import React, { useState } from 'react';
import { Video, User, Stethoscope, MapPin, Eye, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Skeleton } from '../Skeleton';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface AdminSessionHistoryProps {
  activeSessions: any[];
  onInspectSession: (session: any) => void;
  isLoading?: boolean;
}

export default function AdminSessionHistory({
  activeSessions,
  onInspectSession,
  isLoading
}: AdminSessionHistoryProps) {
  const { showToast } = useAppContext();
  const [sessionToEnd, setSessionToEnd] = useState<any | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const confirmEndSession = async () => {
    if (!sessionToEnd) return;
    const sId = sessionToEnd.sessionId || sessionToEnd.id;
    if (!sId) return;

    setIsEnding(true);
    try {
      const docRef = doc(db, 'consultations', sId);
      await updateDoc(docRef, {
        status: 'CANCELLED',
        dispatchStatus: 'cancelled',
        updatedAt: new Date().toISOString()
      });
      setToastMessage(`Session ${sId.slice(0, 8)} terminated successfully.`);
      setSessionToEnd(null);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Firestore update failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, `consultations/${sId}`);
      showToast('Failed to end session: ' + err.message, "error");
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-600 text-white font-bold text-xs flex items-center justify-between gap-2 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-600 hover:opacity-80 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {sessionToEnd && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">End Live Consultation?</h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to forcibly terminate session <strong className="text-slate-800">{sessionToEnd.sessionId || sessionToEnd.id}</strong> between <span className="font-bold">{sessionToEnd.patientName || 'Patient'}</span> and <span className="font-bold">{sessionToEnd.consultantName || 'Doctor'}</span>?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessionToEnd(null)}
                disabled={isEnding}
                className="flex-1 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEndSession}
                disabled={isEnding}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {isEnding ? 'Terminating...' : 'Yes, End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 md:p-8 border-b border-slate-200">
        <h3 className="text-xl font-black tracking-tight text-slate-800">Active Consultations / Live Sessions</h3>
        <p className="text-xs text-slate-600 mt-1">Real-time oversight of ongoing consultations. Inspect active rooms for compliance.</p>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-slate-200 rounded-2xl bg-white p-5 space-y-4">
              <Skeleton className="h-6 w-1/3 rounded-full" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : activeSessions.length === 0 ? (
        <div className="p-12 text-center text-slate-600">
          <Video size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">No active live sessions at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {activeSessions.map(session => (
            <div key={session.sessionId || session.id} className="border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col hover:border-slate-300 transition-all">
              <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                <span className={`${
                  session.dispatchStatus === 'ringing' || session.status === 'PAID' || session.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                } text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    session.dispatchStatus === 'ringing' || session.status === 'PAID' || session.status === 'PENDING'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500 animate-pulse'
                  }`} />
                  {session.dispatchStatus === 'ringing' || session.status === 'PAID' || session.status === 'PENDING' ? 'RINGING' : 'LIVE'} ({session.sessionType || 'VIDEO'})
                </span>
                <span className="text-xs font-mono text-slate-500">ID: {(session.sessionId || session.id || '').slice(0, 6)}</span>
              </div>
              <div className="p-5 flex-1 space-y-4">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Participants</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-indigo-100">
                        <User size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-800">{session.patientName || 'Patient'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                        <Stethoscope size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-800">{session.consultantName || 'Doctor'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Status</p>
                    <div className="text-xs font-bold text-slate-600 capitalize">{(session.status || '').toLowerCase()}</div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Room</p>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <MapPin size={12} className="text-slate-500" /> {session.roomId || 'Internal'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => onInspectSession(session)}
                  className="flex-1 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-white text-slate-800 font-bold text-xs rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye size={14} /> Inspect
                </button>
                <button
                  type="button"
                  onClick={() => setSessionToEnd(session)}
                  className="py-2 px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Forcibly end this live consultation"
                >
                  <Trash2 size={14} /> End
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
