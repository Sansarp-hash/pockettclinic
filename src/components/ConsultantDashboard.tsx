import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import { formatConsultantName } from '../lib/formatters';
import { normalizeCadre } from '../config/consultantCadreConfig';
import { formatMemberId } from '../lib/memberId';
import { 
  Calendar, Clock, UserCircle, Video, CheckCircle2, TrendingUp, Users, Star, 
  MessageSquare, Settings, FileText, Wifi, WifiOff, PhoneCall, AlertCircle, 
  Landmark, Wallet, ShieldAlert, Scale, ShieldCheck, History, Loader2, 
  Building2, LayoutDashboard, Stethoscope, Bell, BellRing, HeartPulse, 
  AlertTriangle, DollarSign, ArrowLeft, Activity, LogOut 
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import PayoutModal, { getWithdrawalWindowStatus } from './PayoutModal';
import UploadIndemnityModal from './UploadIndemnityModal';
import { PayoutRequest } from '../types';
import { DashboardSkeleton } from './Skeleton';

import { ConsultantStats } from './consultant/ConsultantStats';
import { ConsultantPatientQueue } from './consultant/ConsultantPatientQueue';
import { ConsultantProfileEditor } from './consultant/ConsultantProfileEditor';
import { ConsultantFeedbackView } from './consultant/ConsultantFeedbackView';
import ConsultantSoapNoteAssistant from './consultant/ConsultantSoapNoteAssistant';
import DrugSafetyChecker from './consultant/DrugSafetyChecker';
import SpecialistReferralNetwork from './consultant/SpecialistReferralNetwork';
import FollowUpScheduler from './consultant/FollowUpScheduler';
import ConsultantPayoutHub from './consultant/ConsultantPayoutHub';
import ConsultantGuidelinesDrawer from './ConsultantGuidelinesDrawer';
import ConsultationChat from './ConsultationChat';
import ProfileModal from './ProfileModal';
import SubscriptionCard from './SubscriptionCard';
import AccountDeletionModal from './AccountDeletionModal';
import ConsultantSidebar from './consultant/ConsultantSidebar';
import ConsultantMobileDashboard from './consultant/ConsultantMobileDashboard';
import { NetworkSyncIndicator } from './NetworkSyncIndicator';
// Removed redundant IncomingCallOverlay in favor of App-level IncomingCallModal
import { declineOrForwardConsultation } from '../lib/consultationDispatch';

export interface ConsultantDashboardProps {
  targetConsultant?: any;
  allConsultants?: any[];
  onSelectConsultant?: (consultant: any) => void;
  onBackToList?: () => void;
}

export default function ConsultantDashboard({
  targetConsultant,
  allConsultants = [],
  onSelectConsultant,
  onBackToList
}: ConsultantDashboardProps = {}) {
  const { 
    consultations, 
    prescriptions, 
    updateConsultation, 
    updateUserProfile,
    user, 
    logout,
    isLoading,
    showToast,
    showConfirm,
    globalTitle,
    globalSlogan,
    globalLogoUrl
  } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const effectiveUser = targetConsultant || (searchParams.get('consultantId') ? allConsultants.find(c => (c.uid || c.id) === searchParams.get('consultantId')) : null) || user;
  const isAdminView = Boolean(targetConsultant || user?.role === 'admin' || searchParams.get('consultantId'));

  const activeDashboardTab = (searchParams.get('tab') || 'appointments') as any;
  const setActiveDashboardTab = (tab: string) => {
    setSearchParams({ tab });
  };
  
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<any>(null);
  const [isAffirmationModalOpen, setIsAffirmationModalOpen] = useState(false);
  const [isSubmittingAffirmation, setIsSubmittingAffirmation] = useState(false);
  const [reviewTermsChecked, setReviewTermsChecked] = useState(false);
  const [isAcceptingReviewTerms, setIsAcceptingReviewTerms] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isIndemnityModalOpen, setIsIndemnityModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' ? (window.Notification?.permission || 'default') : 'default'
  );
  const [isEnablingNotifs, setIsEnablingNotifs] = useState(false);
  const [hideNotificationBanner, setHideNotificationBanner] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('consultant_notifications_enabled') === 'true';
    }
    return false;
  });
  
  // Portfolio Editing & Clinical Credentials State
  const [isEditingPortfolio, setIsEditingPortfolio] = useState(false);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);

  const isVerified = user?.isVerified;
  const verificationStatus = user?.verificationStatus;
  const independentContractorAffirmed = user?.independentContractorAffirmed;
  const userUid = user?.uid;

  useEffect(() => {
    if (user?.uid && user?.role === 'consultant' && !user?.isOnline) {
      updateUserProfile({ isOnline: true });
    }
  }, [user?.uid, user?.role]);

  useEffect(() => {
    if (!isAdminView && userUid && !isVerified && !verificationStatus) {
      navigate('/consultant/onboarding');
    }
  }, [userUid, isVerified, verificationStatus, navigate, isAdminView]);

  useEffect(() => {
    if (!isAdminView && userUid && !independentContractorAffirmed && (isVerified || verificationStatus)) {
      setIsAffirmationModalOpen(true);
    }
  }, [userUid, independentContractorAffirmed, isVerified, verificationStatus, isAdminView]);

  const handleAffirmStatus = async () => {
    if (!user) return;
    setIsSubmittingAffirmation(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        independentContractorAffirmed: true,
        termsAccepted: true,
        indemnityAgreed: true,
        contractorAffirmedAt: new Date().toISOString()
      });
      setIsAffirmationModalOpen(false);
    } catch (err) {
      console.error("Error affirming status:", err);
      showToast("Failed to record affirmation. Please try again.", "error");
    } finally {
      setIsSubmittingAffirmation(false);
    }
  };

  const handleAcceptReviewTerms = async () => {
    if (!effectiveUser || !reviewTermsChecked) return;
    setIsAcceptingReviewTerms(true);
    try {
      await updateDoc(doc(db, 'users', effectiveUser.uid || effectiveUser.id), {
        reviewTermsAcceptedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error accepting review terms:", err);
      showToast("Failed to accept terms. Please try again.", "error");
    } finally {
      setIsAcceptingReviewTerms(false);
    }
  };

  const windowStatus = getWithdrawalWindowStatus();
  const isOnline = effectiveUser?.isOnline !== undefined ? effectiveUser.isOnline : true;

  const handleEnableNotifications = async () => {
    setIsEnablingNotifs(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('consultant_notifications_enabled', 'true');
        setHideNotificationBanner(true);
      }
      
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          pushNotificationsEnabled: true,
          fcmTokenUpdatedAt: new Date().toISOString()
        }).catch(err => console.warn("Failed to update firestore profile notification flag:", err));
      }

      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification?.requestPermission) {
        const permission = await window.Notification.requestPermission();
        setNotifPermission(permission);
        showToast(permission === 'granted' ? "Real-time notifications enabled!" : "Notification permission deferred.", permission === 'granted' ? "success" : "info");
      }
    } catch (err) {
      console.warn("Notification enabling handled gracefully:", err);
    } finally {
      setIsEnablingNotifs(false);
    }
  };

  const missedCheckRunRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - missedCheckRunRef.current < 60000) return;
    missedCheckRunRef.current = now;

    const handleMissedSessions = async () => {
      for (const c of consultations) {
        if ((c.status === 'PENDING' || c.status === 'ACCEPTED' || c.status === 'PAID' || c.status === 'IN_PROGRESS') && c.sessionId) {
          const targetTime = new Date(c.scheduledAt || c.createdAt || 0).getTime();
          if (!isNaN(targetTime) && targetTime > 0 && (now - targetTime) > (30 * 60 * 1000)) {
            try {
              await updateConsultation(c.sessionId, { status: 'MISSED' });
            } catch (err) {
              console.warn("Failed to mark stale session as MISSED:", err);
            }
          }
        }
      }
    };
    handleMissedSessions();
  }, [consultations, updateConsultation]);

  const parseDate = (d: any): number => {
    if (!d) return 0;
    if (typeof d === 'number') return d;
    if (typeof d === 'string') return new Date(d).getTime();
    if (d && typeof d.toMillis === 'function') return d.toMillis();
    if (d && typeof d.toDate === 'function') return d.toDate().getTime();
    try {
      return new Date(d).getTime();
    } catch {
      return 0;
    }
  };

  const isStaleSession = (c: any) => {
    const statusUpper = (c.status || '').toUpperCase();
    const dispatchUpper = (c.dispatchStatus || '').toUpperCase();

    if (
      statusUpper.startsWith('CANCEL') ||
      dispatchUpper.startsWith('CANCEL') ||
      dispatchUpper === 'EXPIRED' ||
      ['COMPLETED', 'MISSED', 'FAILED', 'TICKET_ISSUED', 'TERMINATED_SYSTEM_FAILURE'].includes(statusUpper)
    ) {
      return true;
    }
    const targetTime = parseDate(c.scheduledAt || c.createdAt);
    if (targetTime === 0) return false;
    
    // 3 minute ringing limit (180 seconds)
    if (c.dispatchStatus === 'ringing' || c.dispatchStatus === 're-routing' || c.dispatchStatus === 'escalated') {
      return (Date.now() - targetTime) > (180 * 1000);
    }

    return (Date.now() - targetTime) > (30 * 60 * 1000);
  };

  const consultantId = effectiveUser?.uid || effectiveUser?.id || user?.uid;
  
  // Debug log to trace why calls might be missing
  useEffect(() => {
    if (consultations.length > 0) {
      const ringing = consultations.filter(c => {
        const sU = (c.status || '').toUpperCase();
        const dU = (c.dispatchStatus || '').toUpperCase();
        return (dU === 'RINGING' || dU === 'RE-ROUTING' || dU === 'ESCALATED') && !sU.startsWith('CANCEL') && !dU.startsWith('CANCEL');
      });
      if (ringing.length > 0) {
        console.log('[ConsultantDashboard] Active ringing calls detected:', ringing.map(c => ({ id: c.sessionId, assigned: c.assignedConsultantId, status: c.status, cadre: c.cadreNeeded })));
      }
    }
  }, [consultations]);

  const incomingCall = consultations.find(c => {
    if (!consultantId) return false;
    const statusUpper = (c.status || '').toUpperCase();
    const dispatchUpper = (c.dispatchStatus || '').toUpperCase();
    
    if (statusUpper.startsWith('CANCEL') || dispatchUpper.startsWith('CANCEL') || dispatchUpper === 'EXPIRED') {
      return false;
    }

    const consultantCadre = user?.cadre || 'UNASSIGNED';
    const normalizedUserCadre = normalizeCadre(consultantCadre);
    const targetCadreNorm = normalizeCadre(c.cadreNeeded || c.consultantCadre || 'UNASSIGNED');

    let isCadreMatch = false;
    if ((normalizedUserCadre as string) === 'UNASSIGNED') {
      if (targetCadreNorm === 'DOCTOR') {
        isCadreMatch = true;
      }
    } else {
      if (targetCadreNorm === 'DOCTOR') {
        isCadreMatch = (normalizedUserCadre === 'DOCTOR' || normalizedUserCadre === 'SPECIALIST' || normalizedUserCadre === 'PHYSICIAN_ASSISTANT');
      } else if (targetCadreNorm === 'SPECIALIST') {
        isCadreMatch = (normalizedUserCadre === 'SPECIALIST' || normalizedUserCadre === 'DOCTOR');
      } else if (targetCadreNorm === 'PHYSICIAN_ASSISTANT') {
        isCadreMatch = (normalizedUserCadre === 'PHYSICIAN_ASSISTANT' || normalizedUserCadre === 'DOCTOR');
      } else if (targetCadreNorm === 'PHARMACIST') {
        isCadreMatch = (normalizedUserCadre === 'PHARMACIST' || normalizedUserCadre === 'PHARM_TECH');
      } else if (targetCadreNorm === 'PHARM_TECH') {
        isCadreMatch = (normalizedUserCadre === 'PHARM_TECH' || normalizedUserCadre === 'PHARMACIST');
      } else {
        isCadreMatch = (normalizedUserCadre as string) === (targetCadreNorm as string);
      }
    }

    const isDirectRinging = (dispatchUpper === 'RINGING' || dispatchUpper === 'DIRECT') && 
      ((c.assignedConsultantId && c.assignedConsultantId !== 'unassigned' && c.assignedConsultantId === consultantId) ||
       (c.consultantId && c.consultantId !== 'unassigned' && c.consultantId === consultantId)) && 
      (statusUpper === 'PAID' || statusUpper === 'PENDING');
    
    const isUnassigned = !c.assignedConsultantId || c.assignedConsultantId === 'unassigned' || c.assignedConsultantId === '' || c.consultantId === 'unassigned';

    const isBroadcastRinging = (dispatchUpper === 'RINGING' || dispatchUpper === 'RE-ROUTING' || dispatchUpper === 'ESCALATED') && 
      isUnassigned && 
      (statusUpper === 'PAID' || statusUpper === 'PENDING') && 
      isCadreMatch &&
      !(c.declinedBy || []).includes(consultantId);
    
    return isDirectRinging || isBroadcastRinging;
  });

  const effectiveConsultations = consultations.filter(c => {
    if (!consultantId) return false;
    const statusUpper = (c.status || '').toUpperCase();
    const dispatchUpper = (c.dispatchStatus || '').toUpperCase();

    if (statusUpper.startsWith('CANCEL') || dispatchUpper.startsWith('CANCEL') || dispatchUpper === 'EXPIRED') {
      return false;
    }

    const isMine = (c.assignedConsultantId && c.assignedConsultantId !== 'unassigned' && c.assignedConsultantId === consultantId) ||
                   (c.consultantId && c.consultantId !== 'unassigned' && c.consultantId === consultantId);
    if (isMine) {
      const isActive = statusUpper === 'IN_PROGRESS' || statusUpper === 'ACTIVE' || statusUpper === 'PAID' || statusUpper === 'ACCEPTED' || statusUpper === 'PENDING';
      return isActive;
    }

    const consultantCadre = user?.cadre || 'UNASSIGNED';
    const normalizedUserCadre = normalizeCadre(consultantCadre);
    const targetCadreNorm = normalizeCadre(c.cadreNeeded || c.consultantCadre || (c as any).targetCadre || 'UNASSIGNED');

    let isCadreMatch = false;
    if ((normalizedUserCadre as string) === 'UNASSIGNED') {
      if (targetCadreNorm === 'DOCTOR') {
        isCadreMatch = true;
      }
    } else {
      if (targetCadreNorm === 'DOCTOR') {
        isCadreMatch = (normalizedUserCadre === 'DOCTOR' || normalizedUserCadre === 'SPECIALIST' || normalizedUserCadre === 'PHYSICIAN_ASSISTANT');
      } else if (targetCadreNorm === 'SPECIALIST') {
        isCadreMatch = (normalizedUserCadre === 'SPECIALIST' || normalizedUserCadre === 'DOCTOR');
      } else if (targetCadreNorm === 'PHYSICIAN_ASSISTANT') {
        isCadreMatch = (normalizedUserCadre === 'PHYSICIAN_ASSISTANT' || normalizedUserCadre === 'DOCTOR');
      } else if (targetCadreNorm === 'PHARMACIST') {
        isCadreMatch = (normalizedUserCadre === 'PHARMACIST' || normalizedUserCadre === 'PHARM_TECH');
      } else if (targetCadreNorm === 'PHARM_TECH') {
        isCadreMatch = (normalizedUserCadre === 'PHARM_TECH' || normalizedUserCadre === 'PHARMACIST');
      } else {
        isCadreMatch = (normalizedUserCadre as string) === (targetCadreNorm as string);
      }
    }

    const isUnassigned = !c.assignedConsultantId || c.assignedConsultantId === 'unassigned' || c.assignedConsultantId === '' || c.consultantId === 'unassigned';

    const isBroadcast = (dispatchUpper === 'RINGING' || dispatchUpper === 'RE-ROUTING' || dispatchUpper === 'ESCALATED') && 
                        isUnassigned &&
                        (statusUpper === 'PAID' || statusUpper === 'PENDING') && 
                        isCadreMatch &&
                        !(c.declinedBy || []).includes(consultantId);
    
    return isMine || isBroadcast || statusUpper === 'COMPLETED';
  });

  const completedConsultations = effectiveConsultations.filter(c => c.status === 'COMPLETED');
  
  const isProTier = user?.subscriptionTier === 'pro_partner';
  const consultantSharePct = isProTier ? 0.75 : 0.70;

  const totalGrossTotalEarnings = completedConsultations.reduce((acc, curr) => acc + (curr.amountPaidGHS || 0), 0);
  const consultantEarnings = completedConsultations.reduce((acc, curr) => {
    const payoutAmount = curr.payoutAmountGHS !== undefined ? curr.payoutAmountGHS : (curr.amountPaidGHS || 0) * consultantSharePct;
    return acc + payoutAmount;
  }, 0);
  
  const consultant70Earnings = Math.round(consultantEarnings * 100) / 100;
  const patientsSeen = completedConsultations.length;

  useEffect(() => {
    if (!consultantId) return;
    const q = query(collection(db, 'payout_requests'), where('consultantId', '==', consultantId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PayoutRequest[] = [];
      snapshot.forEach(docSnap => {
        list.push({ requestId: docSnap.id, ...docSnap.data() } as PayoutRequest);
      });
      list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      setPayoutRequests(list);
    }, (err) => {
      console.error("Error fetching payout requests:", err);
    });
    return () => unsubscribe();
  }, [consultantId]);

  const totalRequestedPayouts = payoutRequests
    .filter(r => r.status !== 'failed')
    .reduce((acc, curr) => acc + (curr.amountGHS || 0), 0);

  const availableBalanceGHS = Math.max(0, Math.round((consultant70Earnings - totalRequestedPayouts) * 100) / 100);
  
  const reviews = completedConsultations.filter(c => c.rating || (c as any).patientRating);
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, curr) => acc + (curr.rating || (curr as any).patientRating || 0), 0) / reviews.length).toFixed(1)
    : '5.0';

  const isPendingReview = !effectiveUser?.isVerified && effectiveUser?.verificationStatus !== 'verified';

  useEffect(() => {
    if (isPendingReview) {
      // Allow viewing all tabs, default to portfolio if empty
    }
  }, [isPendingReview]);
  
  if (!effectiveUser || isLoading) {
    return <DashboardSkeleton />;
  }

  const handleJoin = async (id: string) => {
    if (isPendingReview) return;
    navigate(`/consultation/${id}`);
  };

  return (
    <>
      {isMobileViewport ? (
        <ConsultantMobileDashboard
          effectiveUser={effectiveUser}
          effectiveConsultations={effectiveConsultations}
          patientsSeen={patientsSeen}
          consultant70Earnings={consultant70Earnings}
          averageRating={averageRating}
          isPendingReview={isPendingReview}
          setActiveDashboardTab={setActiveDashboardTab}
          activeDashboardTab={activeDashboardTab}
          isOnline={isOnline}
          globalLogoUrl={globalLogoUrl}
          onOpenSettings={() => setIsProfileModalOpen(true)}
          onOpenDeletion={() => setIsDeleteModalOpen(true)}
          renderActiveTabContent={() => {
            switch (activeDashboardTab) {
              case 'queue':
                return (
                  <ConsultantPatientQueue 
                    consultations={effectiveConsultations}
                    isPendingReview={isPendingReview}
                    onOpenHistory={(p) => {
                      setHistoryPatient(p);
                      setIsHistoryDrawerOpen(true);
                    }}
                    onJoinSession={handleJoin}
                    isLoading={isLoading}
                  />
                );
              case 'soap':
                return (
                  <ConsultantSoapNoteAssistant
                    consultantId={consultantId}
                    consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                  />
                );
              case 'drug-safety':
                return (
                  <DrugSafetyChecker />
                );
              case 'referrals':
                return (
                  <SpecialistReferralNetwork
                    consultantId={consultantId}
                    consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                    consultantCadre={normalizeCadre(effectiveUser?.cadre)}
                  />
                );
              case 'follow-ups':
                return (
                  <FollowUpScheduler
                    consultantId={consultantId}
                    consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                  />
                );
              case 'payout-hub':
              case 'ledger':
                return (
                  <ConsultantPayoutHub
                    consultantId={consultantId}
                    consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                    totalGrossGHS={totalGrossTotalEarnings}
                    consultant70Earnings={consultant70Earnings}
                  />
                );
              case 'portfolio':
                return (
                  <ConsultantProfileEditor 
                    user={user}
                    isEditingPortfolio={isEditingPortfolio}
                    setIsEditingPortfolio={setIsEditingPortfolio}
                    isSavingPortfolio={isSavingPortfolio}
                  />
                );
              case 'subscription':
                return (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <SubscriptionCard />
                  </div>
                );
              case 'schedule':
                return (
                  <ConsultantPatientQueue 
                    consultations={effectiveConsultations}
                    isPendingReview={isPendingReview}
                    onOpenHistory={(p) => {
                      setHistoryPatient(p);
                      setIsHistoryDrawerOpen(true);
                    }}
                    onJoinSession={handleJoin}
                    isLoading={isLoading}
                  />
                );
              case 'stg-reference':
                return (
                  <ConsultantGuidelinesDrawer
                    isOpen={true}
                    onClose={() => setActiveDashboardTab('appointments')}
                  />
                );
              case 'feedback':
                return (
                  <ConsultantFeedbackView reviews={reviews} />
                );
              case 'chat': {
                const chatSessions = effectiveConsultations.filter(c => c.status === 'COMPLETED' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.status === 'PAID' || c.status === 'PENDING');
                const activeSession = chatSessions.find(s => ((s as any).id || s.sessionId) === selectedChatSessionId) || chatSessions[0];
                const currentChatId = activeSession ? ((activeSession as any).id || activeSession.sessionId) : null;
  
                return (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] grid grid-cols-1">
                    <div className="border-b border-slate-200 bg-white p-4">
                      <h3 className="font-bold text-slate-950 text-sm">Patient Messages & Follow-ups</h3>
                    </div>
                    {activeSession && currentChatId ? (
                      <div className="flex flex-col h-full min-h-[450px]">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-slate-950 text-sm">{activeSession.patientName || 'Patient'}</h4>
                          </div>
                        </div>
                        <div className="flex-1 p-4 bg-slate-50/30">
                          <ConsultationChat
                            consultationId={currentChatId}
                            currentUserId={consultantId}
                            currentUserRole="consultant"
                            currentUserName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                            isCompleted={activeSession.status === 'COMPLETED'}
                            followUpWindowClosesAt={(activeSession as any).followUpWindowClosesAt}
                            followUpMessagesRemaining={(activeSession as any).followUpMessagesRemaining || 5}
                            className="h-full border border-slate-200 rounded-2xl shadow-sm bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-600">
                        <p className="text-xs font-semibold">No active conversation thread.</p>
                      </div>
                    )}
                  </div>
                );
              }
              case 'more':
                return null;
              default:
                return null;
            }
          }}
        />
      ) : (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] w-full bg-slate-50">
          <ConsultantSidebar
            activeDashboardTab={activeDashboardTab}
            setActiveDashboardTab={setActiveDashboardTab}
            globalLogoUrl={globalLogoUrl}
            onOpenSettings={() => setIsProfileModalOpen(true)}
            onOpenDeletion={() => setIsDeleteModalOpen(true)}
          />
          
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* Mobile Navigation Header & Tab Bar */}
            <div className="md:hidden bg-white border-b border-slate-200 p-3 sticky top-0 z-30 shadow-xs flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-950 uppercase tracking-tight">Consultant Workspace</span>
                <NetworkSyncIndicator compact={true} />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {[
                  { id: 'appointments', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'queue', label: 'Patient Queue', icon: Users },
                  { id: 'stg-reference', label: 'Ghana STG', icon: Stethoscope },
                  { id: 'soap', label: 'SOAP Notes', icon: FileText },
                  { id: 'drug-safety', label: 'Drug Safety', icon: ShieldAlert },
                  { id: 'referrals', label: 'Referrals', icon: Building2 },
                  { id: 'follow-ups', label: 'Follow-ups', icon: Clock },
                  { id: 'payout-hub', label: 'Earnings & MoMo', icon: Landmark },
                  { id: 'schedule', label: 'Schedule', icon: Calendar },
                  { id: 'chat', label: 'Messages', icon: MessageSquare },
                  { id: 'portfolio', label: 'Portfolio', icon: UserCircle },
                  { id: 'feedback', label: 'Feedback', icon: Star },
                  { id: 'signout', label: 'Sign Out', icon: LogOut },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeDashboardTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (tab.id === 'signout') {
                          logout();
                        } else {
                          setActiveDashboardTab(tab.id);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : tab.id === 'signout'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={14} className={isActive ? 'text-white' : tab.id === 'signout' ? 'text-red-500' : 'text-slate-700'} />
                      <span>{tab.label.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            
            {/* Pending Review Banner */}
            {isPendingReview && (
              <div className="bg-amber-500 text-white rounded-3xl p-6 md:p-8 mb-8 shadow-xl shadow-amber-500/20 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck size={32} className="text-amber-200" />
                    <h3 className="text-xl font-black uppercase tracking-tight">Your Account Is Under Review</h3>
                  </div>
                  <p className="text-amber-50 text-sm leading-relaxed max-w-2xl">
                    Your account is under review by our medical directorate. Once your face-to-face review and credential verification are completed by the administrator, instant consultations and patient queue access will unlock.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-4">
                    <div className="bg-amber-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                      <CheckCircle2 size={16} />
                      View-Only Mode Active
                    </div>
                  </div>
                </div>
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              </div>
            )}

            {/* Face-to-Face Compliance Review Banner */}
            {user?.reviewScheduledAt && (
              <div className="bg-sky-50 border border-sky-200 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <Video size={32} className="text-sky-600" />
                  <h3 className="text-xl font-black text-sky-900 uppercase tracking-tight">Mandatory Face-to-Face Compliance Review</h3>
                </div>
                <p className="text-sky-800 text-sm leading-relaxed mb-6">
                  Our clinical administration team has scheduled a mandatory live video review with you on <span className="font-bold">{new Date(user.reviewScheduledAt).toLocaleString()}</span>. 
                  Before joining, you must review and agree to the compliance terms below.
                </p>

                {!user.reviewTermsAcceptedAt ? (
                  <div className="bg-white p-6 rounded-2xl border border-sky-100 shadow-sm">
                    <h4 className="font-bold text-slate-950 mb-3 text-sm">Pre-Review Compliance & Terms Agreement</h4>
                    <ul className="text-xs text-slate-800 space-y-2 mb-6 list-disc list-inside">
                      <li>I confirm that my submitted professional indemnity insurance and medical licensing documents are authentic and currently active.</li>
                      <li>I understand that I am operating as an independent contractor and assume full personal and professional liability for clinical advice provided on this platform.</li>
                      <li>I agree to adhere strictly to the PockettClinic Code of Conduct during all patient interactions.</li>
                      <li>I consent to this Face-to-Face review being recorded for auditing and compliance verification purposes.</li>
                    </ul>
                    
                    <label className="flex items-start gap-3 mb-6 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={reviewTermsChecked}
                        onChange={(e) => setReviewTermsChecked(e.target.checked)}
                        className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                      />
                      <span className="text-sm font-bold text-slate-900">I have read, understood, and accept these compliance terms.</span>
                    </label>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={handleAcceptReviewTerms}
                        disabled={!reviewTermsChecked || isAcceptingReviewTerms}
                        className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isAcceptingReviewTerms ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                        Accept Terms & Unlock Video Link
                      </button>
                      <button
                        disabled
                        className="bg-slate-100 text-slate-600 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                      >
                        <Video size={18} />
                        Video Link Locked
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle2 size={24} className="text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-950 text-sm">Terms Accepted</h4>
                        <p className="text-xs text-slate-700 mt-1">You agreed to the compliance terms on {new Date(user.reviewTermsAcceptedAt).toLocaleString()}.</p>
                        <p className="text-xs text-slate-900 font-semibold mt-2">Meeting Time: <span className="font-bold">{new Date(user.reviewScheduledAt).toLocaleString()}</span></p>
                      </div>
                    </div>
                    <a 
                      href={user.reviewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Video size={18} />
                      Join Native Video Room
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Dashboard Header */}
            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 ${isPendingReview ? 'opacity-50 pointer-events-none hidden' : ''}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight whitespace-nowrap">
                  {user?.fullName?.split(' ')[0] || 'Consultant'} Workspace
                </h2>
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md shadow-xs whitespace-nowrap">
                  ID: {formatMemberId(user)}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap`}>
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  Verified
                </span>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => {
                    if (!user?.independentContractorAffirmed) {
                      setIsAffirmationModalOpen(true);
                      return;
                    }
                    updateUserProfile({ isOnline: !isOnline });
                  }}
                  className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border shadow-sm cursor-pointer whitespace-nowrap ${
                    isOnline
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      : 'bg-slate-800 hover:bg-slate-900 text-slate-100 border-slate-800'
                  }`}
                >
                  {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                  <span>{isOnline ? 'Go Offline' : 'Go Online'}</span>
                </button>
              </div>
            </div>

            {/* Notification Permission Prompt */}
            {!isAdminView && notifPermission !== 'granted' && !hideNotificationBanner && (
              <div className="bg-indigo-900 text-white rounded-3xl p-6 mb-8 shadow-xl shadow-indigo-500/20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-200 shrink-0 border border-white/10 backdrop-blur-sm">
                    <BellRing size={28} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-tight">Stay Alerted for Bookings</h4>
                    <p className="text-indigo-200 text-sm mt-1 max-w-xl font-semibold leading-relaxed">
                      Enable background push notifications to receive real-time mobile alerts when a patient books a consultation, even when your app is closed.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleEnableNotifications}
                  disabled={isEnablingNotifs}
                  className="relative z-10 bg-white text-indigo-900 hover:bg-indigo-50 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all flex items-center gap-3 whitespace-nowrap cursor-pointer"
                >
                  {isEnablingNotifs ? <Loader2 size={20} className="animate-spin" /> : <Bell size={20} />}
                  {notifPermission === 'denied' ? 'Re-enable Notifications' : 'Enable Native Alerts'}
                </button>
                <div className="absolute -right-24 -bottom-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
              </div>
            )}

            {/* Indemnity Warning */}
            {user?.indemnityStatus === 'deferred_pending' && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-pulse-subtle">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest">Compliance Action Required</h4>
                    <p className="text-sm text-amber-800 mt-1 font-semibold leading-relaxed">
                      You are currently operating under a Personal Liability Agreement. Please upload your Professional Indemnity (PI) certificate to normalize your clinical status.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsIndemnityModalOpen(true)} 
                  className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 whitespace-nowrap transition-all cursor-pointer"
                >
                  Upload Certificate
                </button>
              </div>
            )}

            {activeDashboardTab === 'appointments' && (
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

                  {(() => {
                    const upcoming = [...effectiveConsultations]
                      .filter(c => (c.status === 'IN_PROGRESS' || c.status === 'ACTIVE') && (c.consultantId === consultantId || c.assignedConsultantId === consultantId) && !isStaleSession(c))
                      .sort((a, b) => {
                        const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
                        const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
                        return dateA - dateB;
                      })
                      .slice(0, 3);

                    if (upcoming.length === 0) {
                      return (
                        <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <Calendar className="mx-auto text-slate-500 mb-2" size={32} />
                          <p className="text-xs text-slate-700 font-bold uppercase tracking-wider">No Upcoming Consultations</p>
                          <p className="text-[11px] text-slate-600 mt-1 font-semibold">Your schedule is currently clear of any active or pending sessions.</p>
                        </div>
                      );
                    }

                    return (
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
                    );
                  })()}
                </div>

                <ConsultantPatientQueue 
                  consultations={effectiveConsultations}
                  isPendingReview={isPendingReview}
                  onOpenHistory={(p) => {
                    setHistoryPatient(p);
                    setIsHistoryDrawerOpen(true);
                  }}
                  onJoinSession={handleJoin}
                  isLoading={isLoading}
                />
              </div>
            )}
            
            {activeDashboardTab === 'queue' && (
              <ConsultantPatientQueue 
                consultations={effectiveConsultations}
                isPendingReview={isPendingReview}
                onOpenHistory={(p) => {
                  setHistoryPatient(p);
                  setIsHistoryDrawerOpen(true);
                }}
                onJoinSession={handleJoin}
                isLoading={isLoading}
              />
            )}

            {activeDashboardTab === 'soap' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <ConsultantSoapNoteAssistant
                  consultantId={consultantId}
                  consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                />
              </div>
            )}

            {activeDashboardTab === 'drug-safety' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <DrugSafetyChecker />
              </div>
            )}

            {activeDashboardTab === 'referrals' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <SpecialistReferralNetwork
                  consultantId={consultantId}
                  consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                  consultantCadre={normalizeCadre(effectiveUser?.cadre)}
                />
              </div>
            )}

            {activeDashboardTab === 'follow-ups' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <FollowUpScheduler
                  consultantId={consultantId}
                  consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                />
              </div>
            )}

            {activeDashboardTab === 'payout-hub' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <ConsultantPayoutHub
                  consultantId={consultantId}
                  consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                  totalGrossGHS={totalGrossTotalEarnings}
                  consultant70Earnings={consultant70Earnings}
                />
              </div>
            )}

            {activeDashboardTab === 'portfolio' && (
              <ConsultantProfileEditor 
                user={user}
                isEditingPortfolio={isEditingPortfolio}
                setIsEditingPortfolio={setIsEditingPortfolio}
                isSavingPortfolio={isSavingPortfolio}
              />
            )}

            {activeDashboardTab === 'subscription' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <SubscriptionCard />
              </div>
            )}
            
            {activeDashboardTab === 'schedule' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <ConsultantPatientQueue 
                  consultations={effectiveConsultations}
                  isPendingReview={isPendingReview}
                  onOpenHistory={(p) => {
                    setHistoryPatient(p);
                    setIsHistoryDrawerOpen(true);
                  }}
                  onJoinSession={handleJoin}
                  isLoading={isLoading}
                />
              </div>
            )}

            {activeDashboardTab === 'ledger' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <ConsultantPayoutHub
                  consultantId={consultantId}
                  consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
                  totalGrossGHS={totalGrossTotalEarnings}
                  consultant70Earnings={consultant70Earnings}
                />
              </div>
            )}

            {activeDashboardTab === 'stg-reference' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-[600px]">
                <ConsultantGuidelinesDrawer
                  isOpen={true}
                  onClose={() => setActiveDashboardTab('appointments')}
                />
              </div>
            )}

            {activeDashboardTab === 'feedback' && (
              <ConsultantFeedbackView reviews={reviews} />
            )}

            {activeDashboardTab === 'chat' && (() => {
              const chatSessions = effectiveConsultations.filter(c => c.status === 'COMPLETED' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.status === 'PAID' || c.status === 'PENDING');
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
                              currentUserName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
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
            })()}
          </main>
          
          </div>
        </div>
      )}

      {/* Shared Modals for Desktop and Mobile */}
      <PayoutModal 
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        availableBalanceGHS={availableBalanceGHS}
        totalEarningsGHS={consultant70Earnings}
        pastPayoutRequests={payoutRequests}
        onSuccess={() => {}}
      />

      <UploadIndemnityModal 
        isOpen={isIndemnityModalOpen}
        onClose={() => setIsIndemnityModalOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        targetUser={effectiveUser}
      />

      <AccountDeletionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />

      {/* IncomingCallOverlay removed - handled by universal IncomingCallModal in App.tsx */}
    </>
  );
}
