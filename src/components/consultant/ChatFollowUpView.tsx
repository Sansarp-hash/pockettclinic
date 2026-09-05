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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] grid grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-4 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="p-5 border-b border-slate-200 bg-white">
            <h3 className="font-bold text-slate-950 text-base flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-600" />
              Patient Messages & Follow-ups
            </h3>
            <p className="text-xs text-slate-700 mt-1">Direct communication threads for ongoing care and follow-ups.</p>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-2">
            {chatSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-600">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">No patient message threads found.</p>
              </div>
            ) : (
              chatSessions.map((session) => {
                const sId = (session as any).id || session.sessionId;
                const isSelected = sId === currentChatId;
                return (
                  <button
                    key={sId}
                    onClick={() => setSelectedChatSessionId(sId)}
                    className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/10'
                        : 'bg-white hover:bg-slate-100/80 text-slate-900 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-950'}`}>
                        {session.patientName || 'Patient'}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {session.status || 'ACTIVE'}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${isSelected ? 'text-indigo-100' : 'text-slate-700'}`}>
                      {(session as any).chiefComplaint || session.chiefComplaints || (session as any).symptoms || 'General Consultation'}
                    </p>
                    <div className="mt-2 text-[10px] opacity-75 font-semibold">
                      {(session as any).createdAt ? new Date((session as any).createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="md:col-span-8 flex flex-col bg-white">
          {activeSession && currentChatId ? (
            <div className="flex flex-col h-full min-h-[550px]">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-950 text-sm">{activeSession.patientName || 'Patient'}</h4>
                  <p className="text-xs text-slate-700">{(activeSession as any).chiefComplaint || activeSession.chiefComplaints || 'Consultation Follow-up'}</p>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full border border-indigo-100">
                  Ref: {currentChatId.slice(0, 8)}
                </span>
              </div>
              <div className="flex-1 p-4 bg-slate-50/30">
                <ConsultationChat
                  consultationId={currentChatId}
                  currentUserId={consultantId}
                  currentUserRole="consultant"
                  currentUserName={consultantName}
                  isCompleted={activeSession.status === 'COMPLETED'}
                  followUpWindowClosesAt={(activeSession as any).followUpWindowClosesAt}
                  followUpMessagesRemaining={(activeSession as any).followUpMessagesRemaining || 5}
                  className="h-full border border-slate-200 rounded-2xl shadow-sm bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-600">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-semibold">Select a patient thread from the left to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
