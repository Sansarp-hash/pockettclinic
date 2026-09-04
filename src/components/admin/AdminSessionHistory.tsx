import React, { useState } from 'react';
import { Video, User, Stethoscope, MapPin, Eye, Trash2, AlertTriangle, CheckCircle2, X, CheckSquare, Square } from 'lucide-react';
import { Skeleton } from '../Skeleton';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isEndingBulk, setIsEndingBulk] = useState(false);
  
  const [sessionToEnd, setSessionToEnd] = useState<any | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Categorize Sessions
  const activeOngoing = activeSessions.filter(s => {
    const elapsedMins = s.createdAt ? (Date.now() - new Date(s.createdAt).getTime()) / 60000 : 0;
    return !s.isOnHold && s.status === 'IN_PROGRESS' && elapsedMins < 45;
  });

  const onHold = activeSessions.filter(s => s.isOnHold);

  const idleGhost = activeSessions.filter(s => {
    const isRingingOrPaid = s.dispatchStatus === 'ringing' || s.status === 'PAID' || s.status === 'PENDING';
    const elapsedMins = s.createdAt ? (Date.now() - new Date(s.createdAt).getTime()) / 60000 : 0;
    
    if (isRingingOrPaid && elapsedMins > 2) return true;
    if (s.status === 'IN_PROGRESS' && elapsedMins >= 45) return true;
    
    return false;
  });

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedSessionIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSessionIds(newSet);
  };

  const toggleSelectAll = (categoryList: any[]) => {
    const allSelected = categoryList.every(s => selectedSessionIds.has(s.sessionId || s.id));
    const newSet = new Set(selectedSessionIds);
    if (allSelected) {
      categoryList.forEach(s => newSet.delete(s.sessionId || s.id));
    } else {
      categoryList.forEach(s => newSet.add(s.sessionId || s.id));
    }
    setSelectedSessionIds(newSet);
  };

  const confirmEndSession = async () => {
    if (!sessionToEnd) return;
    const sId = sessionToEnd.sessionId || sessionToEnd.id;
    if (!sId) return;
    
    setIsEnding(true);
    try {
      const docRef = doc(db, 'consultations', sId);
      await updateDoc(docRef, {
        status: 'COMPLETED',
        dispatchStatus: 'completed',
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setToastMessage(`Session ${sId.slice(0, 8)} terminated successfully.`);
      setSessionToEnd(null);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `consultations/${sId}`);
    } finally {
      setIsEnding(false);
    }
  };

  const confirmBulkEnd = async () => {
    if (selectedSessionIds.size === 0) return;
    setIsEndingBulk(true);
    let successCount = 0;
    for (const sId of Array.from(selectedSessionIds)) {
      try {
        await updateDoc(doc(db, 'consultations', sId), {
          status: 'COMPLETED',
          dispatchStatus: 'completed',
          endedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        successCount++;
      } catch (err) {
        console.error("Bulk end failed for ", sId, err);
      }
    }
    
    setToastMessage(`Terminated ${successCount} sessions successfully.`);
    setSelectedSessionIds(new Set());
    setTimeout(() => setToastMessage(null), 3000);
    setIsEndingBulk(false);
  };

  const SessionCard = ({ session, isGhost }: { session: any, isGhost?: boolean }) => {
    const sId = session.sessionId || session.id;
    const isSelected = selectedSessionIds.has(sId);
    
    return (
      <div className={`border rounded-2xl bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}>
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between cursor-pointer" onClick={() => toggleSelection(sId)}>
          <div className="flex items-center gap-2">
            <button className="text-slate-400 hover:text-emerald-600 transition-colors">
              {isSelected ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} />}
            </button>
            <span className={`${
              isGhost ? 'bg-rose-100 text-rose-800' :
              session.isOnHold ? 'bg-amber-100 text-amber-800' :
              'bg-emerald-100 text-emerald-800'
            } text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5`}>
              {isGhost ? 'GHOST/IDLE' : session.isOnHold ? 'ON HOLD' : 'LIVE'}
            </span>
          </div>
          <span className="text-xs font-mono text-slate-500">ID: {(sId || '').slice(0, 6)}</span>
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
          {isGhost && (
            <div className="bg-rose-50 text-rose-700 text-[10px] p-2 rounded-lg font-bold flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              This session appears abandoned and is likely safe to terminate.
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
          <button
            type="button"
            onClick={() => onInspectSession(session)}
            className="flex-1 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Eye size={14} /> Inspect
          </button>
          <button
            type="button"
            onClick={() => setSessionToEnd(session)}
            className="py-2 px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            title="Forcibly end this live consultation"
          >
            <Trash2 size={14} /> End
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-600 text-white font-bold text-xs flex items-center justify-between gap-2 shadow-md animate-in fade-in z-[120]">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-600 hover:opacity-80 cursor-pointer text-white">
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
                className="flex-1 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEndSession}
                disabled={isEnding}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                {isEnding ? 'Terminating...' : 'Yes, End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 md:p-8 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-800">Active Consultations / Live Sessions</h3>
          <p className="text-xs text-slate-600 mt-1">Real-time oversight of ongoing consultations. Terminate stale ghost sessions.</p>
        </div>
        
        {selectedSessionIds.size > 0 && (
          <button 
            onClick={confirmBulkEnd}
            disabled={isEndingBulk}
            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Trash2 size={14} />
            {isEndingBulk ? 'Terminating...' : `Terminate Selected (${selectedSessionIds.size})`}
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-6 space-y-8">
        {isLoading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             <Skeleton className="h-64 w-full rounded-2xl" />
           </div>
        ) : activeSessions.length === 0 ? (
          <div className="p-12 text-center text-slate-600">
            <Video size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">No active live sessions at the moment.</p>
          </div>
        ) : (
          <>
            {/* Ghost / Idle Sessions */}
            {idleGhost.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-rose-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> Ghost / Idle Sessions
                  </h4>
                  <button onClick={() => toggleSelectAll(idleGhost)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase underline cursor-pointer">
                    Select All Idle
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {idleGhost.map(s => <SessionCard key={s.sessionId || s.id} session={s} isGhost />)}
                </div>
              </div>
            )}

            {/* On Hold */}
            {onHold.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-amber-700 flex items-center gap-2">
                    On Hold (Reconnecting)
                  </h4>
                  <button onClick={() => toggleSelectAll(onHold)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase underline cursor-pointer">
                    Select All On Hold
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {onHold.map(s => <SessionCard key={s.sessionId || s.id} session={s} />)}
                </div>
              </div>
            )}

            {/* Active */}
            {activeOngoing.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Active & Ongoing
                  </h4>
                  <button onClick={() => toggleSelectAll(activeOngoing)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase underline cursor-pointer">
                    Select All Active
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeOngoing.map(s => <SessionCard key={s.sessionId || s.id} session={s} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
