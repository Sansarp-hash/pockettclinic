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
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="p-2.5 border-b border-slate-50 bg-white flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-black tracking-tight text-slate-950 uppercase">Patient Queue</h3>
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Live Management</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100">
          <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Active</span>
        </div>
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : consultations.length === 0 ? (
        <div className="p-6 text-center flex flex-col items-center">
          <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 mb-2 border border-slate-100">
            <Calendar size={14} />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Queue is empty</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {consultations.map(c => (
            <li key={c.sessionId} className="p-2.5 hover:bg-slate-50/50 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-950 shrink-0 border border-slate-200">
                  <UserCircle size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <h4 className="font-black text-slate-950 text-[10px] uppercase tracking-tight truncate">{c.patientName}</h4>
                    {c.dispatchStatus === 'ringing' && (
                      <span className="bg-rose-600 text-white text-[6px] font-black px-1 py-0.5 rounded-full animate-pulse uppercase tracking-widest flex items-center gap-0.5 shadow-md shadow-rose-600/20">
                        <PhoneCall size={6} /> Ringing
                      </span>
                    )}
                    {c.status === 'PENDING' ? (
                      <span className="bg-amber-100 text-amber-700 text-[6px] font-black px-1 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5 border border-amber-200">
                        <Clock size={6} /> Unpaid
                      </span>
                    ) : c.status !== 'CANCELLED' ? (
                      <span className="bg-emerald-50 text-emerald-700 text-[6px] font-black px-1 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5 border border-emerald-100">
                        <CheckCircle2 size={6} /> Paid
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-1.5 text-[7px] text-slate-400 font-black uppercase tracking-wider items-center flex-wrap">
                    <span className="flex items-center gap-0.5"><Calendar size={8}/> {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString() : 'Today'}</span>
                    <span className="flex items-center gap-0.5"><Clock size={8}/> {c.scheduledAt ? new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => onOpenHistory({ id: c.patientId, name: c.patientName })}
                  className="p-1.5 bg-white text-slate-600 rounded-lg hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
                  title="Patient History"
                >
                  <FileText size={12} />
                </button>
                
                {((c.dispatchStatus === 'ringing' || c.dispatchStatus === 're-routing' || c.dispatchStatus === 'escalated') && 
                  (!c.assignedConsultantId || c.assignedConsultantId === currentConsultantId) && 
                  (c.status === 'PAID' || c.status === 'PENDING' || c.status === 'ACCEPTED') && 
                  c.dispatchStatus !== 'accepted') ? (
                  <button 
                    onClick={() => handleAcceptBroadcastNatively(c.sessionId)}
                    className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest shadow-md flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <CheckSquare size={10} /> 
                    <span>{c.assignedConsultantId ? 'Accept' : 'Accept Broadcast'}</span>
                  </button>
                ) : (c.assignedConsultantId === currentConsultantId && (c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.dispatchStatus === 'accepted')) && (
                  <button 
                    onClick={() => onJoinSession(c.sessionId)}
                    disabled={isPendingReview}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-2.5 py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest shadow-md flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <Video size={10} />
                    <span>Enter Room</span>
                  </button>
                )}
                
                {(c.status === 'PAID' || c.status === 'PENDING') && (c.consultantId === currentConsultantId || c.assignedConsultantId === currentConsultantId || !c.assignedConsultantId) && (c.dispatchStatus === 'ringing' || c.dispatchStatus === 're-routing' || c.dispatchStatus === 'escalated' || !c.dispatchStatus) && (
                  <button 
                    onClick={() => handleDeclineNatively(c.sessionId)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-lg transition-all border border-rose-100 shadow-sm active:scale-95 cursor-pointer"
                    title="Decline & Forward"
                  >
                    <XCircle size={12} />
                  </button>
                )}
                {c.status === 'COMPLETED' && (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest border border-emerald-100">Complete</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) }
    </div>

  );
};

export default ConsultantPatientQueue;
