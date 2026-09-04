import React, { useState } from 'react';
import { X, MessageSquare, Send, Paperclip } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FollowUpChatModal({ isOpen, onClose }: Props) {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: '1',
      senderName: 'Clinical Consultant',
      text: 'Hello, please let me know if your symptoms improve after taking the prescribed medication.',
      timestamp: '10:15 AM',
      isMe: false
    }
  ]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        senderName: 'Me',
        text: inputMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true
      }
    ]);
    setInputMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full h-[500px] flex flex-col shadow-2xl border border-slate-200">
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-600" />
            <h3 className="font-extrabold text-base text-slate-800">Follow-Up Consultation Messages</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white">
          {messages.map(m => (
            <div key={m.id} className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-slate-500 font-bold mb-0.5">{m.senderName} • {m.timestamp}</span>
              <div className={`p-3 rounded-2xl max-w-[80%] text-xs font-medium leading-relaxed shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${
                m.isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-3 border-t bg-white flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20/20 focus:outline-none"
          />
          <button type="submit" className="p-2.5 bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
