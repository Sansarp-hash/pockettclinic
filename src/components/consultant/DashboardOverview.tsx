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
    <div className="space-y-8 animate-in fade-in duration-500">
      <ConsultantStats 
        pendingQueueCount={effectiveConsultations.filter(c => c.status === 'PAID' || c.status === 'PENDING').length}
        patientsSeen={patientsSeen}
        consultant70Earnings={consultant70Earnings}
        averageRating={averageRating}
        isLoading={isLoading}
      />

      {/* Next Consultations Widget */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">Next 3 Upcoming Consultations</h3>
            <p className="text-xs text-slate-700 font-semibold mt-1">Quick-join your scheduled patient virtual meeting rooms</p>
          </div>
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">
            Real-time Queue
          </span>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Calendar className="mx-auto text-slate-500 mb-2" size={32} />
            <p className="text-xs text-slate-700 font-bold uppercase tracking-wider">No Upcoming Consultations</p>
            <p className="text-[11px] text-slate-600 mt-1 font-semibold">Your schedule is currently clear of any active or pending sessions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {upcoming.map((session) => {
              const sessionTime = session.scheduledAt ? new Date(session.scheduledAt) : null;
              const formattedTime = sessionTime 
                ? sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : 'N/A';
              const formattedDate = sessionTime 
                ? sessionTime.toLocaleDateString([], { month: 'short', day: 'numeric' }) 
                : 'N/A';

              return (
                <div 
                  key={session.sessionId}
                  className="bg-slate-50 hover:bg-slate-100/50 p-5 rounded-2xl border border-slate-200/80 transition-all flex flex-col justify-between gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                        session.sessionType === 'VIDEO'
                          ? 'bg-sky-50 text-sky-700 border border-sky-100'
                          : session.sessionType === 'AUDIO_ONLY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}>
                        {session.sessionType === 'VIDEO' && <Video size={10} />}
                        {session.sessionType === 'AUDIO_ONLY' && <PhoneCall size={10} />}
                        {session.sessionType === 'CHAT_ONLY' && <MessageSquare size={10} />}
                        {session.sessionType?.replace('_', ' ')}
                      </span>

                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                        <Clock size={11} className="text-slate-600" />
                        <span>{formattedDate}, {formattedTime}</span>
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-950 text-sm group-hover:text-indigo-600 transition-colors">
                      {session.patientName || 'Anonymous Patient'}
                    </h4>
                    
                    <p className="text-[10px] text-slate-600 font-bold uppercase mt-1">
                      {session.patientGender || 'Unspecified'} • {session.patientAge ? `${session.patientAge} Years` : 'Age N/A'}
                    </p>

                    {session.chiefComplaints && (
                      <p className="text-xs text-slate-700 mt-2 line-clamp-2 italic font-semibold leading-relaxed bg-white p-2 rounded-lg border border-slate-100">
                        "{session.chiefComplaints}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleJoin(session.sessionId)}
                    disabled={isPendingReview}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-2.5 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Video size={12} />
                    <span>Join Room</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
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
