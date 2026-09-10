import React from 'react';
import { Calendar, Video, Clock, PhoneCall, MessageSquare } from 'lucide-react';
import { ConsultantStats } from './ConsultantStats';
import { ConsultantPatientQueue } from './ConsultantPatientQueue';

interface DashboardOverviewProps {
  effectiveConsultations: any[];
  patientsSeen: number;
  consultant70Earnings: number;
  averageRating: string;
  isLoading: boolean;
  isPendingReview: boolean;
  consultantId: string;
  isStaleSession: (session: any) => boolean;
  handleJoin: (sessionId: string) => void;
  onOpenHistory: (patient: { id: string; name: string }) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  effectiveConsultations,
  patientsSeen,
  consultant70Earnings,
  averageRating,
  isLoading,
  isPendingReview,
  consultantId,
  isStaleSession,
  handleJoin,
  onOpenHistory
}) => {
  const upcoming = [...effectiveConsultations]
    .filter(c => (c.status === 'IN_PROGRESS' || c.status === 'ACTIVE') && (c.consultantId === consultantId || c.assignedConsultantId === consultantId) && !isStaleSession(c))
    .sort((a, b) => {
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return dateA - dateB;
    })
    .slice(0, 3);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <ConsultantStats 
        pendingQueueCount={effectiveConsultations.filter(c => c.status === 'PAID' || c.status === 'PENDING').length}
        patientsSeen={patientsSeen}
        consultant70Earnings={consultant70Earnings}
        averageRating={averageRating}
        isLoading={isLoading}
      />

      {/* Next Consultations Widget */}
      <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 relative z-10">
          <div>
            <h3 className="text-[10px] font-black text-slate-950 uppercase tracking-tight">Active Room Monitor</h3>
            <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Real-time scheduling access</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100 self-start sm:self-auto">
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Live Sync</span>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-center py-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 relative z-10">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-300 mx-auto mb-2 shadow-sm">
              <Calendar size={14} />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[8px] italic">Schedule is clear</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 relative z-10">
            {upcoming.map((session) => {
              const sessionTime = session.scheduledAt ? new Date(session.scheduledAt) : null;
              const formattedTime = sessionTime 
                ? sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : 'Now';
              const formattedDate = sessionTime 
                ? sessionTime.toLocaleDateString([], { month: 'short', day: 'numeric' }) 
                : 'Today';

              return (
                <div 
                   key={session.sessionId}
                  className="bg-white hover:bg-slate-50 p-3 rounded-lg border border-slate-100 transition-all duration-300 flex flex-col justify-between gap-2.5 group/card shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`p-1 rounded-lg ${
                        session.sessionType === 'VIDEO'
                          ? 'bg-sky-50 text-sky-600'
                          : session.sessionType === 'AUDIO_ONLY'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {session.sessionType === 'VIDEO' && <Video size={10} />}
                        {session.sessionType === 'AUDIO_ONLY' && <PhoneCall size={10} />}
                        {session.sessionType === 'CHAT_ONLY' && <MessageSquare size={10} />}
                      </div>

                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[8px] font-black text-slate-950 uppercase tracking-widest">{formattedTime}</span>
                        <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">{formattedDate}</span>
                      </div>
                    </div>

                    <h4 className="font-black text-slate-950 text-[10px] uppercase tracking-tight group-hover/card:text-emerald-600 transition-colors truncate">
                      {session.patientName || 'Anonymous Patient'}
                    </h4>
                    
                    <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest mt-0.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      {session.patientGender || 'Unspecified'} • {session.patientAge ? `${session.patientAge} Y` : 'Age N/A'}
                    </p>

                    {session.chiefComplaints && (
                      <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100 italic">
                        <p className="text-[8px] text-slate-600 font-bold leading-tight line-clamp-2">
                          "{session.chiefComplaints}"
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleJoin(session.sessionId)}
                    disabled={isPendingReview}
                    className="w-full bg-slate-950 hover:bg-slate-800 disabled:bg-slate-200 text-white py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Video size={10} />
                    <span>Enter Room</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Background Decorative Accent */}
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:bg-emerald-50 transition-all duration-700" />
      </div>

      <ConsultantPatientQueue 
        consultations={effectiveConsultations}
        isPendingReview={isPendingReview}
        onOpenHistory={onOpenHistory}
        onJoinSession={handleJoin}
        isLoading={isLoading}
      />
    </div>
  );
};
