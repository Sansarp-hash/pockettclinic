import React from 'react';
import { useAppContext } from '../../AppContext';
import { LayoutDashboard, Users, UserCircle, Clock, MessageSquare, Wallet, Star, FileText, ShieldAlert, Landmark, Share2, CalendarCheck, BookOpen, Heart, Settings, Trash2, LogOut, ShieldCheck, Bell } from 'lucide-react';

interface ConsultantSidebarProps {
  activeDashboardTab: string;
  setActiveDashboardTab: (tab: any) => void;
  globalLogoUrl?: string | null;
  onOpenSettings: () => void;
  onOpenDeletion: () => void;
  unreadCount?: number;
}

export const ConsultantSidebar: React.FC<ConsultantSidebarProps> = ({
  activeDashboardTab,
  setActiveDashboardTab,
  globalLogoUrl,
  onOpenSettings,
  onOpenDeletion,
  unreadCount = 0
}) => {
  const { globalSlogan, globalTitle, logout } = useAppContext();
  const tabs = [
    { id: 'appointments', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'queue', label: 'Patient Queue', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'stg-reference', label: 'Ghana STG & Medscape', icon: BookOpen },
    { id: 'soap', label: 'SOAP Notes & Voice', icon: FileText },
    { id: 'drug-safety', label: 'Drug Safety Checker', icon: ShieldAlert },
    { id: 'referrals', label: 'Specialist Referrals', icon: Share2 },
    { id: 'follow-ups', label: 'Follow-up Scheduler', icon: CalendarCheck },
    { id: 'payout-hub', label: 'Earnings and Payout', icon: Landmark },
    { id: 'schedule', label: 'Schedule', icon: Clock },
    { id: 'chat', label: 'Follow-up Chat', icon: MessageSquare },
    { id: 'portfolio', label: 'Professional Portfolio', icon: UserCircle },
    { id: 'feedback', label: 'Feedback', icon: Star },
    { id: 'subscription', label: 'Subscription', icon: ShieldCheck },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 h-full">
      <div className="p-6 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {globalLogoUrl ? (
            <img src={globalLogoUrl} alt="PockettClinic" className="w-[44px] h-[44px] rounded-[14px] object-cover bg-white p-0.5 shrink-0 shadow-sm border border-slate-200" />
          ) : (
            <div className="w-[44px] h-[44px] rounded-[14px] bg-[#C8E6C9] p-1 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
              <img src="/logo.svg" alt="PockettClinic Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black text-slate-800 tracking-tight leading-none">
              {globalTitle || "PockettClinic"}
            </h1>
            <span className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase block mt-1">
              {globalSlogan || "Your Digital Hospital Anywhere"}
            </span>
          </div>
        </div>
      </div>
      <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeDashboardTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveDashboardTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer relative ${
                isActive 
                   ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50' 
                   : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-emerald-600' : 'text-slate-400'} /> 
              <span>{tab.label}</span>
              {tab.id === 'notifications' && unreadCount > 0 && (
                <span className="absolute right-4 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
        
        <div className="pt-4 border-t border-slate-100 space-y-1.5 mt-4">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
          >
            <Settings size={18} className="text-slate-400" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to sign out?")) {
                logout().then(() => {
                  window.location.href = '/';
                });
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer text-slate-500 hover:bg-rose-50 hover:text-rose-600 border border-transparent"
          >
            <LogOut size={18} className="text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default ConsultantSidebar;
