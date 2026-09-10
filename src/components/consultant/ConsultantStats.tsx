import React from 'react';
import { Star, Users, CalendarDays, TrendingUp, Sparkles } from 'lucide-react';
import { StatSkeleton } from '../Skeleton';

interface ConsultantStatsProps {
  pendingQueueCount: number;
  patientsSeen: number;
  consultant70Earnings: number;
  averageRating: string;
  isLoading?: boolean;
}

export const ConsultantStats: React.FC<ConsultantStatsProps> = ({
  pendingQueueCount,
  patientsSeen,
  consultant70Earnings,
  averageRating,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => <StatSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
      {/* Card 1: Queue Status */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.15em]">Live Queue</p>
          <div className="w-6 h-6 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
            <Users size={12} />
          </div>
        </div>
        <div>
          <p className="text-base font-black tracking-tight text-slate-950 leading-none">{pendingQueueCount}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Pending</p>
          </div>
        </div>
      </div>

      {/* Card 2: Patients Seen */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.15em]">Efficiency</p>
          <div className="w-6 h-6 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
            <CalendarDays size={12} />
          </div>
        </div>
        <div>
          <p className="text-base font-black tracking-tight text-slate-950 leading-none">{patientsSeen}</p>
          <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest mt-1">Total seen</p>
        </div>
      </div>

      {/* Card 3: Wallet Balance */}
      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 shadow-md shadow-slate-950/20 active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.15em]">Net Wallet</p>
          <div className="w-6 h-6 rounded-lg bg-white/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 border border-white/5">
            <TrendingUp size={12} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-[7px] font-black text-slate-500">GHS</span>
            <p className="text-[15px] font-black tracking-tight text-white leading-none">{consultant70Earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <p className="text-[7px] text-emerald-500 font-black uppercase tracking-widest mt-1">70% Share</p>
        </div>
      </div>

      {/* Card 4: Avg Rating */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.15em]">Reputation</p>
          <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 border border-amber-100">
            <Star size={12} className="fill-current" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-base font-black tracking-tight text-slate-950 leading-none">{averageRating}</p>
            <div className="bg-emerald-50 text-emerald-700 text-[6px] font-black px-1 py-0.5 rounded-full uppercase tracking-widest border border-emerald-100">Verified</div>
          </div>
          <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest mt-1">Avg satisfaction</p>
        </div>
      </div>
    </div>
  );
};

export default ConsultantStats;
