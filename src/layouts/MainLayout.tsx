import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { UserCircle, Stethoscope, Video, FileText, LayoutDashboard, Search, History, ShieldCheck, Users, Loader2, Store, User, Settings, MessageSquare, Clock, Wallet, Star, Shield, Activity, Database, LogOut, RefreshCw, Zap, AlertTriangle, AlertCircle, Info, X, Calendar, Pill, HeartPulse, Megaphone, Menu } from 'lucide-react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemBroadcast } from '../types';
import ProfileModal from '../components/ProfileModal';
import SettingsModal from '../components/SettingsModal';
import FollowUpChatModal from '../components/FollowUpChatModal';
import NotificationManager from '../components/NotificationManager';
import NearestFacilitiesModal from '../components/NearestFacilitiesModal';
import BrandingLogo from '../components/BrandingLogo';

export default function MainLayout() {
  const context = useAppContext();
  const { 
    role, 
    setRole, 
    isLoading, 
    user, 
    logout, 
    seedDemoData, 
    showToast 
  } = context;

  // Fallback handlers if not provided in AppContext
  const login = (context as any).login || (() => showToast('Sign in modal open', 'info'));
  const resetProfile = (context as any).resetProfile || (() => showToast('Profile reset', 'info'));
  const systemConfig = (context as any).systemConfig || { features: { maintenanceMode: false }, announcements: { headerBannerActive: false } };
  const updateSystemFeature = (context as any).updateSystemFeature || (() => {});

  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [dismissedMaintenanceBanner, setDismissedMaintenanceBanner] = useState(false);
  const [dismissedEmergencyBanner, setDismissedEmergencyBanner] = useState(false);
  const [isNearestFacilitiesOpen, setIsNearestFacilitiesOpen] = useState(false);
  const [activeBroadcasts, setActiveBroadcasts] = useState<SystemBroadcast[]>([]);
  const [logoSrc, setLogoSrc] = useState<string>('/logo.svg');

  useEffect(() => {
    const unsubBranding = onSnapshot(doc(db, 'settings', 'branding'), (snap) => {
      if (snap.exists() && snap.data().logoUrl) {
        setLogoSrc(snap.data().logoUrl);
      }
    }, (err) => {
      console.warn("Branding logo listener error:", err);
    });
    return () => unsubBranding();
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const q = query(collection(db, 'system_broadcasts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SystemBroadcast[] = [];
      snapshot.forEach(d => {
        list.push({ broadcastId: d.id, ...d.data() } as SystemBroadcast);
      });
      setActiveBroadcasts(list.filter(b => b.isActive !== false));
    }, (err) => {
      console.warn("Broadcast listener error in MainLayout:", err);
    });
    return () => unsubscribe();
  }, []);

  const handleSeed = async () => {
    setIsSeeding(true);
    await seedDemoData();
    setIsSeeding(false);
  };

  const isActive = (path: string, tab?: string) => {
    try {
      const currentPath = location.pathname || '';
      const isSamePath = currentPath === path;
      if (!isSamePath) return false;
      
      const search = location.search || '';
      const params = new URLSearchParams(search);
      const activeTab = params.get('tab');
      
      if (tab) {
        return activeTab === tab;
      }
      return !activeTab;
    } catch (err) {
      console.warn('isActive check failed:', err);
      return false;
    }
  };

  // Logic for mandatory care disclaimer
  const needsDisclaimer = user && (
    (role === 'patient' && !user.hasAcceptedCareTerms) ||
    (role === 'consultant' && !user.independentContractorAffirmed)
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  // SUPER ADMIN CHECK
  const superAdmins = ["missty2k@gmail.com", "pharmabridgeghana@gmail.com", "pockettclinic@gmail.com"]; 
  const userEmail = (user?.email || '').toLowerCase();
  const isSuperAdmin = (userEmail && superAdmins.includes(userEmail)) || role === 'super_admin';
  const effectiveRole = (isSuperAdmin || role === 'admin') ? 'admin' : (role || '').toLowerCase();

  // Targeted Broadcast filtering for current user
  const matchingBroadcasts = activeBroadcasts.filter(bc => {
    if (effectiveRole === 'admin') return true;
    if (bc.targetAudience === 'ALL') return true;
    if (effectiveRole === 'patient') {
      if (bc.targetAudience === 'PATIENTS') return true;
      if (bc.targetAudience === 'INDIVIDUAL_PATIENT' && bc.targetUserId === user?.uid) return true;
    }
    if (effectiveRole === 'consultant') {
      if (bc.targetAudience === 'CONSULTANTS') return true;
      if (bc.targetAudience === 'INDIVIDUAL_CONSULTANT' && bc.targetUserId === user?.uid) return true;
    }
    return false;
  });

  const activeTargetedBroadcast = matchingBroadcasts[0];

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-emerald-800">
      {/* Real-time System Maintenance Banner (ADMIN ONLY on Admin Pages - strictly hidden from patient & consultant dashboards / public views per specification) */}
      {systemConfig?.features?.maintenanceMode && !dismissedMaintenanceBanner && location.pathname.startsWith('/admin') && effectiveRole === 'admin' && (
        <div className="bg-amber-600 text-emerald-600 px-4 py-2 text-xs font-bold flex items-center justify-between z-50">
          <div className="flex items-center gap-2 mx-auto">
            <AlertTriangle size={15} />
            <span>Admin System Notice: Maintenance mode is currently active across infrastructure config.</span>
            <Link 
              to="/admin/dashboard?tab=master-control"
              className="ml-2 bg-white hover:bg-white text-amber-300 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
            >
              Configure in Master Control
            </Link>
          </div>
          <button 
            onClick={() => setDismissedMaintenanceBanner(true)} 
            className="opacity-70 hover:opacity-100 p-0.5 cursor-pointer text-emerald-600"
            title="Dismiss Notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Patient & Consultant Care & Emergency Triage Disclaimer Banner (Replaces scheduled maintenance with essential safety disclaimers) */}
      {!location.pathname.startsWith('/admin') && !dismissedEmergencyBanner && (
        <div className="bg-rose-50 text-rose-950 px-4 py-1.5 text-[10px] font-bold flex flex-col md:flex-row items-center justify-between gap-2 z-50 shadow-sm border-b border-rose-200/40">
          <div className="flex items-center gap-2 mx-auto text-left leading-tight">
            <HeartPulse size={14} className="text-rose-600 flex-shrink-0 animate-pulse" />
            <span className="line-clamp-2 md:line-clamp-none">
              <strong className="text-rose-700 uppercase tracking-wider mr-1">Emergency Notice:</strong> 
              PockettClinic is for triage. If in crisis, dial <strong className="text-rose-700 font-extrabold underline">112 / 193</strong> or visit emergency immediately.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsNearestFacilitiesOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
            >
              Hospitals
            </button>
            <button 
              onClick={() => setDismissedEmergencyBanner(true)} 
              className="opacity-60 hover:opacity-100 p-1 cursor-pointer text-rose-900 hover:bg-rose-200/30 rounded-full transition-all flex-shrink-0"
              title="Dismiss Disclaimer"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Real-time Targeted System Broadcast Banner for Users / Dashboards */}
      {activeTargetedBroadcast && !dismissedBanner && (
        <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between z-50 ${
          activeTargetedBroadcast.priority === 'EMERGENCY'
            ? 'bg-rose-600 text-white'
            : activeTargetedBroadcast.priority === 'URGENT'
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-500 text-white'
        }`}>
          <div className="flex items-center gap-2 mx-auto">
            {activeTargetedBroadcast.priority === 'EMERGENCY' ? (
              <AlertCircle size={15} />
            ) : activeTargetedBroadcast.priority === 'URGENT' ? (
              <AlertTriangle size={15} />
            ) : (
              <Megaphone size={15} />
            )}
            <span>
              <strong>[{activeTargetedBroadcast.title}]</strong> {activeTargetedBroadcast.message}
            </span>
          </div>
          <button 
            onClick={() => setDismissedBanner(true)} 
            className="opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
            title="Dismiss Announcement"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Legacy Config Banner Fallback (Only if no active system broadcast) */}
      {!activeTargetedBroadcast && systemConfig?.announcements?.headerBannerActive && !dismissedBanner && effectiveRole === 'admin' && (
        <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between z-50 ${
          systemConfig.announcements.headerBannerType === 'emergency'
            ? 'bg-rose-600 text-white'
            : systemConfig.announcements.headerBannerType === 'warning'
            ? 'bg-amber-500 text-white'
            : 'bg-emerald-500 text-white'
        }`}>
          <div className="flex items-center gap-2 mx-auto">
            {systemConfig.announcements.headerBannerType === 'emergency' ? (
              <AlertCircle size={15} />
            ) : systemConfig.announcements.headerBannerType === 'warning' ? (
              <AlertTriangle size={15} />
            ) : (
              <Info size={15} />
            )}
            <span>{systemConfig.announcements.headerBannerText}</span>
          </div>
          <button 
            onClick={() => setDismissedBanner(true)} 
            className="opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <BrandingLogo logoSize="w-6 h-6" titleSize="text-[13px]" showSlogan={false} />
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
          <nav className="hidden lg:flex items-center gap-6">
            <Link to="/find-care" className="text-[11px] font-black text-emerald-800 hover:text-emerald-900 transition-colors flex items-center gap-1.5 uppercase tracking-wider">
              <Search size={14} strokeWidth={2.5} /> Find Care
            </Link>
          </nav>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {!user ? (
            <button
              onClick={() => {
                try {
                  const res = login();
                  if (res && typeof (res as any).catch === 'function') {
                    (res as any).catch((err: any) => console.info("MainLayout sign-in handled:", err?.message || err));
                  }
                } catch (err: any) {
                  console.info("MainLayout sign-in error handled:", err?.message || err);
                }
              }}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-black text-[10px] transition-all shadow-sm flex items-center gap-1.5 uppercase tracking-widest"
            >
              <User size={14} strokeWidth={2.5} />
              Sign In
            </button>
          ) : (
            <>
              <nav className="hidden md:flex items-center gap-1 bg-white p-1 rounded-xl">
                {/* Nav links based on current role for quick access */}
                {effectiveRole === 'patient' && (
                  <Link to="/patient/dashboard" className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${location.pathname.startsWith('/patient') ? 'text-emerald-600 bg-white shadow-md shadow-lime-900/5' : 'text-emerald-600 hover:text-emerald-800'}`}>
                    Patient Dashboard
                  </Link>
                )}
                {effectiveRole === 'consultant' && (
                  <Link to="/consultant/dashboard" className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${location.pathname.startsWith('/consultant') ? 'text-emerald-600 bg-white shadow-md shadow-lime-900/5' : 'text-emerald-600 hover:text-emerald-800'}`}>
                    Consultant Dashboard
                  </Link>
                )}
                {effectiveRole === 'admin' && (
                  <Link to="/admin/dashboard" className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${location.pathname.startsWith('/admin') ? 'text-emerald-600 bg-white shadow-md shadow-lime-900/5' : 'text-emerald-600 hover:text-emerald-800'}`}>
                    <ShieldCheck size={16} /> Admin Panel
                  </Link>
                )}
              </nav>

              {/* Messages & Profile Quick Action Buttons */}
              <div className="flex items-center gap-2 border-l border-lime-200 pl-2 sm:pl-4">
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="p-2 text-emerald-600 hover:text-emerald-600 hover:bg-white rounded-xl transition-colors relative"
                  title="Follow-Up Messages"
                >
                  <MessageSquare size={18} />
                </button>
                <NotificationManager />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsProfileOpen(true)}
                    className="flex items-center gap-2 p-1.5 hover:bg-white rounded-xl transition-colors border border-lime-200"
                    title="Edit Profile"
                  >
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="w-7 h-7 rounded-lg object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-lime-200 text-emerald-600 flex items-center justify-center font-bold text-xs">
                        {user?.displayName?.[0] || 'U'}
                      </div>
                    )}
                    <span className="text-xs font-bold text-emerald-800 hidden sm:inline max-w-[100px] truncate">
                      {user?.displayName || 'My Profile'}
                    </span>
                  </button>
                </div>

                {/* Mobile Menu Toggle Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-white rounded-xl transition-colors cursor-pointer lg:hidden border border-lime-200 ml-1"
                  aria-label="Toggle Mobile Navigation"
                >
                  {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>

      {/* Mobile Sidebar Overlay Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-72 max-w-[85vw] h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto ${
            effectiveRole === 'patient' ? 'bg-white text-emerald-600' : 'bg-white text-emerald-500'
          }`}>
            <div className="p-4 border-b border-lime-200/20 flex items-center justify-between shrink-0">
              <BrandingLogo />
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`p-1.5 rounded-lg ${effectiveRole === 'patient' ? 'hover:bg-white text-emerald-600' : 'hover:bg-white text-emerald-500'}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 space-y-4">
              <Link 
                to="/find-care" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-lime-50 text-emerald-600 font-bold text-sm"
              >
                <Search size={18} /> Find Care
              </Link>

              {effectiveRole === 'consultant' && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 px-3 py-1">Consultant Workspace</p>
                  {[
                    { id: 'appointments', label: 'Dashboard', icon: LayoutDashboard },
                    { id: 'queue', label: 'Patient Queue', icon: Users },
                    { id: 'portfolio', label: 'Onboarding & Profile', icon: UserCircle },
                    { id: 'schedule', label: 'Schedule', icon: Clock },
                    { id: 'chat', label: 'Follow-up Chat', icon: MessageSquare },
                    { id: 'ledger', label: 'Payout Wallet', icon: Wallet },
                    { id: 'feedback', label: 'Feedback', icon: Star },
                  ].map((tab) => (
                    <Link
                      key={tab.id}
                      to={`/consultant/dashboard?tab=${tab.id}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                        isActive('/consultant/dashboard', tab.id) || (tab.id === 'appointments' && isActive('/consultant/dashboard'))
                          ? 'bg-emerald-500 text-white font-bold'
                          : 'hover:bg-white text-emerald-500'
                      }`}
                    >
                      <tab.icon size={18} />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </Link>
                  ))}
                  <button
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await context.logout();
                      navigate('/');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-all font-bold text-sm mt-4 border border-red-100"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </div>
              )}

              {effectiveRole === 'patient' && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 px-3 py-1">Patient Portal</p>
                  <Link 
                    to="/patient/dashboard" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white font-bold text-sm"
                  >
                    <LayoutDashboard size={18} /> Dashboard
                  </Link>
                  {[
                    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                    { id: 'appointments', label: 'Appointments & History', icon: Calendar },
                    { id: 'medications', label: 'Medications & Rx', icon: Pill },
                    { id: 'vault', label: 'Health Record & Vault', icon: HeartPulse },
                    { id: 'family', label: 'Family Profiles', icon: Users },
                  ].map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/patient/dashboard?tab=${sub.id}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 pl-8 py-2 text-xs font-semibold text-emerald-600 hover:text-emerald-600"
                    >
                      <sub.icon size={14} />
                      <span>{sub.label}</span>
                    </Link>
                  ))}
                  <button
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await context.logout();
                      navigate('/');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-all font-bold text-sm mt-4 border border-red-100"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </div>
              )}

              {effectiveRole === 'admin' && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 px-3 py-1">Admin Console</p>
                  {[
                    { id: 'master-control', label: 'Master Live Control', icon: Zap },
                    { id: 'system-errors', label: 'System Health & Issue Tracker', icon: Activity },
                    { id: 'dashboard', label: 'System Overview', icon: LayoutDashboard },
                    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
                    { id: 'consultations', label: 'Consultations', icon: FileText },
                    { id: 'patients', label: 'Patients', icon: Users },
                    { id: 'consultants', label: 'Consultants', icon: Shield },
                    { id: 'sessions', label: 'Active Sessions', icon: Activity },
                  ].map((tab) => (
                    <Link
                      key={tab.id}
                      to={`/admin/dashboard?tab=${tab.id}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white text-emerald-500 text-sm font-medium"
                    >
                      <tab.icon size={18} />
                      <span>{tab.label}</span>
                    </Link>
                  ))}
                  <button
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await context.logout();
                      navigate('/');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-all font-bold text-sm mt-4 border border-red-100"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-lime-200/20 shrink-0">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="w-full py-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {effectiveRole === 'consultant' && (
          <aside className="hidden lg:flex lg:w-64 bg-white flex-shrink-0 flex-col text-emerald-500 overflow-y-auto">
            <div className="p-6 border-b border-lime-200 mb-4">
              <BrandingLogo showSlogan={false} titleSize="text-lg" />
            </div>
            <nav className="flex-1 px-3 space-y-1">
              {[
                { id: 'appointments', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'queue', label: 'Patient Queue', icon: Users },
                { id: 'portfolio', label: 'Onboarding & Profile', icon: UserCircle },
                { id: 'schedule', label: 'Schedule', icon: Clock },
                { id: 'chat', label: 'Follow-up Chat', icon: MessageSquare },
                { id: 'ledger', label: 'Payout Wallet', icon: Wallet },
                { id: 'feedback', label: 'Feedback', icon: Star },
              ].map((tab) => (
                <Link
                  key={tab.id}
                  to={`/consultant/dashboard?tab=${tab.id}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive('/consultant/dashboard', tab.id) || (tab.id === 'appointments' && isActive('/consultant/dashboard'))
                      ? 'bg-emerald-500 text-white shadow-lg shadow-indigo-900/50'
                      : 'hover:bg-white hover:text-emerald-600'
                  }`}
                >
                  <tab.icon size={18} className={isActive('/consultant/dashboard', tab.id) ? 'opacity-100' : 'opacity-70'} />
                  <span className="text-sm font-bold">{tab.label}</span>
                </Link>
              ))}

              <div className="pt-2 border-t border-lime-200/80 my-2 space-y-1">
                <button 
                  onClick={() => setIsProfileOpen(true)} 
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white hover:text-emerald-600 rounded-xl transition-colors text-emerald-500 cursor-pointer"
                >
                  <User size={18} className="opacity-70" />
                  <span className="font-bold text-sm">Account</span>
                </button>

                <button 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white hover:text-emerald-600 rounded-xl transition-colors text-emerald-500 cursor-pointer"
                >
                  <Settings size={18} className="opacity-70" />
                  <span className="font-bold text-sm">Settings</span>
                </button>
              </div>
            </nav>
            <div className="p-4 border-t border-lime-200 mt-auto">
              <div className="bg-white/50 rounded-2xl p-4 flex items-center gap-3 border border-lime-200">
                <div className="w-10 h-10 rounded-full bg-lime-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-emerald-500">
                  {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <Stethoscope size={20} />}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-emerald-600 text-sm font-bold truncate">{user?.displayName || 'Consultant'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={logout} className="text-[10px] text-rose-400 hover:text-rose-300 font-black uppercase tracking-widest flex items-center gap-1">
                      <LogOut size={10} /> Logout
                    </button>
                    <button onClick={resetProfile} title="Reset Profile State" className="text-[10px] text-emerald-500 hover:text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1 border-l border-lime-200 pl-2">
                      <RefreshCw size={10} /> Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
        {effectiveRole === 'patient' && (
          <aside className="hidden lg:flex lg:w-64 bg-white border-r border-lime-200 flex-shrink-0 flex-col text-emerald-600 overflow-y-auto">
            <nav className="flex-1 px-4 space-y-2 mt-4">
              <Link to="/find-care" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive('/find-care') ? 'bg-lime-50 text-emerald-600' : 'hover:bg-lime-50 hover:text-emerald-600'}`}>
                <Search size={20} className="opacity-70" />
                <span className="font-bold text-sm">Find Care</span>
              </Link>
              
              <div className="space-y-1">
                <Link to="/patient/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive('/patient/dashboard') ? 'bg-lime-50 text-emerald-600' : 'hover:bg-lime-50 hover:text-emerald-600'}`}>
                  <LayoutDashboard size={20} className="opacity-70" />
                  <span className="font-bold text-sm">Dashboard</span>
                </Link>
                
                {/* Side Sub-tabs for Dashboard */}
                <div className="pl-4 space-y-1 border-l border-lime-200 ml-6 mt-1">
                  {[
                    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                    { id: 'appointments', label: 'Appointments & History', icon: Calendar },
                    { id: 'medications', label: 'Medications & Rx', icon: Pill },
                    { id: 'vault', label: 'Health Record & Vault', icon: HeartPulse },
                    { id: 'family', label: 'Family Profiles', icon: Users },
                  ].map((subTab) => {
                    const isSubActive = isActive('/patient/dashboard', subTab.id) || (subTab.id === 'overview' && isActive('/patient/dashboard'));
                    return (
                      <Link
                        key={subTab.id}
                        to={`/patient/dashboard?tab=${subTab.id}`}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          isSubActive
                            ? 'text-emerald-600 bg-lime-50/50'
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-white'
                        }`}
                      >
                        <subTab.icon size={14} className={isSubActive ? 'text-emerald-600' : 'text-emerald-500'} />
                        <span>{subTab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setIsChatOpen(true)} 
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-lime-50 hover:text-emerald-600 rounded-xl transition-colors"
              >
                <MessageSquare size={20} className="opacity-70" />
                <span className="font-bold text-sm">Messages</span>
              </button>

              <div className="pt-2 border-t border-lime-200 my-2 space-y-1">
                <button 
                  onClick={() => setIsProfileOpen(true)} 
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-lime-50 hover:text-emerald-600 rounded-xl transition-colors text-emerald-600"
                >
                  <User size={20} className="opacity-70" />
                  <span className="font-bold text-sm">Account</span>
                </button>

                <button 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-lime-50 hover:text-emerald-600 rounded-xl transition-colors text-emerald-600"
                >
                  <Settings size={20} className="opacity-70" />
                  <span className="font-bold text-sm">Settings</span>
                </button>
              </div>
            </nav>
            <div className="p-6 border-t border-lime-200 mt-auto">
              <div className="bg-white rounded-2xl p-4 flex items-center gap-3 border border-lime-200">
                <div className="w-10 h-10 rounded-full bg-lime-50 overflow-hidden flex-shrink-0 flex items-center justify-center text-emerald-600">
                  {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <UserCircle size={20} />}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-emerald-800 text-sm font-bold truncate">{user?.displayName || 'Patient'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={logout} className="text-[10px] text-rose-500 hover:text-rose-600 font-black uppercase tracking-widest flex items-center gap-1">
                      <LogOut size={10} /> Logout
                    </button>
                    <button onClick={resetProfile} title="Reset Profile State" className="text-[10px] text-emerald-500 hover:text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1 border-l border-lime-200 pl-2">
                      <RefreshCw size={10} /> Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
        <main className="flex-1 flex flex-col overflow-y-auto relative bg-white min-w-0">
          <Outlet />
        </main>
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <FollowUpChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <NearestFacilitiesModal isOpen={isNearestFacilitiesOpen} onClose={() => setIsNearestFacilitiesOpen(false)} />
    </div>
  );
}
