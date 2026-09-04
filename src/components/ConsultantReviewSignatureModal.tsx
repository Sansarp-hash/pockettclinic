import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, ShieldCheck, FileText, Download, Loader2, Sparkles, AlertCircle, Stethoscope, Printer, Mic, Square, Play, Trash2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAppContext } from '../AppContext';
import { ConsultationSession } from '../types';

interface ConsultantReviewSignatureModalProps {
  consultation: ConsultationSession;
  consultantName: string;
  consultantId: string;
  conversationText?: string;
  recordedAudioBase64?: string | null;
  onClose: () => void;
  onSignedSuccess: () => void;
}

export default function ConsultantReviewSignatureModal({
  consultation,
  consultantName,
  consultantId,
  conversationText,
  recordedAudioBase64,
  onClose,
  onSignedSuccess
}: ConsultantReviewSignatureModalProps) {
  const { showToast } = useAppContext();
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(Boolean(consultation.isConsultantSigned));
  
  // Section states
  const [chiefComplaint, setChiefComplaint] = useState(consultation.chiefComplaints || 'Mild fever and sore throat.');
  const [discussionHistory, setDiscussionHistory] = useState('Patient presented with acute mild symptoms. Evaluated during 15-minute live virtual consultation session.');
  const [suggestedInterventions, setSuggestedInterventions] = useState('Hydration, supportive care, and symptomatic OTC medication.');
  const [nextSteps, setNextSteps] = useState('Monitor temperature for 24-48 hours. Consult a doctor if symptoms escalate.');
  const [consultantFinalNotes, setConsultantFinalNotes] = useState('');
  const [fullSummaryMarkdown, setFullSummaryMarkdown] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice Note Recorder States
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNoteBlob, setVoiceNoteBlob] = useState<Blob | null>(null);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);
  const [isUploadingVoiceNote, setIsUploadingVoiceNote] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setVoiceNoteBlob(blob);
        const url = URL.createObjectURL(blob);
        setVoiceNoteUrl(url);
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      showToast("Microphone access denied or not available.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording && typeof mediaRecorderRef.current.stop === 'function') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("[MediaRecorder] Stop error:", e);
      }
      setIsRecording(false);
    }
  };

  const deleteRecording = () => {
    setVoiceNoteBlob(null);
    setVoiceNoteUrl(null);
  };

  useEffect(() => {
    async function generateStructuredTranscript() {
      setIsGenerating(true);
      try {
        const response = await fetch('/api/ai/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: recordedAudioBase64 || undefined,
            conversationText: conversationText || consultation.clinicalNotes || 'Live session completed.',
            chiefComplaints: consultation.chiefComplaints
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            const res = data.result;
            if (res.chiefComplaint) setChiefComplaint(res.chiefComplaint);
            if (res.discussionHistory) setDiscussionHistory(res.discussionHistory);
            if (res.suggestedInterventions) setSuggestedInterventions(res.suggestedInterventions);
            if (res.nextSteps) setNextSteps(res.nextSteps);
            if (res.formattedSummary) setFullSummaryMarkdown(res.formattedSummary);
          }
        }
      } catch (err) {
        console.warn("Failed to generate AI audio transcript:", err);
      } finally {
        setIsGenerating(false);
      }
    }

    generateStructuredTranscript();
  }, [consultation.sessionId]);

  const handleApproveAndSign = async () => {
    setIsSigning(true);
    setErrorMessage(null);

    try {
      let finalVoiceNoteUrl = null;

      // Upload voice note if recorded
      if (voiceNoteBlob) {
        setIsUploadingVoiceNote(true);
        const storageRef = ref(storage, `consultation_voicenotes/${consultation.sessionId}_${Date.now()}.webm`);
        await uploadBytes(storageRef, voiceNoteBlob);
        finalVoiceNoteUrl = await getDownloadURL(storageRef);
        setIsUploadingVoiceNote(false);
      }

      const now = new Date();
      const followUpExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      const nowISO = now.toISOString();

      const combinedSummary = fullSummaryMarkdown || `
### CLINICAL VISIT SUMMARY
**Chief Complaint:** ${chiefComplaint}
**Discussion & History:** ${discussionHistory}
**Suggested Interventions:** ${suggestedInterventions}
**Next Steps:** ${nextSteps}
`.trim();

      const consultRef = doc(db, 'consultations', consultation.sessionId);
      await updateDoc(consultRef, {
        chiefComplaints: chiefComplaint,
        clinicalNotes: discussionHistory,
        visitSummary: combinedSummary,
        rawTranscript: conversationText || discussionHistory,
        clinicalSummary: combinedSummary,
        isConsultantSigned: true,
        signedByConsultantUid: consultantId,
        signedAt: nowISO,
        status: 'COMPLETED',
        completedAt: nowISO,
        isOnHold: false,
        holdReason: "",
        
        // New post-consultation fields
        consultantVoiceNoteUrl: finalVoiceNoteUrl,
        consultantFinalNotes: consultantFinalNotes.trim() || null,
        followUpWindowClosesAt: followUpExpiry.toISOString(),
        followUpMessagesRemaining: 3
      });

      setIsSigned(true);
      onSignedSuccess();
    } catch (err: any) {
      console.error("Error signing consultation:", err);
      setErrorMessage("Failed to save digital signature and post-consultation data to Firestore.");
    } finally {
      setIsSigning(false);
      setIsUploadingVoiceNote(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-indigo-100 flex items-center justify-center text-slate-800">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-950 text-base md:text-lg">Consultation Review & Digital Signature</h3>
              <p className="text-xs text-slate-700 font-semibold">Verify structured transcript and approve patient visit summary</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-600 hover:text-slate-800 rounded-full hover:bg-slate-50 cursor-pointer transition-colors">
            <X size={20} />
          </button>
        </div>

        {isGenerating ? (
          <div className="py-24 text-center space-y-4 flex-1 flex flex-col justify-center">
            <Loader2 size={36} className="animate-spin text-slate-800 mx-auto" />
            <p className="text-sm font-bold text-slate-950">Structuring Audio Transcript & Visit Summary...</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">Organizing consultation history into Chief Complaint, Discussion, Interventions and Next Steps.</p>
          </div>
        ) : (
          <>
            {/* Scrollable Body Content */}
            <div id="printable-summary" className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-thin">
              
              {/* Header Metadata Badge */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-slate-600 font-black uppercase tracking-wider block text-[9px]">Patient</span>
                  <span className="font-extrabold text-slate-950">{consultation.patientName}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-black uppercase tracking-wider block text-[9px]">Consultant</span>
                  <span className="font-extrabold text-slate-800">{consultantName}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-black uppercase tracking-wider block text-[9px]">Session ID</span>
                  <span className="font-mono text-slate-800 font-bold">{consultation.roomId || consultation.sessionId}</span>
                </div>
              </div>

              {/* Structured 4-Section Edit Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> 1. Chief Complaint
                  </label>
                  <textarea
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    rows={2}
                    className="w-full text-xs font-semibold p-3.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> 2. Discussion & Patient History
                  </label>
                  <textarea
                    value={discussionHistory}
                    onChange={(e) => setDiscussionHistory(e.target.value)}
                    rows={3}
                    className="w-full text-xs font-semibold p-3.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> 3. Suggested Interventions
                  </label>
                  <textarea
                    value={suggestedInterventions}
                    onChange={(e) => setSuggestedInterventions(e.target.value)}
                    rows={2}
                    className="w-full text-xs font-semibold p-3.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> 4. Next Steps
                  </label>
                  <textarea
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    rows={2}
                    className="w-full text-xs font-semibold p-3.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                {/* DYNAMIC ISSUED DIGITAL PRESCRIPTIONS */}
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <FileText size={16} className="text-slate-800" /> Issued Prescription & Medications
                  </h4>

                  {(() => {
                    const { prescriptions } = useAppContext();
                    const sessionRx = (prescriptions || []).find((p: any) => p.sessionId === consultation.sessionId);

                    if (sessionRx) {
                      return (
                        <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl space-y-3 font-semibold">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              Active Digital Rx: <span className="font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md text-[10px] font-bold">{sessionRx.rxId}</span>
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-white border border-emerald-200/50 px-2.5 py-0.5 rounded-full">
                              Verifiable QR Enabled
                            </span>
                          </div>

                          {sessionRx.diagnosisNotes && (
                            <p className="text-xs text-slate-750 font-semibold bg-white p-2.5 rounded-xl border border-slate-100">
                              <span className="font-bold text-slate-950">Diagnosis Notes:</span> {sessionRx.diagnosisNotes}
                            </p>
                          )}

                          <div className="space-y-2">
                            {(sessionRx.medications || []).map((med: any, idx: number) => (
                              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/80 rounded-xl border border-emerald-100/50 text-xs">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-950 text-sm">{med.drugName || med.name}</p>
                                  <p className="text-slate-700 font-semibold">{med.instructions || "No custom instructions provided."}</p>
                                </div>
                                <div className="flex gap-1.5 mt-2 sm:mt-0 flex-wrap">
                                  <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                    {med.dosage}
                                  </span>
                                  <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                    {med.frequency}
                                  </span>
                                  {med.durationDays && (
                                    <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                      {med.durationDays} Days
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-center space-y-1.5">
                        <p className="text-xs font-bold text-slate-800">No active digital prescription has been issued yet.</p>
                        <p className="text-[11px] text-slate-700 max-w-md mx-auto">
                          Tip: If you need to prescribe medication, use the <strong className="text-slate-950">Prescriptions</strong> tab in the consultation room to generate a QR-secured Rx slip before closing out.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* POST-CONSULTATION VOICE NOTE & TEXT INSTRUCTIONS */}
                <div className="pt-4 border-t border-slate-100 space-y-6">
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-indigo-100/55">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Sparkles size={16} className="text-slate-800" /> Consultant Care Takeaways & Voice Note
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-800 uppercase tracking-widest mb-1.5">Patient Care Instructions (Takeaway Text)</label>
                        <textarea
                          value={consultantFinalNotes}
                          onChange={(e) => setConsultantFinalNotes(e.target.value)}
                          placeholder="E.g., Take 1 tab every 8 hours after meals. Avoid cold drinks. Call if fever persists."
                          rows={3}
                          className="w-full text-xs font-semibold p-4 bg-white border border-indigo-100/60 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-700"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-white">
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-1">Dosage Reminders / Audio Care Note</p>
                          <p className="text-xs text-slate-700 font-semibold">Record a quick audio note for the patient to listen to.</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {!voiceNoteUrl ? (
                            isRecording ? (
                              <button
                                onClick={stopRecording}
                                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all animate-pulse cursor-pointer"
                              >
                                <Square size={14} /> Stop Recording
                              </button>
                            ) : (
                              <button
                                onClick={startRecording}
                                className="bg-slate-950 hover:bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all shadow-sm cursor-pointer"
                              >
                                <Mic size={14} /> Record Audio
                              </button>
                            )
                          ) : (
                            <div className="flex items-center gap-2">
                              <audio src={voiceNoteUrl} controls className="h-8 w-44" />
                              <button
                                onClick={deleteRecording}
                                className="p-2 text-slate-600 hover:text-rose-500 transition-colors cursor-pointer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* OCR Extracted Reference if present */}
              {consultation.ocrExtractedText && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs">
                  <p className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">Attached OCR Document Reference</p>
                  <p className="text-slate-950 mt-1 font-mono text-[11px] truncate">{consultation.ocrExtractedText}</p>
                </div>
              )}

              {/* Digital Signature Box / Stamp (INTERACTIVE & CLICKABLE) */}
              <div 
                onClick={!isSigned && !isSigning ? handleApproveAndSign : undefined}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
                  isSigned 
                    ? 'bg-emerald-50/80 border-emerald-200' 
                    : 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer active:scale-[0.99] shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black flex-shrink-0">
                    <Stethoscope size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      Consultant Digital Verification Stamp
                      {!isSigned && <span className="bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md animate-pulse">CLICK TO SIGN</span>}
                    </p>
                    <p className="text-[11px] text-emerald-800 font-semibold">Signed by: {consultantName} ({consultantId.substring(0, 8)})</p>
                  </div>
                </div>
                <span className={`text-[10px] uppercase font-extrabold tracking-wider px-3.5 py-1.5 rounded-full transition-all ${
                  isSigned 
                    ? 'bg-emerald-200 text-emerald-900' 
                    : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 animate-pulse'
                }`}>
                  {isSigned ? 'VERIFIED & SIGNED' : 'SIGN NOW'}
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* STICKY FOOTER ACTIONS PANEL */}
            <div className="p-6 border-t border-slate-100 flex-shrink-0 bg-slate-50/80 backdrop-blur-xs rounded-b-[28px] flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-3.5 bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold rounded-2xl border border-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Printer size={16} />
                <span>Print PDF Summary</span>
              </button>

              {!isSigned ? (
                <button
                  type="button"
                  onClick={handleApproveAndSign}
                  disabled={isSigning}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3.5 px-6 rounded-2xl transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSigning ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Signing & Saving to History...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Approve & Digitally Sign Visit Summary</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-600 text-white text-xs font-bold py-3.5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={18} />
                  <span>Done • Return to Dashboard</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
