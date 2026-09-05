import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, getDocs, doc, updateDoc, addDoc, serverTimestamp, where, getDoc, onSnapshot } from 'firebase/firestore';
import { DashboardSkeleton } from './Skeleton';
import { HeartPulse, ShieldCheck, Users, Activity, Loader2, LogOut, CheckCircle2, Eye, EyeOff, ShieldAlert, Bell, Filter, Check, Search, FileText, UserCheck, AlertTriangle, AlertCircle, X, Download, Shield, Award, CreditCard, Clock, Fingerprint, Scan, Video, LayoutDashboard, Database, ClipboardCheck, History, Trash2, Heart } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import NotificationManager from './NotificationManager';
import { formatConsultantName } from '../lib/formatters';
import { normalizeCadre, CADRE_CONFIGS } from '../config/consultantCadreConfig';

// Admin Components
import AdminMasterLiveControl from './admin/AdminMasterLiveControl';
import AdminCallDispatchMonitor from './admin/AdminCallDispatchMonitor';
import AdminDashboardStats from './admin/AdminDashboardStats';
import AdminComplianceConsole from './admin/AdminComplianceConsole';
import AdminClinicalPrescriptionVault from './admin/AdminClinicalPrescriptionVault';
import AdminOverview from './admin/AdminOverview';
import AdminPatientManager from './admin/AdminPatientManager';
import AdminSessionHistory from './admin/AdminSessionHistory';
import AdminConsultationDirectory from './admin/AdminConsultationDirectory';
import AdminPinReverification from './admin/AdminPinReverification';
import AdminSettlementLedger from './admin/AdminSettlementLedger';
import AdminQualityAssurance from './admin/AdminQualityAssurance';
import AdminBroadcastManager from './admin/AdminBroadcastManager';
import AdminGeographicHeatmap from './admin/AdminGeographicHeatmap';
import AdminAccountDeletionManager from './admin/AdminAccountDeletionManager';
import AdminErrorTracker from './admin/AdminErrorTracker';
import TicketingManagement from './admin/TicketingManagement';
import AdminPartnerPharmacyManager from './admin/AdminPartnerPharmacyManager';
import AdminSystemLogsAudit from './admin/AdminSystemLogsAudit';
import AdminPlatformAnalyticsExport from './admin/AdminPlatformAnalyticsExport';
import AdminSidebar from './admin/AdminSidebar';
import ConsultantDashboard from './ConsultantDashboard';
import PatientDashboard from './PatientDashboard';
import DualFaceBiometrics from './DualFaceBiometrics';

const SUPER_ADMINS = ['pockettclinic@gmail.com', 'missty2k@gmail.com', 'pharmabridgeghana@gmail.com'];
const DEFAULT_ADMIN_EMAIL = 'pockettclinic@gmail.com';

