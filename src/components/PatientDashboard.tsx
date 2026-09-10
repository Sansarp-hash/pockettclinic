import React, { useState, useEffect, useRef } from 'react';
import NotificationManager from './NotificationManager';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { 
  Calendar, Clock, CheckCircle2, FileText, Video, UserCircle, Activity, Crown, 
  Pill, ArrowRight, Star, Loader2, X, HeartPulse, Plus, ShieldCheck, 
  LayoutDashboard, Users, Award, Menu, Settings, ChevronRight,
  CreditCard, Search, Sparkles, FolderLock, Stethoscope, AlertCircle, Phone, Lock,
  Home, Bell, MoreHorizontal, Heart, Ticket, LogOut, UserCheck, AlertTriangle
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { VitalsRecord, FamilyMember, ConsultationSession, isConsultantRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import MedicalVaultModal from './MedicalVaultModal';
import { DashboardSkeleton } from './Skeleton';
import ConsultationHistory from './ConsultationHistory';
import MedicationReminderTracker from './patient/MedicationReminderTracker';
import FamilyProfilesManager from './patient/FamilyProfilesManager';
import ProfileModal from './ProfileModal';
import AccountDeletionModal from './AccountDeletionModal';
import SubscriptionCard from './SubscriptionCard';
import { formatMemberId } from '../lib/memberId';
import { formatConsultantName } from '../lib/formatters';
import { CADRE_CONFIGS, normalizeCadre } from '../config/consultantCadreConfig';
import { isCarePlus } from '../lib/subscriptions';
import { getSessionTierPricing } from '../lib/pricing';

export interface AvailableConsultant {
  id: string;
  name: string;
  title: string;
  cadre: 'Doctor' | 'Pharmacist' | 'Specialist';
  specialty: string;
  rating: number;
  reviewsCount: number;
  fee: number;
  isOnline: boolean;
  avatar: string;
  ghsLicense: string;
  hospitalAffiliation: string;
}



const VitalsChart: React.FC<{ data: VitalsRecord[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const width = 500;
  const height = 150;
  const paddingLeft = 30;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 20;

  const sysVals = data.map(v => v.bloodPressureSys || 0);
  const diaVals = data.map(v => v.bloodPressureDia || 0);
  const hrVals = data.map(v => v.heartRate || 0);
  const allVals = [...sysVals, ...diaVals, ...hrVals];
  
  const maxVal = Math.max(...allVals, 140);
  const minVal = Math.max(0, Math.min(...allVals, 40) - 10);
  const valRange = maxVal - minVal || 1;

  const pointsCount = data.length;
  const getX = (index: number) => {
    if (pointsCount <= 1) return (width - paddingLeft - paddingRight) / 2 + paddingLeft;
    return paddingLeft + (index * (width - paddingLeft - paddingRight)) / (pointsCount - 1);
  };
  const getY = (val: number) => {
    return height - paddingBottom - ((val - minVal) * (height - paddingTop - paddingBottom)) / valRange;
  };

  const getPathD = (vals: number[]) => {
    return vals.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(val)}`).join(' ');
  };

  const sysPath = getPathD(sysVals);
  const diaPath = getPathD(diaVals);
  const hrPath = getPathD(hrVals);

  return (
    <div className="relative w-full h-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + ratio * (height - paddingTop - paddingBottom);
          const labelVal = Math.round(maxVal - ratio * valRange);
          return (
            <g key={idx} className="opacity-30">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#94a3b8" strokeDasharray="2 2" strokeWidth={1} />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-bold">{labelVal}</text>
            </g>
          );
        })}

        {/* Sys Path Line */}
        {sysVals.length > 0 && (
          <path d={sysPath} fill="none" stroke="#f43f5e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Dia Path Line */}
        {diaVals.length > 0 && (
          <path d={diaPath} fill="none" stroke="#fb7185" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Heart Rate Path Line */}
        {hrVals.length > 0 && (
          <path d={hrPath} fill="none" stroke="#8b5cf6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dynamic Interactive Dot Circles */}
        {data.map((item, i) => {
          const x = getX(i);
          const dateStr = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
          return (
            <g key={i} className="group/dot cursor-pointer">
              {/* Highlight bar */}
              <line x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} stroke="#e2e8f0" strokeWidth={1} className="opacity-0 group-hover/dot:opacity-60 transition-opacity pointer-events-none" />

              <circle cx={x} cy={getY(item.bloodPressureSys || 120)} r={4.5} fill="#f43f5e" stroke="#fff" strokeWidth={1.5} />
              <circle cx={x} cy={getY(item.bloodPressureDia || 80)} r={4} fill="#fb7185" stroke="#fff" strokeWidth={1.5} />
              <circle cx={x} cy={getY(item.heartRate || 72)} r={4} fill="#8b5cf6" stroke="#fff" strokeWidth={1.5} />
              
              {/* Tooltip Overlay */}
              <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-150 pointer-events-none" style={{ zIndex: 50 }}>
                {(() => {
                  const tooltipWidth = 100;
                  const tooltipHeight = 48;
                  let tx = x - tooltipWidth / 2;
                  if (tx < 5) tx = 5;
                  if (tx + tooltipWidth > width - 5) tx = width - tooltipWidth - 5;
                  const ty = 2;
                  
                  return (
                    <g>
                      <rect x={tx} y={ty} width={tooltipWidth} height={tooltipHeight} rx={8} fill="#0f172a" opacity={0.95} />
                      <text x={tx + 50} y={ty + 12} textAnchor="middle" className="text-[8px] fill-slate-300 font-bold">{dateStr}</text>
                      <text x={tx + 50} y={ty + 24} textAnchor="middle" className="text-[9px] fill-rose-300 font-black">BP: {item.bloodPressureSys}/{item.bloodPressureDia}</text>
                      <text x={tx + 50} y={ty + 36} textAnchor="middle" className="text-[9px] fill-purple-300 font-black">HR: {item.heartRate} bpm</text>
                    </g>
                  );
                })()}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export interface PatientDashboardProps {
  targetPatient?: any;
  allPatients?: any[];
  onSelectPatient?: (patient: any) => void;
  onBackToList?: () => void;
}

export default function PatientDashboard({
  targetPatient,
  allPatients = [],
  onSelectPatient,
  onBackToList
}: PatientDashboardProps = {}) {
  const navigate = useNavigate();
  const { user, setUser, consultations, prescriptions, updateConsultation, cancelConsultation, isLoading, showToast, tickets, allUsers, globalLogoUrl, globalTitle, globalSlogan, logout, systemConfig } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [consultantSearch, setConsultantSearch] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  
  const rotatingMessages = [
    "Connect instantly with verified specialists.",
    "Manage your medical records securely.",
    "Track your vitals and health history.",
    "Access your digital prescription slips."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % rotatingMessages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const availableConsultants = (allUsers || []).filter(u => isConsultantRole(u.role) && u.isOnline).filter((c: any) => {
    if (!consultantSearch.trim()) return true;
    const term = consultantSearch.toLowerCase();
    const name = (c.fullName || c.displayName || '').toLowerCase();
    const spec = (c.specialty || c.cadre || '').toLowerCase();
    return name.includes(term) || spec.includes(term);
  });

  const isCadreOnline = (cadre: string) => {
    return (allUsers || []).some(u => isConsultantRole(u.role) && u.isOnline && normalizeCadre(u.cadre) === normalizeCadre(cadre));
  };


  const effectiveUser = targetPatient || (searchParams.get('patientId') ? allPatients.find(p => (p.uid || p.id) === searchParams.get('patientId')) : null) || user;
  const isAdminView = Boolean(targetPatient || user?.role === 'admin' || searchParams.get('patientId'));
  const patientId = effectiveUser?.uid || effectiveUser?.id;

  const contextUser = targetPatient || user;

  const [selectedDependent, setSelectedDependent] = useState<FamilyMember | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [specialistSearchQuery, setSpecialistSearchQuery] = useState('');
  
  // Direct Consultation Payment State
  const [selectedConsultantForPay, setSelectedConsultantForPay] = useState<AvailableConsultant | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [payComplaint, setPayComplaint] = useState('');
  const [payChannel, setPayChannel] = useState<'mobile_money' | 'card'>('mobile_money');
  const [momoNumber, setMomoNumber] = useState('');
  const [isProcessingConsultPay, setIsProcessingConsultPay] = useState(false);
  const [agreedToSessionTerms, setAgreedToSessionTerms] = useState(false);
  const [agreeOnceAndForAll, setAgreeOnceAndForAll] = useState(false);
  
  const activeTabParam = searchParams.get('tab') as 'overview' | 'appointments' | 'history' | 'medications' | 'vault' | 'family' | 'portfolio' | 'tickets' | 'subscription' | null;
  const activeTab = activeTabParam || 'overview';
  const setActiveTab = (tab: 'overview' | 'appointments' | 'history' | 'medications' | 'vault' | 'family' | 'portfolio' | 'tickets') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
    setMobileMenuOpen(false);
  };

  const handleStartConsultPay = (consultant: AvailableConsultant) => {
    setSelectedConsultantForPay(consultant);
    setPayComplaint('Requesting instant consultation regarding general medical advice.');
    setSelectedTicketId('');
  };

  const handleConfirmConsultPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsultantForPay) return;

    // Verify consultant is still online
    const targetId = selectedConsultantForPay.id;
    const latestConsultant = (allUsers || []).find(u => u.uid === targetId || u.id === targetId);
    if (!latestConsultant || !latestConsultant.isOnline) {
      showToast("This consultant has just gone offline. Please choose another online consultant.", "error");
      setSelectedConsultantForPay(null);
      return;
    }
    
    // Require terms if not globally accepted
    if (!user?.hasAcceptedGlobalTerms && !agreedToSessionTerms) {
      alert("You must agree to the Terms of Service and Telemedicine Consent before proceeding.");
      return;
    }

    setIsProcessingConsultPay(true);
    
    // Save global terms if they opted in
    if (!user?.hasAcceptedGlobalTerms && agreeOnceAndForAll) {
      try {
        const userRef = doc(db, 'users', user?.uid || '');
        await updateDoc(userRef, { hasAcceptedGlobalTerms: true });
        if (setUser && user) setUser({ ...user, hasAcceptedGlobalTerms: true });
      } catch (err) {
        console.error("Failed to save global terms", err);
      }
    }
    try {
      const sessionId = `sess_${Date.now()}`;
      const reference = `PAY_${Date.now()}`;
      const now = new Date().toISOString();

      const selectedTicket = selectedTicketId ? activePatientTickets.find((t: any) => t.ticketId === selectedTicketId) : null;
      const ticketRemaining = selectedTicket ? (selectedTicket.remainingGHS !== undefined ? selectedTicket.remainingGHS : (selectedTicket.valueGHS || 30)) : 0;
      const originalFee = selectedConsultantForPay.fee || 0;
      const difference = selectedTicket ? originalFee - ticketRemaining : originalFee;
      const finalAmountToPay = difference > 0 ? difference : 0;

      // Case A: Fully covered by active support ticket
      if (selectedTicket && finalAmountToPay === 0) {
        const newRemaining = ticketRemaining - originalFee;
        const newStatus = newRemaining <= 0 ? 'used' : 'active';

        // Redeem/deduct ticket in Firestore
        await updateDoc(doc(db, 'tickets', selectedTicketId), {
          remainingGHS: newRemaining,
          status: newStatus,
          usedAt: now,
          usedForSessionId: sessionId
        });

        // Create the session directly as IN_PROGRESS
        const newSession: ConsultationSession = {
          sessionId,
          patientId: patientId || user?.uid || 'guest_patient',
          patientName: effectiveUser?.fullName || 'Patient',
          consultantId: selectedConsultantForPay.id,
          consultantName: selectedConsultantForPay.name,
          consultantCadre: selectedConsultantForPay.cadre as 'PHARM_TECH' | 'PHARMACIST' | 'DOCTOR' | 'SPECIALIST',
          scheduledAt: now,
          chiefComplaints: payComplaint || 'Instant telehealth consultation (Fully Covered by Support Ticket)',
          status: 'PAID',
          dispatchStatus: 'ringing',
          ringingStartedAt: Date.now(),
          ringingExpiresAt: Date.now() + (300 * 1000),
          roomId: `room_${sessionId}`,
          amountPaidGHS: originalFee,
          createdAt: now,
          paystackReference: `TCK_FULL_${selectedTicketId}`
        };

        await setDoc(doc(db, 'consultations', sessionId), newSession);

        showToast(`Consultation successfully booked using Support Ticket ${selectedTicketId}! Connecting to ${selectedConsultantForPay.name}...`, 'success');
        setSelectedConsultantForPay(null);
        setSelectedTicketId('');
        setIsProcessingConsultPay(false);
        navigate(`/consultation/${sessionId}`);
        return;
      }

      // Case B: Partial or normal cash payment
      if (selectedTicket && finalAmountToPay > 0) {
        // Ticket value is less than session price. Deduct the whole ticket balance first.
        await updateDoc(doc(db, 'tickets', selectedTicketId), {
          remainingGHS: 0,
          status: 'used',
          usedAt: now,
          usedForSessionId: sessionId
        });
      }

      // Hit actual payment endpoint
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Session expired. Please sign in again.");

      const initRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          email: effectiveUser?.email || 'patient@example.com',
          amount: finalAmountToPay,
          reference: selectedTicket ? `PARTIAL_${reference}` : reference
        })
      });
      
      const initData = await initRes.json();
      
      if (initData.authorization_url) {
        // Save pending session info for return recovery
        localStorage.setItem('pockettclinic_pending_session', JSON.stringify({
          sessionId,
          consultantId: selectedConsultantForPay.id,
          consultantName: selectedConsultantForPay.name,
          consultantCadre: selectedConsultantForPay.cadre,
          payComplaint,
          originalFee,
          selectedTicketId,
          timestamp: Date.now()
        }));
        // Redirect to real Paystack checkout
        window.location.href = initData.authorization_url;
        return;
      }

      throw new Error(initData.error || "Payment gateway failed to provide a checkout URL.");
    } catch (err: any) {
      console.error("Consultation checkout failed:", err);
      showToast("Checkout failed: " + (err.message || "Please check your connection and try again."), "error");
      setIsProcessingConsultPay(false);
    }
  };

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ratingSessionId, setRatingSessionId] = useState<string | null>(null);
  const [escalationViewSessionId, setEscalationViewSessionId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const handlePaymentReturn = async (reference: string) => {
    if (isProcessingConsultPay) return;
    setIsProcessingConsultPay(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication failed");

      const verifyRes = await fetch('/api/payments/verify-paystack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ reference })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || "Payment verification failed");
      }

      // Reconstruct session from localStorage
      const pendingRaw = localStorage.getItem('pockettclinic_pending_session');
      if (!pendingRaw) {
        // If we have the reference but lost local state, we can still try to see if session exists
        // or just warn the user.
        showToast("Payment verified, but session data was lost. Re-syncing with server...", "warning");
        // We could potentially reconstruct from Paystack metadata if we sent it
        setIsProcessingConsultPay(false);
        setSearchParams({});
        return;
      }

      const pending = JSON.parse(pendingRaw);
      
      // Prevent stale session creation (over 30 mins old)
      if (Date.now() - pending.timestamp > 30 * 60 * 1000) {
        localStorage.removeItem('pockettclinic_pending_session');
        setSearchParams({});
        setIsProcessingConsultPay(false);
        return;
      }

      const now = new Date().toISOString();
      const nowMs = Date.now();
      const ringingTimeoutSecs = 300;

      const newSession: ConsultationSession = {
        sessionId: pending.sessionId,
        patientId: patientId || user?.uid || 'guest_patient',
        patientName: effectiveUser?.fullName || 'Patient',
        consultantId: pending.consultantId,
        consultantName: pending.consultantName,
        consultantCadre: pending.consultantCadre,
        assignedConsultantId: pending.consultantId,
        scheduledAt: now,
        chiefComplaints: pending.payComplaint || 'Instant telehealth consultation',
        status: 'PAID',
        dispatchStatus: 'ringing',
        ringingStartedAt: nowMs,
        ringingExpiresAt: nowMs + (ringingTimeoutSecs * 1000),
        roomId: `room_${pending.sessionId}`,
        amountPaidGHS: pending.originalFee,
        createdAt: now,
        paystackReference: reference
      };

      await setDoc(doc(db, 'consultations', pending.sessionId), newSession);

      try {
        const idToken = await auth.currentUser?.getIdToken();
        fetch('/api/notifications/trigger', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            targetUid: pending.consultantId || undefined,
            targetCadre: pending.consultantCadre || 'UNASSIGNED',
            title: 'New consultation request',
            body: 'You have a new consultation request waiting for your acceptance.',
            actionType: 'new_consultation',
            targetPath: '/consultant/dashboard'
          })
        }).catch(err => console.warn('Failed to notify consultant:', err));
      } catch (notifErr) {
        console.warn('Consultant notification trigger error:', notifErr);
      }

      localStorage.removeItem('pockettclinic_pending_session');
      
      showToast("Payment verified! Connecting to your consultant...", "success");
      
      // Clear URL params and navigate
      setSearchParams({});
      navigate(`/consultation/${pending.sessionId}`);
    } catch (err: any) {
      console.error("Payment return handler failed:", err);
      showToast("Payment verification failed: " + (err.message || "Unknown error"), "error");
      setSearchParams({});
    } finally {
      setIsProcessingConsultPay(false);
    }
  };

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (reference && user) {
      handlePaymentReturn(reference);
    }
  }, [searchParams, user]);
  
  // Real Firestore Vitals State (starts completely empty, zero mock data)
  const [vitals, setVitals] = useState<VitalsRecord[]>([]);
  
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [newVitals, setNewVitals] = useState({
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 72,
    weightKg: 70,
    glucoseLevel: 90
  });

  const navItems = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'history', name: 'History', icon: Clock },
    { id: 'medications', name: 'Medications & Rx', icon: Pill },
    { id: 'vault', name: 'Vitals & Vault', icon: HeartPulse },
    { id: 'family', name: 'Family Profiles', icon: Users },
    { id: 'tickets', name: 'My Tickets', icon: Ticket },
    { id: 'subscription', name: 'Subscription', icon: Crown },
  ] as const;

  useEffect(() => {
    if (!patientId) return;
    
    try {
      const vQ = query(collection(db, 'vitals'), where('patientId', '==', patientId));
      const vUnsub = onSnapshot(vQ, (snap) => {
        const data: VitalsRecord[] = [];
        snap.forEach(d => data.push(d.data() as VitalsRecord));
        data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setVitals(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `vitals/${patientId}`);
      });

      return () => {
        vUnsub();
      };
    } catch (err) {
      console.warn("Vitals listener error:", err);
    }
  }, [patientId]);
  
  const handleLogVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmittingRating(true);
    try {
      const newRec: VitalsRecord = {
        recordId: `v_${Date.now()}`,
        patientId: patientId || user.uid,
        bloodPressureSys: newVitals.bloodPressureSys,
        bloodPressureDia: newVitals.bloodPressureDia,
        heartRate: newVitals.heartRate,
        weightKg: newVitals.weightKg,
        glucoseLevel: newVitals.glucoseLevel,
        createdAt: new Date().toISOString()
      };

      setVitals(prev => [...prev, newRec]);
      setShowVitalsModal(false);
      showToast('Health vitals saved successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast("Failed to save vitals. Please try again.", "error");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const submitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingSessionId || rating === 0) return;
    
    setIsSubmittingRating(true);
    try {
      await updateConsultation(ratingSessionId, { rating, feedback });
      setRatingSessionId(null);
      setRating(0);
      setFeedback('');
      showToast('Thank you for rating your consultation!', 'success');
    } catch (err) {
      console.error('Failed to submit rating', err);
      showToast('Could not submit rating. Please try again.', "error");
    } finally {
      setIsSubmittingRating(false);
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
          if (!isNaN(targetTime) && targetTime > 0) {
            const elapsed = now - targetTime;
            
            if (elapsed > 30 * 60 * 1000) {
              // Standard 30m stale session cleanup
              try {
                await updateConsultation(c.sessionId, { status: 'MISSED' });
              } catch (err) {
                console.warn("Failed to mark stale session as MISSED:", err);
              }
            }
          }
        }
      }
    };
    handleMissedSessions();
  }, [consultations, updateConsultation]);

  if (!effectiveUser || isLoading) {
    return <DashboardSkeleton />;
  }

  const effectiveConsultations = consultations.filter(c => 
    c.patientId === patientId || 
    (!patientId && contextUser?.role === 'patient')
  );
  
  const isStaleSession = (c: any) => {
    if (c.status === 'COMPLETED' || c.status === 'CANCELLED' || c.status === 'MISSED' || c.status === 'FAILED' || c.status === 'TICKET_ISSUED' || c.status === 'TERMINATED_SYSTEM_FAILURE') {
      return true;
    }
    const targetTime = new Date(c.scheduledAt || c.createdAt || 0).getTime();
    if (isNaN(targetTime) || targetTime === 0) return false;
    return (Date.now() - targetTime) > (30 * 60 * 1000);
  };

  const upcomingConsultations = effectiveConsultations.filter(c => 
    (c.status === 'PAID' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.status === 'PENDING') && 
    (c.status as string) !== 'TICKET_ISSUED' &&
    (c.status as string) !== 'TERMINATED_SYSTEM_FAILURE' &&
    (c.status as string) !== 'FAILED' &&
    (c.status as string) !== 'MISSED' &&
    !isStaleSession(c)
  );
  const pastConsultations = effectiveConsultations.filter(c => 
    c.status === 'COMPLETED' || 
    c.status === 'CANCELLED' || 
    (c.status as string) === 'INCONCLUSIVE' || 
    ((c.status as string) === 'CLINICAL_ESCALATION' || (c.status as string) === 'INCONCLUSIVE') || 
    c.status === 'TICKET_ISSUED' || 
    c.status === 'TERMINATED_SYSTEM_FAILURE' || 
    c.status === 'FAILED' ||
    c.status === 'MISSED' ||
    isStaleSession(c)
  );
  const activePrescriptions = (prescriptions || []).filter(p => !patientId || p.patientName === effectiveUser?.fullName || !p.isFulfilled);
  const totalMedsCount = activePrescriptions.reduce((acc, p) => acc + (p.medications ? p.medications.length : 0), 0);
  const activePatientTickets = (tickets || []).filter(t => t.patientId === patientId && t.status === 'active');

  const reenterableSession = effectiveConsultations.find((cons: any) => {
    const isAccepted = cons.dispatchStatus === 'accepted';
    const isInProgress = cons.status === 'IN_PROGRESS' || cons.status === 'ACTIVE';
    if (!isAccepted || !isInProgress) return false;
    if (cons.patientId !== (patientId || user?.uid)) return false;

    const baseDurationMins = cons.tierDurationMinutes || 15;
    const extensionMins = (cons.extensionCount || 0) * 10;
    const totalDurationMs = (baseDurationMins + extensionMins) * 60 * 1000;

    const startTimeMs = cons.acceptedAt 
      ? new Date(cons.acceptedAt).getTime() 
      : cons.startedAt 
        ? new Date(cons.startedAt).getTime() 
        : null;

    if (!startTimeMs) return true;

    const expiryTimeMs = startTimeMs + totalDurationMs;
    return Date.now() < expiryTimeMs;
  });

  const renderOverviewTab = () => {
    return (
      <div className="bg-[#F8F9FA] min-h-screen pb-10">
        
        {/* ACTIVE SESSION RE-ENTRY BANNER */}
        {reenterableSession && (
          <div className="mx-3 lg:mx-0 mt-3 relative z-30">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5 animate-pulse">
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0 border border-emerald-200">
                  <Video size={14} className="animate-bounce" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-emerald-900 leading-tight uppercase tracking-tight">Session In Progress</h4>
                  <p className="text-[9px] text-emerald-700 mt-0.5 font-bold leading-relaxed uppercase tracking-tight">
                    Active: <span className="font-black underline">{formatConsultantName(reenterableSession.consultantName, reenterableSession.consultantPrefix)}</span>.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/consultation/${reenterableSession.sessionId}`)}
                className="w-full md:w-auto bg-[#0A3B24] hover:bg-emerald-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Video size={12} />
                <span>Join Room</span>
              </button>
            </div>
          </div>
        )}

        {/* QUICK CARE SECTION */}
        <div className="mt-3 px-3 lg:px-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-800 tracking-tight uppercase">Quick Actions</h3>
            <button 
              onClick={() => { const el = document.getElementById('consultants-section'); if(el) el.scrollIntoView({ behavior: 'smooth' }); }} 
              className="text-[8px] font-extrabold text-slate-500 hover:text-slate-700 flex items-center gap-0.5 transition-colors uppercase tracking-wider"
            >
              <span>Directory</span> <ChevronRight size={8} strokeWidth={3} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
             <button 
              onClick={() => { const el = document.getElementById('consultants-section'); if(el) el.scrollIntoView({ behavior: 'smooth' }); }}
              className="bg-white p-2 rounded-lg flex items-center justify-between shadow-xs active:scale-95 hover:shadow-sm transition-all text-left group border border-slate-100 cursor-pointer min-w-0"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                  <Stethoscope size={14} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[10px] font-black text-slate-800 leading-tight truncate uppercase">Consultants</h4>
                </div>
              </div>
              <ChevronRight size={10} className="text-slate-300 shrink-0" strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => setShowVitalsModal(true)}
              className="bg-white p-2 rounded-lg flex items-center justify-between shadow-xs active:scale-95 hover:shadow-sm transition-all text-left group border border-slate-100 cursor-pointer min-w-0"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 flex items-center justify-center text-purple-600 shrink-0 group-hover:scale-105 transition-transform">
                  <Activity size={14} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[10px] font-black text-slate-800 leading-tight truncate uppercase">Log Vitals</h4>
                </div>
              </div>
              <ChevronRight size={10} className="text-slate-300 shrink-0" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* GENERAL CADRES SECTION */}
        <div className="mt-4 px-3 lg:px-0 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-800 tracking-tight uppercase">Instant Care</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button 
              onClick={() => navigate('/booking/instant?cadre=DOCTOR')}
              className="bg-white p-2 rounded-xl flex flex-col justify-between shadow-xs active:scale-95 transition-all text-left group border border-slate-100 cursor-pointer min-w-0"
            >
              <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-1 shadow-sm shrink-0">
                <Stethoscope size={12} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h4 className="text-[9px] font-black text-slate-900 leading-tight truncate uppercase">
                  {getSessionTierPricing('DOCTOR', 'VIDEO', systemConfig).tier.title}
                </h4>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-[9px] font-black text-emerald-800">GHS {getSessionTierPricing('DOCTOR', 'VIDEO', systemConfig).grossFee}</span>
                  <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-full shrink-0 ${isCadreOnline('DOCTOR') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {isCadreOnline('DOCTOR') ? 'Live' : 'Off'}
                  </span>
                </div>
              </div>
            </button>

            <button 
              onClick={() => navigate('/booking/instant?cadre=PHARMACIST')}
              className="bg-white p-2 rounded-xl flex flex-col justify-between shadow-xs active:scale-95 transition-all text-left group border border-slate-100 cursor-pointer min-w-0"
            >
              <div className="w-5 h-5 rounded-lg bg-purple-600 text-white flex items-center justify-center mb-1 shadow-sm shrink-0">
                <Pill size={12} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h4 className="text-[9px] font-black text-slate-900 leading-tight truncate uppercase">
                  {getSessionTierPricing('PHARMACIST', 'VIDEO', systemConfig).tier.title}
                </h4>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-[9px] font-black text-purple-800">GHS {getSessionTierPricing('PHARMACIST', 'VIDEO', systemConfig).grossFee}</span>
                  <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-full shrink-0 ${isCadreOnline('PHARMACIST') ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>
                    {isCadreOnline('PHARMACIST') ? 'Live' : 'Off'}
                  </span>
                </div>
              </div>
            </button>

            <button 
              onClick={() => navigate('/booking/instant?cadre=PHARM_TECH')}
              className="bg-white p-2 rounded-xl flex flex-col justify-between shadow-xs active:scale-95 transition-all text-left group border border-slate-100 cursor-pointer min-w-0"
            >
              <div className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-1 shadow-sm shrink-0">
                <ShieldCheck size={12} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h4 className="text-[9px] font-black text-slate-900 leading-tight truncate uppercase">
                  {getSessionTierPricing('PHARM_TECH', 'VIDEO', systemConfig).tier.title}
                </h4>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-[9px] font-black text-blue-800">GHS {getSessionTierPricing('PHARM_TECH', 'VIDEO', systemConfig).grossFee}</span>
                  <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-full shrink-0 ${isCadreOnline('PHARM_TECH') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    {isCadreOnline('PHARM_TECH') ? 'Live' : 'Off'}
                  </span>
                </div>
              </div>
            </button>

            <button 
              onClick={() => navigate('/booking/instant?cadre=PHYSICIAN_ASSISTANT')}
              className="bg-white p-2 rounded-xl flex flex-col justify-between shadow-xs active:scale-95 transition-all text-left group border border-slate-100 cursor-pointer min-w-0"
            >
              <div className="w-5 h-5 rounded-lg bg-amber-600 text-white flex items-center justify-center mb-1 shadow-sm shrink-0">
                <UserCheck size={12} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h4 className="text-[9px] font-black text-slate-900 leading-tight truncate uppercase">
                  {getSessionTierPricing('PHYSICIAN_ASSISTANT', 'VIDEO', systemConfig).tier.title}
                </h4>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-[9px] font-black text-amber-800">GHS {getSessionTierPricing('PHYSICIAN_ASSISTANT', 'VIDEO', systemConfig).grossFee}</span>
                  <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-full shrink-0 ${isCadreOnline('PHYSICIAN_ASSISTANT') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                    {isCadreOnline('PHYSICIAN_ASSISTANT') ? 'Live' : 'Off'}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* FIND SPECIALIZED CARE SEARCH ENGINE */}
        <div className="mt-6 px-3 lg:px-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-black text-slate-800 tracking-tight flex items-center gap-1">
                <Sparkles size={14} className="text-emerald-600" />
                Specialist Directory
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Search available experts online.</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                value={specialistSearchQuery}
                onChange={(e) => setSpecialistSearchQuery(e.target.value)}
                placeholder="Search by name, role, or expertise..."
                className="w-full pl-8 pr-8 py-2 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
              />
              {specialistSearchQuery && (
                <button 
                  onClick={() => setSpecialistSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {specialistSearchQuery && (
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tight">
                  Instant <span className="text-emerald-700 font-black">{specialistSearchQuery} Specialist</span> Call
                </span>
                <button
                  onClick={() => navigate(`/booking/instant?cadre=SPECIALIST&specialty=${encodeURIComponent(specialistSearchQuery)}`)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <span>Book</span>
                  <ArrowRight size={10} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TOP CONSULTANTS ONLINE - Slimmed */}
        <div id="consultants-section" className="mt-5 space-y-2">
          <div className="flex items-center justify-between px-3 lg:px-0">
            <h3 className="text-[13px] font-black text-slate-800 tracking-tight uppercase">Top Consultants Online</h3>
            <button 
              onClick={() => { const el = document.getElementById('consultants-section'); if(el) el.scrollIntoView({ behavior: 'smooth' }); }}
              className="text-[8px] font-extrabold text-slate-600 hover:text-slate-800 flex items-center gap-0.5 transition-colors uppercase tracking-wider"
            >
              <span>All</span> <ChevronRight size={10} strokeWidth={2.5} />
            </button>
          </div>
          
          <div className="flex overflow-x-auto pb-3 -mx-3 px-3 lg:mx-0 lg:px-0 gap-2.5 snap-x snap-mandatory hide-scrollbar">
            {availableConsultants.length === 0 ? (
              <div className="text-center py-3 text-slate-600 w-full text-[9px] font-medium uppercase tracking-wider">No consultants online</div>
            ) : (
              availableConsultants.map((c: any) => (
                <div key={c.uid || c.id} className="min-w-[130px] w-[130px] snap-start bg-white rounded-xl overflow-hidden shadow-xs border border-slate-100 shrink-0 flex flex-col relative group pb-2.5">
                  <div className="h-[85px] bg-slate-100 relative m-1 rounded-lg overflow-hidden">
                    <img 
                      src={c.avatarUrl || c.profilePhotoUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${c.uid || c.id}&backgroundColor=e2e8f0`} 
                      alt={c.fullName || c.displayName} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm border border-slate-100">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[6px] font-black text-[#15803D] tracking-wider uppercase">Live</span>
                    </div>
                  </div>
                  <div className="px-2.5 pt-1 flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="font-black text-slate-800 text-[11px] leading-tight line-clamp-1 truncate uppercase">
                        {formatConsultantName(c.fullName || c.displayName, c.prefix)}
                      </h4>
                      <p className="text-[8px] text-slate-400 font-bold mt-0.5 line-clamp-1 uppercase tracking-tight">
                        {c.specialty || getSessionTierPricing(normalizeCadre(c.cadre || 'UNASSIGNED'), 'VIDEO', systemConfig).tier.title}
                      </p>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-black text-emerald-800">
                        GHS {getSessionTierPricing(normalizeCadre(c.cadre || 'UNASSIGNED'), 'VIDEO', systemConfig).grossFee}
                      </p>
                    </div>
                  </div>
                  <div className="px-2.5 mt-2.5 text-center">
                    <button 
                      onClick={() => handleStartConsultPay({ 
                        ...c, 
                        id: c.uid || c.id, 
                        name: formatConsultantName(c.fullName || c.displayName, c.prefix), 
                        fee: getSessionTierPricing(normalizeCadre(c.cadre || 'UNASSIGNED'), 'VIDEO', systemConfig).grossFee, 
                        avatar: c.avatarUrl || c.profilePhotoUrl 
                      })}
                      className="w-full bg-[#0A3B24] hover:bg-emerald-900 text-white py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-250 shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Video size={10} strokeWidth={2.5} />
                      <span>Consult</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* HEALTH SUMMARY */}
        <div className="mt-5 px-3 lg:px-0 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-800 tracking-tight uppercase">Health Summary</h3>
            <button 
              onClick={() => setActiveTab('vault')}
              className="text-[8px] font-extrabold text-slate-600 hover:text-slate-800 flex items-center gap-0.5 transition-colors uppercase tracking-wider"
            >
              <span>Vault</span> <ChevronRight size={10} strokeWidth={2.5} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <button onClick={() => setActiveTab('appointments')} className="bg-[#E8F5E9] py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform hover:opacity-90 border border-emerald-100 min-w-0">
              <Calendar size={14} className="text-emerald-700" strokeWidth={2} />
              <span className="text-[13px] font-black text-slate-900 leading-none">{upcomingConsultations.length}</span>
              <span className="text-[7px] text-slate-600 font-bold text-center truncate w-full uppercase tracking-tight">Active</span>
            </button>
            <button onClick={() => setActiveTab('medications')} className="bg-[#F3E5F5] py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform hover:opacity-90 border border-purple-100 min-w-0">
              <Pill size={14} className="text-purple-700" strokeWidth={2} />
              <span className="text-[13px] font-black text-slate-900 leading-none">{totalMedsCount}</span>
              <span className="text-[7px] text-slate-600 font-bold text-center truncate w-full uppercase tracking-tight">Meds</span>
            </button>
            <button onClick={() => setActiveTab('vault')} className="bg-[#FFEBEE] py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform hover:opacity-90 border border-rose-100 min-w-0">
              <HeartPulse size={14} className="text-rose-600" strokeWidth={2} />
              <span className="text-[13px] font-black text-slate-900 leading-none">{vitals.length}</span>
              <span className="text-[7px] text-slate-600 font-bold text-center truncate w-full uppercase tracking-tight">Vitals</span>
            </button>
            <button onClick={() => setActiveTab('family')} className="bg-[#E3F2FD] py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform hover:opacity-90 border border-blue-100 min-w-0">
              <Users size={14} className="text-blue-700" strokeWidth={2} />
              <span className="text-[13px] font-black text-slate-900 leading-none">0</span>
              <span className="text-[7px] text-slate-600 font-bold text-center truncate w-full uppercase tracking-tight">Family</span>
            </button>
          </div>
        </div>

        {/* UPCOMING CONSULTATION SESSION */}
        <div className="mt-5 px-3 lg:px-0">
          <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-100 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Calendar size={14} strokeWidth={2} />
                </div>
                <h3 className="text-[11px] font-black text-slate-800 tracking-tight uppercase">Consultation</h3>
              </div>
              <button 
                onClick={() => setActiveTab('appointments')} 
                className="text-[8px] font-extrabold text-[#0A3B24] flex items-center gap-0.5 uppercase tracking-wider"
              >
                <span>Full List</span> <ChevronRight size={10} strokeWidth={2.5} />
              </button>
            </div>

            {upcomingConsultations.length === 0 ? (
              <div className="flex items-center gap-2.5 py-1">
                <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-emerald-500" strokeWidth={1.5} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h4 className="text-[11px] font-black text-slate-800 leading-tight truncate uppercase">No Active Sessions</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase tracking-tight">Book a session now.</p>
                </div>
                <button 
                  onClick={() => { const el = document.getElementById('consultants-section'); if(el) el.scrollIntoView({ behavior: 'smooth' }); }} 
                  className="bg-[#0A3B24] text-white p-2 rounded-lg active:scale-95 transition-all shadow-sm"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 py-1">
                <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-9 h-9 bg-white rounded-lg flex flex-col items-center justify-center text-[#0A3B24] border border-emerald-100 shrink-0">
                    <span className="text-[7px] font-black uppercase tracking-wider leading-none">{new Date(upcomingConsultations[0].scheduledAt).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-[14px] font-black leading-none mt-0.5">{new Date(upcomingConsultations[0].scheduledAt).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="text-[11px] font-black text-slate-800 truncate uppercase">
                        {formatConsultantName(upcomingConsultations[0].consultantName, upcomingConsultations[0].consultantPrefix)}
                      </h4>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[7px] font-black tracking-wider uppercase rounded-full shrink-0 ml-2">
                        {upcomingConsultations[0].status === 'ACCEPTED' ? 'Ready' : 'Upcoming'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-500 font-bold uppercase tracking-tight">
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(upcomingConsultations[0].scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><Video size={10} /> Video Call</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => navigate(`/room/${upcomingConsultations[0].sessionId}`)}
                    className="w-full bg-[#0A3B24] text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Video size={12} strokeWidth={2.5} />
                    Enter Room
                  </button>

                  {(upcomingConsultations[0].dispatchStatus !== 'accepted' && upcomingConsultations[0].status !== 'IN_PROGRESS' && upcomingConsultations[0].status !== 'ACCEPTED') && (
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm('Cancel this pending consultation request? Any deducted consultation fee will be refunded to your wallet.');
                        if (confirmed) {
                          try {
                            await cancelConsultation(upcomingConsultations[0].sessionId);
                            showToast('Consultation request cancelled successfully and fee refunded.', 'success');
                          } catch (err: any) {
                            console.error('Failed to cancel consultation:', err);
                            showToast(err?.message || 'Failed to cancel consultation. Please try again.', 'error');
                          }
                        }
                      }}
                      className="w-full bg-rose-50 text-rose-600 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-rose-100 cursor-pointer"
                    >
                      <X size={12} /> Cancel Request
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM UTILITY LINKS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 px-3 lg:px-0">
          <button onClick={() => setActiveTab('vault')} className="bg-white p-3 rounded-xl shadow-xs border border-slate-100 flex items-center justify-between active:scale-95 hover:shadow-sm transition-all text-left group cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <HeartPulse size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Vitals Snapshot</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Health trends</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" strokeWidth={2.5} />
          </button>

          <button onClick={() => setShowVaultModal(true)} className="bg-white p-3 rounded-xl shadow-xs border border-slate-100 flex items-center justify-between active:scale-95 hover:shadow-sm transition-all text-left group cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FolderLock size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Medical Vault</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Secure records</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" strokeWidth={2.5} />
          </button>
        </div>

      </div>
    );
  };

  const renderAppointmentsTab = () => {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
              <Calendar className="text-slate-500" size={14} /> Scheduled Consultations
            </h3>
          </div>
          
          {upcomingConsultations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <Activity size={24} className="text-slate-400 mb-2" />
              <p className="font-black text-slate-800 uppercase text-[10px]">No Scheduled Appointments</p>
              <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-tight">Book a session to talk with healthcare specialists.</p>
              <button 
                onClick={() => { const el = document.getElementById('consultants-section'); if(el) el.scrollIntoView({ behavior: 'smooth' }); }}
                className="mt-3 inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider cursor-pointer"
              >
                <span>Book Now</span> <ArrowRight size={10} />
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingConsultations.map(c => {
                const isAccepted = c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.dispatchStatus === 'accepted';
                return (
                  <li key={c.sessionId} className="p-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
                      <div className="flex gap-2.5">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 shrink-0 border border-slate-200">
                          <UserCircle size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-slate-800 text-[11px] truncate uppercase tracking-tight">{formatConsultantName(c.consultantName, c.consultantPrefix)}</h4>
                            <span className={`text-[7px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-full border ${
                              isAccepted 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {isAccepted ? 'ACTIVE' : 'PENDING'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-tight">
                            <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(c.scheduledAt).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><Clock size={10}/> {new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        {c.status === 'PENDING' ? (
                          <Link 
                            to={`/book/${c.consultantId || 'doc_kwame_456'}`}
                            className="bg-[#09A5DB] hover:bg-[#078bb9] text-white px-3 py-1.5 rounded-lg text-[9px] font-black transition-all flex items-center justify-center shadow-xs w-full md:w-auto uppercase tracking-wider"
                          >
                            Pay & Confirm
                          </Link>
                        ) : (
                          <div className="flex gap-1.5">
                            <Link 
                              to={`/consultation/${c.sessionId}`}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all flex items-center justify-center gap-1 shadow-xs w-full md:w-auto uppercase tracking-wider ${
                                isAccepted 
                                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white' 
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <Video size={10} />
                              {isAccepted ? 'Join Room' : 'View Status'}
                            </Link>

                            {!isAccepted && c.status === 'PAID' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const confirmed = window.confirm('Cancel this request and get a full refund to your wallet?');
                                  if (!confirmed) return;
                                  try {
                                    await cancelConsultation(c.sessionId);
                                    showToast('Request cancelled and refunded to your wallet.', 'success');
                                  } catch (err: any) {
                                    showToast(err?.message || 'Could not cancel this request. Please try again.', 'error');
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-[9px] font-black transition-all flex items-center justify-center gap-1 border border-rose-100 text-rose-600 hover:bg-rose-50 w-full md:w-auto uppercase tracking-wider cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ConsultationHistory patientId={patientId} />

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
              <CheckCircle2 className="text-slate-500" size={14} /> Clinical History
            </h3>
          </div>
          
          {pastConsultations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <Activity size={24} className="text-slate-400 mb-2" />
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">No Past Consultations</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pastConsultations.map(c => (
                <li key={c.sessionId} className="p-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-tight">{formatConsultantName(c.consultantName, c.consultantPrefix)}</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-tight">{new Date(c.scheduledAt).toLocaleDateString()}</p>
                      </div>
                      {c.rating ? (
                        <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span className="text-[9px] font-black text-amber-800">{c.rating}</span>
                        </div>
                      ) : null}
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {(c.status === 'CLINICAL_ESCALATION' || c.status === 'INCONCLUSIVE') && (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle size={10} /> INCONCLUSIVE
                        </span>
                      )}
                      {c.prescriptionId && (
                        <Link 
                          to={`/prescriptions/${c.prescriptionId}`}
                          className="bg-white hover:bg-slate-50 text-slate-700 px-2 py-1 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 border border-slate-200 uppercase tracking-wider shadow-xs"
                        >
                          <FileText size={10} />
                          Rx SLIP
                        </Link>
                      )}
                      {(c.status === 'CLINICAL_ESCALATION' || c.status === 'INCONCLUSIVE') && c.escalationNotes && (
                        <button 
                          onClick={() => setEscalationViewSessionId(c.sessionId)}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 border border-slate-200 uppercase tracking-wider cursor-pointer"
                        >
                          <FileText size={10} />
                          ADD-UP SHEET
                        </button>
                      )}
                      {!c.rating && c.status === 'COMPLETED' && (
                        <button 
                          onClick={() => {
                             setRatingSessionId(c.sessionId);
                             setRating(0);
                             setFeedback('');
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 border border-emerald-100 uppercase tracking-wider cursor-pointer"
                        >
                          <Star size={10} />
                          RATE SESSION
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderMedicationsTab = () => {
    return (
      <div className="space-y-4">
        <MedicationReminderTracker
          patientId={patientId || ''}
          patientName={effectiveUser?.fullName || 'Patient'}
          activeDependentId={selectedDependent?.memberId || null}
          activeDependentName={selectedDependent?.fullName}
        />

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
              <Pill className="text-emerald-600" size={14} /> Prescription Slips
            </h3>
          </div>
          
          {activePrescriptions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <FileText size={24} className="text-slate-400 mb-2" />
              <p className="font-black text-slate-800 uppercase text-[10px]">No Active Prescriptions</p>
              <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-tight">Historical medications will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activePrescriptions.map(p => (
                <li key={p.rxId} className="p-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-black text-slate-800 text-[11px] truncate uppercase tracking-tight">Rx: {p.rxId}</h4>
                        <span className="bg-emerald-50 text-emerald-700 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase border border-emerald-100">VERIFIED</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">By {p.consultantName} • {new Date(p.createdAt || Date.now()).toLocaleDateString()}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(p.medications || []).map((med, i) => (
                          <span key={i} className="inline-flex items-center bg-white text-slate-700 px-1.5 py-0.5 rounded text-[8px] font-black border border-slate-200 shadow-xs truncate max-w-[120px] uppercase">
                            {med.drugName || med.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link 
                      to={`/prescriptions/${p.rxId}`}
                      className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all flex items-center justify-center shadow-xs whitespace-nowrap uppercase tracking-wider"
                    >
                      VIEW SLIP <ArrowRight size={10} className="ml-1" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderVaultTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
              <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
                <HeartPulse className="text-rose-500" size={14} /> Vitals History
              </h3>
              <button 
                onClick={() => setShowVitalsModal(true)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-1 rounded-lg text-[9px] font-black transition-colors flex items-center gap-1 border border-rose-100 uppercase tracking-wider cursor-pointer"
              >
                <Plus size={12} /> LOG READINGS
              </button>
            </div>
            
            <div className="p-4">
              {vitals.length === 0 ? (
                <div className="text-center text-slate-500 flex flex-col items-center py-6">
                  <Activity size={24} className="text-slate-400 mb-1" />
                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">No readings logged</p>
                  <button onClick={() => setShowVitalsModal(true)} className="text-[9px] text-slate-500 font-bold mt-1 hover:underline uppercase tracking-tight cursor-pointer">Add first reading</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-40 bg-white/50 rounded-lg p-3 border border-slate-100 shadow-xs">
                    <VitalsChart data={vitals} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                      <p className="text-[8px] text-rose-600 font-black mb-0.5 uppercase tracking-tight leading-none">BP (SYS/DIA)</p>
                      <p className="text-lg font-black text-rose-900 leading-none mt-1">{vitals[vitals.length - 1].bloodPressureSys}/{vitals[vitals.length - 1].bloodPressureDia}</p>
                    </div>
                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-200">
                      <p className="text-[8px] text-slate-600 font-black mb-0.5 uppercase tracking-tight leading-none">HEART RATE</p>
                      <p className="text-lg font-black text-slate-700 leading-none mt-1">{vitals[vitals.length - 1].heartRate} <span className="text-[9px]">BPM</span></p>
                    </div>
                    <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                      <p className="text-[8px] text-emerald-600 font-black mb-0.5 uppercase tracking-tight leading-none">WEIGHT</p>
                      <p className="text-lg font-black text-emerald-900 leading-none mt-1">{vitals[vitals.length - 1].weightKg} <span className="text-[9px]">KG</span></p>
                    </div>
                    <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                      <p className="text-[8px] text-amber-600 font-black mb-0.5 uppercase tracking-tight leading-none">GLUCOSE</p>
                      <p className="text-lg font-black text-amber-900 leading-none mt-1">{vitals[vitals.length - 1].glucoseLevel} <span className="text-[9px]">MG/DL</span></p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-[10px] font-black text-slate-800 mb-2 uppercase tracking-wider">Historical Logs</h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[8px] font-black text-slate-600 uppercase tracking-widest">
                            <th className="p-2">DATE</th>
                            <th className="p-2">BP (mmHg)</th>
                            <th className="p-2">HR (bpm)</th>
                            <th className="p-2">WEIGHT (kg)</th>
                            <th className="p-2">GLUCOSE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[9px] text-slate-800 font-bold">
                          {[...vitals].reverse().map((v, index) => (
                            <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2 text-slate-600">{new Date(v.createdAt).toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'})}</td>
                              <td className="p-2 text-rose-600">{v.bloodPressureSys}/{v.bloodPressureDia}</td>
                              <td className="p-2 text-slate-700">{v.heartRate}</td>
                              <td className="p-2 text-emerald-700">{v.weightKg}</td>
                              <td className="p-2 text-amber-700">{v.glucoseLevel}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50/30">
              <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
                <FileText className="text-slate-500" size={14} /> Medical Locker
              </h3>
            </div>
            <div className="p-4 text-center">
              <div className="w-10 h-10 bg-slate-50 rounded-xl mx-auto flex items-center justify-center text-slate-500 mb-2 border border-blue-50">
                <FolderLock size={20} />
              </div>
              <h4 className="text-[11px] font-black text-slate-800 uppercase">Document Storage</h4>
              <p className="text-[9px] text-slate-500 mt-1.5 mb-3 font-bold uppercase tracking-tight leading-relaxed">
                Lab reports, scan images, and clinical summaries.
              </p>
              <button
                onClick={() => setShowVaultModal(true)}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg text-[9px] font-black transition-all shadow-xs uppercase tracking-wider cursor-pointer"
              >
                OPEN VAULT
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  
  const renderPortfolioTab = () => {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center">
              <UserCircle size={20} />
            </div>
            <div>
              <h2 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">Portfolio</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">Manage details & account configuration.</p>
            </div>
          </div>
          
          {(!effectiveUser?.dob || !effectiveUser?.gender || !effectiveUser?.phone) && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start shadow-xs">
              <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg shrink-0">
                <AlertCircle size={14} />
              </div>
              <div>
                <h4 className="text-[11px] font-black text-amber-900 mb-0.5 uppercase">Incomplete Profile</h4>
                <p className="text-[9px] text-amber-800 leading-relaxed font-bold uppercase tracking-tight mb-2">Required details missing for safe care.</p>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black transition-all shadow-xs active:scale-95 flex items-center gap-1.5 uppercase tracking-wider"
                >
                  <Sparkles size={12} /> Complete Now
                </button>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="p-3 border border-slate-100 rounded-xl flex items-center justify-between hover:border-emerald-100 transition-colors bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-xs text-slate-500">
                  <UserCircle size={14} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-tight">Personal Details</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">Demographics & contact.</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors uppercase tracking-wider"
              >
                Edit
              </button>
            </div>
            
            <div className="p-3 border border-slate-100 rounded-xl flex items-center justify-between hover:border-emerald-100 transition-colors bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-xs text-slate-500">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-tight">Indemnity</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">Legal & consent.</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors uppercase tracking-wider"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

    const renderTicketsTab = () => {
    const myTickets = (tickets || []).filter((t: any) => t.patientId === patientId);
    return (
      <div className="space-y-4 pb-16">
        <div>
          <h2 className="text-[14px] font-black text-slate-800 tracking-tight flex items-center gap-1.5 uppercase">
            <Ticket className="text-emerald-600" size={18} />
            Support & Credits
          </h2>
          <p className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-tight">
            Active store credits and compensation tickets.
          </p>
        </div>

        {myTickets.length === 0 ? (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <Ticket size={24} className="text-slate-300 mb-2" />
            <h3 className="text-[10px] font-black text-slate-700 uppercase">No Tickets</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myTickets.map((t: any) => {
              const balance = t.remainingGHS !== undefined ? t.remainingGHS : (t.valueGHS || 30);
              const isActive = t.status === 'active';
              return (
                <div key={t.ticketId} className={`bg-white border ${isActive ? 'border-dashed border-emerald-300 shadow-xs' : 'border-slate-100 opacity-60'} rounded-xl p-3 flex flex-col gap-2.5 transition-all`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'} flex items-center justify-center shrink-0`}>
                        <Ticket size={16} className="rotate-45" />
                      </div>
                      <div>
                        <span className="font-mono font-black text-slate-700 text-[8px] tracking-widest bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{t.ticketId}</span>
                        <p className="text-[8px] text-slate-500 font-bold mt-0.5 leading-tight uppercase tracking-tight">
                          <span className="font-black text-slate-800">{t.reason || 'Credit'}</span>
                        </p>
                      </div>
                    </div>
                    <span className={`text-[7px] font-black uppercase ${isActive ? 'text-emerald-700 bg-emerald-100' : 'text-slate-500 bg-slate-50'} px-1.5 py-0.5 rounded`}>
                      {t.status}
                    </span>
                  </div>
                  {t.notes && (
                    <p className="text-[9px] text-slate-500 font-bold italic border-l border-slate-200 pl-1.5 leading-relaxed">{t.notes}</p>
                  )}
                  <div className="pt-2 border-t border-slate-50 flex items-end justify-between">
                    <div>
                      <p className="text-[7px] uppercase font-black tracking-widest text-slate-400">Value</p>
                      <p className="text-[9px] font-black text-slate-500">GHS {t.valueGHS || 30}.00</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] uppercase font-black tracking-widest text-slate-400">Balance</p>
                      <p className={`text-[13px] font-black ${isActive ? 'text-emerald-800' : 'text-slate-400'}`}>GHS {balance}.00</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFamilyTab = () => {
    return (
      <FamilyProfilesManager
        primaryPatientId={patientId || ''}
        primaryPatientName={effectiveUser?.fullName || 'Patient'}
        selectedDependentId={selectedDependent?.memberId || null}
        onSelectDependent={(dep) => setSelectedDependent(dep)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row w-full overflow-x-hidden">
      
      {/* Mobile Top Navigation Header */}
      <div className="lg:hidden bg-[#0A3B24] text-white px-3 pt-2.5 pb-2.5 flex flex-col shadow-sm relative z-20">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {globalLogoUrl ? (
              <img src={globalLogoUrl} alt="Logo" className="w-6 h-6 rounded-lg object-cover bg-white p-0.5 shrink-0 shadow-xs" />
            ) : (
              <div className="w-6 h-6 rounded-lg bg-[#C8E6C9] text-[#0A3B24] flex items-center justify-center shrink-0 shadow-xs">
                <Heart size={14} className="fill-[#0A3B24] text-[#0A3B24]" strokeWidth={2.5} />
              </div>
            )}
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-[11px] font-black leading-none tracking-tight text-white truncate uppercase">
                {globalTitle || 'PockettClinic'}
              </h1>
              <span className="text-[7px] text-emerald-100/90 font-black leading-none block truncate uppercase tracking-widest mt-0.5">{globalSlogan || 'Digital Hospital'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <NotificationManager iconClassName="text-white hover:bg-white/10" />
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-emerald-200 transition-colors"
            >
              {mobileMenuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop & Mobile Drawer Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 lg:z-10
        w-64 bg-white text-slate-600 flex flex-col justify-between
        h-screen transition-transform duration-300 ease-in-out shrink-0 border-r border-slate-200
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Patient Header Card */}
          <div className="bg-white rounded-xl p-3 border border-slate-100 space-y-2 shadow-xs">
            <div className="flex items-center gap-2.5">
              {effectiveUser?.avatarUrl || effectiveUser?.profilePhotoUrl ? (
                <img 
                  src={effectiveUser.avatarUrl || effectiveUser.profilePhotoUrl} 
                  alt={effectiveUser.fullName || 'Patient'} 
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 shadow-xs" 
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-lg shadow-xs border border-slate-200 shrink-0">
                  {effectiveUser?.fullName ? effectiveUser.fullName.charAt(0).toUpperCase() : 'P'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{effectiveUser?.fullName || 'Patient'}</h2>
                  <span className="bg-emerald-600 text-white text-[7px] font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                    <CheckCircle2 size={8} strokeWidth={4} /> OK
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 truncate font-bold uppercase tracking-tight">{effectiveUser?.email}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono text-[8px] font-black text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                    ID: {formatMemberId(effectiveUser)}
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
              <span>Status</span>
              <span className="text-emerald-600 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-600 animate-pulse" /> Active
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-0.5">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-3 mb-1.5">Navigation</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              let badgeCount = null;
              if (item.id === 'appointments' && upcomingConsultations.length > 0) badgeCount = upcomingConsultations.length;
              if (item.id === 'medications' && totalMedsCount > 0) badgeCount = totalMedsCount;

              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as any); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-black transition-all cursor-pointer uppercase tracking-tight ${
                    isActive 
                      ? 'bg-emerald-700 text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={14} className={isActive ? 'text-emerald-100' : 'text-slate-500'} />
                    <span>{item.name}</span>
                  </div>
                  {badgeCount !== null && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Actions Card */}
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">Quick Access</span>
            <button 
              onClick={() => setActiveTab('overview')}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2 px-3 rounded-lg text-[9px] font-black transition-all flex items-center justify-center gap-1.5 shadow-xs uppercase tracking-wider cursor-pointer"
            >
              <Video size={12} />
              <span>Consultants</span>
            </button>
            <button
              onClick={() => setShowVitalsModal(true)}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 py-2 px-3 rounded-lg text-[9px] font-black transition-all flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer uppercase shadow-xs"
            >
              <HeartPulse size={12} className="text-rose-500" />
              <span>Log Vitals</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-slate-200 space-y-2">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-600 hover:bg-white transition-colors cursor-pointer"
          >
            <Settings size={16} />
            <span>Profile Settings</span>
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <AlertCircle size={16} />
            <span>Account Actions</span>
          </button>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Canvas Container */}
      <main className={`flex-1 w-full md:p-6 min-w-0 max-w-7xl ${activeTab === 'overview' ? 'p-0 pt-0 pb-20' : 'p-4 pb-20'}`}>
        {/* Admin Inspection Banner */}
        {isAdminView && (
          <div className="bg-white text-slate-600 rounded-xl p-3 shadow-xs border border-slate-200 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                <UserCircle size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black tracking-widest uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                    ADMIN MIRROR
                  </span>
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                    {effectiveUser?.fullName || 'Patient'}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-tight">
                  Real-time sync for patient records & vitals.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {allPatients && allPatients.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-tight">Switch:</span>
                  <select
                    value={patientId || ''}
                    onChange={(e) => {
                      const found = allPatients.find(p => (p.uid || p.id) === e.target.value);
                      if (found && onSelectPatient) onSelectPatient(found);
                    }}
                    className="bg-white text-slate-800 text-[10px] font-black rounded border border-slate-200 px-1.5 py-0.5 outline-none cursor-pointer uppercase"
                  >
                    {allPatients.map(p => (
                      <option key={p.uid || p.id} value={p.uid || p.id}>
                        {p.fullName || 'Patient'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {onBackToList && (
                <button
                  onClick={onBackToList}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-[9px] font-black transition-all border border-slate-200 cursor-pointer uppercase tracking-wider"
                >
                  ← Directory
                </button>
              )}
            </div>
          </div>
        )}

        {/* Dashboard Header Title Bar */}
        <div className="flex flex-col gap-0.5 pb-3 border-b border-slate-100 mb-4 mx-4 lg:mx-0 mt-4 lg:mt-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight uppercase">
            {activeTab === 'overview' && `Hello, ${effectiveUser?.fullName?.split(' ')[0] || effectiveUser?.fullName || 'Patient'}`}
            {activeTab === 'appointments' && 'Consultations'}
            {activeTab === 'history' && 'Clinical History'}
            {activeTab === 'medications' && 'Medications'}
            {activeTab === 'vault' && 'Medical Locker'}
            {activeTab === 'family' && 'Family Health'}
            {activeTab === 'tickets' && 'Support & Credits'}
            {activeTab === 'subscription' && 'Subscription'}
            {activeTab === 'portfolio' && 'Profile'}
          </h1>
          {activeTab === 'overview' && (
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              Everything is up to date • {new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Main Active Tab Content View */}
        <div className="animate-in fade-in duration-200">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'appointments' && renderAppointmentsTab()}
          {activeTab === 'history' && (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-600">
      <Clock className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
      <h3 className="text-lg font-black uppercase tracking-wider mb-2">Consultation History</h3>
      <p className="text-sm font-medium">Your past consultations will appear here.</p>
    </div>
  )}
          {activeTab === 'medications' && renderMedicationsTab()}
          {activeTab === 'vault' && renderVaultTab()}
          {activeTab === 'family' && renderFamilyTab()}
          {activeTab === 'tickets' && renderTicketsTab()}
          {activeTab === 'subscription' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <SubscriptionCard />
            </div>
          )}
          {activeTab === 'portfolio' && renderPortfolioTab()}
        </div>
      </main>

      {escalationViewSessionId && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col p-5 relative max-h-[90vh] overflow-y-auto border border-slate-200">
            <button 
              onClick={() => setEscalationViewSessionId(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">Assessment</h3>
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1">Clinical Escalation sheet</p>
              </div>
            </div>
            
            {(() => {
              const session = pastConsultations.find(c => c.sessionId === escalationViewSessionId);
              if (!session) return null;
              return (
                <div className="space-y-4 text-left">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Escalation Reason</h4>
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{session.escalationReason || session.inconclusiveReason}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-wrap font-mono text-[10px] text-slate-700 leading-relaxed">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 font-sans">Preliminary Findings</h4>
                    {session.escalationNotes || session.inconclusiveContext}
                  </div>
                  <div className="text-center pt-2">
                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed max-w-xs mx-auto">
                       Show this sheet to a Doctor in a future session to avoid repeating details.
                     </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Rating Feedback Modal */}
      {ratingSessionId && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col p-6 text-center relative border border-slate-200">
            <button 
              onClick={() => setRatingSessionId(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <form onSubmit={submitRating} className="flex flex-col">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">Rate Experience</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-6">Consultation with {(() => {
                const session = consultations.find(c => c.sessionId === ratingSessionId);
                return formatConsultantName(session?.consultantName, session?.consultantPrefix);
              })()}</p>
              
              <div className="flex items-center justify-center gap-1.5 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      size={28}
                      className={`${
                        star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-100 text-slate-300'
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>

              <div className="text-left mb-6">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Feedback (Optional)</label>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Anything we should know?"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-tight focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={rating === 0 || isSubmittingRating}
                className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 text-white px-4 py-2.5 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-2 shadow-xs uppercase tracking-wider cursor-pointer"
              >
                {isSubmittingRating ? <Loader2 size={16} className="animate-spin" /> : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log Vitals Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col p-5 relative border border-slate-200">
            <button 
              onClick={() => setShowVitalsModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <form onSubmit={handleLogVitals} className="flex flex-col">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-0.5">Log Vitals</h3>
              <p className="text-slate-500 mb-5 text-[10px] font-bold uppercase tracking-tight leading-none">Update health readings.</p>
              
              <div className="space-y-3 mb-5">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">BP Sys (mmHg)</label>
                    <input type="number" required value={newVitals.bloodPressureSys} onChange={e => setNewVitals({...newVitals, bloodPressureSys: parseInt(e.target.value)})} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">BP Dia (mmHg)</label>
                    <input type="number" required value={newVitals.bloodPressureDia} onChange={e => setNewVitals({...newVitals, bloodPressureDia: parseInt(e.target.value)})} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] font-bold" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Heart Rate (bpm)</label>
                    <input type="number" required value={newVitals.heartRate} onChange={e => setNewVitals({...newVitals, heartRate: parseInt(e.target.value)})} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Weight (kg)</label>
                    <input type="number" required step="0.1" value={newVitals.weightKg} onChange={e => setNewVitals({...newVitals, weightKg: parseFloat(e.target.value)})} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] font-bold" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Glucose Level (mg/dL)</label>
                  <input type="number" required value={newVitals.glucoseLevel} onChange={e => setNewVitals({...newVitals, glucoseLevel: parseInt(e.target.value)})} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] font-bold" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-2 shadow-xs uppercase tracking-wider cursor-pointer"
              >
                Save Vitals
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cloud Locker / Vault Modal */}
      <MedicalVaultModal isOpen={showVaultModal} onClose={() => setShowVaultModal(false)} patientId={patientId} />

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        targetUser={effectiveUser}
      />

      {/* Account Deletion Modal */}
      <AccountDeletionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />

      {/* Sleek Light Lemon Paystack Payment Modal for Direct Consult */}
      {selectedConsultantForPay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="bg-[#0A3B24] p-4 sm:p-5 border-b border-emerald-950 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 text-emerald-300 flex items-center justify-center font-black shadow-inner shrink-0">
                  <Video size={20} />
                </div>
                <div>
                  <h3 className="font-black text-white text-xs sm:text-sm uppercase tracking-wider">Instant Consultation</h3>
                  <p className="text-[10px] font-bold text-emerald-100">Powered by Paystack Telehealth Checkout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConsultantForPay(null)}
                className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer flex items-center justify-center"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleConfirmConsultPay} className="p-5 space-y-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
              
              {/* Selected Consultant Profile */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                <img
                  src={selectedConsultantForPay.avatar}
                  alt={selectedConsultantForPay.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800 text-[14px] truncate">{selectedConsultantForPay.name}</h4>
                    <span className="bg-emerald-50 text-[#0A3B24] font-black text-xs px-2.5 py-1 rounded-full border border-emerald-100 whitespace-nowrap">
                      GHS {selectedConsultantForPay.fee}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">{selectedConsultantForPay.title}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{selectedConsultantForPay.hospitalAffiliation}</p>
                </div>
              </div>

              {/* Chief Complaints Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider">
                  Chief Medical Complaints / Reason for Visit
                </label>
                <textarea
                  value={payComplaint}
                  onChange={(e) => setPayComplaint(e.target.value)}
                  rows={3}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-[#0A3B24] focus:ring-1 focus:ring-[#0A3B24] font-medium shadow-inner"
                  placeholder="Describe your symptoms (e.g. fever, headache, medication inquiry)..."
                />
              </div>

              {/* Dynamic compensation ticket selector if patient has active tickets */}
              {activePatientTickets.length > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <Ticket size={16} className="text-emerald-600 rotate-45 animate-pulse" />
                    Apply Support Credit / Ticket
                  </h4>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    You have active refund/compensation tickets. Select one to discount or fully cover this consultation fee.
                  </p>
                  
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-white border border-emerald-100 rounded-xl cursor-pointer hover:bg-emerald-50/20 transition-all">
                      <input 
                        type="radio" 
                        name="momo_payment_option" 
                        checked={selectedTicketId === ''}
                        onChange={() => setSelectedTicketId('')}
                        className="text-slate-600 focus:ring-emerald-500/20 w-4 h-4 cursor-pointer"
                      />
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-800 block">Standard Payment (Pay GHS {selectedConsultantForPay.fee}.00)</span>
                        <span className="text-[10px] text-slate-500 block">Use Mobile Money or Bank Card checkout</span>
                      </div>
                    </label>

                    {activePatientTickets.map((t: any) => {
                      const rem = t.remainingGHS !== undefined ? t.remainingGHS : (t.valueGHS || 30);
                      return (
                        <label key={t.ticketId} className="flex items-center gap-3 p-3 bg-white border border-emerald-100 rounded-xl cursor-pointer hover:bg-emerald-50/20 transition-all">
                          <input 
                            type="radio" 
                            name="momo_payment_option" 
                            checked={selectedTicketId === t.ticketId}
                            onChange={() => setSelectedTicketId(t.ticketId)}
                            className="text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1 flex items-center justify-between">
                            <div className="text-left">
                              <span className="text-xs font-mono font-black text-emerald-700 block">{t.ticketId}</span>
                              <span className="text-[10px] text-slate-600 block">Remaining: <strong>GHS {rem}.00</strong> • {t.reason}</span>
                            </div>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                              Apply
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Fee Calculation Details */}
              {(() => {
                const selectedTicket = selectedTicketId ? activePatientTickets.find((t: any) => t.ticketId === selectedTicketId) : null;
                const ticketRemaining = selectedTicket ? (selectedTicket.remainingGHS !== undefined ? selectedTicket.remainingGHS : (selectedTicket.valueGHS || 30)) : 0;
                const originalFee = selectedConsultantForPay.fee || 0;
                const difference = selectedTicket ? originalFee - ticketRemaining : originalFee;
                const finalAmountToPay = difference > 0 ? difference : 0;
                const remainingStoreCreditAfter = difference < 0 ? Math.abs(difference) : 0;

                return (
                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between font-medium text-slate-500">
                      <span>Standard Rate</span>
                      <span>GHS {originalFee}.00</span>
                    </div>
                    {selectedTicket && (
                      <div className="flex justify-between font-bold text-emerald-700">
                        <span>Ticket discount applied ({selectedTicket.ticketId})</span>
                        <span>- GHS {Math.min(ticketRemaining, originalFee)}.00</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-800 text-sm">
                      <span>Total Amount to Pay</span>
                      <span className="text-[#0A3B24]">GHS {finalAmountToPay}.00</span>
                    </div>
                    {selectedTicket && remainingStoreCreditAfter > 0 && (
                      <p className="text-[10px] text-emerald-700 font-bold text-right">
                        ✨ GHS {remainingStoreCreditAfter}.00 store credit will remain on this ticket for future sessions.
                      </p>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const selectedTicket = selectedTicketId ? activePatientTickets.find((t: any) => t.ticketId === selectedTicketId) : null;
                const ticketRemaining = selectedTicket ? (selectedTicket.remainingGHS !== undefined ? selectedTicket.remainingGHS : (selectedTicket.valueGHS || 30)) : 0;
                const originalFee = selectedConsultantForPay.fee || 0;
                const difference = selectedTicket ? originalFee - ticketRemaining : originalFee;
                const finalAmountToPay = difference > 0 ? difference : 0;

                if (finalAmountToPay === 0) return null;

                return (
                  <>
                    {/* Payment Options */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider text-left">
                        Select Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPayChannel('mobile_money')}
                          className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                            payChannel === 'mobile_money'
                              ? 'bg-emerald-50/50 border-[#0A3B24] text-[#0A3B24] font-black shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                          }`}
                        >
                          <Phone size={16} className={payChannel === 'mobile_money' ? 'text-[#0A3B24]' : 'text-slate-400'} />
                          <div className="text-[11px] leading-tight">
                            <div className="font-extrabold">Mobile Money</div>
                            <div className="text-[9px] opacity-80 mt-0.5 font-medium">MTN / Telecel / AT</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayChannel('card')}
                          className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                            payChannel === 'card'
                              ? 'bg-emerald-50/50 border-[#0A3B24] text-[#0A3B24] font-black shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                          }`}
                        >
                          <CreditCard size={16} className={payChannel === 'card' ? 'text-[#0A3B24]' : 'text-slate-400'} />
                          <div className="text-[11px] leading-tight">
                            <div className="font-extrabold">Bank Card</div>
                            <div className="text-[9px] opacity-80 mt-0.5 font-medium">Visa / Mastercard</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {payChannel === 'mobile_money' ? (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider text-left">
                          Ghana Mobile Money Number
                        </label>
                        <input
                          type="tel"
                          value={momoNumber}
                          onChange={(e) => setMomoNumber(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#0A3B24] focus:ring-1 focus:ring-[#0A3B24] shadow-inner"
                          placeholder="0244123456"
                        />
                      </div>
                    ) : (
                      <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-500 flex items-center gap-2">
                        <Lock size={14} className="text-[#0A3B24]" />
                        <span>Encrypted Paystack 256-bit Card Gateway</span>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Terms & Consent (One-time or Session-based) */}
              {!user?.hasAcceptedGlobalTerms && (
                <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-200 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center h-5">
                      <input
                        id="session-consent"
                        type="checkbox"
                        checked={agreedToSessionTerms}
                        onChange={(e) => setAgreedToSessionTerms(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="text-left">
                      <label htmlFor="session-consent" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                        I agree to the <span className="text-emerald-700 underline">Terms of Service</span> and <span className="text-emerald-700 underline">Telemedicine Consent</span> for this consultation.
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 border-t border-amber-100 pt-3">
                    <div className="flex items-center h-5">
                      <input
                        id="global-consent"
                        type="checkbox"
                        checked={agreeOnceAndForAll}
                        onChange={(e) => setAgreeOnceAndForAll(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="text-left">
                      <label htmlFor="global-consent" className="text-[10px] font-medium text-slate-600 cursor-pointer">
                        Remember my choice. Do not show this consent box for my future consultations.
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {(() => {
                const selectedTicket = selectedTicketId ? activePatientTickets.find((t: any) => t.ticketId === selectedTicketId) : null;
                const ticketRemaining = selectedTicket ? (selectedTicket.remainingGHS !== undefined ? selectedTicket.remainingGHS : (selectedTicket.valueGHS || 30)) : 0;
                const originalFee = selectedConsultantForPay.fee || 0;
                const difference = selectedTicket ? originalFee - ticketRemaining : originalFee;
                const finalAmountToPay = difference > 0 ? difference : 0;

                return (
                  <button
                    type="submit"
                    disabled={isProcessingConsultPay}
                    className="w-full py-4 bg-[#0A3B24] hover:bg-[#0A3B24]/95 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
                  >
                    {isProcessingConsultPay ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-white" />
                        <span>Verifying...</span>
                      </>
                    ) : finalAmountToPay === 0 ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span>Apply Support Ticket & Start Consultation (Free)</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Pay GHS {finalAmountToPay} & Start Consultation</span>
                      </>
                    )}
                  </button>
                );
              })()}

              <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1 font-bold uppercase tracking-wider">
                <ShieldCheck size={12} className="text-emerald-600" /> Secure payment processed by Paystack Ghana
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation (Flush Micro Design) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-[90] pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between h-12">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center justify-center flex-1 relative h-full ${activeTab === 'overview' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <Home size={18} strokeWidth={activeTab === 'overview' ? 2.5 : 2} />
            <span className="text-[8px] font-black tracking-tight uppercase">Home</span>
            {activeTab === 'overview' && (
              <div className="absolute top-0 w-8 h-0.5 bg-[#0A3B24] rounded-full"></div>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`flex flex-col items-center justify-center flex-1 relative h-full ${activeTab === 'appointments' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <div className="relative">
              <Calendar size={18} strokeWidth={activeTab === 'appointments' ? 2.5 : 2} />
              {upcomingConsultations.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
              )}
            </div>
            <span className="text-[8px] font-black tracking-tight uppercase">Visits</span>
            {activeTab === 'appointments' && (
              <div className="absolute top-0 w-8 h-0.5 bg-[#0A3B24] rounded-full"></div>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center flex-1 relative h-full ${activeTab === 'history' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <Clock size={18} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[8px] font-black tracking-tight uppercase">History</span>
            {activeTab === 'history' && (
              <div className="absolute top-0 w-8 h-0.5 bg-[#0A3B24] rounded-full"></div>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('medications')}
            className={`flex flex-col items-center justify-center flex-1 relative h-full ${activeTab === 'medications' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <div className="relative">
              <Pill size={18} strokeWidth={activeTab === 'medications' ? 2.5 : 2} />
              {totalMedsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-sky-500 rounded-full"></span>
              )}
            </div>
            <span className="text-[8px] font-black tracking-tight uppercase">Meds</span>
            {activeTab === 'medications' && (
              <div className="absolute top-0 w-8 h-0.5 bg-[#0A3B24] rounded-full"></div>
            )}
          </button>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex flex-col items-center justify-center flex-1 relative h-full ${mobileMenuOpen ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <MoreHorizontal size={18} strokeWidth={2} />
            <span className="text-[8px] font-black tracking-tight uppercase">More</span>
            {mobileMenuOpen && (
              <div className="absolute top-0 w-8 h-0.5 bg-[#0A3B24] rounded-full"></div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
