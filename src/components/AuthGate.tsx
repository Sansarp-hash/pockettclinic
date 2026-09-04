import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../AppContext";
import { motion } from "motion/react";
import { Activity, LogIn, ShieldCheck, Zap, Mail, Lock, User, ArrowLeft, CheckCircle2, Heart , HeartPulse, ArrowRight} from "lucide-react";
import { Role } from "../types";
import { LegalDocumentsModal } from "./LegalDocumentsModal";

interface AuthGateProps {
  children: React.ReactNode;
}

type AuthMode = 'landing' | 'signin' | 'signup' | 'forgot';

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { 
    user, 
    isLoading, 
    login, 
    loginWithRedirect,
    isPopupBlocked,
    setIsPopupBlocked,
    signInWithEmail, 
    signUpWithEmail, 
    sendPasswordReset, 
    authError, 
    globalLogoUrl
  } = useAppContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode and input states
  const [authMode, setAuthMode] = useState<AuthMode>(window.location.pathname === '/' ? 'landing' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('patient');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [explicitRoleSelected, setExplicitRoleSelected] = useState(false);
  
  // UI messaging states
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);

  // Legal Modal states
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'tos' | 'privacy'>('tos');

  useEffect(() => {
    if (user && !isLoading) {
      if (user.role === 'admin' && window.location.pathname === '/') {
        navigate('/admin');
      }
    }
  }, [user?.uid, user?.role, isLoading, navigate]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setResetSentEmail(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'signin') {
        if (!email || !password) {
          setFormError("Please enter both your email and password.");
          setIsSubmitting(false);
          return;
        }
        await signInWithEmail(email.trim(), password);
      } else if (authMode === 'signup') {
        if (!email || !password || !fullName) {
          setFormError("Please fill in all registration fields.");
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setFormError("Password must be at least 6 characters.");
          setIsSubmitting(false);
          return;
        }
        await signUpWithEmail(email.trim(), password, fullName.trim(), selectedRole);
      } else if (authMode === 'forgot') {
        if (!email) {
          setFormError("Please provide your email address to reset your password.");
          setIsSubmitting(false);
          return;
        }
        await sendPasswordReset(email.trim());
        setResetSentEmail(email.trim());
        setEmail('');
      }
    } catch (err: any) {
      console.warn("Auth process failure:", err);
      const code = err?.code || '';
      const rawMsg = err?.message || '';
      
      if (code === 'auth/email-already-in-use' || rawMsg.includes('auth/email-already-in-use')) {
        setFormError("An account with this email address already exists. Please switch to Sign In.");
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || rawMsg.includes('auth/invalid-credential')) {
        setFormError("Invalid email or password. Please verify your credentials.");
      } else if (code === 'auth/too-many-requests' || rawMsg.includes('auth/too-many-requests')) {
        setFormError("Too many failed attempts. Please wait a moment or reset your password.");
      } else if (code === 'auth/invalid-email' || rawMsg.includes('auth/invalid-email')) {
        setFormError("Please enter a valid email address.");
      } else if (code === 'auth/weak-password' || rawMsg.includes('auth/weak-password')) {
        setFormError("Password must be at least 6 characters long.");
      } else {
        setFormError(rawMsg || "An authentication error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-transparent" />
          <span className="text-sm font-medium tracking-wide text-slate-500">
            Initializing Secure Session...
          </span>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  if (authMode === 'landing') {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-slate-50 relative overflow-hidden">
        {/* Deep Emerald Header Arching Down */}
        <div className="absolute top-0 left-0 right-0 h-[45%] bg-[#0A3B24] rounded-b-[40px] z-0"></div>
        
        <header className="relative z-10 px-6 pt-10 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
             {globalLogoUrl ? (
                <img src={globalLogoUrl} alt="PockettClinic Logo" className="w-[42px] h-[42px] rounded-[14px] object-cover bg-white p-0.5 shrink-0 shadow-lg" />
             ) : (
                <div className="w-[42px] h-[42px] items-center justify-center rounded-[14px] bg-[#C8E6C9] flex shrink-0 shadow-lg">
                   <HeartPulse className="h-6 w-6 fill-[#0A3B24] text-[#0A3B24]" />
                </div>
             )}
             <div>
               <h1 className="text-xl font-black tracking-tight text-white leading-none">PockettClinic</h1>
               <span className="text-[10px] text-white/80 font-medium">Your Digital Hospital Anywhere</span>
             </div>
          </div>
          <button 
             onClick={() => setAuthMode('signin')} 
             className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer border border-white/20 backdrop-blur-sm"
          >
             Log In
          </button>
        </header>

        <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto w-full">
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 w-full">
              <h1 className="text-[36px] md:text-6xl font-black tracking-tight text-white leading-[1.1] text-left sm:text-center mt-2">
                 Your Hospital,<br className="sm:hidden" /> Anywhere.
              </h1>
              
              <div className="bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 text-left sm:text-center mt-12 md:mt-24 relative z-20">
                <p className="text-sm md:text-base text-slate-600 font-medium leading-relaxed mb-8">
                   Connect with licensed professionals instantly. No waiting rooms, just secure, verifiable care on demand.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                   <button 
                     onClick={() => {
                       setSelectedRole('patient');
                       setExplicitRoleSelected(true);
                       setAuthMode('signup');
                     }}
                     className="w-full sm:w-auto px-6 py-4 bg-[#0A3B24] hover:bg-[#0A3B24]/90 text-white text-xs font-black rounded-[16px] shadow-lg shadow-emerald-900/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                   >
                     Get Care <ArrowRight size={16} />
                   </button>
                   <button 
                     onClick={() => {
                       setSelectedRole('consultant');
                       setExplicitRoleSelected(true);
                       setAuthMode('signup');
                     }}
                     className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-black rounded-[16px] transition-all uppercase tracking-wider cursor-pointer"
                   >
                     Join as a Consultant
                   </button>
                </div>
              </div>
           </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
      >
        {/* App Logo & Branding */}
        <div className="text-center mb-6">
          {globalLogoUrl ? (
            <img src={globalLogoUrl} alt="PockettClinic Logo" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-xl shadow-emerald-500/10" />
          ) : (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0A3B24] shadow-xl shadow-emerald-900/20">
              <HeartPulse className="h-10 w-10 text-emerald-200 fill-emerald-200/25" />
            </div>
          )}
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-800 italic">PockettClinic</h1>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed px-4 font-semibold uppercase tracking-wider">
            Ghana's Premier Digital Tele-Triage Network
          </p>
        </div>

        {/* Tab Selection */}
        {authMode !== 'forgot' && (
          <div className="grid grid-cols-2 bg-white p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setFormError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                authMode === 'signin' 
                  ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300' 
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setFormError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                authMode === 'signup' 
                  ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300' 
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Success Reset Banner */}
        {resetSentEmail && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800"
          >
            <p className="font-bold flex items-center gap-2 uppercase tracking-wider">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              Reset Link Dispatched
            </p>
            <p className="mt-1 font-medium leading-relaxed">
              We have sent a secure password reset link to <strong className="underline">{resetSentEmail}</strong>. Please check your spam folder if it doesn't arrive shortly.
            </p>
          </motion.div>
        )}

        {/* Popup Blocker Help Guide */}
        {isPopupBlocked && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm"
          >
            <p className="font-bold flex items-center gap-2 uppercase tracking-wider text-amber-800">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shrink-0" />
              Google Sign-In Popup Blocked
            </p>
            <p className="mt-1.5 font-medium leading-relaxed text-amber-900/90">
              Your browser blocked the Google authentication popup because the preview window is running inside an iframe. You have two secure solutions:
            </p>
            <div className="mt-3.5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  loginWithRedirect(selectedRole as 'patient' | 'consultant', explicitRoleSelected).catch((err) => {
                    console.info("Redirect sign-in error handled:", err?.message || err);
                  });
                }}
                className="w-full bg-[#0A3B24] hover:bg-[#0A3B24]/90 text-white font-extrabold px-3 py-2.5 rounded-xl uppercase tracking-wider text-[10px] shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Option 1: Try Redirect Method</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(window.location.href, '_blank');
                }}
                className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-extrabold px-3 py-2.5 rounded-xl uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Option 2: Open App in New Tab</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPopupBlocked(false)}
                className="text-center font-bold text-[9px] uppercase tracking-wider text-amber-700 hover:text-amber-900 transition-colors pt-1 cursor-pointer"
              >
                Dismiss Notice
              </button>
            </div>
          </motion.div>
        )}

        {/* Global/Form Error Display */}
        {(formError || authError) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"
          >
            <p className="font-bold flex items-center gap-2 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shrink-0" />
              Secure Authentication Notice
            </p>
            <p className="mt-1 font-semibold leading-relaxed">{formError || authError}</p>
          </motion.div>
        )}

        {/* Interactive Auth Form */}
        <form onSubmit={handleAction} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwame Mensah"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-semibold outline-none focus:border-slate-300 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-semibold outline-none focus:border-slate-300 focus:bg-white transition-all text-slate-800"
              />
            </div>
          </div>

          {authMode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Password
                </label>
                {authMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setFormError(null);
                      setResetSentEmail(null);
                    }}
                    className="text-[10px] font-black uppercase tracking-wider text-slate-600 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-semibold outline-none focus:border-slate-300 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>
          )}

          {authMode === 'signup' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Join PockettClinic As
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('patient')}
                    className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      selectedRole === 'patient'
                        ? 'border-slate-300 bg-slate-50/50 text-slate-600 ring-2 ring-lime-300/20'
                        : 'border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${selectedRole === 'patient' ? 'text-slate-600' : 'text-slate-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Patient / Client</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('consultant')}
                    className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      selectedRole === 'consultant'
                        ? 'border-slate-300 bg-slate-50/50 text-slate-600 ring-2 ring-lime-300/20'
                        : 'border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <ShieldCheck className={`h-5 w-5 ${selectedRole === 'consultant' ? 'text-slate-600' : 'text-slate-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Consultant</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input 
                      type="checkbox"
                      required
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="peer appearance-none w-5 h-5 rounded-lg border-slate-100 border-slate-300 checked:bg-emerald-600 checked:border-blue-600 transition-all cursor-pointer"
                    />
                    <CheckCircle2 size={12} className="absolute text-slate-600 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight group-hover:text-slate-800 transition-colors">
                    I agree to the <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalModalTab('tos'); setLegalModalOpen(true); }} className="text-slate-600 underline font-extrabold hover:text-slate-600 focus:outline-none cursor-pointer">Terms of Service</button> and <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalModalTab('privacy'); setLegalModalOpen(true); }} className="text-slate-600 underline font-extrabold hover:text-slate-600 focus:outline-none cursor-pointer">Privacy Policy</button>, including Ghana DPA 843 standards.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Form Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black text-slate-600 uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-slate-100 border-white border-t-transparent" />
            ) : (
              <span>
                {authMode === 'signin' && 'SIGN IN TO CLINIC'}
                {authMode === 'signup' && 'CREATE SECURE ACCOUNT'}
                {authMode === 'forgot' && 'DISPATCH RESET EMAIL'}
              </span>
            )}
          </button>
        </form>

        {/* Back to Sign-in link for Forgot mode */}
        {authMode === 'forgot' && (
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setFormError(null);
              setResetSentEmail(null);
            }}
            className="mt-4 flex items-center justify-center gap-2 w-full text-xs font-black uppercase tracking-wider text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
        )}

        {/* Separator */}
        {authMode !== 'forgot' && (
          <>
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                Or alternative sign in
              </span>
            </div>

            {/* Google Alternative Login Button */}
            <button
              type="button"
              onClick={() => {
                if (authMode === 'signup' && !agreedToTerms) {
                  setFormError("You must agree to the Terms of Service and Privacy Policy before proceeding.");
                  return;
                }
                login(selectedRole as 'patient' | 'consultant', explicitRoleSelected).catch((err) => {
                  console.info("Popup sign-in error handled:", err?.message || err);
                });
              }}
              disabled={authMode === 'signup' && !agreedToTerms}
              className={`group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-3.5 text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all ${authMode === 'signup' && !agreedToTerms ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-slate-600 hover:bg-white hover:scale-[1.01] active:scale-[0.99] cursor-pointer'}`}
            >
              <LogIn className="h-4 w-4" />
              SIGN IN WITH GOOGLE
            </button>
          </>
        )}

        <p className="mt-6 text-center text-[9px] uppercase tracking-widest font-black text-slate-500 px-4 leading-relaxed">
          Ghana Health & MDC Certified Clinical Data Privacy Standards Enforced.
        </p>
      </motion.div>

      <LegalDocumentsModal 
        isOpen={legalModalOpen} 
        onClose={() => setLegalModalOpen(false)} 
        defaultTab={legalModalTab} 
      />
    </div>
  );
};

export { RoleGuard, PublicOnlyGuard } from "./RoleGuard";
export default AuthGate;