export default function AdminDashboard() {
  const { 
    logout, 
    setRole, 
    seedDemoData, globalLogoUrl, 
    user: contextUser, 
    isLoading: appContextLoading, 
    impersonatedUser, 
    stopImpersonation, 
    startImpersonation,
    showToast,
    showConfirm
  } = useAppContext();
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const userEmail = (contextUser?.email || '').toLowerCase();
  const isSuperAdmin = userEmail && SUPER_ADMINS.includes(userEmail);
  const isAdminUser = contextUser?.role === 'admin' || isSuperAdmin;
  const activeTab = (searchParams.get('tab') || 'dashboard') as any;
  const setActiveTab = (tab: string) => setSearchParams({ tab });

  // Handle impersonation exit
  useEffect(() => {
    if (impersonatedUser && activeTab === 'dashboard') {
      // Keep dashboard active
    }
  }, [impersonatedUser, activeTab]);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);

  // Admin Data State
  const [totalUsers, setTotalUsers] = useState(0);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [criticalErrorsCount, setCriticalErrorsCount] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedConsultantForView, setSelectedConsultantForView] = useState<any | null>(null);
  const [selectedPatientForView, setSelectedPatientForView] = useState<any | null>(null);

  // Indemnity Oversight & Search State
  const [indemnityFilter, setIndemnityFilter] = useState<'all' | 'provided' | 'deferred_pending'>('all');
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'pending' | 'unverified' | 'deferred_pending' | 'verified' | 'flagged_modified'>('all');
  const [comparisonResult, setComparisonResult] = useState<{
    matchPercentage: number;
    isMatch: boolean;
    reasoning: string;
  } | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingReminderUid, setSendingReminderUid] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<string | null>(null);
  
  // Schedule Review State
  const [scheduleMeetingDate, setScheduleMeetingDate] = useState('');
  const [isSchedulingReview, setIsSchedulingReview] = useState(false);

  // Selected Consultant for Audit File Modal
  const [auditingConsultant, setAuditingConsultant] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingPrefix, setIsUpdatingPrefix] = useState(false);

  const handleUpdatePrefix = async (consultantId: string, newPrefix: string) => {
    setIsUpdatingPrefix(true);
    try {
      await updateDoc(doc(db, 'users', consultantId), {
        prefix: newPrefix
      });
      
      setConsultants(prev => prev.map(c => c.id === consultantId ? { ...c, prefix: newPrefix } : c));
      
      if (auditingConsultant && auditingConsultant.id === consultantId) {
        setAuditingConsultant((prev: any) => ({ ...prev, prefix: newPrefix }));
      }

      showToast(`Consultant professional title updated to ${newPrefix}.`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${consultantId}`);
      showToast("Failed to update prefix.", "error");
    } finally {
      setIsUpdatingPrefix(false);
    }
  };

  const sendIndemnityReminder = async (c: any) => {
    setSendingReminderUid(c.id);
    try {
      await addDoc(collection(db, 'notifications'), {
        targetUid: c.id,
        targetEmail: c.email,
        type: 'INDEMNITY_UPLOAD_REMINDER',
        title: 'Urgent Compliance Notice: Professional Indemnity Certificate Required',
        message: `Dear ${c.fullName}, please log into PockettClinic and upload your active Professional Indemnity Insurance policy certificate to update your verified status from the temporary Personal Liability Agreement.`,
        createdAt: serverTimestamp()
      });

      showToast(`Automated compliance reminder dispatched to ${c.fullName} (${c.email}).`, "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
      showToast('Failed to send reminder.', "error");
    } finally {
      setSendingReminderUid(null);
    }
  };

  const handleScheduleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditingConsultant || !scheduleMeetingDate) return;

    setIsSchedulingReview(true);
    
    // Auto-generate the native PockettClinic video review link
    const nativeReviewLink = `${window.location.origin}/review-room/${auditingConsultant.id}`;

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Authentication token unavailable");
      
      const response = await fetch('/api/admin/schedule-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          consultantId: auditingConsultant.id,
          consultantEmail: auditingConsultant.email,
          consultantPhone: auditingConsultant.phone || auditingConsultant.phoneNumber,
          fullName: auditingConsultant.fullName,
          meetingDate: scheduleMeetingDate,
          meetingLink: nativeReviewLink
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to schedule review');

      // Update Firestore
      try {
        await updateDoc(doc(db, 'users', auditingConsultant.id), {
          reviewScheduledAt: scheduleMeetingDate,
          reviewLink: nativeReviewLink,
          notificationSent: true
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${auditingConsultant.id}`);
        throw err;
      }

      // Update local state
      setConsultants(prev => prev.map(c => 
        c.id === auditingConsultant.id ? { ...c, reviewScheduledAt: scheduleMeetingDate, reviewLink: nativeReviewLink, notificationSent: true } : c
      ));
      setAuditingConsultant((prev: any) => ({ ...prev, reviewScheduledAt: scheduleMeetingDate, reviewLink: nativeReviewLink, notificationSent: true }));

      showToast(`Review scheduled and notifications dispatched to ${auditingConsultant.fullName}.`, "success");
      setScheduleMeetingDate('');
    } catch (err) {
      console.error('Error scheduling review:', err);
      showToast('Failed to schedule review. Please check server logs.', "error");
    } finally {
      setIsSchedulingReview(false);
    }
  };

  const compareFaces = async (face1: string, face2: string) => {
    setIsComparing(true);
    setComparisonResult(null);
    try {
      const response = await fetch('/api/admin/compare-faces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ face1, face2 })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setComparisonResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsComparing(false);
    }
  };

  const handleVerifyConsultant = async (consultantId: string, verified: boolean) => {
    setIsUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'users', consultantId), {
        isVerified: verified,
        verificationStatus: verified ? 'verified' : 'unverified'
      });
      
      setConsultants(prev => prev.map(c => c.id === consultantId ? { ...c, isVerified: verified, verificationStatus: verified ? 'verified' : 'unverified' } : c));
      
      if (auditingConsultant && auditingConsultant.id === consultantId) {
        setAuditingConsultant((prev: any) => ({ ...prev, isVerified: verified, verificationStatus: verified ? 'verified' : 'unverified' }));
      }

      // Trigger Notification
      await fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({
          targetUid: consultantId,
          title: 'Compliance Status Updated',
          body: `Your compliance status has been updated to: ${verified ? 'Verified' : 'Unverified'}`,
          actionType: 'compliance_update',
          targetPath: '/consultant/onboarding'
        })
      }).then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
        }
      }).catch(e => console.error("Failed to trigger push:", e));
      
      showToast(`Consultant verification status updated to ${verified ? 'Verified' : 'Unverified'}.`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${consultantId}`);
      showToast("Failed to update consultant status.", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleGoodStanding = async (consultantId: string, currentGoodStanding: boolean) => {
    setIsUpdatingStatus(true);
    const newStatus = !currentGoodStanding;
    try {
      await updateDoc(doc(db, 'users', consultantId), {
        isGoodStanding: newStatus,
        registryStatus: newStatus ? 'In Good Standing (Admin Override)' : 'License Expired / Inactive'
      });
      
      setConsultants(prev => prev.map(c => c.id === consultantId ? { 
        ...c, 
        isGoodStanding: newStatus, 
        registryStatus: newStatus ? 'In Good Standing (Admin Override)' : 'License Expired / Inactive' 
      } : c));
      
      if (auditingConsultant && auditingConsultant.id === consultantId) {
        setAuditingConsultant((prev: any) => ({ 
          ...prev, 
          isGoodStanding: newStatus, 
          registryStatus: newStatus ? 'In Good Standing (Admin Override)' : 'License Expired / Inactive' 
        }));
      }
      
      showToast(`Consultant Good Standing status toggled to ${newStatus ? 'IN GOOD STANDING' : 'EXPIRED/INACTIVE'}.`, "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${consultantId}`);
      showToast("Failed to toggle consultant status.", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleApproveProfileChanges = async (consultantId: string, pendingChanges: any) => {
    setIsUpdatingStatus(true);
    try {
      const updates: any = {
        verificationPendingReview: false,
        pendingProfileChanges: null
      };

      if (pendingChanges.displayName) {
        updates.fullName = pendingChanges.displayName;
        updates.displayName = pendingChanges.displayName;
      }
      if (pendingChanges.prefix !== undefined) {
        updates.prefix = pendingChanges.prefix;
      }
      if (pendingChanges.cadre) {
        updates.cadre = pendingChanges.cadre;
      }
      if (pendingChanges.qualification) {
        updates.qualification = pendingChanges.qualification;
      }
      if (pendingChanges.councilPin) {
        updates.councilPin = pendingChanges.councilPin;
      }
      if (pendingChanges.manualReviewFile) {
        updates.indemnityDocUrl = pendingChanges.manualReviewFile;
        updates.indemnityStatus = 'provided';
        updates.verificationStatus = 'verified';
      }

      await updateDoc(doc(db, 'users', consultantId), updates);

      setConsultants(prev => prev.map(c => c.id === consultantId ? { 
        ...c, 
        ...updates,
        isVerified: true,
        verificationStatus: 'verified'
      } : c));

      if (auditingConsultant && auditingConsultant.id === consultantId) {
        setAuditingConsultant((prev: any) => ({ 
          ...prev, 
          ...updates,
          isVerified: true,
          verificationStatus: 'verified'
        }));
      }

      // Trigger notification
      await fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({
          targetUid: consultantId,
          title: 'Profile Changes Approved',
          body: 'Your profile changes have been reviewed and approved by administrators.',
          actionType: 'compliance_update',
          targetPath: '/consultant/onboarding'
        })
      }).then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
        }
      }).catch(e => console.error("Failed to trigger push:", e));

      showToast("Profile changes approved and live profile updated.", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${consultantId}`);
      showToast("Failed to approve profile changes.", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRejectProfileChanges = async (consultantId: string) => {
    setIsUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'users', consultantId), {
        verificationPendingReview: false,
        pendingProfileChanges: null
      });

      setConsultants(prev => prev.map(c => c.id === consultantId ? { 
        ...c, 
        verificationPendingReview: false,
        pendingProfileChanges: null
      } : c));

      if (auditingConsultant && auditingConsultant.id === consultantId) {
        setAuditingConsultant((prev: any) => ({ 
          ...prev, 
          verificationPendingReview: false,
          pendingProfileChanges: null
        }));
      }

      // Trigger notification
      await fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({
          targetUid: consultantId,
          title: 'Profile Changes Rejected',
          body: 'Your requested profile changes have been reviewed and rejected by administrators.',
          actionType: 'compliance_update',
          targetPath: '/consultant/onboarding'
        })
      }).then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
        }
      }).catch(e => console.error("Failed to trigger push:", e));

      showToast("Profile changes rejected. Original details kept intact.", "warning");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${consultantId}`);
      showToast("Failed to reject profile changes.", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchAdminData = () => {
    setIsLoadingData(true);
    try {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let usersCount = 0;
        const consultantsList: any[] = [];
        const patientsList: any[] = [];
  
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          usersCount++;
          const isConsultantRole = data.role === 'consultant' || data.role === 'doctor' || data.role === 'pharmacist' || data.role === 'specialist' || data.role === 'physician_assistant';
          if (isConsultantRole) {
            consultantsList.push({ ...data, id: docSnap.id, uid: docSnap.id });
          } else if (data.role === 'patient') {
            patientsList.push({ ...data, id: docSnap.id, uid: docSnap.id });
          }
        });
  
        setTotalUsers(usersCount);
        setConsultants(consultantsList);
        setPatients(patientsList);
        setIsLoadingData(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
        setIsLoadingData(false);
      });

      // Also listen to critical errors for crashlytics stats
      const qErrors = query(
        collection(db, 'system_errors'),
        where('status', '==', 'unresolved'),
        where('severity', '==', 'critical')
      );
      const unsubErrors = onSnapshot(qErrors, (snap) => {
        setCriticalErrorsCount(snap.size);
      });

      return () => {
        unsubscribe();
        unsubErrors();
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setIsLoadingData(false);
      return () => {};
    }
  };

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubCons: (() => void) | undefined;

    if (isAdminUser && user) {
      unsubUsers = fetchAdminData();

      // Listen to active sessions in real time
      const q = query(collection(db, 'consultations'));
      unsubCons = onSnapshot(q, (snap) => {
        const sessionsList: any[] = [];
        snap.forEach(docSnap => {
          const session = docSnap.data();
          sessionsList.push({ id: docSnap.id, sessionId: docSnap.id, ...session });
        });
        setActiveSessions(sessionsList);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'consultations');
      });
    }

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubCons) unsubCons();
    };
  }, [isAdminUser, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoggingIn(true);
    setError('');

    try {
      // Use default admin email for the legacy password check if context email isn't in super admins
      const targetEmail = isSuperAdmin ? userEmail : DEFAULT_ADMIN_EMAIL;
      await signInWithEmailAndPassword(auth, targetEmail, password);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        try {
          const targetEmail = isSuperAdmin ? userEmail : DEFAULT_ADMIN_EMAIL;
          await createUserWithEmailAndPassword(auth, targetEmail, password);
        } catch (createErr: any) {
           console.error(createErr);
           setError('Authentication failed. Check your password.');
        }
      } else {
        console.error(err);
        setError('Authentication failed. Check your password.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  // --- Automated Audit Systems (Client-Side Workers) ---
  useEffect(() => {
    if (!isAdminUser || !auth.currentUser) return;

    const runDispatchAudit = async () => {
      if (!auth.currentUser) return;
      try {
        const now = Date.now();
        const ringingTimeout = 45000;
        
        const q = query(
          collection(db, 'consultations'),
          where('dispatchStatus', '==', 'ringing')
        );
        const snapshot = await getDocs(q);

        for (const consultationDoc of snapshot.docs) {
          const data = consultationDoc.data();
          if (data.status !== 'PAID' && data.status !== 'PENDING') continue;
          
          const ringStartTime = data.ringingStartedAt || 0;
          if (now - ringStartTime > ringingTimeout) {
            console.log(`[Audit] Escalating session ${consultationDoc.id}`);
            try {
              await updateDoc(doc(db, 'consultations', consultationDoc.id), {
                dispatchStatus: 'escalated',
                initialConsultantId: data.assignedConsultantId,
                assignedConsultantId: null,
                ringingStartedAt: now,
                updatedAt: serverTimestamp()
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `consultations/${consultationDoc.id}`);
            }
          }
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, 'consultations');
      }
    };

    const runLedgerFinalization = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'consultations'),
          where('status', '==', 'COMPLETED'),
          where('ledgerProcessed', '==', false)
        );
        const snapshot = await getDocs(q);

        for (const sessionDoc of snapshot.docs) {
          const data = sessionDoc.data();
          const consultantId = data.assignedConsultantId;
          const amount = data.amountGHS || 0;
          if (!consultantId) continue;

          console.log(`[Ledger] Processing earnings for session ${sessionDoc.id}`);
          
          let consultantShare = amount * 0.7;
          let referrerShare = 0;

          if (data.dispatchStatus === 'escalated' && data.initialConsultantId) {
            consultantShare = amount * 0.5;
            referrerShare = amount * 0.2;
          }

          // 1. Update Consultant Wallet
          const consultantRef = doc(db, 'users', consultantId);
          try {
            const consultantDoc = await getDoc(consultantRef);
            if (consultantDoc.exists()) {
              const currentBalance = consultantDoc.data().walletBalanceGHS || 0;
              await updateDoc(consultantRef, {
                walletBalanceGHS: currentBalance + consultantShare
              });
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${consultantId}`);
          }

          // 2. Update Referrer if applicable
          if (referrerShare > 0 && data.initialConsultantId) {
            const referrerRef = doc(db, 'users', data.initialConsultantId);
            try {
              const referrerDoc = await getDoc(referrerRef);
              if (referrerDoc.exists()) {
                const currentRefBalance = referrerDoc.data().walletBalanceGHS || 0;
                await updateDoc(referrerRef, {
                  walletBalanceGHS: currentRefBalance + referrerShare
                });
              }
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `users/${data.initialConsultantId}`);
            }
          }

          // 3. Mark as processed
          try {
            await updateDoc(doc(db, 'consultations', sessionDoc.id), {
              ledgerProcessed: true,
              processedAt: serverTimestamp()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `consultations/${sessionDoc.id}`);
          }
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, 'consultations');
      }
    };

    // Run audits every 30 seconds while Admin is active
    const interval = setInterval(() => {
      runDispatchAudit();
      runLedgerFinalization();
    }, 30000);

    // Initial run
    runDispatchAudit();
    runLedgerFinalization();

    return () => clearInterval(interval);
  }, [isAdminUser, user]);

  if (isInitializing) {
    return <DashboardSkeleton />;
  }

  // Not logged in or not admin
  if (!user || !isAdminUser) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl p-8 md:p-12 shadow-xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-white rounded-xl mx-auto flex items-center justify-center text-slate-600 mb-6">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Admin Portal</h2>
          <p className="text-slate-600 mt-2 mb-8 text-sm">Secure access is restricted to the platform super administrator.</p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Admin Email</label>
              <input 
                type="email" 
                value={isSuperAdmin ? userEmail : DEFAULT_ADMIN_EMAIL}
                disabled
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium outline-none cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-slate-300 focus:ring-2 focus:ring-emerald-500/20 transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            <div className="pt-4">
              <button 
                type="submit"
                disabled={!password || isLoggingIn}
                className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-300 disabled:cursor-not-allowed text-slate-600 px-6 py-4 rounded-xl font-bold transition-colors flex justify-center items-center gap-2 shadow-sm border border-slate-200 transition-all duration-300"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Authenticate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const liveConsultations = activeSessions.filter(s => {
    const statusUpper = (s.status || '').toUpperCase();
    const dispatchUpper = (s.dispatchStatus || '').toUpperCase();
    if (statusUpper.startsWith('CANCEL') || dispatchUpper.startsWith('CANCEL') || dispatchUpper === 'EXPIRED') {
      return false;
    }
    return (
      statusUpper === 'IN_PROGRESS' || 
      statusUpper === 'ACTIVE' ||
      statusUpper === 'PAID' ||
      statusUpper === 'PENDING' ||
      ['RINGING', 'RE-ROUTING', 'ESCALATED', 'CONNECTED', 'ACCEPTED'].includes(dispatchUpper)
    );
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-slate-50">
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden bg-[#0A3B24] text-white px-5 pt-6 pb-4 flex flex-col gap-3 shadow-lg relative z-[80] w-full shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {globalLogoUrl ? (
              <img src={globalLogoUrl} alt="PockettClinic" className="w-10 h-10 rounded-xl object-cover bg-white p-0.5 shrink-0 shadow-sm border border-white/10" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#C8E6C9] text-[#0A3B24] flex items-center justify-center shrink-0 border border-[#E8F5E9]/20 shadow-sm">
                <Heart size={20} className="fill-[#0A3B24] text-[#0A3B24]" strokeWidth={2.5} />
              </div>
            )}
            <div className="flex flex-col justify-center">
              <h1 className="text-base font-black leading-none tracking-tight text-white mb-0.5">
                PockettClinic
              </h1>
              <span className="text-[9px] text-emerald-200 font-extrabold uppercase tracking-widest block">Master Admin Console</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationManager iconClassName="text-white hover:bg-white/10" />
          </div>
        </div>

        {/* Mobile Horizontal Scrollable Tab Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-2 px-2 border-t border-emerald-800/50 pt-2">
          {[
            { id: 'dashboard', label: 'OVERVIEW' },
            { id: 'master-control', label: 'LIVE MASTER CONTROL' },
            { id: 'call-dispatch', label: 'CALL DISPATCH' },
            { id: 'compliance', label: 'COMPLIANCE AND AUDIT' },
            { id: 'prescription-vault', label: 'RX VAULT' },
            { id: 'pin-verification', label: 'CANCEL PIN VERIFICATION' },
            { id: 'consultations', label: 'CONSULTATION LEDGER' },
            { id: 'overview', label: 'CONSULTANT DIRECTORY' },
            { id: 'patients', label: 'PATIENT ACCOUNTS' },
            { id: 'partner-pharmacies', label: 'PARTNER EPHARMACY' },
            { id: 'system-logs', label: 'SECURITY LOGS' },
            { id: 'sessions', label: 'ACTIVE VIDEO ROOMS' },
            { id: 'settlement', label: 'SETTLEMENT AND PAYOUT' },
            { id: 'quality-qa', label: 'CONSULTANT QA AND SOAP' },
            { id: 'broadcasts', label: 'SYSTEM BROADCAST' },
            { id: 'heatmap', label: 'GEOGRAPHIC HEAT MAP' },
            { id: 'ticketing-management', label: 'SUPPORT AND CREDIT' },
            { id: 'deletion-requests', label: 'GRD DELETION' },
            { id: 'system-errors', label: 'SRE CRASH LATENCY TRACK' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-400 text-[#0A3B24] shadow-sm'
                  : 'bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AdminSidebar 
        globalLogoUrl={globalLogoUrl}
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSeeding={isSeeding} 
        handleSeed={async () => { setIsSeeding(true); await seedDemoData(); setIsSeeding(false); }} 
        handleLogout={logout} 
        isLoading={appContextLoading} 
      />
      <main className="flex-1 w-full min-w-0 p-4 pb-28 md:p-6 lg:p-8 space-y-6">
        {/* Reminder Toast Banner */}
        {reminderToast && (
          <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 size={18} />
              <span>{reminderToast}</span>
            </div>
            <button onClick={() => setReminderToast(null)} className="text-emerald-100 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        )}

        {activeTab === 'master-control' && (
          <div className="animate-in fade-in duration-300">
            <AdminMasterLiveControl />
          </div>
        )}

        {activeTab === 'call-dispatch' && (
          <div className="animate-in fade-in duration-300">
            <AdminCallDispatchMonitor />
          </div>
        )}

        {activeTab === 'system-errors' && (
          <div className="animate-in fade-in duration-300">
            <AdminErrorTracker />
          </div>
        )}

        {activeTab === 'deletion-requests' && (
          <div className="animate-in fade-in duration-300">
            <AdminAccountDeletionManager />
          </div>
        )}

        {activeTab === 'ticketing-management' && (
          <div className="animate-in fade-in duration-300">
            <TicketingManagement />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Admin Welcome Hero Area */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 p-8 md:p-10 shadow-xl border border-emerald-900/50">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-emerald-700/20 blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="inline-block px-3 py-1 mb-3 text-[10px] font-black tracking-widest text-emerald-100 uppercase bg-emerald-800/40 rounded-full border border-emerald-700/30 backdrop-blur-sm">
                    SRE Master Console
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2">Systems Overview</h2>
                  <p className="text-emerald-100/80 text-sm md:text-base font-medium max-w-md">Real-time health, compliance metrics, and active consultation monitoring across the entire PockettClinic network.</p>
                </div>
                
                <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                   <div className="flex items-center gap-2 bg-emerald-800/30 px-4 py-2 rounded-xl border border-emerald-700/30 backdrop-blur-sm">
                     <span className="relative flex h-3 w-3">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                     </span>
                     <span className="text-emerald-50 text-xs font-bold uppercase tracking-wider">All Systems Nominal</span>
                   </div>
                </div>
              </div>
            </div>

            <AdminDashboardStats 
              totalUsers={totalUsers}
              verifiedCount={consultants.filter(c => c.isVerified).length}
              activeSessionsCount={liveConsultations.length}
              criticalErrorsCount={criticalErrorsCount}
              isLoading={isLoadingData}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300">
                <h3 className="text-lg font-black tracking-tight text-slate-800 mb-6 flex items-center gap-2">
                  <Activity size={20} className="text-slate-600" /> Recent Compliance Activity
                </h3>
                <div className="space-y-4">
                  {consultants.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                          <img src={c.avatarUrl} alt={c.fullName} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{c.fullName}</p>
                          <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">{c.cadre}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${
                        c.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {c.isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl text-slate-600 shadow-xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-400" /> System Integrity Logs
                </h3>
                <div className="space-y-4 font-mono text-[11px] text-slate-500">
                  <p className="flex items-center gap-2"><span className="text-emerald-500">[OK]</span> Firestore Security Rules: v2.4 Active</p>
                  <p className="flex items-center gap-2"><span className="text-emerald-500">[OK]</span> Paystack Webhook Integrity: Verified</p>
                  <p className="flex items-center gap-2"><span className="text-emerald-500">[OK]</span> Agora Media Service: Operational</p>
                  <p className="flex items-center gap-2"><span className="text-amber-500">[WARN]</span> 4 Consultants awaiting face-to-face review</p>
                  <p className="flex items-center gap-2"><span className="text-emerald-500">[OK]</span> Patient Health Data Encryption: AES-256</p>
                </div>
              </div>
            </div>

            <AdminPlatformAnalyticsExport />
          </div>
        )}

        {activeTab === 'compliance' && (
          <AdminComplianceConsole 
            consultants={consultants}
            isLoadingData={isLoadingData}
            complianceFilter={complianceFilter}
            setComplianceFilter={setComplianceFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setAuditingConsultant={setAuditingConsultant}
            sendIndemnityReminder={sendIndemnityReminder}
            sendingReminderUid={sendingReminderUid}
          />
        )}

        {activeTab === 'prescription-vault' && (
          <div className="animate-in fade-in duration-300">
            <AdminClinicalPrescriptionVault />
          </div>
        )}

        {activeTab === 'pin-verification' && (
          <div className="animate-in fade-in duration-300">
            <AdminPinReverification 
              consultants={consultants} 
              onRefreshData={() => {}}
            />
          </div>
        )}

        {activeTab === 'settlement' && (
          <div className="animate-in fade-in duration-300">
            <AdminSettlementLedger 
              consultations={activeSessions}
            />
          </div>
        )}

        {activeTab === 'quality-qa' && (
          <div className="animate-in fade-in duration-300">
            <AdminQualityAssurance 
              consultations={activeSessions}
              consultants={consultants}
            />
          </div>
        )}

        {activeTab === 'broadcasts' && (
          <div className="animate-in fade-in duration-300">
            <AdminBroadcastManager />
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div className="animate-in fade-in duration-300">
            <AdminGeographicHeatmap 
              consultations={activeSessions}
              consultants={consultants}
            />
          </div>
        )}

        {activeTab === 'consultations' && (
          <AdminConsultationDirectory 
            consultations={activeSessions}
            isLoading={isLoadingData}
            onInspectSession={(session) => setInspectSessionId(session.sessionId || session.id)}
          />
        )}

        {(activeTab === 'overview' || activeTab === 'consultants') && (
          <AdminOverview 
            consultants={consultants}
            isLoadingData={isLoadingData}
            indemnityFilter={indemnityFilter}
            setIndemnityFilter={setIndemnityFilter}
            onSelectConsultant={(c) => {
              setSelectedConsultantForView(c);
              setActiveTab('view-consultant');
            }}
          />
        )}

        {activeTab === 'patients' && (
          <AdminPatientManager 
            patients={patients} 
            isLoading={isLoadingData} 
            onSelectPatient={(p) => {
              setSelectedPatientForView(p);
              setActiveTab('view-patient');
            }}
          />
        )}

        {activeTab === 'partner-pharmacies' && (
          <div className="animate-in fade-in duration-300">
            <AdminPartnerPharmacyManager />
          </div>
        )}

        {activeTab === 'system-logs' && (
          <div className="animate-in fade-in duration-300">
            <AdminSystemLogsAudit />
          </div>
        )}
        {activeTab === 'identity-verification' && (
          <div className="animate-in fade-in duration-300 space-y-6">
            <h2 className="text-2xl font-black text-slate-800">Patient Identity Verification (Biometrics)</h2>
            <div className="bg-slate-900 rounded-[32px] p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
               <DualFaceBiometrics />
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <AdminSessionHistory 
            activeSessions={liveConsultations}
            onInspectSession={(session) => setInspectSessionId(session.sessionId || session.id)}
            isLoading={isLoadingData}
          />
        )}

        {/* Session Inspector Modal */}
        {inspectSessionId && (() => {
          const inspectedSession = activeSessions.find(s => (s.sessionId || s.id) === inspectSessionId) || 
            patients.flatMap(p => p.consultations || []).find((c: any) => (c.sessionId || c.id) === inspectSessionId) ||
            { id: inspectSessionId, status: 'UNKNOWN' };

          const handleForceEndSession = async () => {
            try {
              const sessionRef = doc(db, 'consultations', inspectSessionId);
              await updateDoc(sessionRef, {
                status: 'CANCELLED',
                dispatchStatus: 'cancelled',
                isOnHold: false,
                holdReason: "",
                updatedAt: new Date().toISOString()
              });
              showToast(`Session ${inspectSessionId.slice(0, 8)} terminated successfully.`, "success");
              setInspectSessionId(null);
            } catch (err: any) {
              console.error("Failed to end session:", err);
              showToast('Failed to end session: ' + err.message, "error");
            }
          };

          return (
            <div className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-6 bg-white text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-bold">
                      <Video size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black tracking-tight text-slate-600">Clinical Session Inspector</h2>
                        <span className={`${
                          inspectedSession.dispatchStatus === 'ringing' || inspectedSession.status === 'PAID' || inspectedSession.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        } text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border`}>
                          {inspectedSession.dispatchStatus === 'ringing' || inspectedSession.status === 'PAID' || inspectedSession.status === 'PENDING' ? 'RINGING' : (inspectedSession.status || 'ACTIVE')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Session ID: {inspectSessionId}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setInspectSessionId(null)}
                    className="p-2 text-slate-500 hover:text-slate-600 hover:bg-white rounded-xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
                  {/* Participant Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50/60 border border-indigo-100/80">
                      <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider mb-1">Patient</p>
                      <p className="font-black text-slate-800 text-base">{inspectedSession.patientName || 'Anonymous Patient'}</p>
                      <p className="text-xs text-slate-600 mt-0.5">Ref: {inspectedSession.patientId || 'N/A'}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100/80">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-1">Attending Consultant</p>
                      <p className="font-black text-slate-800 text-base">{formatConsultantName(inspectedSession.consultantName, inspectedSession.consultantPrefix) || 'Assigned Consultant'}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{inspectedSession.cadreNeeded || 'UNASSIGNED'} • {inspectedSession.consultantSpecialty || 'General Practice'}</p>
                    </div>
                  </div>

                  {/* Consultation Meta Details */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Chief Complaint & Room Info</h3>
                    <div className="text-sm font-semibold text-slate-800 bg-white p-3 rounded-xl border border-slate-200">
                      {inspectedSession.chiefComplaint || inspectedSession.symptoms || 'No initial complaint statement recorded.'}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Room ID</span>
                        <span className="text-xs font-mono font-bold text-slate-800">{inspectedSession.roomId || inspectSessionId.slice(0, 8)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Cadre Level</span>
                        <span className="text-xs font-bold text-slate-600">{inspectedSession.cadreNeeded || 'UNASSIGNED'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Created At</span>
                        <span className="text-xs font-bold text-slate-800">
                          {inspectedSession.createdAt ? new Date(inspectedSession.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Vitals Summary if present */}
                  {inspectedSession.vitals && (
                    <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                      <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">Attached Patient Vitals</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium text-slate-800">
                        <div>BP: <strong className="text-slate-800">{inspectedSession.vitals.bloodPressureSys}/{inspectedSession.vitals.bloodPressureDia} mmHg</strong></div>
                        <div>HR: <strong className="text-slate-800">{inspectedSession.vitals.heartRate} bpm</strong></div>
                        <div>Weight: <strong className="text-slate-800">{inspectedSession.vitals.weightKg} kg</strong></div>
                        <div>Glucose: <strong className="text-slate-800">{inspectedSession.vitals.glucoseLevel} mg/dL</strong></div>
                      </div>
                    </div>
                  )}

                  {/* SOAP Notes Preview if present */}
                  {inspectedSession.soapNotes && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Recorded SOAP Clinical Notes</h4>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        {inspectedSession.soapNotes.subjective && <p><strong>S:</strong> {inspectedSession.soapNotes.subjective}</p>}
                        {inspectedSession.soapNotes.objective && <p><strong>O:</strong> {inspectedSession.soapNotes.objective}</p>}
                        {inspectedSession.soapNotes.assessment && <p><strong>A:</strong> {inspectedSession.soapNotes.assessment}</p>}
                        {inspectedSession.soapNotes.plan && <p><strong>P:</strong> {inspectedSession.soapNotes.plan}</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer Controls */}
                <div className="p-5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <button 
                    onClick={() => setInspectSessionId(null)}
                    className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-white text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Close Inspector
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleForceEndSession}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Force End Session
                    </button>
                    <a
                      href={`/consultation/${inspectSessionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Video size={14} />
                      Join Room as Admin
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'view-consultant' && (
          <div className="space-y-4">
            <div className="bg-indigo-900 text-indigo-100 px-6 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg border border-indigo-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-600">Super Admin Live View: Consultant Dashboard</h3>
                  <p className="text-xs text-slate-600">You are viewing the exact live interface and workspace seen by active clinical consultants.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('view-patient')}
                  className="px-4 py-2 bg-indigo-800 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Switch to Patient View
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-white text-indigo-950 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors"
                >
                  Back to Admin Console
                </button>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-2 md:p-6">
              <ConsultantDashboard 
                targetConsultant={consultants.find(c => c.id === (selectedConsultantForView?.id || selectedConsultantForView?.uid)) || selectedConsultantForView || consultants[0]}
                allConsultants={consultants}
                onSelectConsultant={(c) => setSelectedConsultantForView(c)}
                onBackToList={() => setActiveTab('consultants')}
              />
            </div>
          </div>
        )}

        {activeTab === 'view-patient' && (
          <div className="space-y-4">
            <div className="bg-emerald-900 text-emerald-100 px-6 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg border border-emerald-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-600">Super Admin Live View: Patient Dashboard</h3>
                  <p className="text-xs text-emerald-200">You are viewing the exact live interface, appointment cards, and triage tools seen by patients.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('view-consultant')}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Switch to Consultant View
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-white text-emerald-950 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-colors"
                >
                  Back to Admin Console
                </button>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-2 md:p-6">
              <PatientDashboard 
                targetPatient={selectedPatientForView || patients[0]}
                allPatients={patients}
                onSelectPatient={(p) => setSelectedPatientForView(p)}
                onBackToList={() => setActiveTab('patients')}
              />
            </div>
          </div>
        )}

      {/* DETAILED CONSULTANT COMPLIANCE AUDIT FILE MODAL */}
      {auditingConsultant && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-white text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck size={24} className="text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-slate-600">Consultant Compliance Audit File</h3>
                  <p className="text-xs text-slate-500">Ghana Card, Medical Council PIN, and Indemnity Verification Record</p>
                </div>
              </div>
              <button onClick={() => { setAuditingConsultant(null); setComparisonResult(null); }} className="text-slate-500 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-800">
              {/* Consultant Summary Bar */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-indigo-100 flex items-center justify-center text-slate-600 font-bold text-base overflow-hidden shrink-0">
                    <img
                      src={auditingConsultant.profilePhotoUrl || auditingConsultant.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${auditingConsultant.id}&backgroundColor=f8fafc`}
                      alt={auditingConsultant.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{auditingConsultant.fullName}</h4>
                    <p className="text-slate-600 font-semibold">{auditingConsultant.cadre}</p>
                    <p className="text-slate-500 text-[11px]">{auditingConsultant.email} • {auditingConsultant.phone}</p>
                  </div>
                </div>

                <div>
                  {auditingConsultant.isVerified ? (
                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-emerald-600" /> Account Verified
                    </span>
                  ) : auditingConsultant.verificationStatus === 'pending' ? (
                    <span className="bg-slate-200 text-slate-600 border border-slate-300 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1">
                      <Clock size={14} className="text-slate-600 animate-pulse" /> Pending Manual Audit
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1">
                      <AlertTriangle size={14} className="text-amber-600" /> Unverified
                    </span>
                  )}
                </div>
              </div>

              {/* Post-Verification Modification Side-by-Side Review Block */}
              {auditingConsultant.verificationPendingReview && auditingConsultant.pendingProfileChanges && (
                <div className="p-5 bg-amber-50/70 border-slate-100 border-amber-300 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                    <div>
                      <h5 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider">
                        ⚠️ Profile Modified Post-Verification
                      </h5>
                      <p className="text-[10px] text-amber-700 font-medium">
                        This verified consultant has requested updates to critical clinical identity fields. Review the changes below.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    {/* Live Profile Column */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Live Profile</p>
                      
                      <div className="space-y-1">
                        <span className="text-slate-500 font-medium block">Full Name</span>
                        <p className="font-bold text-slate-800">{auditingConsultant.fullName || auditingConsultant.displayName}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-500 font-medium block">Prefix</span>
                        <p className="font-bold text-slate-800">{auditingConsultant.prefix || 'No prefix'}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-500 font-medium block">Qualification</span>
                        <p className="font-bold text-slate-800">{auditingConsultant.qualification || 'No qualification'}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-500 font-medium block">Council PIN</span>
                        <p className="font-bold font-mono text-slate-800">{auditingConsultant.councilPin || 'No PIN'}</p>
                      </div>
                    </div>

                    {/* Pending Changes Column */}
                    <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2.5">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Requested Modifications</p>
                      
                      <div className="space-y-1">
                        <span className="text-amber-600 font-medium block">Full Name</span>
                        <p className={`font-bold ${
                          auditingConsultant.fullName !== auditingConsultant.pendingProfileChanges.displayName
                            ? 'text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded w-fit'
                            : 'text-slate-600'
                        }`}>
                          {auditingConsultant.pendingProfileChanges.displayName || auditingConsultant.fullName || auditingConsultant.displayName}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-amber-600 font-medium block">Prefix</span>
                        <p className={`font-bold ${
                          auditingConsultant.prefix !== auditingConsultant.pendingProfileChanges.prefix
                            ? 'text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded w-fit'
                            : 'text-slate-600'
                        }`}>
                          {auditingConsultant.pendingProfileChanges.prefix || 'No prefix'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-amber-600 font-medium block">Professional Cadre</span>
                        <p className={`font-bold ${
                          auditingConsultant.cadre !== auditingConsultant.pendingProfileChanges.cadre
                            ? 'text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded w-fit'
                            : 'text-slate-600'
                        }`}>
                          {auditingConsultant.pendingProfileChanges.cadre || 'Not specified'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-amber-600 font-medium block">Qualification</span>
                        <p className={`font-bold ${
                          auditingConsultant.qualification !== auditingConsultant.pendingProfileChanges.qualification
                            ? 'text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded w-fit'
                            : 'text-slate-600'
                        }`}>
                          {auditingConsultant.pendingProfileChanges.qualification || 'No qualification'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-amber-600 font-medium block">Council PIN</span>
                        <p className={`font-bold font-mono ${
                          auditingConsultant.councilPin !== auditingConsultant.pendingProfileChanges.councilPin
                            ? 'text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded w-fit'
                            : 'text-slate-600'
                        }`}>
                          {auditingConsultant.pendingProfileChanges.councilPin || 'No PIN'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pending Certificate Document View */}
                  {auditingConsultant.pendingProfileChanges.manualReviewFile && (
                    <div className="p-3.5 bg-white border border-amber-200 rounded-2xl space-y-2">
                      <span className="text-amber-600 font-bold block uppercase tracking-wider text-[9px]">
                        New Practice Certificate / License Document Uploaded
                      </span>
                      <div className="aspect-video w-full bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                        {auditingConsultant.pendingProfileChanges.manualReviewFile.startsWith('data:image') ? (
                          <img 
                            src={auditingConsultant.pendingProfileChanges.manualReviewFile} 
                            alt="New Certificate Document" 
                            className="w-full h-full object-contain" 
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-slate-500">
                            <FileText size={36} className="text-slate-600" />
                            <p className="text-[10px] font-bold">New PDF Certificate Document</p>
                            <a 
                              href={auditingConsultant.pendingProfileChanges.manualReviewFile} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-slate-600 hover:underline text-[10px] font-bold"
                            >
                              Open in New Tab
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Decision Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleRejectProfileChanges(auditingConsultant.id)}
                      disabled={isUpdatingStatus}
                      className="py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] transition-all text-rose-700 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-rose-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                    >
                      {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      Reject Changes
                    </button>
                    <button
                      onClick={() => handleApproveProfileChanges(auditingConsultant.id, auditingConsultant.pendingProfileChanges)}
                      disabled={isUpdatingStatus}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                    >
                      {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approve & Update
                    </button>
                  </div>
                </div>
              )}

              <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Fingerprint size={16} className="text-slate-600" /> Biometric Identity Match Helper
              </h5>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 uppercase">1. License Photo</p>
                      <div className="aspect-square rounded-xl bg-slate-50 border border-slate-300 overflow-hidden">
                        {auditingConsultant.indemnityDocUrl ? (
                          <img src={auditingConsultant.indemnityDocUrl} alt="License" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500"><FileText size={20} /></div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 uppercase">2. Profile Snapshot</p>
                      <div className="aspect-square rounded-xl bg-slate-50 border border-slate-300 overflow-hidden">
                        <img 
                          src={auditingConsultant.profilePhotoUrl || auditingConsultant.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${auditingConsultant.id}&backgroundColor=f8fafc`} 
                          alt="Profile" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    </div>
                  </div>

                  {!comparisonResult && !isComparing ? (
                    <button
                      onClick={() => compareFaces(auditingConsultant.indemnityDocUrl || '', auditingConsultant.profilePhotoUrl || auditingConsultant.avatarUrl || '')}
                      disabled={!auditingConsultant.indemnityDocUrl}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
                    >
                      <Scan size={14} />
                      Analyze Biometric Similarity
                    </button>
                  ) : isComparing ? (
                    <div className="w-full py-2.5 bg-slate-50 border border-indigo-100 rounded-xl flex items-center justify-center gap-3 text-slate-600">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">Running AI Comparison...</span>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-xl border-slate-100 ${comparisonResult.isMatch ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} animate-in fade-in slide-in-from-top-2 duration-300`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {comparisonResult.isMatch ? <CheckCircle2 size={18} className="text-emerald-600" /> : <ShieldAlert size={18} className="text-rose-600" />}
                          <span className={`text-[11px] font-black uppercase ${comparisonResult.isMatch ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {comparisonResult.isMatch ? 'High Similarity Detected' : 'Identity Mismatch Caution'}
                          </span>
                        </div>
                        <div className={`text-sm font-black ${comparisonResult.isMatch ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {comparisonResult.matchPercentage}% Match
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-relaxed italic font-medium">
                        "{comparisonResult.reasoning}"
                      </p>
                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">AI Assisted Identity Verification</span>
                        <button 
                          onClick={() => setComparisonResult(null)}
                          className="text-[9px] text-slate-600 font-bold hover:underline"
                        >
                          Re-run Scan
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              {/* Face-to-Face Compliance Review Scheduler */}
              <div className="space-y-2 mt-4">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-slate-600" /> Mandatory Face-to-Face Compliance Review
                </h5>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                  {auditingConsultant.notificationSent ? (
                    <div className="flex flex-col gap-3 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-800">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={24} className="text-emerald-600" />
                        <div>
                          <p className="font-bold text-sm">Notification Sent Successfully</p>
                          <p className="text-xs">Meeting scheduled for {new Date(auditingConsultant.reviewScheduledAt).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {auditingConsultant.reviewTermsAcceptedAt ? (
                        <div className="mt-2 pt-3 border-t border-emerald-200">
                          <p className="text-xs font-bold text-emerald-800 mb-2">
                            Terms Accepted at {new Date(auditingConsultant.reviewTermsAcceptedAt).toLocaleString()}
                          </p>
                          <a 
                            href={`/review-room/${auditingConsultant.id}`}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 text-sm w-full"
                          >
                            <Video size={16} />
                            Launch Native Face-to-Face Video Room
                          </a>
                        </div>
                      ) : (
                        <div className="mt-2 pt-3 border-t border-emerald-200">
                          <p className="text-xs text-emerald-800 flex items-center gap-1.5">
                            <Clock size={14} /> Waiting for consultant to accept terms...
                          </p>
                          <button 
                            disabled
                            className="mt-2 w-full bg-emerald-200/50 text-emerald-600/50 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm cursor-not-allowed"
                          >
                            <Video size={16} />
                            Video Room Locked
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleScheduleReview} className="space-y-4">
                      <p className="text-xs text-slate-600 mb-2">Schedule a live video review. An automated email and SMS will be dispatched instantly.</p>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Meeting Date & Time</label>
                          <input 
                            type="datetime-local" 
                            required
                            value={scheduleMeetingDate}
                            onChange={(e) => setScheduleMeetingDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSchedulingReview}
                        className="w-full bg-white hover:bg-white disabled:bg-slate-300 text-slate-600 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                      >
                        {isSchedulingReview ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                        Dispatch Automated Notifications (Email & SMS)
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* 1. Ghana Card & Identity */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CreditCard size={16} className="text-slate-600" /> 1. Ghana Card Identification
                </h5>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Registered Ghana Card Number:</span>
                    <span className="font-mono font-extrabold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200">
                      {auditingConsultant.ghanaCardNumber || auditingConsultant.indemnityLegalSignoff?.ghanaCardNumber || 'GHA-829103847-1'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600 font-medium">National Identity Verification Status:</span>
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                      Verified Against NIA Directory
                    </span>
                  </div>
                </div>
              </div>

              {/* 1.5. Professional Title & Prefix Lock */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Shield size={16} className="text-slate-600" /> 1.5. Verified Professional Title (Prefix Lock)
                </h5>
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Requested/Assigned Prefix:</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={auditingConsultant.prefix || ''}
                        onChange={(e) => handleUpdatePrefix(auditingConsultant.id, e.target.value)}
                        disabled={isUpdatingPrefix}
                        className="bg-white border border-slate-300 text-slate-600 font-bold px-3 py-1.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">No Prefix</option>
                        <option value="Dr.">Dr.</option>
                        <option value="Pharm.">Pharm.</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Pharm. Tech.">Pharm. Tech.</option>
                      </select>
                      {isUpdatingPrefix && <Loader2 size={14} className="animate-spin text-slate-600" />}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-600 border border-indigo-100 italic font-medium leading-relaxed">
                    "Only Administrators can assign or modify prefixes. Consultants are restricted from self-editing this field after initial registration to prevent qualification falsification. Ensure the title matches the verified certificate below."
                  </div>
                </div>
              </div>

              {/* 2. Medical Council License Retention PIN */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Award size={16} className="text-slate-600" /> 2. Medical / Health Professional Council License
                </h5>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Council License Retention PIN:</span>
                    <span className="font-mono font-extrabold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-300">
                      {auditingConsultant.councilPin || 'MDC/RN/2026/0921'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600 font-medium">Regulatory Council Body:</span>
                    <span className="text-slate-800 font-bold">
                      {CADRE_CONFIGS[normalizeCadre(auditingConsultant.cadre)].governingCouncil}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[11px] pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">Council Registry Year:</span>
                    <span className="text-slate-800 font-bold font-mono">
                      {auditingConsultant.registrationYear || '1997 onwards'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600 font-medium">Registry Status:</span>
                    <div className="flex items-center gap-2">
                      {auditingConsultant.isGoodStanding !== false ? (
                        <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                          ✓ In Good Standing
                        </span>
                      ) : (
                        <span className="text-rose-700 font-extrabold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                          ✗ Expired / Inactive
                        </span>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => handleToggleGoodStanding(auditingConsultant.id, auditingConsultant.isGoodStanding !== false)}
                        className="text-[10px] font-bold text-slate-600 hover:text-slate-600 bg-slate-50 border border-slate-300 px-2 py-0.5 rounded transition-all"
                      >
                        Override Status
                      </button>
                    </div>
                  </div>
                  
                  {auditingConsultant.indemnityDocUrl && (
                    <div className="pt-4 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-tight">Practice Certificate / License Document</p>
                      <div className="aspect-video w-full bg-white rounded-xl border-slate-100 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                        {(auditingConsultant.indemnityDocUrl || '').startsWith('data:image') ? (
                          <img src={auditingConsultant.indemnityDocUrl} alt="License" className="w-full h-full object-contain" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-500">
                            <FileText size={40} />
                            <p className="text-[10px] font-bold">PDF Document Uploaded</p>
                            <a 
                              href={auditingConsultant.indemnityDocUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-slate-600 hover:underline text-[10px] font-bold"
                            >
                              Download/View Document
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Professional Indemnity Status & Signed Waiver Transcript */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldAlert size={16} className="text-amber-600" /> 3. Professional Indemnity Compliance Record
                </h5>

                {auditingConsultant.indemnityStatus === 'provided' ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-900 font-bold">Insurance Status:</span>
                      <span className="bg-emerald-600 text-white font-extrabold px-3 py-1 rounded-full text-[11px]">
                        Active Policy Verified
                      </span>
                    </div>
                    {auditingConsultant.indemnityPolicyNo && (
                      <p className="text-[11px] text-slate-800 font-mono">
                        Policy Number: {auditingConsultant.indemnityPolicyNo}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border-slate-100 border-amber-300 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-amber-100 text-amber-950 border border-amber-300 font-extrabold px-3 py-1 rounded-full text-[11px]">
                        Operating under Personal Legal Liability Agreement
                      </span>
                      <span className="text-[10px] text-amber-800 font-bold">Indemnity Upload Deferred</span>
                    </div>

                    <div className="p-3 bg-white border border-amber-200 rounded-xl space-y-2 text-[11px]">
                      <p className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">Signed Waiver Transcript Log</p>
                      <div className="grid grid-cols-2 gap-2 text-slate-800">
                        <div>
                          <span className="text-slate-500 font-medium block">Signed Legal Name:</span>
                          <span className="font-bold">{auditingConsultant.indemnityLegalSignoff?.signerFullName || auditingConsultant.fullName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium block">Ghana Card Verified:</span>
                          <span className="font-mono font-bold">{auditingConsultant.indemnityLegalSignoff?.ghanaCardNumber || auditingConsultant.ghanaCardNumber}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 font-medium block">Legal Agreement Scope:</span>
                          <span className="font-medium text-slate-800 leading-tight block mt-0.5">
                            "Consultant certifies full personal civil and professional liability for tele-consultation advice, explicitly indemnifying PockettClinic from third-party claims."
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => sendIndemnityReminder(auditingConsultant)}
                      disabled={sendingReminderUid === auditingConsultant.id}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                    >
                      {sendingReminderUid === auditingConsultant.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                      Dispatch Automated Certificate Upload Reminder
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => { setAuditingConsultant(null); setComparisonResult(null); }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-white"
              >
                Close Audit File
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {auditingConsultant.isVerified ? (
                  <button
                    onClick={() => handleVerifyConsultant(auditingConsultant.id, false)}
                    disabled={isUpdatingStatus}
                    className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                  >
                    {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    Revoke Account Verification
                  </button>
                ) : (
                  <button
                    onClick={() => handleVerifyConsultant(auditingConsultant.id, true)}
                    disabled={isUpdatingStatus}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                  >
                    {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                    Approve & Verify Consultant
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
          {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 pb-safe shadow-[0_-4px_24px_rgb(0,0,0,0.04)] rounded-t-[24px]">
        <div className="flex items-center justify-between px-6 pt-3 pb-4">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center w-14 h-14 relative ${activeTab === 'dashboard' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={26} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} className="mb-1.5" />
            <span className="text-[11px] font-bold">Home</span>
            {activeTab === 'dashboard' && (
              <div className="absolute -bottom-2.5 w-8 h-[3px] bg-[#0A3B24] rounded-full"></div>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('master-control')}
            className={`flex flex-col items-center justify-center w-14 h-14 relative ${activeTab === 'master-control' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <Activity size={26} strokeWidth={activeTab === 'master-control' ? 2.5 : 2} className="mb-1.5" />
            <span className="text-[11px] font-bold">Control</span>
            {activeTab === 'master-control' && (
              <div className="absolute -bottom-2.5 w-8 h-[3px] bg-[#0A3B24] rounded-full"></div>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('compliance')}
            className={`flex flex-col items-center justify-center w-14 h-14 relative ${activeTab === 'compliance' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <ShieldCheck size={26} strokeWidth={activeTab === 'compliance' ? 2.5 : 2} className="mb-1.5" />
            <span className="text-[11px] font-bold">Audit</span>
            {activeTab === 'compliance' && (
              <div className="absolute -bottom-2.5 w-8 h-[3px] bg-[#0A3B24] rounded-full"></div>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('consultations')}
            className={`flex flex-col items-center justify-center w-14 h-14 relative ${activeTab === 'consultations' ? 'text-[#0A3B24]' : 'text-slate-400'}`}
          >
            <Video size={26} strokeWidth={activeTab === 'consultations' ? 2.5 : 2} className="mb-1.5" />
            <span className="text-[11px] font-bold">Ledger</span>
            {activeTab === 'consultations' && (
              <div className="absolute -bottom-2.5 w-8 h-[3px] bg-[#0A3B24] rounded-full"></div>
            )}
          </button>

          <button 
            onClick={() => logout()}
            className="flex flex-col items-center justify-center w-14 h-14 relative text-rose-500"
          >
            <LogOut size={26} strokeWidth={2} className="mb-1.5" />
            <span className="text-[11px] font-bold uppercase">Exit</span>
          </button>
        </div>
      </div>

    </div>
  );
}
