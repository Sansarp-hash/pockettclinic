import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import alarmService from '../../lib/alarmService';
import { acceptConsultation, declineOrForwardConsultation } from '../../lib/consultationDispatch';
import { ConsultationSession } from '../../types';
import { PhoneCall, Volume2, VolumeX, CheckCircle, ArrowRightLeft, Clock, Activity, ShieldAlert, User, ShieldCheck } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { normalizeCadre } from '../../config/consultantCadreConfig';

export default function IncomingCallModal() {
  const { user, consultations, systemConfig, showToast } = useAppContext();
  const navigate = useNavigate();
  const [activeRequest, setActiveRequest] = useState<ConsultationSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(180); // 3-minute max ringing
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Daily session limit logic
  const consultantConsultations = (consultations || []).filter(c => 
    (c.assignedConsultantId === user?.uid || c.consultantId === user?.uid) &&
    (c.status === 'COMPLETED' || c.status === 'ACCEPTED' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE')
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const sessionsToday = consultantConsultations.filter(c => {
    const rawDate = c.acceptedAt || c.createdAt;
    if (!rawDate) return false;
    
    let sessionDate = '';
    if (typeof rawDate === 'string') {
      sessionDate = rawDate.split('T')[0];
    } else if (rawDate.toDate) {
      sessionDate = rawDate.toDate().toISOString().split('T')[0];
    } else if (rawDate instanceof Date) {
      sessionDate = rawDate.toISOString().split('T')[0];
    }
    
    return sessionDate === todayStr;
  }).length;

  const isPro = user?.subscriptionTier === 'pro_partner';
  const dailyLimitValue = systemConfig?.operations?.maxDailyConsultationsPerConsultant || 25;
  const dailyLimit = isPro 
    ? dailyLimitValue
    : (systemConfig?.operations?.maxDailyConsultationsFreeTier || 8);
  
  const hasReachedLimit = sessionsToday >= dailyLimit;
  
  const ringingMatchRef = useRef<ConsultationSession | null>(null);
  const legacyMatchRef = useRef<ConsultationSession | null>(null);
  const assignedMatchRef = useRef<ConsultationSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedSessionIds = useRef<Set<string>>(new Set());

  // Web Audio User Interaction Unlocker for Browser Autoplay Restrictions
  useEffect(() => {
    const unlockAudio = () => {
      alarmService.init();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    const isConsultant = user && (user.role === 'consultant' || Boolean(user.cadre));
    if (!isConsultant) {
      setActiveRequest(null);
      if (alarmService && typeof alarmService.stop === 'function') {
        alarmService.stop();
      }
      return;
    }

    const currentUserId = user.uid || user.id;

    const processSnapshot = (snapshot: any, matchKey: 'ringing' | 'legacy' | 'assigned') => {
      let incoming: ConsultationSession | null = null;
      const normalizedUserCadre = normalizeCadre(user.cadre || 'UNASSIGNED');

      snapshot.forEach((docSnap: any) => {
        if (processedSessionIds.current.has(docSnap.id)) {
          return;
        }
        const data = docSnap.data() as ConsultationSession;
        const statusUpper = (data.status || '').toUpperCase();
        const dispatchUpper = (data.dispatchStatus || '').toUpperCase();

        const isCancelled = 
          statusUpper.startsWith('CANCEL') || 
          dispatchUpper.startsWith('CANCEL') || 
          dispatchUpper === 'EXPIRED';

        // Ignore ended, completed, cancelled, or accepted sessions
        if (
          isCancelled || 
          statusUpper === 'COMPLETED' || 
          statusUpper === 'TERMINATED_SYSTEM_FAILURE' || 
          dispatchUpper === 'ACCEPTED' || 
          statusUpper === 'IN_PROGRESS' ||
          statusUpper === 'ACCEPTED'
        ) {
          return;
        }

        const declinedList = data.declinedBy || [];
        const notDeclinedByMe = currentUserId && !declinedList.includes(currentUserId);
        if (!notDeclinedByMe) return;

        const isDirectToMe = Boolean(
          (data.consultantId && data.consultantId !== 'unassigned' && (data.consultantId === currentUserId || data.consultantId === user.uid)) ||
          (data.assignedConsultantId && data.assignedConsultantId !== 'unassigned' && (data.assignedConsultantId === currentUserId || data.assignedConsultantId === user.uid))
        );
        const isBroadcastingReferral = data.referralState === 'BROADCASTING';

        // Cadre matching for broadcasted referrals & auto-dispatches
        const rawCadre = data.cadreNeeded || data.consultantCadre || (data as any).targetCadre || 'UNASSIGNED';
        const targetCadreNorm = normalizeCadre(rawCadre);
        let isCadreMatch = false;
        
        if (normalizedUserCadre === 'UNASSIGNED') {
          // If consultant hasn't set their cadre, but matches DOCTOR generally
          if (targetCadreNorm === 'DOCTOR') isCadreMatch = true;
        } else {
          // Check for exact match or specialty groupings
          const userCadreStr = String(normalizedUserCadre).toUpperCase();
          const targetCadreStr = String(targetCadreNorm).toUpperCase();

          if (targetCadreStr === 'DOCTOR') {
            isCadreMatch = ['DOCTOR', 'SPECIALIST', 'PHYSICIAN_ASSISTANT'].includes(userCadreStr);
          } else if (targetCadreStr === 'SPECIALIST') {
            isCadreMatch = ['SPECIALIST', 'DOCTOR'].includes(userCadreStr);
          } else if (targetCadreStr === 'PHYSICIAN_ASSISTANT') {
            isCadreMatch = ['PHYSICIAN_ASSISTANT', 'DOCTOR'].includes(userCadreStr);
          } else if (targetCadreStr === 'PHARMACIST' || targetCadreStr === 'PHARM_TECH') {
            isCadreMatch = ['PHARMACIST', 'PHARM_TECH'].includes(userCadreStr);
          } else {
            isCadreMatch = userCadreStr === targetCadreStr;
          }
        }

        const isAuthorizedForThisCall = isDirectToMe || isCadreMatch;
        if (!isAuthorizedForThisCall) return;

        const isRingingState = !isCancelled && (
          dispatchUpper === 'RINGING' || 
          dispatchUpper === 'RE-ROUTING' || 
          dispatchUpper === 'ESCALATED' ||
          dispatchUpper === 'DIRECT' ||
          (!data.dispatchStatus && (statusUpper === 'PAID' || statusUpper === 'PENDING'))
        );
        const isUnassignedBroadcast = !data.assignedConsultantId || data.assignedConsultantId === 'unassigned' || data.assignedConsultantId === '' || data.consultantId === 'unassigned';
        
        // Match if:
        // 1. Direct call to me (ID match) - Skip cadre check for direct calls
        // 2. Broadcast call that matches my cadre
        const isMatch = (isDirectToMe && isRingingState) || (isUnassignedBroadcast && isRingingState && isCadreMatch) || (isBroadcastingReferral && isCadreMatch) || (dispatchUpper === 'ESCALATED' && isCadreMatch);

        if (isMatch) {
          incoming = { ...data, sessionId: docSnap.id };
        }
      });

      if (matchKey === 'ringing') ringingMatchRef.current = incoming;
      if (matchKey === 'legacy') legacyMatchRef.current = incoming;
      if (matchKey === 'assigned') assignedMatchRef.current = incoming;

      // Merge and pick the best match
      const selectedIncoming = ringingMatchRef.current || assignedMatchRef.current || legacyMatchRef.current;

      if (selectedIncoming) {
        setActiveRequest((prev) => {
          if (!prev || prev.sessionId !== selectedIncoming.sessionId) {
            let expiryMs = selectedIncoming.ringingExpiresAt ? (typeof selectedIncoming.ringingExpiresAt === 'number' ? selectedIncoming.ringingExpiresAt : (selectedIncoming.ringingExpiresAt as any).toDate?.().getTime() || Date.now() + 180000) : Date.now() + 180000;
            let remainingSecs = Math.max(1, Math.round((expiryMs - Date.now()) / 1000));
            if (remainingSecs > 180) remainingSecs = 180;
            
            setTimeLeft(remainingSecs);
            try {
              if (!window.location.pathname.startsWith('/consultation/')) {
                alarmService.start();
              }
            } catch (err) {
              console.warn("Alarm start suppressed:", err);
            }
            return selectedIncoming;
          }
          return prev;
        });
      } else {
        if (!ringingMatchRef.current && !legacyMatchRef.current && !assignedMatchRef.current) {
          setActiveRequest(null);
          try {
            if (alarmService && typeof alarmService.stop === 'function') {
              alarmService.stop();
            }
          } catch (err) {
            console.warn("Alarm stop suppressed:", err);
          }
        }
      }
    };

    const incomingQuery = query(
      collection(db, 'consultations'),
      where('dispatchStatus', 'in', ['ringing', 're-routing', 'escalated', 'RINGING', 'RE-ROUTING', 'ESCALATED'])
    );

    const legacyQuery = query(
      collection(db, 'consultations'),
      where('consultantId', '==', currentUserId)
    );

    const assignedQuery = query(
      collection(db, 'consultations'),
      where('assignedConsultantId', '==', currentUserId)
    );

    const unsubscribeRinging = onSnapshot(incomingQuery, (snapshot) => {
      processSnapshot(snapshot, 'ringing');
    }, (err) => console.warn("Ringing query listener error:", err));

    const unsubscribeLegacy = onSnapshot(legacyQuery, (snapshot) => {
      processSnapshot(snapshot, 'legacy');
    }, (err) => console.warn("Legacy query listener error:", err));

    const unsubscribeAssigned = onSnapshot(assignedQuery, (snapshot) => {
      processSnapshot(snapshot, 'assigned');
    }, (err) => console.warn("Assigned query listener error:", err));

    return () => {
      unsubscribeRinging();
      unsubscribeLegacy();
      unsubscribeAssigned();
      try {
        if (alarmService && typeof alarmService.stop === 'function') {
          alarmService.stop();
        }
      } catch (err) {
        console.warn("Alarm stop suppressed:", err);
      }
    };
  }, [user?.uid, user?.id, user?.role, user?.cadre]);

  // Context-level synchronization fallback
  useEffect(() => {
    const isConsultant = user && (user.role === 'consultant' || Boolean(user.cadre));
    if (!isConsultant || !consultations || consultations.length === 0) return;

    const currentUserId = user.uid || user.id;
    const normalizedUserCadre = normalizeCadre(user.cadre || 'UNASSIGNED');

    const incoming = consultations.find(data => {
      if (data.sessionId && processedSessionIds.current.has(data.sessionId)) {
        return false;
      }
      const statusUpper = (data.status || '').toUpperCase();
      const dispatchUpper = (data.dispatchStatus || '').toUpperCase();

      const isCancelled = 
        statusUpper.startsWith('CANCEL') || 
        dispatchUpper.startsWith('CANCEL') || 
        dispatchUpper === 'EXPIRED';

      if (
        isCancelled || 
        statusUpper === 'COMPLETED' || 
        statusUpper === 'TERMINATED_SYSTEM_FAILURE' || 
        dispatchUpper === 'ACCEPTED' || 
        statusUpper === 'IN_PROGRESS' ||
        statusUpper === 'ACCEPTED'
      ) {
        return false;
      }

      const declinedList = data.declinedBy || [];
      if (currentUserId && declinedList.includes(currentUserId)) return false;

      const isDirectToMe = Boolean(
        (data.consultantId && data.consultantId !== 'unassigned' && (data.consultantId === currentUserId || data.consultantId === user.uid)) ||
        (data.assignedConsultantId && data.assignedConsultantId !== 'unassigned' && (data.assignedConsultantId === currentUserId || data.assignedConsultantId === user.uid))
      );
      const isBroadcastingReferral = data.referralState === 'BROADCASTING';

      const rawCadre = data.cadreNeeded || data.consultantCadre || (data as any).targetCadre || 'UNASSIGNED';
      const targetCadreNorm = normalizeCadre(rawCadre);
      let isCadreMatch = false;

      if (normalizedUserCadre === 'UNASSIGNED') {
        if (targetCadreNorm === 'DOCTOR') isCadreMatch = true;
      } else {
        const userCadreStr = String(normalizedUserCadre).toUpperCase();
        const targetCadreStr = String(targetCadreNorm).toUpperCase();

        if (targetCadreStr === 'DOCTOR') {
          isCadreMatch = ['DOCTOR', 'SPECIALIST', 'PHYSICIAN_ASSISTANT'].includes(userCadreStr);
        } else if (targetCadreStr === 'SPECIALIST') {
          isCadreMatch = ['SPECIALIST', 'DOCTOR'].includes(userCadreStr);
        } else if (targetCadreStr === 'PHYSICIAN_ASSISTANT') {
          isCadreMatch = ['PHYSICIAN_ASSISTANT', 'DOCTOR'].includes(userCadreStr);
        } else if (targetCadreStr === 'PHARMACIST' || targetCadreStr === 'PHARM_TECH') {
          isCadreMatch = ['PHARMACIST', 'PHARM_TECH'].includes(userCadreStr);
        } else {
          isCadreMatch = userCadreStr === targetCadreStr;
        }
      }

      if (!isDirectToMe && !isCadreMatch) return false;

      const isRingingState = !isCancelled && (
        dispatchUpper === 'RINGING' || 
        dispatchUpper === 'RE-ROUTING' || 
        dispatchUpper === 'ESCALATED' ||
        dispatchUpper === 'DIRECT' ||
        (!data.dispatchStatus && (statusUpper === 'PAID' || statusUpper === 'PENDING'))
      );
      const isUnassignedBroadcast = !data.assignedConsultantId || data.assignedConsultantId === 'unassigned' || data.assignedConsultantId === '' || data.consultantId === 'unassigned';

      return (isDirectToMe && isRingingState) || (isUnassignedBroadcast && isRingingState && isCadreMatch) || (isBroadcastingReferral && isCadreMatch) || (dispatchUpper === 'ESCALATED' && isCadreMatch);
    });

    if (incoming) {
      setActiveRequest((prev) => {
        if (!prev || prev.sessionId !== incoming.sessionId) {
          let expiryMs = incoming.ringingExpiresAt ? (typeof incoming.ringingExpiresAt === 'number' ? incoming.ringingExpiresAt : (incoming.ringingExpiresAt as any).toDate?.().getTime() || Date.now() + 180000) : Date.now() + 180000;
          let remainingSecs = Math.max(1, Math.round((expiryMs - Date.now()) / 1000));
          if (remainingSecs > 180) remainingSecs = 180;

          setTimeLeft(remainingSecs);
          try {
            if (!window.location.pathname.startsWith('/consultation/')) {
              alarmService.start();
            }
          } catch (err) {
            console.warn("Alarm start suppressed:", err);
          }
          return incoming;
        }
        return prev;
      });
    }
  }, [consultations, user?.uid, user?.id, user?.role, user?.cadre]);

  useEffect(() => {
    if (!activeRequest) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoForwardTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeRequest?.sessionId]);

  const handleAutoForwardTimeout = async () => {
    if (!activeRequest || !user) return;
    if (alarmService && typeof alarmService.stop === 'function') {
      alarmService.stop();
    }
    const currentSessionId = activeRequest.sessionId;
    processedSessionIds.current.add(currentSessionId);
    setActiveRequest(null);
    try {
      await declineOrForwardConsultation(currentSessionId, user.uid);
    } catch(e) {
      console.warn("Auto-forward failed:", e);
    }
  };

  const handleAccept = async () => {
    if (!activeRequest || !user || isProcessing) return;
    if (hasReachedLimit) {
      showToast(`Daily limit reached (${sessionsToday}/${dailyLimit}). Upgrade to Pro to accept more sessions.`, "warning");
      return;
    }
    
    setIsProcessing(true);
    if (alarmService && typeof alarmService.stop === 'function') {
      alarmService.stop();
    }
    
    const sessionId = activeRequest.sessionId;
    processedSessionIds.current.add(sessionId);
    const consultantName = user.displayName || user.fullName || 'Consultant';

    try {
      await acceptConsultation(sessionId, user.uid, consultantName);
      setActiveRequest(null);
      setIsProcessing(false);
      navigate(`/consultation/${sessionId}`);
    } catch (err: any) {
      console.error("Accept failed:", err);
      // Remove from processed if accept actually failed, so user can retry or sound plays again if appropriate
      processedSessionIds.current.delete(sessionId);
      setIsProcessing(false);
      if (err?.message === "Consultation already accepted by someone else.") {
        showToast("Could not accept call. It may have been taken by another consultant.", "error");
      } else {
        showToast(err?.message || "Failed to accept consultation.", "error");
      }
    }
  };

  const handleDeclineForward = async () => {
    if (!activeRequest || !user || isProcessing) return;
    setIsProcessing(true);
    if (alarmService && typeof alarmService.stop === 'function') {
      alarmService.stop();
    }

    const sessionId = activeRequest.sessionId;
    processedSessionIds.current.add(sessionId);
    setActiveRequest(null);
    
    try {
      await declineOrForwardConsultation(sessionId, user.uid);
    } catch (err) {
      console.error("Decline/Forward failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleMute = () => {
    const muted = alarmService.toggleMute();
    setIsMuted(muted);
  };

  if (!activeRequest) return null;

  const totalTime = 180;
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col relative"
      >
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1.5 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md relative z-10 animate-pulse">
                <PhoneCall size={18} />
              </div>
            </div>
            <div>
              <span className="inline-block px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[7px] font-black uppercase tracking-widest rounded-full mb-0.5">
                Incoming Dispatch
              </span>
              <h2 className="text-sm font-black text-white tracking-tight">Consultation Request</h2>
            </div>
          </div>

          <button
            onClick={handleToggleMute}
            className={`p-2 rounded-xl transition-colors border ${
              isMuted 
                ? 'bg-rose-500/20 text-rose-200 border-rose-400/30' 
                : 'bg-white/20 text-white border-white/30 hover:bg-white/30'
            }`}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="animate-pulse" />}
          </button>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
          <div 
            className={`h-full transition-all duration-1000 ${
              timeLeft < 30 ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center shadow-sm">
                <User size={16} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-tight">
                  {activeRequest.patientName || 'Anonymous Patient'}
                </h3>
                <p className="text-[8px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">
                  {activeRequest.patientAge ? `${activeRequest.patientAge} Yrs` : 'Adult'} 
                  {activeRequest.patientGender ? ` • ${activeRequest.patientGender}` : ''}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[7px] text-slate-400 uppercase font-black tracking-widest block">Duration</span>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/50 inline-block mt-0.5">
                {activeRequest.tierDurationMinutes || 15} M {activeRequest.sessionType === 'VIDEO' ? 'VIDEO' : 'AUDIO'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Activity size={12} className="text-indigo-500" />
              Symptoms & Chief Complaints
            </label>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
              {activeRequest.chiefComplaints || 'General medical consultation request regarding clinical evaluation.'}
            </div>
          </div>

          <div className="flex items-center justify-between text-[8px] px-0.5 font-black uppercase tracking-widest">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Clock size={12} className={timeLeft < 30 ? 'text-rose-500 animate-spin' : 'text-indigo-500'} />
              <span>Forwarding in: <strong className={timeLeft < 30 ? 'text-rose-600 text-[11px]' : 'text-slate-900 dark:text-white'}>{timeLeft}s</strong></span>
            </div>
            
            <div className="flex items-center gap-1 text-slate-400">
              <ShieldAlert size={12} />
              <span>PockettClinic Dispatch v2</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleAccept}
                disabled={isProcessing}
                className={`w-full py-2.5 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                  hasReachedLimit 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10'
                }`}
              >
                <CheckCircle size={16} />
                <span>Accept Call</span>
              </button>
              {hasReachedLimit && (
                <p className="text-[8px] text-rose-600 font-black uppercase text-center leading-tight">
                  Daily limit reached ({sessionsToday}/{dailyLimit})<br/>
                  Upgrade to Pro for 25 calls/day
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleDeclineForward}
                disabled={isProcessing}
                className="w-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-2.5 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <ArrowRightLeft size={14} className="text-slate-500" />
                <span>Decline</span>
              </button>
              {hasReachedLimit && (
                <p className="text-[8px] text-slate-400 font-black uppercase text-center leading-tight">
                  Reroute to next consultant
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
