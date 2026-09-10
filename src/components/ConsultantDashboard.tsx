import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
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
  AlertTriangle, DollarSign, ArrowLeft, Activity, LogOut, BookOpen, Share2, CalendarCheck
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import PayoutModal, { getWithdrawalWindowStatus } from './PayoutModal';
import UploadIndemnityModal from './UploadIndemnityModal';
import { PayoutRequest } from '../types';
import { DashboardSkeleton } from './Skeleton';

import { ConsultantSidebar } from './consultant/ConsultantSidebar';
import { ConsultantStats } from './consultant/ConsultantStats';
import { ConsultantPatientQueue } from './consultant/ConsultantPatientQueue';
import ConsultantSoapNoteAssistant from './consultant/ConsultantSoapNoteAssistant';
import DrugSafetyChecker from './consultant/DrugSafetyChecker';
import SpecialistReferralNetwork from './consultant/SpecialistReferralNetwork';
import FollowUpScheduler from './consultant/FollowUpScheduler';
import ConsultantPayoutHub from './consultant/ConsultantPayoutHub';
import { ConsultantProfileEditor } from './consultant/ConsultantProfileEditor';
import ConsultantGuidelinesDrawer from './ConsultantGuidelinesDrawer';
import { ConsultantFeedbackView } from './consultant/ConsultantFeedbackView';
import { NotificationsCenter } from './consultant/NotificationsCenter';
import { DashboardOverview } from './consultant/DashboardOverview';
import { ChatFollowUpView } from './consultant/ChatFollowUpView';
import ConsultationChat from './ConsultationChat';
import ProfileModal from './ProfileModal';
import SubscriptionCard from './SubscriptionCard';
import AccountDeletionModal from './AccountDeletionModal';
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
  const isConsultantThemselves = Boolean(user && (effectiveUser?.uid === user.uid || effectiveUser?.id === user.uid));
  const isAdminView = Boolean(
    (targetConsultant && !isConsultantThemselves) || 
    (user?.role === 'admin' && !isConsultantThemselves) || 
    (searchParams.get('consultantId') && searchParams.get('consultantId') !== user?.uid)
  );

  const activeDashboardTab = (searchParams.get('tab') || 'appointments') as any;
  const [prevTab, setPrevTab] = useState('appointments');
  
  const setActiveDashboardTab = (tab: string) => {
    if (activeDashboardTab !== 'notifications' && activeDashboardTab !== 'more') {
      setPrevTab(activeDashboardTab);
    }
    setSearchParams({ tab });
  };
  
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<any>(null);
  const [isAffirmationModalOpen, setIsAffirmationModalOpen] = useState(false);
  const [isSubmittingAffirmation, setIsSubmittingAffirmation] = useState(false);
  const [typedSignature, setTypedSignature] = useState('');
  const [reviewTermsChecked, setReviewTermsChecked] = useState(false);
  const [isAcceptingReviewTerms, setIsAcceptingReviewTerms] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isIndemnityModalOpen, setIsIndemnityModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  useEffect(() => {
    if (!db) {
      setLoadingNotifs(false);
      return;
    }

    const uid = effectiveUser?.uid || effectiveUser?.id;
    if (!uid) {
      setNotifications([]);
      setLoadingNotifs(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'user_notifications', uid, 'items'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        setNotifications(fetched);
        setLoadingNotifs(false);
      }, (err) => {
        console.warn('Notification stream warning:', err);
        setLoadingNotifs(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error starting notifications stream:', err);
      setLoadingNotifs(false);
    }
  }, [effectiveUser]);

  const unreadCount = notifications.filter(n => !n.read).length;
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

  // Background notification enablement as requested
  useEffect(() => {
    if (user?.uid && (user?.role === 'consultant' || user?.cadre) && user?.pushNotificationsEnabled !== true) {
      updateUserProfile({ pushNotificationsEnabled: true });
    }
  }, [user?.uid, user?.role, user?.cadre, user?.pushNotificationsEnabled, updateUserProfile]);

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

  useEffect(() => {
    if (!isAdminView && user?.uid && (user?.role === 'consultant' || !!user?.cadre)) {
      const handleUnload = () => {
        // Attempt to go offline when closing tab
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { isOnline: false }).catch(() => {});
      };

      window.addEventListener('beforeunload', handleUnload);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        // Also update on unmount (navigation)
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { isOnline: false }).catch(() => {});
      };
    }
  }, [user?.uid, user?.role, user?.cadre, isAdminView]);

  const handleAffirmStatus = async () => {
    if (!user) return;
    setIsSubmittingAffirmation(true);
    try {
      // Use updateUserProfile instead of direct updateDoc to ensure local context state synchronizes immediately
      await updateUserProfile({
        independentContractorAffirmed: true,
        termsAccepted: true,
        indemnityAgreed: true,
        isOnline: true, // Automatically go online upon signing
        contractorAffirmedAt: new Date().toISOString()
      });
      setIsAffirmationModalOpen(false);
      showToast("Clinical affirmation recorded and status updated to Online.", "success");
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
  const isOnline = effectiveUser?.isOnline === true;

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

  const completedConsultations = effectiveConsultations.filter(c => c.status === 'COMPLETED' || c.status === 'CLINICAL_ESCALATION');
  
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
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] w-full bg-slate-50">
          <ConsultantSidebar
            activeDashboardTab={activeDashboardTab}
            setActiveDashboardTab={setActiveDashboardTab}
            globalLogoUrl={globalLogoUrl}
            onOpenSettings={() => setIsProfileModalOpen(true)}
            onOpenDeletion={() => setIsDeleteModalOpen(true)}
            unreadCount={unreadCount}
          />
          
          <div className="flex-1 flex flex-col min-w-0 h-screen md:h-auto overflow-hidden relative">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24 md:pb-0">
              <main className="w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-5 space-y-4">
                
                {/* Mobile Sub-page Back Button */}
                {!['appointments', 'queue', 'chat', 'payout-hub', 'notifications', 'more'].includes(activeDashboardTab) && (
                  <div className="md:hidden flex items-center mb-1.5">
                    <button
                      onClick={() => setActiveDashboardTab('more')}
                      className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-widest text-[8px] active:scale-95 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm"
                    >
                      <ArrowLeft size={10} />
                      Back to Hub
                    </button>
                  </div>
                )}
            
            {/* Native Mobile Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-around h-12">
                {[
                  { id: 'appointments', label: 'Home', icon: LayoutDashboard },
                  { id: 'queue', label: 'Queue', icon: Users },
                  { id: 'chat', label: 'Chat', icon: MessageSquare },
                  { id: 'payout-hub', label: 'Wallet', icon: Landmark },
                  { id: 'more', label: 'More', icon: Settings },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === 'more' 
                    ? !['appointments', 'queue', 'chat', 'payout-hub', 'notifications'].includes(activeDashboardTab)
                    : activeDashboardTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (tab.id === 'more') {
                          setIsMoreMenuOpen(!isMoreMenuOpen);
                        } else {
                          setActiveDashboardTab(tab.id);
                          setIsMoreMenuOpen(false);
                        }
                      }}
                      className={`relative flex flex-col items-center justify-center gap-0.5 h-full px-2 transition-all active:scale-95 ${
                        isActive ? 'text-[#0A3B24]' : 'text-slate-400'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
                      <span className={`text-[8px] font-black uppercase tracking-tight ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                        {tab.label}
                      </span>
                      {isActive && (
                        <div className="absolute top-0 w-8 h-0.5 bg-[#0A3B24] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pending Review Banner */}
            {isPendingReview && (
              <div className="bg-amber-600 text-white rounded-xl p-2.5 mb-4 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={14} className="text-amber-200" />
                    <h3 className="text-[9px] font-black uppercase tracking-tight">Review In Progress</h3>
                  </div>
                  <p className="text-amber-50 text-[8px] leading-relaxed max-w-2xl font-bold uppercase tracking-tight">
                    Your account is under medical directorate review. Consultation access will unlock after verification.
                  </p>
                </div>
              </div>
            )}

            {/* Face-to-Face Compliance Review Banner */}
            {user?.reviewScheduledAt && (
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 md:p-4 mb-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Video size={18} className="text-sky-600" />
                  <h3 className="text-xs font-black text-sky-900 uppercase tracking-tight">Compliance Review</h3>
                </div>
                <p className="text-sky-800 text-[10px] leading-relaxed mb-3 font-bold uppercase tracking-tight">
                  Scheduled: <span className="underline">{new Date(user.reviewScheduledAt).toLocaleString()}</span>.
                </p>

                {!user.reviewTermsAcceptedAt ? (
                  <div className="bg-white p-3 rounded-lg border border-sky-100 shadow-sm">
                    <h4 className="font-black text-slate-950 mb-1.5 text-[9px] uppercase tracking-widest">Agreement</h4>
                    <ul className="text-[8px] text-slate-800 space-y-1 mb-3 list-disc list-inside font-bold uppercase tracking-tight">
                      <li>I confirm documents are authentic.</li>
                      <li>I assume clinical liability.</li>
                      <li>I agree to the Code of Conduct.</li>
                      <li>I consent to recording.</li>
                    </ul>
                    
                    <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={reviewTermsChecked}
                        onChange={(e) => setReviewTermsChecked(e.target.checked)}
                        className="mt-0.5 w-3.5 h-3.5 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                      />
                      <span className="text-[11px] font-bold text-slate-900 leading-tight">I have read, understood, and accept these compliance terms.</span>
                    </label>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={handleAcceptReviewTerms}
                        disabled={!reviewTermsChecked || isAcceptingReviewTerms}
                        className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black text-[9px] uppercase tracking-widest py-2 px-4 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isAcceptingReviewTerms ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Accept Terms
                      </button>
                      <button
                        disabled
                        className="bg-slate-100 text-slate-600 font-black text-[9px] uppercase tracking-widest py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200"
                      >
                        <Video size={12} />
                        Link Locked
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-950 text-[11px] uppercase">Terms Accepted</h4>
                        <p className="text-[10px] text-slate-600 mt-0.5">Agreed: {new Date(user.reviewTermsAcceptedAt).toLocaleString()}.</p>
                        <p className="text-[10px] text-slate-900 font-black mt-1 uppercase tracking-tight">Meeting: {new Date(user.reviewScheduledAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <a 
                      href={user.reviewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-widest py-2 px-4 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Video size={12} />
                      Join Video Room
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Header: Deep Emerald Banner */}
            <div className="md:hidden bg-[#0A3B24] -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 pt-4 pb-4 px-4 rounded-b-xl shadow-md relative overflow-hidden">
              {/* Branding and Action Row */}
              <div className="relative z-20 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center p-1.5 border border-white/10 shadow-inner">
                    <Activity size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-sm font-black text-white tracking-tight leading-none uppercase">
                      PockettClinic
                    </h1>
                    <p className="text-[7px] font-bold text-emerald-400 uppercase tracking-[0.12em] mt-0.5">
                      Your Digital Health Anywhere
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (activeDashboardTab === 'notifications') {
                        setActiveDashboardTab(prevTab || 'appointments');
                      } else {
                        setActiveDashboardTab('notifications');
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-all border border-white/10 relative"
                  >
                    <Bell size={16} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-[#0A3B24]" />
                    )}
                  </button>
                  <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-all border border-white/10"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>

              {/* Status Row */}
              <div className="relative z-10 flex items-center gap-2 flex-wrap">
                <h2 className="text-xs font-black text-white tracking-tight whitespace-nowrap">
                  {user?.fullName?.split(' ')[0] || 'Consultant'}
                </h2>
                <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md p-1 pr-2 rounded-full border border-white/5 shadow-sm">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 size={10} className="text-white" />
                  </div>
                  <span className="font-mono text-[8px] font-bold text-emerald-100 px-1 whitespace-nowrap opacity-80">
                    {formatMemberId(user)}
                  </span>
                  
                  {/* Tiny Pause Sync Indicator (Integrated) */}
                  <div className="flex gap-0.5 px-1 items-center border-l border-white/10 ml-0.5">
                    <div className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <div className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-pulse delay-75" />
                  </div>

                  <button
                    id="consultant-online-toggle"
                    onClick={async () => {
                      const currentId = effectiveUser?.uid || effectiveUser?.id;
                      if (!currentId) return;

                      if (!isAdminView && !user?.independentContractorAffirmed) {
                        setIsAffirmationModalOpen(true);
                        return;
                      }

                      try {
                        const newStatus = !isOnline;
                        if (!isAdminView || isConsultantThemselves) {
                          await updateUserProfile({ isOnline: newStatus });
                        } else {
                          await updateDoc(doc(db, 'users', currentId), { isOnline: newStatus });
                        }
                        showToast(`You are now ${newStatus ? 'Online' : 'Offline'}.`, newStatus ? 'success' : 'info');
                      } catch (err) {
                        console.error("Error toggling online status:", err);
                        showToast("Failed to update status. Please try again.", "error");
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full font-black text-[7px] uppercase tracking-widest transition-all flex items-center gap-1 border shadow-sm cursor-pointer whitespace-nowrap ${
                      isOnline
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    }`}
                  >
                    {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
                    <span>{isOnline ? 'Off' : 'On'}</span>
                  </button>
                </div>
              </div>
              
              {/* Abstract Background Effect */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
            </div>

            {/* Desktop Header */}
            <div className={`hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 ${isPendingReview ? 'opacity-50 pointer-events-none hidden' : ''}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-slate-950 tracking-tight whitespace-nowrap uppercase">
                  {user?.fullName?.split(' ')[0] || 'Consultant'} Workspace
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded shadow-xs whitespace-nowrap">
                    ID: {formatMemberId(user)}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap`}>
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    Verified
                  </span>
                  <button
                    onClick={async () => {
                      const currentId = effectiveUser?.uid || effectiveUser?.id;
                      if (!currentId) return;

                      if (!isAdminView && !user?.independentContractorAffirmed) {
                        setIsAffirmationModalOpen(true);
                        return;
                      }

                      try {
                        const newStatus = !isOnline;
                        if (!isAdminView || isConsultantThemselves) {
                          await updateUserProfile({ isOnline: newStatus });
                        } else {
                          await updateDoc(doc(db, 'users', currentId), { isOnline: newStatus });
                        }
                        showToast(`You are now ${newStatus ? 'Online' : 'Offline'}.`, newStatus ? 'success' : 'info');
                      } catch (err) {
                        console.error("Error toggling online status:", err);
                        showToast("Failed to update status. Please try again.", "error");
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-1.5 border shadow-sm cursor-pointer whitespace-nowrap ${
                      isOnline
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    }`}
                  >
                    {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    <span>{isOnline ? 'Go Offline' : 'Go Online'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Indemnity Warning */}
            {user?.indemnityStatus === 'deferred_pending' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black text-amber-900 uppercase tracking-widest">Compliance Required</h4>
                    <p className="text-[11px] text-amber-800 mt-0.5 font-bold leading-tight uppercase">
                      Operating under waiver. Please upload your PI certificate.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsIndemnityModalOpen(true)} 
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md whitespace-nowrap transition-all cursor-pointer"
                >
                  Upload Certificate
                </button>
              </div>
            )}

            {/* More Menu Drawer */}
            <AnimatePresence>
              {isMoreMenuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="md:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[45]"
                  />
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[46] shadow-[0_-10px_30px_rgba(0,0,0,0.1)] max-h-[80vh] overflow-y-auto no-scrollbar border-t border-slate-100 pb-24"
                  >
                    <div className="sticky top-0 bg-white/80 backdrop-blur-md px-5 py-4 border-b border-slate-50 flex items-center justify-between z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-950 text-white flex items-center justify-center shadow-lg">
                          <Settings size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-950 tracking-tight uppercase">Professional Hub</h3>
                          <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Clinical Suite</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsMoreMenuOpen(false)}
                        className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors border border-slate-100"
                      >
                        <LogOut size={14} className="rotate-90" />
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-2.5">
                      {[
                        { id: 'notifications', label: 'Dispatch', icon: Bell, desc: 'Alerts & News' },
                        { id: 'stg-reference', label: 'STG Guides', icon: BookOpen, desc: 'Ghana STG' },
                        { id: 'soap', label: 'SOAP Notes', icon: FileText, desc: 'Voice Docs' },
                        { id: 'drug-safety', label: 'Safety Check', icon: ShieldAlert, desc: 'Interactions' },
                        { id: 'referrals', label: 'Referrals', icon: Share2, desc: 'Network' },
                        { id: 'schedule', label: 'Schedule', icon: CalendarCheck, desc: 'Availability' },
                        { id: 'payout-hub', label: 'Payout Hub', icon: Landmark, desc: 'Earnings' },
                        { id: 'portfolio', label: 'My Portfolio', icon: UserCircle, desc: 'Credentials' },
                        { id: 'feedback', label: 'Reviews', icon: Star, desc: 'Ratings' },
                        { id: 'subscription', label: 'Account', icon: ShieldCheck, desc: 'Membership' },
                        { id: 'signout', label: 'Exit', icon: LogOut, desc: 'Sign Out', color: 'bg-rose-50 border-rose-100 text-rose-600' },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.id === 'signout') {
                                if (window.confirm('Are you sure you want to sign out?')) {
                                  logout().then(() => navigate('/'));
                                }
                              } else {
                                setActiveDashboardTab(item.id);
                                setIsMoreMenuOpen(false);
                              }
                            }}
                            className={`flex flex-col items-start gap-2 p-3 rounded-xl border transition-all active:scale-[0.97] text-left h-full ${
                              item.color || 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border ${
                              item.color ? 'bg-rose-100 border-rose-200' : 'bg-white border-slate-100 text-[#0A3B24]'
                            }`}>
                              <Icon size={14} />
                            </div>
                            <div className="text-left">
                              <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{item.label}</div>
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-none mt-0.5">{item.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {activeDashboardTab === 'notifications' && (
              <NotificationsCenter
                notifications={notifications}
                loadingNotifs={loadingNotifs}
                unreadCount={unreadCount}
                userUid={effectiveUser?.uid || effectiveUser?.id || ''}
                onNavigateToFeedback={() => setActiveDashboardTab('feedback')}
              />
            )}

            {activeDashboardTab === 'appointments' && (
              <DashboardOverview
                effectiveConsultations={effectiveConsultations}
                patientsSeen={patientsSeen}
                consultant70Earnings={consultant70Earnings}
                averageRating={averageRating}
                isLoading={isLoading}
                isPendingReview={isPendingReview}
                consultantId={consultantId}
                isStaleSession={isStaleSession}
                handleJoin={handleJoin}
                onOpenHistory={(p) => {
                  setHistoryPatient(p);
                  setIsHistoryDrawerOpen(true);
                }}
              />
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

            {activeDashboardTab === 'chat' && (
              <ChatFollowUpView
                chatSessions={effectiveConsultations.filter(c => c.status === 'COMPLETED' || c.status === 'CLINICAL_ESCALATION' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.status === 'PAID' || c.status === 'PENDING')}
                selectedChatSessionId={selectedChatSessionId}
                setSelectedChatSessionId={setSelectedChatSessionId}
                consultantId={consultantId}
                consultantName={formatConsultantName(effectiveUser?.fullName || effectiveUser?.displayName, effectiveUser?.prefix) || 'Consultant'}
              />
            )}
          </main>
          
          </div>
        </div>
      </div>

      {/* Shared Modals for Desktop and Mobile */}
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

      {/* Premium Independent Contractor Agreement Affirmation Modal */}
      {isAffirmationModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
          />
          
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 md:p-6 shadow-2xl border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 relative z-10 flex flex-col scrollbar-thin">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-md">
                <Scale size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">Independent Contractor Agreement</h4>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Mandatory Clinical Affirmation</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-3 text-slate-600 text-xs leading-relaxed border-y border-slate-100 py-4">
              <p className="font-bold text-slate-800 uppercase tracking-tight text-[10px]">
                Review and accept terms to enable active status:
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  { id: 'credentials', label: 'Verification', text: 'I certify credentials and certificates are valid and active.' },
                  { id: 'liability', label: 'Clinical Liability', text: 'I assume sole professional liability for all clinical advice and Rx.' },
                  { id: 'negligence', label: 'Platform Indemnity', text: 'I agree to indemnify PockettClinic from practice negligence claims.' },
                  { id: 'status', label: 'Independent Practice', text: 'I affirm status as an independent contractor rendering services.' }
                ].map((item, index) => (
                  <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <h5 className="font-black text-slate-800 text-[10px] uppercase tracking-tight">{item.label}</h5>
                      <p className="text-[9px] text-slate-500 font-medium leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-amber-800 text-[10px] flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <p className="font-bold leading-relaxed uppercase tracking-tight">
                  By signing, you digitally lock your clinical profile to "Active". Permanent legal record.
                </p>
              </div>
            </div>

            <div className="pt-1 pb-3 space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Type name to sign (Must match: "{effectiveUser?.fullName || effectiveUser?.displayName || 'Your Name'}")
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Type name exactly"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-300 font-mono"
                />
                {typedSignature.trim().toLowerCase() === (effectiveUser?.fullName || effectiveUser?.displayName || '').trim().toLowerCase() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                    <ShieldCheck size={16} />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAffirmationModalOpen(false);
                  showToast("Affirmation required for online status.", "info");
                }}
                className="flex-1 py-2 text-slate-400 hover:text-slate-600 font-black text-[9px] uppercase tracking-widest transition-colors text-center border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAffirmation || typedSignature.trim().toLowerCase() !== (effectiveUser?.fullName || effectiveUser?.displayName || '').trim().toLowerCase()}
                onClick={handleAffirmStatus}
                className="flex-[2] py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-lg shadow-md transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingAffirmation ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Signing...</span>
                  </>
                ) : (
                  'Sign & Affirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IncomingCallOverlay removed - handled by universal IncomingCallModal in App.tsx */}
    </>
  );
}
