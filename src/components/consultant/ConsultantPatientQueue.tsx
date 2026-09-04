import React from 'react';
import { Calendar, UserCircle, Clock, CheckCircle2, FileText, Video, PhoneCall } from 'lucide-react';
import { TableSkeleton } from '../Skeleton';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import { XCircle, CheckSquare } from 'lucide-react';
import { acceptConsultation, declineOrForwardConsultation } from '../../lib/consultationDispatch';

interface ConsultantPatientQueueProps {
  currentConsultantId?: string;
  onDeclineAndForward?: (sessionId: string) => void;
  onAcceptBroadcast?: (sessionId: string) => void;
  consultations: any[];
  isPendingReview: boolean;
  onOpenHistory: (patient: { id: string; name: string }) => void;
  onJoinSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export const ConsultantPatientQueue: React.FC<ConsultantPatientQueueProps> = ({
  consultations,
  isPendingReview,
  onOpenHistory,
  onJoinSession,
  currentConsultantId,
  onDeclineAndForward,
  onAcceptBroadcast,
  isLoading
}) => {
  const navigate = useNavigate();
  const { user, showToast } = useAppContext();

  const handleAcceptBroadcastNatively = async (sessionId: string) => {
    if (onAcceptBroadcast) {
      onAcceptBroadcast(sessionId);
      return;
    }
    
    if (!user) return;
    
    try {
      const consultantName = user.displayName || user.fullName || 'Consultant';
      await acceptConsultation(sessionId, user.uid, consultantName);
      showToast('Call accepted. Entering consultation room...', 'success');
      navigate(`/consultation/${sessionId}`);
    } catch (err: any) {
      console.error('Accept broadcast error:', err);
      showToast(err.message || 'Failed to accept broadcast call', 'error');
    }
  };

  const handleDeclineNatively = async (sessionId: string) => {
    if (onDeclineAndForward) {
      onDeclineAndForward(sessionId);
      return;
    }
    if (!user) return;
    try {
      await declineOrForwardConsultation(sessionId, user.uid);
      showToast('Consultation declined and forwarded.', 'info');
    } catch (err: any) {
      console.error('Decline error:', err);
      showToast(err.message || 'Failed to decline consultation', 'error');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-white">
        <h3 className="text-lg font-black tracking-tight text-slate-800">Current Queue</h3>
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : consultations.length === 0 ? (
        <div className="p-20 text-center flex flex-col items-center">
          <Calendar size={48} className="text-slate-500 mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No Active Consultations</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {consultations.map(c => (
            <li key={c.sessionId} className="p-4 md:p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-600 shrink-0 border border-slate-100">
                  <UserCircle size={20} className="md:w-6 md:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-800 text-sm md:text-base truncate">{c.patientName}</h4>
                    {c.dispatchStatus === 'ringing' && (
                      <span className="bg-rose-600 text-white text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <PhoneCall size={10} /> Ringing
                      </span>
                    )}
                    {c.status === 'PENDING' ? (
                      <span className="bg-amber-100 text-amber-700 text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                        <Clock size={10} /> Unpaid
                      </span>
                    ) : c.status !== 'CANCELLED' ? (
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                        <CheckCircle2 size={10} /> Paid
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-3 text-[10px] md:text-xs text-slate-500 mt-1 font-bold items-center flex-wrap uppercase tracking-tighter md:tracking-normal">
                    <span className="flex items-center gap-1"><Calendar size={12}/> {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString() : 'Today'}</span>
                    <span className="flex items-center gap-1"><Clock size={12}/> {c.scheduledAt ? new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => onOpenHistory({ id: c.patientId, name: c.patientName })}
                  className="p-2.5 md:p-3 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm"
                  title="Patient History"
                >
                  <FileText size={16} className="md:w-[18px] md:h-[18px]" />
                </button>
                
                {((c.dispatchStatus === 'ringing' || c.dispatchStatus === 're-routing' || c.dispatchStatus === 'escalated') && 
                  (!c.assignedConsultantId || c.assignedConsultantId === currentConsultantId) && 
                  (c.status === 'PAID' || c.status === 'PENDING' || c.status === 'ACCEPTED') && 
                  c.dispatchStatus !== 'accepted') ? (
                  <button 
                    onClick={() => handleAcceptBroadcastNatively(c.sessionId)}
                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <CheckSquare size={14} className="md:w-4 md:h-4" /> 
                    <span>{c.assignedConsultantId ? 'Accept Consultation' : 'Accept Broadcast'}</span>
                  </button>
                ) : (c.assignedConsultantId === currentConsultantId && (c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.dispatchStatus === 'accepted')) && (
                  <button 
                    onClick={() => onJoinSession(c.sessionId)}
                    disabled={isPendingReview}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Video size={14} className="md:w-4 md:h-4" />
                    <span>Join Room</span>
                  </button>
                )}
                
                {(c.status === 'PAID' || c.status === 'PENDING') && (c.consultantId === currentConsultantId || c.assignedConsultantId === currentConsultantId || !c.assignedConsultantId) && (c.dispatchStatus === 'ringing' || c.dispatchStatus === 're-routing' || c.dispatchStatus === 'escalated' || !c.dispatchStatus) && (
                  <button 
                    onClick={() => handleDeclineNatively(c.sessionId)}
                    className="p-2.5 md:p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors border border-rose-100 shadow-sm cursor-pointer"
                    title="Decline & Forward"
                  >
                    <XCircle size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                )}
                {c.status === 'COMPLETED' && (
                  <span className="text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-200">Session Complete</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ConsultantPatientQueue;
