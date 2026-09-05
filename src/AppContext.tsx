import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import { User, Role, AccountDeletionRequest, ConsultationSession, DigitalPrescription } from './types';
import { db, auth } from './firebase';
import { doc, deleteDoc, updateDoc, setDoc, getDoc, serverTimestamp, collection, addDoc, onSnapshot, query, where, increment, or, and } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInWithRedirect, getRedirectResult } from 'firebase/auth';

interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface SupportTicket {
  ticketId: string;
  patientId: string;
  patientName: string;
  originalSessionId?: string;
  reason: string;
  notes?: string;
  valueGHS?: number;
  remainingGHS?: number;
  status: 'active' | 'redeemed' | 'revoked' | 'used';
  createdAt: string;
}

export const isConsultantRole = (role?: string, cadre?: string): boolean => {
  const lower = (role || '').toLowerCase();
  return lower === 'consultant' || Boolean(cadre);
};

interface AppContextType {
  globalLogoUrl: string | null;
  globalSlogan: string | null;
  globalTitle: string | null;
  paystackPublicKey: string | null;
  user: User | null;
  role: Role;
  allUsers: User[];
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setRole: (role: Role) => void;
  isLoading: boolean;
  login: (requestedRole?: 'patient' | 'consultant', explicitRoleSelected?: boolean) => Promise<void>;
  loginWithRedirect: (requestedRole?: 'patient' | 'consultant', explicitRoleSelected?: boolean) => Promise<void>;
  isPopupBlocked: boolean;
  setIsPopupBlocked: React.Dispatch<React.SetStateAction<boolean>>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string, role: Role) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  authError: string | null;
  resetProfile: () => void;
  systemConfig: any;
  updateSystemFeature: (feature: string, value: any) => void;
  impersonatedUser: User | null;
  startImpersonation: (user: User) => void;
  stopImpersonation: () => void;
  logout: () => Promise<void>;
  seedDemoData: () => Promise<void>;
  consultations: ConsultationSession[];
  prescriptions: DigitalPrescription[];
  tickets: SupportTicket[];
  addConsultation: (session: ConsultationSession) => Promise<void>;
  updateConsultation: (sessionId: string, data: Partial<ConsultationSession>) => Promise<void>;
  cancelConsultation: (sessionId: string) => Promise<void>;
  addPrescription: (prescription: Partial<DigitalPrescription>) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  issueTicket: (ticket: { patientId: string; patientName: string; originalSessionId?: string; reason: string; notes?: string; valueGHS?: number }) => Promise<void>;
  revokeTicket: (ticketId: string, auto?: boolean) => Promise<void>;
  requestAccountDeletion: (reason: string, customFeedback?: string) => Promise<void>;
  approveAccountDeletion: (requestId: string, userId: string, notes?: string) => Promise<void>;
  rejectAccountDeletion: (requestId: string, userId: string, reason: string) => Promise<void>;
  isMasterEditMode?: boolean;
  toggleMasterEditMode?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (
    messageOrOptions: string | { title?: string; message: string; type?: 'danger' | 'info' | 'warning'; onConfirm?: () => void; onCancel?: () => void },
    onConfirmCallback?: () => void
  ) => void;
  lastSyncedAt: Date | null;
  isFirestoreConnected: boolean;
  syncStatus: 'connected' | 'syncing' | 'offline';
  verifyConnectionStream: () => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ 
  children, 
  currentUser = null,
  onUserUpdate 
}: { 
  children: ReactNode; 
  currentUser?: User | null;
  onUserUpdate?: (user: User | null) => void;
}) {
  const [user, setUserState] = useState<User | null>(currentUser);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'info' | 'warning';
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [consultations, setConsultations] = useState<ConsultationSession[]>([]);
  const [prescriptions, setPrescriptions] = useState<DigitalPrescription[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [globalLogoUrl, setGlobalLogoUrl] = useState<string | null>(null);
  const [globalSlogan, setGlobalSlogan] = useState<string | null>(null);
  const [globalTitle, setGlobalTitle] = useState<string | null>(null);
  const [paystackPublicKey, setPaystackPublicKey] = useState<string | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [isMasterEditMode, setIsMasterEditMode] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'offline'>('connected');

  const verifyConnectionStream = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      await getDoc(doc(db, 'settings', 'branding'));
      setLastSyncedAt(new Date());
      setIsFirestoreConnected(true);
      setSyncStatus('connected');
      return true;
    } catch (err) {
      console.warn('[Sync Check] Stream verification failed:', err);
      setIsFirestoreConnected(false);
      setSyncStatus('offline');
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsFirestoreConnected(true);
      setSyncStatus('connected');
      setLastSyncedAt(new Date());
    };
    const handleOffline = () => {
      setIsFirestoreConnected(false);
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const lowerMsg = (message || '').toLowerCase();
    if (lowerMsg.includes('websocket') || lowerMsg.includes('web socket') || lowerMsg.includes('closed without opening') || lowerMsg.includes('hmr') || lowerMsg.includes('livekit') || lowerMsg.includes('socket') || lowerMsg.includes('failed to fetch')) {
      console.warn("Suppressed Toast Error:", message);
      return;
    }
    const id = `${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const toggleMasterEditMode = useCallback(() => setIsMasterEditMode(prev => !prev), []);

  const setUser = useCallback((newUser: React.SetStateAction<User | null>) => {
    setUserState(prev => {
      const evaluated = typeof newUser === 'function' ? (newUser as (prev: User | null) => User | null)(prev) : newUser;
      if (onUserUpdate) onUserUpdate(evaluated);
      return evaluated;
    });
  }, [onUserUpdate]);

  const role = user?.role || 'patient';

  const [systemConfig, setSystemConfig] = useState<any>({
    features: { maintenanceMode: false },
    announcements: { headerBannerActive: false, headerBannerText: '', headerBannerType: 'info' }
  });

  const [authError, setAuthError] = useState<string | null>(null);
  const [isPopupBlocked, setIsPopupBlocked] = useState<boolean>(false);
  const redirectCheckStarted = useRef(false);

  const login = useCallback(async (requestedRole?: 'patient' | 'consultant', explicitRoleSelected: boolean = false) => {
    setAuthError(null);
    try {
      if (auth.authStateReady) {
        await auth.authStateReady().catch(() => {});
      }
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      
      const userRef = doc(db, 'users', res.user.uid);
      let loggedUser: User;
      const isSuperAdmin = res.user.email === 'missty2k@gmail.com' || res.user.email === 'pockettclinic@gmail.com';
      
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          loggedUser = userSnap.data() as User;
          if (isSuperAdmin && loggedUser.role !== 'super_admin') {
             loggedUser.role = 'super_admin';
             await setDoc(userRef, { role: 'super_admin' }, { merge: true });
          }
        } else {
          let userRole: any = requestedRole || 'patient';
          if (isSuperAdmin) userRole = 'super_admin';
          else if (!explicitRoleSelected) userRole = 'unassigned';
          
          loggedUser = {
            uid: res.user.uid,
            email: res.user.email || '',
            displayName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
            fullName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
            role: userRole as any,
            isVerified: isSuperAdmin ? true : false,
            verificationStatus: isSuperAdmin ? 'verified' : 'pending',
            termsAccepted: isSuperAdmin,
            walletBalanceGHS: 250,
            createdAt: new Date().toISOString()
          };
          
          try {
            await setDoc(userRef, loggedUser);
          } catch (e: any) {
            console.warn("Firestore user save:", e);
          }
        }
        try {
          localStorage.setItem(`pockettclinic_user_cache_${res.user.uid}`, JSON.stringify(loggedUser));
        } catch (e) {
          console.warn("Failed to write to localStorage:", e);
        }
        setUserState(loggedUser);
        if (onUserUpdate) onUserUpdate(loggedUser);
        showToast('Signed in with Google successfully.', 'success');
      } catch (dbErr) {
        console.warn("Database fetch failed on Google popup sign-in, attempting local cache retrieval:", dbErr);
        let cached: User | null = null;
        try {
          const raw = localStorage.getItem(`pockettclinic_user_cache_${res.user.uid}`);
          if (raw) cached = JSON.parse(raw);
        } catch (e) {
          console.warn("Failed to read user cache:", e);
        }
        
        if (cached) {
          loggedUser = cached;
        } else {
          let userRole: any = requestedRole || 'patient';
          if (isSuperAdmin) userRole = 'super_admin';
          else if (!explicitRoleSelected) userRole = 'unassigned';
          
          loggedUser = {
            uid: res.user.uid,
            email: res.user.email || '',
            displayName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
            fullName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
            role: userRole as any,
            isVerified: isSuperAdmin ? true : false,
            verificationStatus: isSuperAdmin ? 'verified' : 'pending',
            termsAccepted: isSuperAdmin,
            walletBalanceGHS: 250,
            createdAt: new Date().toISOString()
          };
        }
        setUserState(loggedUser);
        if (onUserUpdate) onUserUpdate(loggedUser);
        showToast('Signed in successfully.', 'success');
      }
    } catch (err: any) {
      const errCode = err?.code || '';
      const errMsg = err?.message || 'Google Authentication failed.';
      const isPopupError = errCode === 'auth/popup-blocked' || errMsg.includes('popup-blocked') || errMsg.includes('popup');
      const isInternalAssertion = errCode === 'auth/internal-error' || 
                                  errMsg.includes('INTERNAL ASSERTION FAILED') || 
                                  errMsg.includes('Pending promise') ||
                                  errMsg.includes('Cross-Origin-Opener-Policy') ||
                                  errMsg.includes('window.closed');
      const isCancelledError = errCode === 'auth/cancelled-popup-request' || 
                               errCode === 'auth/popup-closed-by-user' || 
                               errMsg.includes('cancelled-popup-request') || 
                               errMsg.includes('popup-closed-by-user');

      if (isPopupError || isInternalAssertion) {
        setIsPopupBlocked(true);
        setAuthError("Google Sign-In popup was restricted by browser Cross-Origin security policies. Please use the Redirect Sign-In method below or click the 'Open in New Tab' icon at top right.");
        showToast("Sign-In popup restricted by browser policies. Please use redirect or open in a new tab.", 'warning');
      } else if (isCancelledError) {
        console.info("Google sign-in popup request was cancelled or closed.");
      } else {
        console.error("Google signIn error:", err);
        setAuthError(errMsg);
        showToast(errMsg, 'error');
      }
    }
  }, [onUserUpdate, showToast]);

  const loginWithRedirect = useCallback(async (requestedRole?: 'patient' | 'consultant', explicitRoleSelected: boolean = false) => {
    setAuthError(null);
    try {
      localStorage.setItem('redirect_requested_role', requestedRole || 'patient');
      localStorage.setItem('redirect_explicit_role_selected', String(explicitRoleSelected));
      if (auth.authStateReady) {
        await auth.authStateReady().catch(() => {});
      }
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error("Google redirect signIn error:", err);
      const errMsg = err.message || 'Google Redirect Authentication failed.';
      setAuthError(errMsg);
      showToast(errMsg, 'error');
    }
  }, [showToast]);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      const isSuperAdmin = res.user.email === 'missty2k@gmail.com' || res.user.email === 'pockettclinic@gmail.com';
      
      const userRef = doc(db, 'users', res.user.uid);
      let loggedUser: User;
      
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          loggedUser = userSnap.data() as User;
          if (isSuperAdmin && loggedUser.role !== 'super_admin') {
             loggedUser.role = 'super_admin';
             await setDoc(userRef, { role: 'super_admin' }, { merge: true });
          }
        } else {
          loggedUser = {
            uid: res.user.uid,
            email: res.user.email || email,
            displayName: res.user.displayName || email.split('@')[0],
            fullName: res.user.displayName || email.split('@')[0],
            role: isSuperAdmin ? 'super_admin' : 'patient',
            isVerified: isSuperAdmin ? true : false,
            verificationStatus: isSuperAdmin ? 'verified' : 'pending',
            termsAccepted: isSuperAdmin,
            walletBalanceGHS: 250,
            createdAt: new Date().toISOString()
          };
          try {
            await setDoc(userRef, loggedUser);
          } catch (e) {
            console.warn("Firestore user save:", e);
          }
        }
        try {
          localStorage.setItem(`pockettclinic_user_cache_${res.user.uid}`, JSON.stringify(loggedUser));
        } catch (e) {
          console.warn("Failed to write to localStorage:", e);
        }
      } catch (dbErr) {
        console.warn("Database fetch failed on email sign-in, attempting local cache retrieval:", dbErr);
        let cached: User | null = null;
        try {
          const raw = localStorage.getItem(`pockettclinic_user_cache_${res.user.uid}`);
          if (raw) cached = JSON.parse(raw);
        } catch (e) {
          console.warn("Failed to read user cache:", e);
        }
        
        if (cached) {
          loggedUser = cached;
        } else {
          loggedUser = {
            uid: res.user.uid,
            email: res.user.email || email,
            displayName: res.user.displayName || email.split('@')[0],
            fullName: res.user.displayName || email.split('@')[0],
            role: isSuperAdmin ? 'super_admin' : 'patient',
            isVerified: isSuperAdmin ? true : false,
            verificationStatus: isSuperAdmin ? 'verified' : 'pending',
            termsAccepted: isSuperAdmin,
            walletBalanceGHS: 250,
            createdAt: new Date().toISOString()
          };
        }
      }
      
      setUserState(loggedUser);
      if (onUserUpdate) onUserUpdate(loggedUser);
      showToast('Signed in successfully.', 'success');
    } catch (err: any) {
      console.error("signInWithEmail error:", err);
      const errMsg = err.message || 'Authentication failed. Please check your credentials.';
      setAuthError(errMsg);
      showToast(errMsg, 'error');
      throw err;
    }
  }, [onUserUpdate, showToast]);

  const signUpWithEmail = useCallback(async (email: string, pass: string, fullName: string, userRole: Role) => {
    setAuthError(null);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const isSuperAdmin = res.user.email === 'missty2k@gmail.com' || res.user.email === 'pockettclinic@gmail.com';
      const finalRole = isSuperAdmin ? 'super_admin' : userRole;

      const newUser: User = {
        uid: res.user.uid,
        email: res.user.email || email,
        displayName: fullName || email.split('@')[0],
        fullName,
        role: finalRole,
        isVerified: isSuperAdmin ? true : false,
        verificationStatus: isSuperAdmin ? 'verified' : 'pending',
        termsAccepted: true,
        walletBalanceGHS: 100,
        createdAt: new Date().toISOString()
      };
      // Save to firestore doc
      try {
        await setDoc(doc(db, 'users', res.user.uid), newUser);
      } catch (e: any) {
        console.warn("Firestore user save:", e);
      }
      setUserState(newUser);
      if (onUserUpdate) onUserUpdate(newUser);
      showToast('Account created successfully!', 'success');
    } catch (err: any) {
      console.error("signUpWithEmail error:", err);
      const errMsg = err.message || 'Account registration failed.';
      setAuthError(errMsg);
      showToast(errMsg, 'error');
      throw err;
    }
  }, [onUserUpdate, showToast]);

  const sendPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Password reset link dispatched to ${email}`, 'info');
    } catch (err: any) {
      console.warn("sendPasswordReset error:", err);
      showToast(`Password reset request processed for ${email}`, 'info');
    }
  }, [showToast]);

  const resetProfile = useCallback(() => {
    showToast('Profile state reset.', 'info');
  }, [showToast]);

  const updateSystemFeature = useCallback((feature: string, value: any) => {
    setSystemConfig((prev: any) => ({
      ...prev,
      features: { ...prev.features, [feature]: value }
    }));
  }, []);

  const setRole = useCallback((newRole: Role) => {
    setUserState(prev => {
      if (prev) {
        const updated = { ...prev, role: newRole };
        if (onUserUpdate) onUserUpdate(updated);
        return updated;
      }
      return prev;
    });
  }, [onUserUpdate]);

  const startImpersonation = useCallback((targetUser: User) => {
    setImpersonatedUser(targetUser);
    showToast(`Impersonating ${targetUser.fullName || targetUser.email} (${targetUser.role})`, 'info');
  }, [showToast]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
    showToast('Impersonation ended. Returned to Super Admin.', 'info');
  }, [showToast]);


  const seedDemoData = useCallback(async () => {
    // No-op: Simulation data seeding has been purged for production readiness.
    showToast('Simulation seeding is disabled in production mode.', 'info');
  }, [showToast]);

  // Handle redirect result on mount
  useEffect(() => {
    if (redirectCheckStarted.current) {
      return;
    }

    const hasRedirectIntent = Boolean(localStorage.getItem('redirect_requested_role'));
    if (!hasRedirectIntent) {
      return;
    }
    
    redirectCheckStarted.current = true;

    const handleRedirectResult = async () => {
      try {
        if (auth.authStateReady) {
          await auth.authStateReady().catch(() => {});
        }
        const res = await getRedirectResult(auth);
        if (res) {
          setIsLoading(true);
          const userRef = doc(db, 'users', res.user.uid);
          let loggedUser: User;
          const isSuperAdmin = res.user.email === 'missty2k@gmail.com' || res.user.email === 'pockettclinic@gmail.com';
          
          try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              loggedUser = userSnap.data() as User;
              if (isSuperAdmin && loggedUser.role !== 'super_admin') {
                loggedUser.role = 'super_admin';
                await setDoc(userRef, { role: 'super_admin' }, { merge: true });
              }
            } else {
              // Retrieve parameters from localStorage
              const savedRole = localStorage.getItem('redirect_requested_role') || 'patient';
              const savedExplicit = localStorage.getItem('redirect_explicit_role_selected') === 'true';
              
              let userRole: any = savedRole;
              if (isSuperAdmin) userRole = 'super_admin';
              else if (!savedExplicit) userRole = 'unassigned';
              
              loggedUser = {
                uid: res.user.uid,
                email: res.user.email || '',
                displayName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
                fullName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
                role: userRole as any,
                isVerified: isSuperAdmin ? true : false,
                verificationStatus: isSuperAdmin ? 'verified' : 'pending',
                termsAccepted: isSuperAdmin,
                walletBalanceGHS: 250,
                createdAt: new Date().toISOString()
              };
              
              try {
                await setDoc(userRef, loggedUser);
              } catch (e: any) {
                console.warn("Firestore redirect user save error:", e);
              }
            }
            try {
              localStorage.setItem(`pockettclinic_user_cache_${res.user.uid}`, JSON.stringify(loggedUser));
            } catch (e) {
              console.warn("Failed to write to localStorage:", e);
            }
          } catch (dbErr) {
            console.warn("Database fetch failed on Google redirect sign-in, attempting local cache retrieval:", dbErr);
            let cached: User | null = null;
            try {
              const raw = localStorage.getItem(`pockettclinic_user_cache_${res.user.uid}`);
              if (raw) cached = JSON.parse(raw);
            } catch (e) {
              console.warn("Failed to read user cache:", e);
            }
            
            if (cached) {
              loggedUser = cached;
            } else {
              const savedRole = localStorage.getItem('redirect_requested_role') || 'patient';
              const savedExplicit = localStorage.getItem('redirect_explicit_role_selected') === 'true';
              
              let userRole: any = savedRole;
              if (isSuperAdmin) userRole = 'super_admin';
              else if (!savedExplicit) userRole = 'unassigned';
              
              loggedUser = {
                uid: res.user.uid,
                email: res.user.email || '',
                displayName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
                fullName: res.user.displayName || res.user.email?.split('@')[0] || 'User',
                role: userRole as any,
                isVerified: isSuperAdmin ? true : false,
                verificationStatus: isSuperAdmin ? 'verified' : 'pending',
                termsAccepted: isSuperAdmin,
                walletBalanceGHS: 250,
                createdAt: new Date().toISOString()
              };
            }
          }
          
          // Clear variables
          localStorage.removeItem('redirect_requested_role');
          localStorage.removeItem('redirect_explicit_role_selected');
          
          setUser(loggedUser);
          showToast('Signed in with Google successfully.', 'success');
        }
      } catch (err: any) {
        const errMsg = (err?.message || '').toLowerCase();
        const isBenign = errMsg.includes('database is closing') || 
                         errMsg.includes('closing') || 
                         errMsg.includes('indexeddb') || 
                         errMsg.includes('closed') ||
                         err?.code === 'auth/internal-error';
        if (!isBenign) {
          console.warn("Google redirect info notice:", err?.message || err);
        }
      } finally {
        setIsLoading(false);
      }
    };
    handleRedirectResult();
  }, []);

  // Synchronize incoming currentUser changes
  useEffect(() => {
    setIsLoading(true);
    let userUnsub: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (firebaseUser) {
        // Create a real-time listener for the user document
        userUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            let data = snap.data() as User;
            
            // Self-healing role normalization for consultant accounts
            if (data && data.cadre) {
              const knownProfessions = ['DOCTOR', 'PHARMACIST', 'PHARM_TECH', 'PHYSICIAN_ASSISTANT', 'SPECIALIST'];
              const cadreUpper = data.cadre.toUpperCase();
              const matchesProfession = knownProfessions.some(p => cadreUpper.includes(p));
              if (matchesProfession && data.role !== 'consultant') {
                console.warn(`Normalized mismatched role for consultant account in-session: ${firebaseUser.uid}`);
                data = { ...data, role: 'consultant' };
              }
            }

            setUserState(data);
            if (onUserUpdate) onUserUpdate(data);
            try {
              localStorage.setItem(`pockettclinic_user_cache_${firebaseUser.uid}`, JSON.stringify(data));
            } catch (e) {
              console.warn("Failed to write user cache to localStorage:", e);
            }
          } else {
            // fallback if doc missing
            const fallbackUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              fullName: firebaseUser.displayName || 'User',
              role: 'patient',
              isVerified: true,
              verificationStatus: 'verified',
              termsAccepted: true,
              walletBalanceGHS: 250,
              createdAt: new Date().toISOString()
            };
            setUserState(fallbackUser);
            if (onUserUpdate) onUserUpdate(fallbackUser);
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Error in user document listener, attempting cache fallback:", error);
          
          let cachedUser: User | null = null;
          try {
            const cacheRaw = localStorage.getItem(`pockettclinic_user_cache_${firebaseUser.uid}`);
            if (cacheRaw) {
              cachedUser = JSON.parse(cacheRaw);
            }
          } catch (e) {
            console.warn("Failed to read user cache from localStorage:", e);
          }

          if (cachedUser) {
            setUserState(cachedUser);
            if (onUserUpdate) onUserUpdate(cachedUser);
          }
          setIsLoading(false);
        });
      } else {
        setUserState(null);
        if (onUserUpdate) onUserUpdate(null);
        setIsLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsub) userUnsub();
    };
  }, [onUserUpdate]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      showToast('Logged out successfully.', 'info');
      window.location.href = '/';
    } catch (error) {
      console.error("Error logging out:", error);
    }
  }, [setUser, showToast]);

  // Subscribe to consultations collection in Firestore
  useEffect(() => {
    const uRole = user?.role;
    const uid = user?.uid;
    const isAdmin = uRole === 'admin' || uRole === 'super_admin';
    const isConsultantUser = isConsultantRole(uRole, user?.cadre);

    if (!uid) return;
    try {
      if (isAdmin) {
        const q = query(collection(db, 'consultations'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: ConsultationSession[] = [];
          snapshot.forEach((d) => {
            list.push({ ...d.data(), sessionId: d.id, id: d.id } as unknown as ConsultationSession);
          });
          setConsultations(list);
        }, (err) => {
          console.warn('Consultations firestore listener error:', err.message);
        });
        return () => unsubscribe();
      } else if (isConsultantUser) {
        const resultsMap = new Map<string, Map<string, ConsultationSession>>();
        
        const updateConsultationsList = () => {
          const merged = new Map<string, ConsultationSession>();
          resultsMap.forEach((subMap) => {
            subMap.forEach((session, id) => {
              merged.set(id, session);
            });
          });
          setConsultations(Array.from(merged.values()));
        };

        const qRinging = query(
          collection(db, 'consultations'),
          where('dispatchStatus', 'in', ['ringing', 're-routing', 'escalated'])
        );
        const qLegacy = query(
          collection(db, 'consultations'),
          where('consultantId', '==', uid)
        );
        const qAssigned = query(
          collection(db, 'consultations'),
          where('assignedConsultantId', '==', uid)
        );
        const qStatus = query(
          collection(db, 'consultations'),
          where('status', 'in', ['PAID', 'PENDING', 'ACTIVE', 'IN_PROGRESS'])
        );

        const handleSnap = (key: string, snap: any) => {
          const subMap = new Map<string, ConsultationSession>();
          snap.forEach((d: any) => {
            subMap.set(d.id, { ...d.data(), sessionId: d.id, id: d.id } as unknown as ConsultationSession);
          });
          resultsMap.set(key, subMap);
          setLastSyncedAt(new Date());
          setIsFirestoreConnected(true);
          setSyncStatus('connected');
          updateConsultationsList();
        };

        const unsubRinging = onSnapshot(qRinging, (s) => handleSnap('ringing', s), (err) => console.warn('Ringing listener error:', err.message));
        const unsubLegacy = onSnapshot(qLegacy, (s) => handleSnap('legacy', s), (err) => console.warn('Legacy listener error:', err.message));
        const unsubAssigned = onSnapshot(qAssigned, (s) => handleSnap('assigned', s), (err) => console.warn('Assigned listener error:', err.message));
        const unsubStatus = onSnapshot(qStatus, (s) => handleSnap('status', s), (err) => console.warn('Status listener error:', err.message));

        return () => {
          unsubRinging();
          unsubLegacy();
          unsubAssigned();
          unsubStatus();
        };
      } else {
        const q = query(collection(db, 'consultations'), where('patientId', '==', uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: ConsultationSession[] = [];
          snapshot.forEach((d) => {
            list.push({ ...d.data(), sessionId: d.id, id: d.id } as unknown as ConsultationSession);
          });
          setConsultations(list);
        }, (err) => {
          console.warn('Consultations firestore listener error:', err.message);
        });
        return () => unsubscribe();
      }
    } catch (err) {
      console.warn('Failed to listen to consultations:', err);
    }
  }, [user?.uid, user?.role, user?.cadre]);

  // Subscribe to branding
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'branding'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.logoUrl) setGlobalLogoUrl(data.logoUrl);
        if (data.slogan) setGlobalSlogan(data.slogan);
        if (data.title) setGlobalTitle(data.title);
      }
    }, (err) => {
      console.warn("Branding onSnapshot error (offline/unavailable):", err.message);
    });
    return () => unsub();
  }, []);
  
  // Subscribe to integration keys
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'integration_keys'), (snap) => {
      if (snap.exists() && snap.data().paystackPublicKey) {
        setPaystackPublicKey(snap.data().paystackPublicKey);
      } else {
        setPaystackPublicKey(null);
      }
    }, (err) => {
      console.warn("Integration keys onSnapshot error (offline/unavailable):", err.message);
    });
    return () => unsub();
  }, []);
  
  // Subscribe to tickets collection
  useEffect(() => {
    const uid = user?.uid;
    const uRole = user?.role;
    if (!uid) return;
    try {
      const isAdmin = uRole === 'admin' || uRole === 'super_admin';
      const isConsultantUser = isConsultantRole(uRole, user?.cadre);
      
      let q;
      if (isAdmin) {
        q = query(collection(db, 'tickets'));
      } else if (isConsultantUser) {
        // Consultants can see all tickets relevant to them or escalated ones
        q = query(collection(db, 'tickets'));
      } else {
        q = query(collection(db, 'tickets'), where('patientId', '==', uid));
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: SupportTicket[] = [];
        snapshot.forEach((d) => {
          list.push({ ticketId: d.id, ...d.data() } as SupportTicket);
        });
        setTickets(list);
      }, (err) => {
        console.warn('Tickets firestore listener error:', err.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to listen to tickets:', err);
    }
  }, [user?.uid, user?.role, user?.cadre]);

  // Subscribe to prescriptions collection
  useEffect(() => {
    const uid = user?.uid;
    const uRole = user?.role;
    if (!uid) return;
    try {
      const isAdmin = uRole === 'admin' || uRole === 'super_admin';
      const isConsultantUser = isConsultantRole(uRole, user?.cadre);
      
      let q;
      if (isAdmin) {
        q = query(collection(db, 'prescriptions'));
      } else if (isConsultantUser) {
        q = query(collection(db, 'prescriptions'), where('consultantId', '==', uid));
      } else {
        q = query(collection(db, 'prescriptions'), where('patientId', '==', uid));
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: DigitalPrescription[] = [];
        snapshot.forEach((d) => {
          list.push({ rxId: d.id, ...d.data() } as DigitalPrescription);
        });
        setPrescriptions(list);
      }, (err) => {
        console.warn('Prescriptions firestore listener error:', err.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to listen to prescriptions:', err);
    }
  }, [user?.uid, user?.role, user?.cadre]);

  // Subscribe to users collection in Firestore
  useEffect(() => {
    const uid = user?.uid;
    const uRole = user?.role;
    if (!uid) return;
    try {
      const isAdmin = uRole === 'admin' || uRole === 'super_admin';
      const isConsultantUser = isConsultantRole(uRole, user?.cadre);
      
      let q;
      if (isAdmin) {
        q = query(collection(db, 'users'));
      } else if (isConsultantUser) {
        // Consultants need to see patients
        q = query(collection(db, 'users'), where('role', '==', 'patient'));
      } else {
        // Patients should only see consultants
        q = query(collection(db, 'users'), where('role', '==', 'consultant'));
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const firestoreUsers: User[] = [];
        const driftedAccounts: Array<{ docId: string; storedUid?: string; email?: string; fullName?: string; role?: string }> = [];

        snapshot.forEach((d) => {
          const rawData = d.data() as any;
          if (rawData && rawData.uid && rawData.uid !== d.id) {
            driftedAccounts.push({
              docId: d.id,
              storedUid: rawData.uid,
              email: rawData.email,
              fullName: rawData.fullName || rawData.displayName,
              role: rawData.role || rawData.cadre
            });
          }
          firestoreUsers.push({ ...rawData, uid: d.id, id: d.id } as User);
        });

        if (driftedAccounts.length > 0) {
          console.warn('⚠️ [CRITICAL DIAGNOSTIC] User documents with UID drift detected:', driftedAccounts);
        } else {
          console.log('✅ [DIAGNOSTIC] All user documents checked: 0 UID drifts detected.');
        }

        setAllUsers(firestoreUsers);
      }, (err) => {
        console.warn('Users firestore listener error:', err.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to listen to users:', err);
    }
  }, [user?.uid, user?.role]);

  const showConfirm = useCallback((
    messageOrOptions: string | { title?: string; message: string; type?: 'danger' | 'info' | 'warning'; onConfirm?: () => void; onCancel?: () => void },
    onConfirmCallback?: () => void
  ) => {
    if (typeof messageOrOptions === 'string') {
      setConfirmModal({
        isOpen: true,
        title: 'Please Confirm',
        message: messageOrOptions,
        type: 'warning',
        onConfirm: () => {
          setConfirmModal(null);
          if (onConfirmCallback) onConfirmCallback();
        },
        onCancel: () => {
          setConfirmModal(null);
        }
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: messageOrOptions.title || 'Please Confirm',
        message: messageOrOptions.message || 'Are you sure you want to proceed?',
        type: messageOrOptions.type || 'warning',
        onConfirm: () => {
          setConfirmModal(null);
          if (messageOrOptions.onConfirm) messageOrOptions.onConfirm();
          else if (onConfirmCallback) onConfirmCallback();
        },
        onCancel: () => {
          setConfirmModal(null);
          if (messageOrOptions.onCancel) messageOrOptions.onCancel();
        }
      });
    }
  }, []);

  const addConsultation = useCallback(async (session: ConsultationSession) => {
    try {
      const ref = doc(db, 'consultations', session.sessionId);
      await setDoc(ref, session, { merge: true });
    } catch (err) {
      console.warn('addConsultation error:', err);
    }
  }, []);

  const updateConsultation = useCallback(async (sessionId: string, data: Partial<ConsultationSession>) => {
    try {
      const ref = doc(db, 'consultations', sessionId);
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      
      // Consistency check: clear hold flags when transitioning away from active states
      if (data.status && data.status !== 'IN_PROGRESS' && data.status !== 'ACTIVE') {
        (updateData as any).isOnHold = false;
        (updateData as any).holdReason = "";
      }
      
      await setDoc(ref, updateData, { merge: true });
    } catch (err) {
      console.warn('updateConsultation error:', err);
    }
  }, []);

  // Lets a patient cancel their own request while it is still awaiting
  // consultant acceptance. Refunds the full amount to the patient's wallet
  // and notifies the assigned consultant (if any) so their dashboard stops
  // showing it as an incoming call.
  const cancelConsultation = useCallback(async (sessionId: string) => {
    try {
      const ref = doc(db, 'consultations', sessionId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();

      const cancellableDispatchStatuses = ['ringing', 're-routing', 'escalated', 'scheduled', 'direct'];
      const isAlreadyAccepted = data.status === 'IN_PROGRESS' || data.status === 'ACTIVE' || data.dispatchStatus === 'accepted';
      if (isAlreadyAccepted) {
        throw new Error('This consultation has already been accepted and can no longer be cancelled here.');
      }
      if (!cancellableDispatchStatuses.includes(data.dispatchStatus || '') && data.status !== 'PENDING') {
        throw new Error('This consultation is not in a cancellable state.');
      }

      const notifiedConsultantId = data.assignedConsultantId || data.consultantId || null;

      await setDoc(ref, {
        status: 'CANCELLED',
        dispatchStatus: 'cancelled_by_patient',
        cancelReason: 'Cancelled by patient before acceptance',
        isOnHold: false,
        holdReason: "",
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (data.patientId && data.amountPaidGHS) {
        try {
          await updateDoc(doc(db, 'users', data.patientId), {
            walletBalanceGHS: increment(data.amountPaidGHS)
          });
        } catch (refundErr) {
          console.warn('cancelConsultation: failed to refund wallet:', refundErr);
        }
      }

      if (notifiedConsultantId) {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
            },
            body: JSON.stringify({
              targetUid: notifiedConsultantId,
              title: 'Consultation request withdrawn',
              body: 'The patient cancelled this request before it was accepted.',
              actionType: 'consultation_cancelled',
              targetPath: '/consultant-dashboard'
            })
          });
          if (!res.ok) console.warn('cancelConsultation: notify consultant failed:', await res.text());
        } catch (notifyErr) {
          console.warn('cancelConsultation: failed to notify consultant:', notifyErr);
        }
      }
    } catch (err) {
      console.warn('cancelConsultation error:', err);
      throw err;
    }
  }, []);

  const addPrescription = useCallback(async (prescription: Partial<DigitalPrescription>) => {
    try {
      const rxId = prescription.rxId || `RX-${Date.now().toString(36).toUpperCase()}`;
      const ref = doc(db, 'prescriptions', rxId);
      await setDoc(ref, {
        ...prescription,
        rxId,
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('addPrescription error:', err);
    }
  }, []);

  const updateUserProfile = useCallback(async (data: Partial<User>) => {
    const uid = user?.uid;
    if (!uid) return;
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, data, { merge: true });
      setUser(prev => prev ? { ...prev, ...data } : null);
    } catch (err) {
      console.error('updateUserProfile error:', err);
      throw err;
    }
  }, [user?.uid, setUser]);

  const issueTicket = useCallback(async (ticket: { patientId: string; patientName: string; originalSessionId?: string; reason: string; notes?: string; valueGHS?: number }) => {
    try {
      const ticketId = `TCK-${Date.now().toString(36).toUpperCase()}`;
      const ticketDoc: SupportTicket = {
        ticketId,
        ...ticket,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'tickets', ticketId), ticketDoc);
      
      // Notify patient about the ticket
      try {
        const idToken = await auth.currentUser?.getIdToken();
        fetch('/api/notifications/trigger', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            targetUid: ticket.patientId,
            title: 'Compensation Ticket Issued',
            body: `A compensation ticket (${ticketId}) has been issued to your account.`,
            actionType: 'ticket_issued',
            targetPath: '/patient-dashboard'
          })
        }).then(async res => {
          if (!res.ok) {
            const errorText = await res.text();
            console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
          }
        }).catch(err => console.warn('Failed to trigger ticket notification:', err));
      } catch (notifErr) {
        console.warn('Notification trigger auth error:', notifErr);
      }
      
      if (ticket.valueGHS && ticket.valueGHS > 0) {
        try {
          const userRef = doc(db, 'users', ticket.patientId);
          await updateDoc(userRef, {
            walletBalanceGHS: increment(ticket.valueGHS)
          });
        } catch(err) {
          console.warn('Failed to increment walletBalanceGHS:', err);
        }
      }
      
    } catch (err) {
      console.warn('issueTicket error:', err);
    }
  }, []);

  const revokeTicket = useCallback(async (ticketId: string, auto = false) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        autoRevoked: auto
      });
    } catch (err) {
      console.warn('revokeTicket error:', err);
    }
  }, []);

  const requestAccountDeletion = useCallback(async (reason: string, customFeedback?: string) => {
    const uid = user?.uid;
    const email = user?.email;
    const fullName = user?.fullName || user?.displayName || 'Account User';
    const uRole = user?.role;
    
    if (!uid) return;
    const requestData = {
      userId: uid,
      userName: fullName,
      userEmail: email,
      userRole: uRole,
      reason,
      customFeedback: customFeedback?.trim() || '',
      details: customFeedback?.trim() || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'deletion_requests'), requestData);
    } catch (err: any) {
      console.warn("Firestore deletion_requests write:", err.message);
    }

    await updateUserProfile({
      accountStatus: 'pending_deletion'
    });

    showToast('Account deletion request queued for Admin Console review.', 'info');
  }, [user?.uid, user?.email, user?.fullName, user?.displayName, user?.role, updateUserProfile, showToast]);

  const approveAccountDeletion = useCallback(async (requestId: string, userId: string, notes?: string) => {
    const adminUid = user?.uid;
    const adminEmail = user?.email;
    
    try {
      try {
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
      } catch (err: any) {
        console.warn('Direct Firestore deleteDoc on users failed:', err.message);
      }

      try {
        const reqRef = doc(db, 'deletion_requests', requestId);
        await updateDoc(reqRef, {
          status: 'approved',
          reviewedAt: new Date().toISOString(),
          reviewedBy: adminUid || 'admin_user',
          reviewedByEmail: adminEmail || 'admin@pockettclinic.health',
          reviewNotes: notes || 'Account purged from backend database.'
        });
      } catch (err: any) {
        try {
          const reqRef = doc(db, 'deletion_requests', requestId);
          await setDoc(reqRef, {
            requestId,
            userId,
            status: 'approved',
            reviewedAt: new Date().toISOString(),
            reviewedBy: adminUid || 'admin_user',
            reviewedByEmail: adminEmail || 'admin@pockettclinic.health',
            reviewNotes: notes || 'Direct backend purge',
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (e: any) {
          console.warn('Firestore setDoc on deletion_requests:', e.message);
        }
      }

      try {
        await addDoc(collection(db, 'admin_audit_logs'), {
          action: 'PURGE_USER_ACCOUNT',
          targetUserId: userId,
          performedBy: adminEmail || 'admin@pockettclinic.health',
          notes: notes || 'Direct deletion approval',
          timestamp: serverTimestamp()
        });
      } catch (auditErr: any) {
        console.warn('Audit log write error:', auditErr.message);
      }

      showToast(`User ${userId} successfully purged from database.`, 'success');
    } catch (error: any) {
      console.error('approveAccountDeletion error:', error);
      throw error;
    }
  }, [user?.uid, user?.email, showToast]);

  const rejectAccountDeletion = useCallback(async (requestId: string, userId: string, reason: string) => {
    const adminUid = user?.uid;
    const adminEmail = user?.email;
    
    try {
      const reqRef = doc(db, 'deletion_requests', requestId);
      await updateDoc(reqRef, {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedBy: adminUid || 'admin_user',
        reviewedByEmail: adminEmail || 'admin@pockettclinic.health',
        reviewNotes: reason
      });

      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          accountStatus: 'active',
          deletionPending: false
        });
      } catch (e: any) {
        console.warn('Could not update user doc status to active:', e.message);
      }

      try {
        await addDoc(collection(db, 'admin_audit_logs'), {
          action: 'REJECT_DELETION_REQUEST',
          targetUserId: userId,
          performedBy: adminEmail || 'admin@pockettclinic.health',
          reason,
          timestamp: serverTimestamp()
        });
      } catch (auditErr: any) {
        console.warn('Audit log write error:', auditErr.message);
      }

      showToast(`Deletion request rejected and user account restored.`, 'info');
    } catch (error: any) {
      console.error('rejectAccountDeletion error:', error);
      throw error;
    }
  }, [user?.uid, user?.email, showToast]);

  const contextValue = useMemo(() => ({
    user,
    role,
    allUsers,
    setUser,
    setRole,
    isLoading,
    login,
    loginWithRedirect,
    isPopupBlocked,
    setIsPopupBlocked,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    authError,
    resetProfile,
    systemConfig,
    updateSystemFeature,
    impersonatedUser,
    startImpersonation,
    stopImpersonation,
    logout,
    globalLogoUrl,
    globalSlogan,
    globalTitle,
    paystackPublicKey,
    seedDemoData,
    consultations,
    prescriptions,
    tickets,
    addConsultation,
    updateConsultation,
    cancelConsultation,
    addPrescription,
    updateUserProfile,
    issueTicket,
    revokeTicket,
    requestAccountDeletion,
    approveAccountDeletion,
    rejectAccountDeletion,
    isMasterEditMode,
    toggleMasterEditMode,
    showToast,
    showConfirm,
    lastSyncedAt,
    isFirestoreConnected,
    syncStatus,
    verifyConnectionStream
  }), [
    user, role, allUsers, setUser, setRole, isLoading, login, loginWithRedirect,
    isPopupBlocked, setIsPopupBlocked, signInWithEmail, signUpWithEmail,
    sendPasswordReset, authError, resetProfile, systemConfig, updateSystemFeature,
    impersonatedUser, startImpersonation, stopImpersonation, logout,
    globalLogoUrl, globalSlogan, globalTitle, paystackPublicKey, seedDemoData,
    consultations, prescriptions, tickets, addConsultation, updateConsultation,
    cancelConsultation,
    addPrescription, updateUserProfile, issueTicket, revokeTicket,
    requestAccountDeletion, approveAccountDeletion, rejectAccountDeletion,
    isMasterEditMode, toggleMasterEditMode, showToast, showConfirm,
    lastSyncedAt, isFirestoreConnected, syncStatus, verifyConnectionStream
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}

      {/* Custom Global Confirmation Dialog Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            role="dialog" 
            aria-modal="true"
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 p-6 space-y-4"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmModal.type === 'danger'
                  ? 'bg-rose-100 text-rose-600'
                  : confirmModal.type === 'warning'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}>
                {confirmModal.type === 'danger' ? (
                  <span className="text-xl font-black">!</span>
                ) : confirmModal.type === 'warning' ? (
                  <span className="text-xl font-black">⚠️</span>
                ) : (
                  <span className="text-xl font-black">ℹ️</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1.5 leading-relaxed whitespace-pre-line">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className={`px-5 py-3 rounded-xl text-white text-xs font-extrabold tracking-wide active:scale-95 transition-all shadow-md min-h-[44px] cursor-pointer ${
                  confirmModal.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                    : confirmModal.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                }`}
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-4 rounded-2xl shadow-xl border text-xs font-bold pointer-events-auto flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-lime-600 border-emerald-500 shadow-emerald-900/20'
                : toast.type === 'error'
                ? 'bg-rose-600 text-lime-600 border-rose-500 shadow-rose-900/20'
                : toast.type === 'warning'
                ? 'bg-amber-600 text-lime-600 border-amber-500 shadow-amber-900/20'
                : 'bg-white text-lime-600 border-lime-200 shadow-slate-950/20'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-lime-600/80 hover:text-lime-600 shrink-0 ml-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
