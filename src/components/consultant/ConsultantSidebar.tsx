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
    <aside className="hidden md:flex w-52 bg-white border-r border-slate-200 flex-col shrink-0 h-full">
      <div className="p-3 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {globalLogoUrl ? (
            <img src={globalLogoUrl} alt="PockettClinic" className="w-[32px] h-[32px] rounded-lg object-cover bg-white p-0.5 shrink-0 shadow-sm border border-slate-200" />
          ) : (
            <div className="w-[32px] h-[32px] rounded-lg bg-[#C8E6C9] p-1 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
              <img src="/logo.svg" alt="PockettClinic Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[10px] font-black text-slate-900 tracking-tight leading-none truncate">
              {globalTitle || "PockettClinic"}
            </h1>
            <span className="text-[7px] text-emerald-600 font-bold tracking-wider uppercase block mt-0.5 truncate">
              {globalSlogan || "Digital Hospital"}
            </span>
          </div>
        </div>
      </div>
      <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeDashboardTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveDashboardTab(tab.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer relative ${
                isActive 
                   ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/30' 
                   : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-emerald-600' : 'text-slate-400'} /> 
              <span className="truncate">{tab.label}</span>
              {tab.id === 'notifications' && unreadCount > 0 && (
                <span className="absolute right-2.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black flex items-center justify-center rounded-full shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
        
        <div className="pt-2 border-t border-slate-100 space-y-0.5 mt-2">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
          >
            <Settings size={14} className="text-slate-400" />
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
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-slate-500 hover:bg-rose-50 hover:text-rose-600 border border-transparent"
          >
            <LogOut size={14} className="text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default ConsultantSidebar;
