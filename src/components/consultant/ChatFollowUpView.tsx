import React from 'react';
import { MessageSquare } from 'lucide-react';
import ConsultationChat from '../ConsultationChat';

interface ChatFollowUpViewProps {
  chatSessions: any[];
  selectedChatSessionId: string | null;
  setSelectedChatSessionId: (id: string) => void;
  consultantId: string;
  consultantName: string;
}

export const ChatFollowUpView: React.FC<ChatFollowUpViewProps> = ({
  chatSessions,
  selectedChatSessionId,
  setSelectedChatSessionId,
  consultantId,
  consultantName
}) => {
  const activeSession = chatSessions.find(s => ((s as any).id || s.sessionId) === selectedChatSessionId) || chatSessions[0];
  const currentChatId = activeSession ? ((activeSession as any).id || activeSession.sessionId) : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden min-h-[700px] grid grid-cols-1 md:grid-cols-12">
        {/* Sidebar: Patient List */}
        <div className="md:col-span-4 border-r border-slate-50 bg-slate-50/30 flex flex-col">
          <div className="p-8 border-b border-slate-100 bg-white relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">Clinical Comms</h3>
            </div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Active Patient Dispatches</p>
          </div>

          <div className="p-6 flex-1 overflow-y-auto no-scrollbar space-y-3 relative z-10">
            {chatSessions.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-10 stroke-[1.5]" />
                <p className="text-[11px] font-black uppercase tracking-widest">No Active Threads</p>
              </div>
            ) : (
              chatSessions.map((session) => {
                const sId = (session as any).id || session.sessionId;
                const isSelected = sId === currentChatId;
                return (
                  <button
                    key={sId}
                    onClick={() => setSelectedChatSessionId(sId)}
                    className={`w-full text-left p-6 rounded-[2rem] transition-all duration-300 cursor-pointer border group relative overflow-hidden ${
                      isSelected
                        ? 'bg-slate-950 border-slate-950 text-white shadow-2xl shadow-slate-950/20 scale-[1.02]'
                        : 'bg-white hover:bg-slate-100 border-slate-100 text-slate-900 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 relative z-10">
                      <span className={`font-black text-xs uppercase tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-950 group-hover:text-indigo-600'}`}>
                        {session.patientName || 'Patient User'}
                      </span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {session.status || 'ACTIVE'}
                      </span>
                    </div>
                    <p className={`text-[10px] font-bold leading-relaxed truncate relative z-10 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {(session as any).chiefComplaint || session.chiefComplaints || (session as any).symptoms || 'Clinical Consultation'}
                    </p>
                    <div className={`mt-3 text-[9px] font-black uppercase tracking-widest relative z-10 ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>
                      {(session as any).createdAt ? new Date((session as any).createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Dispatch'}
                    </div>

                    {/* Hover Glow */}
                    {!isSelected && (
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Main Content: Chat Window */}
        <div className="md:col-span-8 flex flex-col bg-white">
          {activeSession && currentChatId ? (
            <div className="flex flex-col h-full min-h-[600px]">
              <div className="p-8 border-b border-slate-50 bg-white flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-black text-slate-950 uppercase tracking-tight">{activeSession.patientName || 'Patient'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      {(activeSession as any).chiefComplaint || activeSession.chiefComplaints || 'Consultation Follow-up'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] bg-slate-50 text-slate-500 font-black px-4 py-2 rounded-full border border-slate-100 uppercase tracking-widest">
                    ID: {currentChatId.slice(0, 8)}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 p-8 bg-slate-50/20">
                <div className="h-full bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/20 overflow-hidden relative">
                  <ConsultationChat
                    consultationId={currentChatId}
                    currentUserId={consultantId}
                    currentUserRole="consultant"
                    currentUserName={consultantName}
                    isCompleted={activeSession.status === 'COMPLETED'}
                    followUpWindowClosesAt={(activeSession as any).followUpWindowClosesAt}
                    followUpMessagesRemaining={(activeSession as any).followUpMessagesRemaining || 5}
                    className="h-full border-0"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-24 text-center">
              <div className="w-24 h-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center mb-8 border border-slate-50 shadow-inner">
                <MessageSquare size={48} className="text-slate-200 stroke-[1.2]" />
              </div>
              <h4 className="text-sm font-black text-slate-950 uppercase tracking-[0.2em]">Secure Messaging Locked</h4>
              <p className="text-[11px] text-slate-400 mt-2 font-bold uppercase tracking-tight">Select a patient dispatch from the ledger to begin care.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
