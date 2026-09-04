import React from 'react';
import { useAppContext } from '../AppContext';
import { ShieldAlert, X, User } from 'lucide-react';

export default function ImpersonationBanner() {
  const { impersonatedUser, stopImpersonation } = useAppContext();

  if (!impersonatedUser) return null;

  return (
    <div className="bg-white text-slate-600 border-b border-slate-300/30 sticky top-0 z-[200] shadow-2xl animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-1.5 rounded-lg text-slate-600 animate-pulse">
            <ShieldAlert size={16} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">Impersonation Active</p>
            <div className="flex items-center gap-2">
              <User size={12} className="text-slate-500" />
              <p className="text-sm font-bold truncate max-w-[200px]">
                Viewing as <span className="text-slate-600">{impersonatedUser.fullName || impersonatedUser.displayName}</span>
              </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={stopImpersonation}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
        >
          <span>Exit Mode</span>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
