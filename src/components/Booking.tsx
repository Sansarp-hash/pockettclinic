import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { ConsultationSession, isConsultantRole } from '../types';
import { Calendar, Clock, CreditCard, ChevronRight, CheckCircle2, Loader2, MessageSquare, Video, PhoneCall, ShieldCheck, AlertTriangle, ShieldAlert, FileText, ExternalLink, X, Award, AlertCircle, Stethoscope } from 'lucide-react';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import PaystackPop from '@paystack/inline-js';
import { getSessionTierPricing, CONSULTANT_TIERS } from '../lib/pricing';
import { formatConsultantName } from '../lib/formatters';
import { isCarePlus, isProPartner } from '../lib/subscriptions';
import { normalizeCadre, CADRE_CONFIGS, CadreType } from '../config/consultantCadreConfig';

const generateId = () => Math.random().toString(36).substring(2, 9).toUpperCase();



export default function Booking() {
  const { consultantId } = useParams<{ consultantId: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'instant';
  const { 
    allUsers, 
    consultations, 
    addConsultation, 
    user, 
    role, 
    systemConfig, 
    updateUserProfile,
    showToast,
    showConfirm,
    tickets
  } = useAppContext();
  const navigate = useNavigate();

  const consultants = (allUsers || []).filter(u => isConsultantRole(u.role));

  const activePatientTickets = (tickets || []).filter(t => t.patientId === user?.uid && t.status === 'active');

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getDefaultTimeStr = () => {
    const nextHour = new Date(Date.now() + 30 * 60 * 1000);
    const hrs = String(nextHour.getHours()).padStart(2, '0');
    const mins = String(nextHour.getMinutes() >= 30 ? 30 : 0).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  const [step, setStep] = useState<'datetime' | 'consent' | 'payment' | 'success'>(
    mode === 'instant' ? 'consent' : 'datetime'
  );
  const [date, setDate] = useState(getTodayStr());
  const [time, setTime] = useState(getDefaultTimeStr());
  const [sessionType, setSessionType] = useState<'VIDEO' | 'CHAT_ONLY' | 'AUDIO_ONLY'>('VIDEO');
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [consultation, setConsultation] = useState<ConsultationSession | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [patientInformedConsent, setPatientInformedConsent] = useState(true);
  
  const [agreedVideoAudio, setAgreedVideoAudio] = useState(true);
  const [agreedChat, setAgreedChat] = useState(true);
  const [agreedRecording, setAgreedRecording] = useState(true);
  const [agreedNonEmergency, setAgreedNonEmergency] = useState(true);

  const [showCareDisclaimer, setShowCareDisclaimer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedTicketToken, setSelectedTicketToken] = useState<string | null>(null);

  const activeSession = consultations.find(c => {
    const statusUpper = (c.status || '').toUpperCase();
    const dispatchUpper = (c.dispatchStatus || '').toUpperCase();
    if (statusUpper.startsWith('CANCEL') || dispatchUpper.startsWith('CANCEL') || dispatchUpper === 'EXPIRED') {
      return false;
    }
    return (
      c.patientId === user?.uid && 
      (statusUpper === 'PENDING' || statusUpper === 'PAID' || statusUpper === 'IN_PROGRESS')
    );
  });

  if (activeSession) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm mt-12 flex flex-col items-center animate-in fade-in">
        <AlertTriangle size={48} className="text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Booking Limit Reached</h2>
        <p className="text-slate-500 text-xs mt-3 font-medium leading-relaxed">
          You currently have a session in progress with <strong className="text-slate-700">{formatConsultantName(activeSession.consultantName, activeSession.consultantPrefix)}</strong>. To ensure optimal medical oversight, patients are restricted to one active consultation at a time.
        </p>
        <div className="mt-6 w-full space-y-2">
          <button 
            onClick={() => navigate(`/consultation/${activeSession.sessionId}`)} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-4 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider cursor-pointer"
          >
            Go to Active Session
          </button>
          <button 
            onClick={() => navigate('/patient/dashboard')} 
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-black px-6 py-4 rounded-xl shadow-sm transition-all text-xs uppercase tracking-wider cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isConsultantRole(role)) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm mt-12 flex flex-col items-center">
        <ShieldAlert size={48} className="text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-800">Booking Restricted</h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">
          Consultants are strictly prohibited from booking appointments or sending out session requests. Only patients can request a consultation.
        </p>
        <button 
          onClick={() => navigate('/consultant/dashboard')} 
          className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider cursor-pointer"
        >
          Return to Workspace
        </button>
      </div>
    );
  }

  const handleUseTicketPayment = async () => {
    if (!consultation || !selectedTicketToken) return;
    setIsProcessingPayment(true);
    try {
      const selectedTicket = activePatientTickets.find((t: any) => t.ticketId === selectedTicketToken);
      if (!selectedTicket) throw new Error("Selected support ticket not found");

      const sessionPrice = consultation.amountPaidGHS;
      const currentRemaining = selectedTicket.remainingGHS !== undefined ? selectedTicket.remainingGHS : (selectedTicket.valueGHS || 30);
      const difference = sessionPrice - currentRemaining;

      if (difference > 0) {
        await updateDoc(doc(db, 'rescheduling_tickets', selectedTicketToken), {
          remainingGHS: 0,
          status: 'used',
          usedAt: new Date().toISOString(),
          usedForSessionId: consultation.sessionId
        });

        setIsProcessingPayment(false);
        const paystack = new PaystackPop();
        const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_pockettclinic_default';

        paystack.newTransaction({
          key: paystackKey,
          email: user?.email || 'patient@example.com',
          amount: difference * 100,
          currency: 'GHS',
          reference: `PARTIAL_${consultation.paystackReference}`,
          label: "PockettClinic Healthcare Consultation (Partial Store Credit)",
          channels: ['card', 'mobile_money'],
          phone: user?.phone || '',
          onSuccess: async (transaction: any) => {
            console.log('Partial payment complete! Reference:', transaction.reference);
            await completePaymentFlow();
          },
          onCancel: () => {
            console.log('Transaction cancelled');
            setIsProcessingPayment(false);
          }
        });
        return;
      } else {
        const newRemaining = currentRemaining - sessionPrice;
        const newStatus = newRemaining <= 0 ? 'used' : 'active';

        await updateDoc(doc(db, 'rescheduling_tickets', selectedTicketToken), {
          remainingGHS: newRemaining,
          status: newStatus,
          usedAt: new Date().toISOString(),
          usedForSessionId: consultation.sessionId
        });

        const now = Date.now();
        const ringingTimeoutSecs = 180; // 3 minute ringing limit
        const activeConsultation: ConsultationSession = { 
          ...consultation, 
          status: 'PAID',
          paymentStatus: 'COMPLETED',
          ringingStartedAt: now,
          ringingExpiresAt: now + (ringingTimeoutSecs * 1000),
          dispatchStatus: 'ringing',
          bookingType: 'INSTANT',
          paymentMethod: 'STORE_CREDIT_TICKET',
          usedTicketToken: selectedTicketToken,
          cadreNeeded: consultation.cadreNeeded || effectiveCadre,
          consultantCadre: consultation.consultantCadre || effectiveCadre,
          assignedConsultantId: consultation.assignedConsultantId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        if (role === 'public') {
          try {
            await updateUserProfile({
              role: 'patient',
              fullName: user?.displayName || user?.email?.split('@')[0] || 'Patient',
              hasAcceptedCareTerms: true
            });
          } catch (regErr) {
            console.warn("Patient registration failed, continuing with booking:", regErr);
          }
        }

        await addConsultation(activeConsultation);
        console.log('[Booking Diagnostic] activeConsultation written (Ticket):', activeConsultation);

        // Notify consultant(s)
        if (activeConsultation.dispatchStatus === 'ringing') {
          try {
            const idToken = await auth.currentUser?.getIdToken();
            const targetCadre = (activeConsultation.consultantCadre || (activeConsultation as any).cadreNeeded || 'UNASSIGNED').toUpperCase();

            fetch('/api/notifications/trigger', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                targetUid: activeConsultation.assignedConsultantId || 'BROADCAST',
                targetCadre: targetCadre,
                title: 'Incoming Consultation',
                body: `New ${targetCadre.replace(/_/g, ' ')} consultation request.`,
                actionType: 'new_consultation',
                targetPath: '/consultant/dashboard'
              })
            }).then(async res => {
              if (!res.ok) {
                const errorText = await res.text();
                console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
              } else {
                console.log('[Notification Diagnostic] Ticket broadcast triggered.');
              }
            }).catch(err => console.warn('Failed to notify consultant:', err));
          } catch (notifErr) {
            console.warn('Consultant notification trigger error:', notifErr);
          }
        }

        navigate(`/consultation/${activeConsultation.sessionId}`);
      }
    } catch (err: any) {
      console.error("Booking with store credit ticket failed:", err);
      showToast(`Booking with store credit failed: ${err.message || 'Please try again.'}`, "error");
      setIsProcessingPayment(false);
    }
  };

  const superAdmins = ["missty2k@gmail.com", "pockettclinic@gmail.com", "pharmabridgeghana@gmail.com"];
  const impersonatedUser = localStorage.getItem('pockettclinic_impersonating_admin');
  const isAdmin = user?.role === 'admin' || (user?.email && superAdmins.includes(user.email.toLowerCase())) || impersonatedUser !== null;

  const handleAdminBypassBooking = async () => {
    if (!consultation || !isAdmin) return;
    setIsProcessingPayment(true);
    try {
      const now = Date.now();
      const ringingTimeoutSecs = 180; // 3 minute ringing limit
      const isInstant = mode === 'instant';

      const activeConsultation: ConsultationSession = { 
        ...consultation, 
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        amountPaidGHS: 0,
        paymentMethod: 'ADMIN_BYPASS',
        ringingStartedAt: isInstant ? now : null,
        ringingExpiresAt: isInstant ? now + (ringingTimeoutSecs * 1000) : null,
        dispatchStatus: isInstant ? 'ringing' : 'scheduled',
        bookingType: isInstant ? 'INSTANT' : 'SCHEDULED',
        cadreNeeded: consultation.cadreNeeded || effectiveCadre,
        consultantCadre: consultation.consultantCadre || effectiveCadre,
        assignedConsultantId: consultation.assignedConsultantId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (role === 'public') {
        try {
          await updateUserProfile({
            role: 'patient',
            fullName: user?.displayName || user?.email?.split('@')[0] || 'Patient',
            hasAcceptedCareTerms: true
          });
        } catch (regErr) {
          console.warn("Patient registration failed, continuing with booking:", regErr);
        }
      }

      await addConsultation(activeConsultation);
      console.log('[Booking Diagnostic] activeConsultation written (Admin Bypass):', activeConsultation);

      // Notify consultant(s)
      if (activeConsultation.dispatchStatus === 'ringing') {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const targetCadre = (activeConsultation.consultantCadre || (activeConsultation as any).cadreNeeded || 'UNASSIGNED').toUpperCase();
          
          fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              targetUid: activeConsultation.assignedConsultantId || 'BROADCAST',
              targetCadre: targetCadre,
              title: 'Incoming Consultation',
              body: `New ${targetCadre.replace(/_/g, ' ')} consultation request.`,
              actionType: 'new_consultation',
              targetPath: '/consultant/dashboard'
            })
          }).then(async res => {
            if (!res.ok) {
              const errorText = await res.text();
              console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
            }
          }).catch(err => console.warn('Failed to notify consultant:', err));
        } catch (notifErr) {
          console.warn('Consultant notification trigger error:', notifErr);
        }
      }

      if (isInstant) {
        navigate(`/consultation/${activeConsultation.sessionId}`);
      } else {
        setStep('success');
      }
    } catch (err: any) {
      console.error("Admin bypass booking failed:", err);
      showToast(`Admin bypass booking failed: ${err.message || 'Please try again.'}`, "error");
      setIsProcessingPayment(false);
    }
  };

  const handleUseVideoChatTicket = async () => {
    if (!consultation || !user?.videoChatTickets || user.videoChatTickets <= 0) return;
    setIsProcessingPayment(true);
    try {
      await updateUserProfile({ videoChatTickets: user.videoChatTickets - 1 });

      const now = Date.now();
      const ringingTimeoutSecs = 180; // 3 minute ringing limit
      const activeConsultation: ConsultationSession = { 
        ...consultation, 
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        ringingStartedAt: now,
        ringingExpiresAt: now + (ringingTimeoutSecs * 1000),
        dispatchStatus: 'ringing',
        bookingType: 'INSTANT',
        paymentMethod: 'VIDEO_TICKET',
        cadreNeeded: consultation.cadreNeeded || effectiveCadre,
        consultantCadre: consultation.consultantCadre || effectiveCadre,
        assignedConsultantId: consultation.assignedConsultantId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      if (role === 'public') {
        try {
          await updateUserProfile({
            role: 'patient',
            fullName: user?.displayName || user?.email?.split('@')[0] || 'Patient',
            hasAcceptedCareTerms: true
          });
        } catch (regErr) {
          console.warn("Patient registration failed, continuing with booking:", regErr);
        }
      }

      await addConsultation(activeConsultation);
      console.log('[Booking Diagnostic] activeConsultation written (Video Ticket):', activeConsultation);

      // Notify consultant(s)
      if (activeConsultation.dispatchStatus === 'ringing') {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const targetCadre = (activeConsultation.consultantCadre || (activeConsultation as any).cadreNeeded || 'UNASSIGNED').toUpperCase();

          fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              targetUid: activeConsultation.assignedConsultantId || 'BROADCAST',
              targetCadre: targetCadre,
              title: 'Incoming Consultation',
              body: `New ${targetCadre.replace(/_/g, ' ')} consultation request.`,
              actionType: 'new_consultation',
              targetPath: '/consultant/dashboard'
            })
          }).then(async res => {
            if (!res.ok) {
              const errorText = await res.text();
              console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
            } else {
              console.log('[Notification Diagnostic] Video ticket broadcast triggered.');
            }
          }).catch(err => console.warn('Failed to notify consultant:', err));
        } catch (notifErr) {
          console.warn('Consultant notification trigger error:', notifErr);
        }
      }

      navigate(`/consultation/${activeConsultation.sessionId}`);
    } catch (err: any) {
      console.error("Booking with video ticket failed:", err);
      showToast(`Booking with video ticket failed: ${err.message || 'Please try again.'}`, "error");
      setIsProcessingPayment(false);
    }
  };

  const isInstantCadre = consultantId === 'instant' || consultantId === 'general' || consultantId === 'cadre' || !consultants.some(p => p.uid === consultantId);
  const targetCadreParam = (searchParams.get('cadre') || 'UNASSIGNED').toUpperCase();
  const targetSpecialtyParam = searchParams.get('specialty') || '';

  const consultant = consultants.find(p => p.uid === consultantId) || null;

  const effectiveCadre = normalizeCadre(consultant ? consultant.cadre : targetCadreParam);
  const pricing = getSessionTierPricing(effectiveCadre, sessionType, systemConfig, mode === 'instant');

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!agreedVideoAudio || !agreedChat || !agreedRecording || !agreedNonEmergency) {
      setFormError("Please toggle YES to all consultation & recording agreements to proceed to payment.");
      return;
    }

    if (user && !user.hasAcceptedCareTerms) {
      setShowCareDisclaimer(true);
      return;
    }
    
    const userIsCarePlus = isCarePlus(user);
    const consultantIsPro = consultant ? isProPartner(consultant) : false;

    const grossFee = pricing.grossFee;

    let platformCutPct = 0.30;
    if (consultantIsPro) {
      platformCutPct = 0.25;
    }

    const platformCutGHS = Math.round(grossFee * platformCutPct * 100) / 100;
    const payoutAmountGHS = Math.round((grossFee - platformCutGHS) * 100) / 100;

    const newSessionId = generateId();
    const newConsultation: ConsultationSession = {
      sessionId: newSessionId,
      patientId: user?.uid || 'anonymous',
      patientName: user?.displayName || user?.email || 'Guest Patient',
      patientAge: 32,
      patientGender: 'Male',
      consultantId: consultant ? consultant.uid : 'unassigned',
      consultantName: consultant 
        ? (consultant.fullName || consultant.displayName)
        : targetSpecialtyParam 
          ? `${targetSpecialtyParam} Specialist`
          : (CADRE_CONFIGS[normalizeCadre(effectiveCadre)].label),
      consultantPrefix: consultant ? (consultant.prefix || null) : null,
      assignedConsultantId: consultant ? consultant.uid : null,
      declinedBy: [],
      dispatchStatus: 'ringing',
      ringingExpiresAt: Date.now() + 180000,
      tierDurationMinutes: pricing.durationMins,
      cadreNeeded: effectiveCadre,
      consultantCadre: effectiveCadre,
      specialtyNeeded: targetSpecialtyParam || undefined,
      chiefComplaints: chiefComplaints,
      symptoms: targetSpecialtyParam ? [targetSpecialtyParam, 'Specialized Consultation'] : ['General Consultation'],
      sessionType: sessionType,
      type: sessionType === 'CHAT_ONLY' ? 'chat' : 'video',
      status: 'PENDING',
      roomId: newSessionId,
      scheduledAt: mode === 'instant' ? new Date().toISOString() : `${date}T${time}:00`,
      paystackReference: `REF_${effectiveCadre}_${sessionType}_${generateId()}`,
      amountPaidGHS: grossFee,
      platformCutGHS: platformCutGHS,
      payoutAmountGHS: payoutAmountGHS,
      priorityMatching: mode === 'instant' ? true : userIsCarePlus
    };
    
    setConsultation(newConsultation);
    setStep('payment');
  };

  const handleDateTimeContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      setFormError("Please select a valid date and time for your appointment.");
      return;
    }
    setStep('consent');
  };

  const completePaymentFlow = async () => {
    if (!consultation) return;
    try {
      const now = Date.now();
      const ringingTimeoutSecs = 180; // 3 minute ringing limit
      
      const isInstant = mode === 'instant';

      const activeConsultation: ConsultationSession = { 
        ...consultation, 
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        ringingStartedAt: isInstant ? now : null,
        ringingExpiresAt: isInstant ? now + (ringingTimeoutSecs * 1000) : null,
        dispatchStatus: isInstant ? 'ringing' : 'scheduled',
        bookingType: isInstant ? 'INSTANT' : 'SCHEDULED',
        cadreNeeded: consultation.cadreNeeded || effectiveCadre,
        consultantCadre: consultation.consultantCadre || effectiveCadre,
        assignedConsultantId: consultation.assignedConsultantId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      if (role === 'public') {
        try {
          await updateUserProfile({
            role: 'patient',
            fullName: user?.displayName || user?.email?.split('@')[0] || 'Patient',
            hasAcceptedCareTerms: true
          });
        } catch (regErr) {
          console.warn("Patient registration failed, continuing with booking:", regErr);
        }
      }

      await addConsultation(activeConsultation);
      console.log('[Booking Diagnostic] activeConsultation written (Regular/Instant):', activeConsultation);
      
      // Notify consultant(s)
      if (activeConsultation.dispatchStatus === 'ringing') {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const targetCadre = (activeConsultation.consultantCadre || (activeConsultation as any).cadreNeeded || 'UNASSIGNED').toUpperCase();

          fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              targetUid: activeConsultation.assignedConsultantId || 'BROADCAST',
              targetCadre: targetCadre,
              title: 'Incoming Consultation',
              body: `New ${targetCadre.replace(/_/g, ' ')} consultation request.`,
              actionType: 'new_consultation',
              targetPath: '/consultant/dashboard'
            })
          }).then(async res => {
            if (!res.ok) {
              const errorText = await res.text();
              console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
            } else {
              console.log('[Notification Diagnostic] Broadcast notification triggered successfully.');
            }
          }).catch(err => console.warn('Failed to notify consultant:', err));
        } catch (notifErr) {
          console.warn('Consultant notification trigger error:', notifErr);
        }
      }

      if (isInstant) {
        navigate(`/consultation/${activeConsultation.sessionId}`);
      } else {
        setStep('success');
      }
    } catch (dbError: any) {
       console.error("Booking creation error:", dbError);
       setIsProcessingPayment(false);
       showToast(`Booking save error: ${dbError?.message || 'Please try again.'}`, "error");
    }
  };

  const verifyAndCompleteBooking = async (reference: string) => {
    setIsProcessingPayment(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/payments/verify-paystack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ reference })
      });

      const data = await response.json();
      if (!response.ok || !data.verified) {
        throw new Error(data.error || "Payment verification failed");
      }

      await completePaymentFlow();
    } catch (err: any) {
      console.error("Verification failed:", err);
      showToast(`Payment verification failed: ${err.message}. If you were charged, please contact support with reference: ${reference}`, "error");
      setIsProcessingPayment(false);
    }
  };

  const handlePayment = () => {
    if (!consultation) return;
    setIsProcessingPayment(true);
    
    try {
      const paystack = new PaystackPop();
      const fullName = user?.fullName || user?.displayName || 'Patient';
      const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_pockettclinic_default';
      
      paystack.newTransaction({
        key: paystackKey,
        email: user?.email || 'patient@example.com',
        amount: consultation.amountPaidGHS * 100,
        currency: 'GHS',
        reference: consultation.paystackReference,
        label: "PockettClinic Healthcare Consultation",
        channels: ['card', 'mobile_money'],
        phone: user?.phone || '',
        metadata: {
          platform: "PockettClinic",
          business_name: "PockettClinic",
          merchant_name: "PockettClinic",
          custom_fields: [
            { display_name: "Platform", variable_name: "platform_name", value: "PockettClinic" },
            { display_name: "Patient Name", variable_name: "patient_name", value: fullName },
            { display_name: "Consultant Name", variable_name: "consultant_name", value: consultation.consultantName },
            { display_name: "Session Type", variable_name: "session_type", value: consultation.sessionType }
          ]
        },
        onSuccess: async (transaction: any) => {
          console.log('Payment complete! Reference:', transaction.reference);
          await verifyAndCompleteBooking(transaction.reference);
        },
        onCancel: () => {
          console.log('Transaction cancelled');
          setIsProcessingPayment(false);
        }
      });
    } catch (err: any) {
      console.error("Paystack checkout error:", err);
      setIsProcessingPayment(false);
      showToast(`Payment initialization failed: ${err.message || 'Please check your connection and try again.'}`, "error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 w-full min-h-[calc(100vh-80px)] flex flex-col justify-center">
      <div className="mb-8 flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm max-w-md mx-auto w-full">
         <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex-shrink-0 border border-indigo-200 overflow-hidden flex items-center justify-center text-indigo-600">
            {consultant ? (
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${consultant.uid}&backgroundColor=f8fafc`} alt={consultant.fullName || 'Consultant'} className="w-full h-full object-cover" />
            ) : (
              <Stethoscope size={32} />
            )}
         </div>
         <div>
           <h1 className="text-xl font-bold text-slate-800">
             {consultant 
               ? `Book ${formatConsultantName(consultant.fullName || consultant.displayName, consultant.prefix)}`
               : targetSpecialtyParam 
                 ? `Instant ${targetSpecialtyParam} Consultation`
                 : `Instant ${CADRE_CONFIGS[normalizeCadre(effectiveCadre)].label}`
             }
           </h1>
           <p className="text-indigo-600 font-medium text-sm">
             {consultant ? CADRE_CONFIGS[normalizeCadre(consultant.cadre)].label : `On-Call ${CADRE_CONFIGS[normalizeCadre(effectiveCadre)].label}`}
           </p>
         </div>
      </div>

      <div className="mb-8 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden max-w-xl mx-auto w-full">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Award size={18} className="text-indigo-600" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
            {consultant ? 'Professional Background' : 'Instant Dispatch Details'}
          </h3>
        </div>
        {consultant ? (
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bio & Expertise</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {consultant.bio || 'Consultant has not provided a detailed bio yet.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credentials</h4>
                <div className="flex flex-wrap gap-1">
                  {((consultant as any).degrees || []).length > 0 ? (
                    (consultant as any).degrees.map((d: string, i: number) => (
                      <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold border border-indigo-100">
                        {d}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Degrees not listed.</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Council PIN</h4>
                <p className="text-xs font-mono font-bold text-slate-700">{(consultant as any).councilPin || 'VERIFIED'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Education</h4>
                <p className="text-[11px] text-slate-600 font-medium">{(consultant as any).educationHistory || 'Provided via Council Registry'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience</h4>
                <p className="text-[11px] text-slate-600 font-medium">{(consultant as any).pastWorkHistory || 'Verified Professional Experience'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">On-Call General Cadre Request</h4>
              <p className="text-xs mt-1 leading-relaxed text-emerald-700">
                Your consultation request will instantly ring all available online <strong>{CADRE_CONFIGS[normalizeCadre(effectiveCadre)].label}</strong> professionals on the platform. The first consultant to accept will be connected with you immediately.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-8 relative px-4 max-w-md mx-auto w-full">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
        {[
          { id: 'datetime', label: 'Select Time', icon: Clock, hidden: mode === 'instant' },
          { id: 'consent', label: 'Consent', icon: FileText },
          { id: 'payment', label: 'Payment', icon: CreditCard }
        ].filter(s => !s.hidden).map((s, i, arr) => {
          const stepIndex = arr.findIndex(x => x.id === step);
          const isCompleted = i < stepIndex || step === 'success';
          const isCurrent = s.id === step;
          return (
            <div key={s.id} className="flex flex-col items-center bg-slate-50 px-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 
                isCurrent ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm' : 
                'bg-white border-slate-300 text-slate-400'
              }`}>
                {isCompleted ? <CheckCircle2 size={24} /> : <s.icon size={24} />}
              </div>
              <span className={`text-sm font-bold mt-2 ${isCurrent ? 'text-indigo-600' : 'text-slate-500'}`}>{s.label}</span>
            </div>
          )
        })}
      </div>

      {step === 'datetime' && (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden max-w-xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">Schedule Appointment</h2>
            <p className="text-xs text-slate-500 mt-1">Select your preferred date and time for consultation.</p>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Time</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-3 text-amber-900 font-bold text-xs">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button 
              onClick={handleDateTimeContinue}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/20 uppercase tracking-wider text-xs cursor-pointer"
            >
              Continue to Consent
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 'consent' && (
        <form onSubmit={handleContinue} className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden max-w-xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">{mode === 'instant' ? 'Instant Consultation & Agreements' : 'Confirm Consultation Details'}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'schedule' ? `Scheduled for ${new Date(date).toLocaleDateString()} at ${time}` : `Cadre: ${pricing.tier.title} (${pricing.tier.focus})`}
            </p>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Select Consultation Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSessionType('CHAT_ONLY')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    sessionType === 'CHAT_ONLY'
                      ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <MessageSquare size={20} className={sessionType === 'CHAT_ONLY' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-xs font-black bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      GHS {pricing.tier.chatFeeGHS}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Text Chat</p>
                    <p className="text-[11px] text-slate-500 font-medium">{pricing.tier.chatDurationMins} Mins duration</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionType('VIDEO')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    sessionType === 'VIDEO' || sessionType === 'AUDIO_ONLY'
                      ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Video size={20} className={sessionType === 'VIDEO' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-xs font-black bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      GHS {pricing.tier.voiceVideoFeeGHS}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Voice & Video</p>
                    <p className="text-[11px] text-slate-500 font-medium">{pricing.tier.voiceVideoDurationMins} Mins duration</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Symptoms / Chief Complaints</label>
              <textarea
                rows={3}
                value={chiefComplaints}
                onChange={e => setChiefComplaints(e.target.value)}
                placeholder="Describe your symptoms or reason for consultation..."
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 text-sm"
              />
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck size={18} className="text-indigo-600" /> Patient Telehealth & Recording Consent
                </span>
                <button
                  type="button"
                  onClick={() => setShowCareDisclaimer(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
                >
                  Full Policy <ExternalLink size={12} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <Video size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Video & Audio Consultation Agreement</p>
                      <p className="text-[11px] text-slate-500 leading-snug">Consent to encrypted real-time video/audio evaluation with the healthcare professional.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setAgreedVideoAudio(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        agreedVideoAudio ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgreedVideoAudio(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        !agreedVideoAudio ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <MessageSquare size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Text Chat & Messaging Agreement</p>
                      <p className="text-[11px] text-slate-500 leading-snug">Consent to text-based messaging, clinical photo sharing, and e-prescription transmission.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setAgreedChat(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        agreedChat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgreedChat(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        !agreedChat ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <FileText size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Clinical Record & Detail Logging</p>
                      <p className="text-[11px] text-slate-500 leading-snug">Consent to recording and secure retention of SOAP clinical notes, vitals, and consultation records.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setAgreedRecording(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        agreedRecording ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgreedRecording(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        !agreedRecording ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert size={18} className="text-rose-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Non-Emergency Medical Confirmation</p>
                      <p className="text-[11px] text-slate-500 leading-snug">Confirm this consultation is non-emergency and acknowledge redirection for acute trauma.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setAgreedNonEmergency(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        agreedNonEmergency ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgreedNonEmergency(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        !agreedNonEmergency ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-3 text-amber-900 font-bold text-xs">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-8 py-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer uppercase tracking-wider text-xs"
              >
                Proceed Direct to Payment
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </form>
      )}

      {step === 'payment' && (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden max-w-md mx-auto w-full">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">Secure Checkout</h2>
            <p className="text-slate-500 text-sm mt-1">{pricing.tier.title} ({pricing.durationMins} Mins)</p>
          </div>
          <div className="p-6 md:p-8">
            {activePatientTickets.length > 0 && mode !== 'instant' && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in fade-in">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 mb-2 flex items-center gap-1.5">
                  <Award size={16} className="text-emerald-600" />
                  Select Store-Credit Ticket
                </h4>
                <p className="text-xs text-emerald-800 mb-4 font-medium">
                  You have store-credit compensation tickets on your account. Apply one to cover or partially pay for this consultation.
                </p>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-white border border-emerald-150 rounded-xl cursor-pointer shadow-xs hover:bg-slate-50 transition-colors">
                    <input 
                      type="radio" 
                      name="payment_option" 
                      checked={selectedTicketToken === null}
                      onChange={() => setSelectedTicketToken(null)}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Make New Cash/Momo Payment</span>
                      <span className="text-[10px] text-slate-500 block">GHS {pricing.grossFee}.00 via Mobile Money or Card</span>
                    </div>
                  </label>

                  {activePatientTickets.map((t: any) => {
                    const rem = t.remainingGHS !== undefined ? t.remainingGHS : (t.valueGHS || 30);
                    return (
                      <label key={t.ticketId} className="flex items-center gap-3 p-3 bg-white border border-emerald-150 rounded-xl cursor-pointer shadow-xs hover:bg-slate-50 transition-colors">
                        <input 
                          type="radio" 
                          name="payment_option" 
                          checked={selectedTicketToken === t.ticketId}
                          onChange={() => setSelectedTicketToken(t.ticketId)}
                          className="text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-xs font-mono font-black text-emerald-700 block">{t.ticketId}</span>
                            <span className="text-[10px] text-slate-500 block">Balance: <strong className="text-emerald-800">GHS {rem}.00</strong> • {t.reason || 'Support Credit'}</span>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                            Apply Credit
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {(() => {
              const selectedTicket = selectedTicketToken ? activePatientTickets.find((t: any) => t.ticketId === selectedTicketToken) : null;
              const sessionPrice = pricing.grossFee;
              const ticketRemaining = selectedTicket ? (selectedTicket.remainingGHS !== undefined ? selectedTicket.remainingGHS : (selectedTicket.valueGHS || 30)) : 0;
              const difference = selectedTicket ? sessionPrice - ticketRemaining : sessionPrice;
              const payableNow = difference > 0 ? difference : 0;
              const remainingStoreCreditAfter = difference < 0 ? Math.abs(difference) : 0;

              return (
                <div className="bg-slate-50 p-6 rounded-2xl mb-6 border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-600">Standard Consultation Rate</span>
                    <span className="font-bold text-slate-800">GHS {sessionPrice}.00</span>
                  </div>
                  {selectedTicket && (
                    <div className="flex justify-between items-center text-sm font-medium text-emerald-700">
                      <span>Store Credit Applied ({selectedTicket.ticketId})</span>
                      <span className="font-bold">- GHS {Math.min(ticketRemaining, sessionPrice)}.00</span>
                    </div>
                  )}
                  {selectedTicket && difference > 0 && (
                    <div className="flex justify-between items-center text-sm font-medium text-purple-700">
                      <span>Remaining Balance Due</span>
                      <span className="font-bold">GHS {difference}.00</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-base">Total Payable Now</span>
                    <span className="font-black text-2xl text-indigo-600">
                      GHS {payableNow}.00
                    </span>
                  </div>
                  {selectedTicket && remainingStoreCreditAfter > 0 && (
                    <p className="text-[11px] text-emerald-700 font-semibold text-right">
                      ✨ GHS {remainingStoreCreditAfter}.00 store credit will remain on this ticket for future visits.
                    </p>
                  )}
                </div>
              );
            })()}

            {isAdmin && (
              <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-2xl animate-in fade-in">
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-purple-600" />
                  Admin Privileged Bypass
                </h4>
                <p className="text-xs text-purple-800 mb-3 font-medium">
                  As an authenticated administrator, you can create this consultation session immediately without payment.
                </p>
                <button
                  onClick={handleAdminBypassBooking}
                  disabled={isProcessingPayment}
                  className="w-full bg-purple-700 hover:bg-purple-800 active:scale-[0.99] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex justify-center items-center gap-2 shadow-md cursor-pointer"
                >
                  {isProcessingPayment ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Create Consultation (Admin Bypass)
                </button>
              </div>
            )}

            {user?.videoChatTickets && user.videoChatTickets > 0 && mode !== 'instant' && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl animate-in fade-in">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 mb-2 flex items-center gap-1.5">
                  <Video size={16} className="text-indigo-600" />
                  Video Chat Ticket Available ({user.videoChatTickets} left)
                </h4>
                <p className="text-xs text-indigo-800 mb-3 font-medium">
                  You have available video chat credits. You can use 1 ticket to book this consultation instantly without paying cash.
                </p>
                <button
                  onClick={handleUseVideoChatTicket}
                  disabled={isProcessingPayment}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex justify-center items-center gap-2 shadow-md cursor-pointer"
                >
                  {isProcessingPayment ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Use 1 Video Chat Ticket (Free Booking)
                </button>
              </div>
            )}

            <div className="space-y-3">
              {selectedTicketToken ? (
                <button 
                  onClick={handleUseTicketPayment}
                  disabled={isProcessingPayment}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:bg-emerald-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {isProcessingPayment ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  {isProcessingPayment ? 'Processing Ticket...' : 'Confirm Booking with Ticket'}
                </button>
              ) : (
                <>
                  <button 
                    onClick={handlePayment}
                    disabled={isProcessingPayment}
                    className="w-full bg-[#09A5DB] hover:bg-[#078bb9] disabled:bg-[#7bc8e2] disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold transition-colors flex justify-center items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isProcessingPayment ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                    {isProcessingPayment ? 'Processing...' : 'Pay with Paystack'}
                  </button>
                </>
              )}
            </div>
            <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1 font-bold uppercase tracking-widest">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>256-bit Encrypted Telehealth Payment</span>
            </p>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden max-w-md mx-auto w-full p-8 text-center animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Booking Confirmed!</h2>
          <p className="text-slate-500 mt-3 font-medium">
            Your appointment with <strong className="text-slate-800">{formatConsultantName(consultant.fullName || consultant.displayName, consultant.prefix)}</strong> is successfully scheduled.
          </p>
          
          <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 text-left">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-indigo-600" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                <p className="text-sm font-bold text-slate-700">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-indigo-600" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</p>
                <p className="text-sm font-bold text-slate-700">{time}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button 
              onClick={() => navigate('/patient/dashboard')} 
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold transition-all shadow-lg text-xs uppercase tracking-widest cursor-pointer"
            >
              Go to My Dashboard
            </button>
            <p className="text-xs text-slate-400 font-medium">
              A confirmation email and notification have been sent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
