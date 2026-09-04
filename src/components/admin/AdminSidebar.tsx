import React from 'react';
import { useAppContext } from '../../AppContext';
import { 
  LayoutDashboard, ShieldCheck, Video, Users, History, Award, 
  CreditCard, Activity, Megaphone, MapPin, Database, AlertTriangle, 
  Ticket, LogOut, Loader2, Sparkles, Sliders, Heart, FileCheck, Store, Radio
} from 'lucide-react';

interface AdminSidebarProps {
  globalLogoUrl?: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSeeding: boolean;
  handleSeed: () => Promise<void>;
  handleLogout: () => Promise<void>;
  isLoading?: boolean;
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  isSeeding,
  handleSeed,
  handleLogout,
  isLoading
}: AdminSidebarProps) {
  const { globalLogoUrl, globalSlogan, globalTitle } = useAppContext();
  const menuItems = [
    { id: 'dashboard', label: 'Systems Overview', icon: LayoutDashboard },
    { id: 'master-control', label: 'Live Master Control', icon: Sliders },
    { id: 'call-dispatch', label: 'Call Dispatch', icon: Radio },
    { id: 'compliance', label: 'Compliance and Audit', icon: ShieldCheck },
    { id: 'prescription-vault', label: 'RX Vault', icon: FileCheck },
    { id: 'pin-verification', label: 'Cancel PIN Verification', icon: Award },
    { id: 'consultations', label: 'Consultation Ledger', icon: Video },
    { id: 'overview', label: 'Consultant Directory', icon: Users },
    { id: 'patients', label: 'Patient Accounts', icon: Users },
    { id: 'partner-pharmacies', label: 'Partner ePharmacy', icon: Store },
    { id: 'system-logs', label: 'Security Logs', icon: Database },
    { id: 'sessions', label: 'Active Video Rooms', icon: Activity },
    { id: 'settlement', label: 'Settlement and Payout', icon: CreditCard },
    { id: 'quality-qa', label: 'Clinical QA and SOAP', icon: History },
    { id: 'broadcasts', label: 'System Broadcast', icon: Megaphone },
    { id: 'heatmap', label: 'Geographic Heat Map', icon: MapPin },
    { id: 'ticketing-management', label: 'Support and Credit', icon: Ticket },
    { id: 'deletion-requests', label: 'GRD Deletion', icon: Database },
    { id: 'system-errors', label: 'SRE Crash Latency Track', icon: AlertTriangle },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 h-screen sticky top-0 z-20">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {globalLogoUrl ? (
            <img src={globalLogoUrl} alt={globalTitle || "PockettClinic"} className="w-[48px] h-[48px] rounded-[14px] object-cover bg-white p-0.5 shrink-0 shadow-sm border border-slate-200" />
          ) : (
            <div className="w-[48px] h-[48px] rounded-[14px] bg-[#C8E6C9] text-[#0A3B24] flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
              <Heart size={24} className="fill-[#0A3B24] text-[#0A3B24]" strokeWidth={2.5} />
            </div>
          )}
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-tight flex items-center gap-1.5">
              {globalTitle || "PockettClinic"}
            </h1>
            <span className="text-xs text-slate-500 font-medium leading-[1.2] block mt-0.5">
              {globalSlogan || "Your Digital Hospital Anywhere"}
            </span>
            <p className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase mt-1">Master Admin</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isActive 
                   ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50' 
                   : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-emerald-600' : 'text-slate-400'} /> 
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer / Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
        >
          <LogOut size={14} className="text-slate-400" />
          <span>Secure Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
