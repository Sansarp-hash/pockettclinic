import React, { useState, useEffect } from 'react';
import { 
  Radio, PhoneCall, Zap, Play, CheckCircle2, AlertCircle, RefreshCw, 
  Trash2, ShieldCheck, Clock, ArrowRight, UserCheck, Stethoscope, Pill, X, Sparkles, Activity
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { ConsultationSession } from '../../types';
import { useAppContext } from '../../AppContext';
import { CADRE_CONFIGS, normalizeCadre } from '../../config/consultantCadreConfig';

export default function AdminCallDispatchMonitor() {
  const { showToast } = useAppContext();
  const [activeDispatches, setActiveDispatches] = useState<ConsultationSession[]>([]);
  const [isListenerConnected, setIsListenerConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);
  const [eventLogs, setEventLogs] = useState<{ id: string; msg: string; type: 'info' | 'success' | 'warn'; time: string }[]>([]);
  const [isTriggeringTest, setIsTriggeringTest] = useState(false);
  const [selectedTestCadre, setSelectedTestCadre] = useState<'DOCTOR' | 'PHARMACIST' | 'PHARM_TECH' | 'PHYSICIAN_ASSISTANT' | 'SPECIALIST'>('DOCTOR');

  // Real-time Firestore Listener for Dispatch State
  useEffect(() => {
    const q = query(
      collection(db, 'consultations'),
      where('dispatchStatus', 'in', ['ringing', 're-routing', 'escalated', 'pending'])
    );

    const addLog = (msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
      const timeStr = new Date().toLocaleTimeString();
      setEventLogs(prev => [{ id: Math.random().toString(), msg, type, time: timeStr }, ...prev.slice(0, 25)]);
    };

    addLog('Establishing live Firestore dispatch snapshot listener...', 'info');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsListenerConnected(true);
      const nowStr = new Date().toLocaleTimeString();
      setLastEventTime(nowStr);

      const dispatches: ConsultationSession[] = [];
      snapshot.forEach((docSnap) => {
        dispatches.push({ ...docSnap.data(), sessionId: docSnap.id } as ConsultationSession);
      });

      setActiveDispatches(dispatches);
      addLog(`Snapshot event received: ${dispatches.length} active dispatches ringing in Firestore.`, 'success');
    }, (err) => {
      console.error("[CallDispatchMonitor] Listener error:", err);
      setIsListenerConnected(false);
      addLog(`Firestore listener error: ${err.message}`, 'warn');
    });

    return () => unsubscribe();
  }, []);

  // Trigger Manual Dispatch Call
  const handleTriggerManualDispatch = async () => {
    setIsTriggeringTest(true);
    try {
      const sessionId = `dispatch_${Date.now()}`;
      const now = Date.now();
      
      const manualConsultation: ConsultationSession = {
        sessionId: sessionId,
        patientId: 'manual_dispatch',
        patientName: 'Manual Dispatch Request',
        patientAge: 0,
        patientGender: 'Not Specified',
        consultantId: 'unassigned',
        consultantName: 'On-Call Consultant',
        assignedConsultantId: null,
        declinedBy: [],
        dispatchStatus: 'ringing',
        ringingStartedAt: now,
        ringingExpiresAt: now + 180000, // 3 minutes
        tierDurationMinutes: 15,
        cadreNeeded: selectedTestCadre,
        chiefComplaints: 'Manually Initiated Administrative Dispatch',
        symptoms: [],
        sessionType: 'VIDEO',
        type: 'video',
        status: 'PAID',
        roomId: sessionId,
        scheduledAt: new Date().toISOString(),
        paystackReference: `MANUAL_${sessionId}`,
        amountPaidGHS: 0,
        platformCutGHS: 0,
        payoutAmountGHS: 0,
        bookingType: 'INSTANT'
      };

      await setDoc(doc(db, 'consultations', sessionId), manualConsultation);
      showToast(`Manual dispatch created for ${selectedTestCadre}.`, 'success');
    } catch (err: any) {
      console.error("Failed to trigger manual dispatch:", err);
      showToast(`Failed to trigger dispatch: ${err.message}`, 'error');
    } finally {
      setIsTriggeringTest(false);
    }
  };

  // Simulate Consultant Acceptance
  const handleForceAccept = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'consultations', sessionId), {
        status: 'ACTIVE',
        dispatchStatus: 'accepted',
        assignedConsultantId: 'admin_test_consultant',
        consultantName: 'Admin Verified Consultant',
        acceptedAt: new Date().toISOString()
      });
      showToast('Dispatch marked as ACCEPTED. Call modal should dismiss instantly.', 'success');
    } catch (err: any) {
      showToast(`Failed to force accept: ${err.message}`, 'error');
    }
  };

  // Clear or Cancel Dispatch
  const handleCancelDispatch = async (sessionId: string) => {
    try {
      const consRef = doc(db, 'consultations', sessionId);
      await updateDoc(consRef, {
        status: 'CANCELLED',
        dispatchStatus: 'cancelled',
        updatedAt: new Date().toISOString()
      }).catch(() => {});
      await deleteDoc(consRef);
      showToast('Dispatch cancelled and deleted from Firestore.', 'info');
    } catch (err: any) {
      showToast(`Failed to cancel dispatch: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & LIVE STATUS BADGE */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <PhoneCall size={240} className="text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isListenerConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Call Dispatch Propagation Monitor
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-medium max-w-xl">
              Monitors live Firestore snapshot events for consultation dispatches. Verifies that incoming calls ring instantly on online Consultants' IncomingCallModal.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700/80">
            <Radio size={18} className={isListenerConnected ? "text-emerald-400 animate-pulse" : "text-rose-400"} />
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">WebSocket / Snapshot</div>
              <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                {isListenerConnected ? 'ONLINE & ACTIVE' : 'DISCONNECTED'}
                {lastEventTime && <span className="text-[10px] text-slate-400 font-normal">({lastEventTime})</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE DISPATCH TESTER PANEL */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Zap size={18} className="text-emerald-500" />
              Administrative Manual Dispatch Tool
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manually initiate a consultation dispatch to target healthcare cadres. Useful for internal coordination or handling off-platform requests.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-1">
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Target Healthcare Cadre</label>
            <select
              value={selectedTestCadre}
              onChange={(e) => setSelectedTestCadre(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="DOCTOR">Doctor (DOCTOR)</option>
              <option value="SPECIALIST">Specialist (SPECIALIST)</option>
              <option value="PHYSICIAN_ASSISTANT">Physician Assistant (PHYSICIAN_ASSISTANT)</option>
              <option value="PHARMACIST">Pharmacist (PHARMACIST)</option>
              <option value="PHARM_TECH">Pharmacy Technician (PHARM_TECH)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Expected Behavior</label>
            <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-900 flex items-center gap-2">
              <Clock size={14} className="text-emerald-600 shrink-0" />
              <span>Broadcasts to {selectedTestCadre} dashboards for 180s</span>
            </div>
          </div>

          <button
            onClick={handleTriggerManualDispatch}
            disabled={isTriggeringTest}
            className="w-full bg-[#0A3B24] hover:bg-emerald-950 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isTriggeringTest ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Play size={16} className="fill-current" />
            )}
            <span>Initiate Manual Dispatch</span>
          </button>
        </div>
      </div>

      {/* ACTIVE RINGING DISPATCHES TABLE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-emerald-600" />
            <h3 className="text-sm font-black text-slate-900 tracking-tight">Active Ringing Dispatches ({activeDispatches.length})</h3>
          </div>
          <span className="text-xs font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
            Realtime Firestore Sync
          </span>
        </div>

        {activeDispatches.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-80" />
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">No Active Calls Ringing</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are currently no consultation calls in the 'ringing' state. Use the tester above or place an instant call from the Patient Dashboard.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-3">Session ID</th>
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Cadre Needed</th>
                  <th className="py-3 px-3">Dispatch Status</th>
                  <th className="py-3 px-3">Expires In</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {activeDispatches.map((session) => {
                  const expiresAt = session.ringingExpiresAt ? (typeof session.ringingExpiresAt === 'number' ? session.ringingExpiresAt : Date.now() + 180000) : Date.now() + 180000;
                  const remainingSecs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));

                  return (
                    <tr key={session.sessionId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-800">
                        {session.sessionId.slice(0, 16)}...
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {session.patientName}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-emerald-700 uppercase">
                        {CADRE_CONFIGS[normalizeCadre(session.cadreNeeded)]?.label || session.cadreNeeded || 'UNASSIGNED'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`${
                          (session.dispatchStatus || '').toLowerCase() === 'ringing'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        } text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          (session.dispatchStatus || '').toLowerCase() === 'ringing' ? 'animate-bounce' : 'animate-pulse'
                        } flex items-center gap-1 w-max`}>
                          <PhoneCall size={10} />
                          {session.dispatchStatus || 'ringing'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-600">
                        {remainingSecs}s
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleForceAccept(session.sessionId)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <CheckCircle2 size={12} />
                            <span>Force Accept</span>
                          </button>
                          <button
                            onClick={() => handleCancelDispatch(session.sessionId)}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REAL-TIME EVENT PROPAGATION LOGS */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            Realtime Propagation Console Output
          </span>
          <span className="text-[10px] text-slate-500">Auto-scroll enabled</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
          {eventLogs.length === 0 ? (
            <div className="text-slate-600 italic text-[11px]">Awaiting snapshot stream events...</div>
          ) : (
            eventLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-[11px] leading-tight">
                <span className="text-slate-600 text-[10px] shrink-0">[{log.time}]</span>
                <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'}>
                  {log.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
