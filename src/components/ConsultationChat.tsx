import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, setDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useAppContext } from '../AppContext';
import { ConsultationChatMessage } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Send, Paperclip, Loader2, Lock, User, Stethoscope, Image, FileText, Download, Sparkles, Clock, Mic, MicOff, Languages } from 'lucide-react';

interface ConsultationChatProps {
  consultationId: string;
  currentUserId: string;
  currentUserRole: 'patient' | 'consultant';
  currentUserName: string;
  isCompleted?: boolean;
  className?: string;
  followUpWindowClosesAt?: string | null;
  followUpMessagesRemaining?: number;
}

const generateId = () => Math.random().toString(36).substring(2, 9).toUpperCase();

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function ConsultationChat({
  consultationId,
  currentUserId,
  currentUserRole,
  currentUserName,
  isCompleted = false,
  className = '',
  followUpWindowClosesAt,
  followUpMessagesRemaining = 0
}: ConsultationChatProps) {
  const { showToast } = useAppContext();
  const [messages, setMessages] = useState<ConsultationChatMessage[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [targetLang, setTargetLang] = useState('English');
  const [isListening, setIsListening] = useState(false);
  const [isMediaRecording, setIsMediaRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setText(prev => (prev.trim() ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition warning:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            showToast('Microphone access denied. Please enable permissions to use dictation or enter text manually.', "error");
          } else if (event.error === 'network') {
            showToast('Speech recognition network error occurred. Please check your internet connection or use manual keyboard entry.', "error");
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    } catch (e) {
      console.warn("Speech recognition initialization failed:", e);
    }

    return () => {
      if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn("Speech recognition cleanup failed:", e);
        }
      }
    };
  }, []);

  const toggleDictation = async () => {
    try {
      if (isListening || isMediaRecording) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive' && typeof mediaRecorderRef.current.stop === 'function') {
          try {
            mediaRecorderRef.current.stop();
          } catch (e) {
            console.warn('MediaRecorder stop error:', e);
          }
        }
        if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
          try {
            recognitionRef.current.stop();
          } catch (err) {
            console.warn('Recognition stop error:', err);
          }
        }
        setIsMediaRecording(false);
        setIsListening(false);
        return;
      }

      // Explicitly request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (recognitionRef.current) {
        // If native Speech Recognition is available, stop the audio stream so it can handle the input natively
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
        setIsListening(true);
        recognitionRef.current.start();
      } else {
        // Standard media recording fallback
        audioChunksRef.current = [];
        let mediaRecorder;
        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        } catch (e) {
          mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          stream.getTracks().forEach(track => {
            if (track && typeof track.stop === 'function') {
              track.stop();
            }
          });

          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const base64data = reader.result as string;
              const res = await fetch('/api/ai/speech-translate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  audioBase64: base64data,
                  mimeType: mediaRecorder.mimeType,
                  targetLang: targetLang
                })
              });
              const data = await res.json();
              if (data.success && data.originalTranscript) {
                setText(prev => prev.trim() ? `${prev} ${data.originalTranscript}` : data.originalTranscript);
              }
            } catch (err) {
              console.error("Audio translation failed:", err);
            }
          };
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsMediaRecording(true);
        setIsListening(true);
      }
    } catch (err) {
      console.error("Microphone access failed:", err);
      showToast("Microphone permission was denied or failed to initialize.", "error");
      setIsListening(false);
      setIsMediaRecording(false);
    }
  };

  // Determine if we are in an active follow-up window
  const isFollowUpWindowOpen = followUpWindowClosesAt 
    ? new Date(followUpWindowClosesAt).getTime() > Date.now() 
    : false;
  
  const canSendMessages = !isCompleted || (isFollowUpWindowOpen && followUpMessagesRemaining > 0);

  useEffect(() => {
    if (!consultationId) return;

    // Listen to real-time sub-collection: consultations/{consultationId}/messages
    const messagesRef = collection(db, 'consultations', consultationId, 'messages');
    const q = query(messagesRef);

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ConsultationChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ messageId: doc.id, ...doc.data() } as ConsultationChatMessage);
      });
      // Sort chronologically by timestamp
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `consultations/${consultationId}/messages`);
    });

    return () => unsub();
  }, [consultationId]);

  const handleSendMessage = async (e?: React.FormEvent, attachmentUrl?: string) => {
    if (e) e.preventDefault();
    if ((!text.trim() && !attachmentUrl) || !canSendMessages || isSending) return;

    const currentText = text.trim();
    if (!attachmentUrl) setText('');
    setIsSending(true);

    try {
      const msgId = generateId();
      const newMessage: ConsultationChatMessage = {
        messageId: msgId,
        consultationId,
        senderId: currentUserId,
        senderRole: currentUserRole,
        senderName: currentUserName || (currentUserRole === 'consultant' ? 'Doctor' : 'Patient'),
        text: attachmentUrl ? '' : currentText,
        attachmentUrl: attachmentUrl || '',
        timestamp: new Date().toISOString(),
      };

      
      try {
        await setDoc(doc(db, 'consultations', consultationId, 'messages', msgId), newMessage);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `consultations/${consultationId}/messages/${msgId}`);
      }
      
      // Trigger Notification to the other party
      const notifyOtherParty = async () => {
        try {
          const consDoc = await getDoc(doc(db, 'consultations', consultationId));
          if (consDoc.exists()) {
            const data = consDoc.data();
            const targetUid = currentUserRole === 'patient' ? data.assignedConsultantId : data.patientId;
            if (targetUid) {
              await fetch('/api/notifications/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
                body: JSON.stringify({
                  targetUid,
                  title: `New Message from ${currentUserName}`,
                  body: attachmentUrl ? 'Sent an attachment' : currentText,
                  actionType: 'new_message',
                  targetPath: `/consultation/${consultationId}`
                })
              }).then(async res => {
                if (!res.ok) {
                  const errorText = await res.text();
                  console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
                }
              }).catch(e => console.error("Failed to trigger message push:", e));
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `consultations/${consultationId}`);
        }
      };

      notifyOtherParty();


      // Decrement follow-up count if this is a completed session message
      if (isCompleted && isFollowUpWindowOpen && currentUserRole === 'patient') {
        const consRef = doc(db, 'consultations', consultationId);
        try {
          await updateDoc(consRef, {
            followUpMessagesRemaining: increment(-1)
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `consultations/${consultationId}`);
        }
      }
    } catch (err) {
      console.error("Error sending consultation message:", err);
      if (!attachmentUrl) setText(currentText);
    } finally {
      setIsSending(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canSendMessages) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file || isCompleted) return;

    try {
      setIsUploading(true);
      const storageRef = ref(storage, `consultation_attachments/${consultationId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await handleSendMessage(undefined, url);

      // If it's an image, trigger automatic AI analysis
      if (file.type.startsWith('image/')) {
        try {
          const res = await fetch('/api/ai/analyze-medical-doc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: url, docType: 'prescription' })
          });
          const data = await res.json();
          if (data.success && data.analysis) {
            const msgId = generateId();
            await setDoc(doc(db, 'consultations', consultationId, 'messages', msgId), {
              messageId: msgId,
              consultationId,
              senderId: 'ai-system',
              senderRole: 'system',
              senderName: 'Clinical AI Assistant',
              text: `📋 **Automatic AI Analysis:**\n\n${data.analysis}`,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error("AI Auto-analysis failed:", err);
        }
      }
    } catch (err) {
      console.error("Failed to upload chat file attachment:", err);
      showToast("Failed to upload attachment. Please try again.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canSendMessages) return;
    
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-full bg-white relative rounded-2xl overflow-hidden border border-slate-200 ${className} ${isDragging ? 'ring-4 ring-emerald-500/30 ring-inset bg-emerald-50/50' : ''}`}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600/10 backdrop-blur-sm pointer-events-none">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border-2 border-emerald-500 border-dashed animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <Paperclip size={32} />
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-slate-800">Drop Medical Document</p>
              <p className="text-sm text-slate-500">Image will be scanned automatically by AI</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner if Completed */}
      {isCompleted && (
        <div className={`px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-b ${
          isFollowUpWindowOpen && followUpMessagesRemaining > 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {isFollowUpWindowOpen && followUpMessagesRemaining > 0 ? (
            <>
              <Sparkles size={14} className="text-emerald-600 shrink-0" />
              <span>Follow-up Window Open • {followUpMessagesRemaining} clarification questions remaining</span>
            </>
          ) : (
            <>
              <Lock size={14} className="text-amber-600 shrink-0" />
              <span>Consultation Completed • Transcript preserved in read-only mode</span>
            </>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto bg-white/50">
        {messages.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-500 mb-3">
              <Stethoscope size={22} />
            </div>
            <p className="text-sm font-bold text-slate-600">No conversation messages yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {isCompleted ? 'No message transcript recorded for this session.' : 'Send a secure message to start real-time consultation chat.'}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUserId;
            const isDoctor = msg.senderRole === 'consultant';

            return (
              <div
                key={msg.messageId || idx}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-slate-500 px-1">
                  {isDoctor ? (
                    <span className="flex items-center gap-1 text-slate-600 font-bold bg-slate-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      <Stethoscope size={10} /> {msg.senderName} (Doctor)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                      <User size={10} /> {msg.senderName}
                    </span>
                  )}
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div
                  className={`p-3.5 text-sm max-w-[85%] md:max-w-[75%] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-xs'
                      : isDoctor
                      ? 'bg-slate-50/90 text-slate-800 border border-indigo-100 rounded-2xl rounded-tl-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-xs'
                  }`}
                >
                  {msg.text && <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>}

                  {msg.attachmentUrl && (
                    <div className="mt-2 pt-2 border-t border-black/10">
                      {(msg.attachmentUrl && msg.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i)) || (msg.attachmentUrl || '').includes('image') ? (
                        <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block group">
                          <img
                            src={msg.attachmentUrl}
                            alt="Attachment"
                            className="max-w-full rounded-xl max-h-56 object-cover border border-slate-200 hover:opacity-95 transition-opacity"
                          />
                          <span className="text-xs flex items-center gap-1 mt-1 font-bold underline opacity-90">
                            <Image size={12} /> View Full Image
                          </span>
                        </a>
                      ) : (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-xs font-bold"
                        >
                          <FileText size={16} />
                          <span className="truncate flex-1">Attached Document</span>
                          <Download size={14} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      {canSendMessages ? (
        <div className="p-3 border-t border-slate-200 bg-white">
          <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending}
              title="Attach File / Lab Image"
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin text-slate-600" /> : <Paperclip size={18} />}
            </button>

            <button
              type="button"
              onClick={toggleDictation}
              disabled={isSending || isUploading}
              title="Dictate Message (Speech-to-Text & Live Translation)"
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center relative cursor-pointer ${
                isListening 
                  ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-500 ring-offset-1' 
                  : 'bg-white hover:bg-slate-50 text-slate-600'
              }`}
            >
              {isListening && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              )}
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <div className="relative flex items-center">
              <Languages size={14} className="absolute left-2 text-slate-400 pointer-events-none" />
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="Target Language for Voice Dictation & AI Speech Translation"
              >
                <option value="English">English</option>
                <option value="Twi">Twi</option>
                <option value="French">French</option>
                <option value="Spanish">Spanish</option>
                <option value="Hausa">Hausa</option>
                <option value="Yoruba">Yoruba</option>
                <option value="Ga">Ga</option>
              </select>
            </div>

            <input
              type="text"
              placeholder={isCompleted ? "Type your follow-up question..." : "Type your message..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
            />

            <button
              type="submit"
              disabled={isSending || (!text.trim() && !isUploading)}
              className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-50 disabled:text-slate-500 text-slate-600 font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
          {isCompleted && (
            <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center justify-center gap-1">
              <Clock size={10} /> 24h Medication Clarification Window Active
            </p>
          )}
        </div>
      ) : (
        <div className="p-3 border-t border-slate-200 bg-white text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5">
          <Lock size={12} /> {isFollowUpWindowOpen && followUpMessagesRemaining === 0 ? 'Follow-up message limit reached' : 'Chat disabled for completed session'}
        </div>
      )}
    </div>
  );
}
