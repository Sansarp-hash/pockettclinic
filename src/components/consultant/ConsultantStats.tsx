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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
      {/* Card 1: Queue Status */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Live Queue</p>
          <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
            <Users size={20} />
          </div>
        </div>
        <div>
          <p className="text-3xl font-black tracking-tighter text-slate-950">{pendingQueueCount}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Pending dispatch</p>
          </div>
        </div>
      </div>

      {/* Card 2: Patients Seen */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Efficiency</p>
          <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
            <CalendarDays size={20} />
          </div>
        </div>
        <div>
          <p className="text-3xl font-black tracking-tighter text-slate-950">{patientsSeen}</p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">Total completed</p>
        </div>
      </div>

      {/* Card 3: Wallet Balance */}
      <div className="bg-slate-950 p-6 md:p-8 rounded-[2.5rem] border border-slate-900 shadow-2xl shadow-slate-950/20 active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Net Wallet</p>
          <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 border border-white/5">
            <TrendingUp size={20} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-black text-slate-500">GHS</span>
            <p className="text-2xl font-black tracking-tight text-white">{consultant70Earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-2">70% Clinical Share</p>
        </div>
      </div>

      {/* Card 4: Avg Rating */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Reputation</p>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 border border-amber-100">
            <Star size={20} className="fill-current" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-black tracking-tighter text-slate-950">{averageRating}</p>
            <div className="bg-emerald-50 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-100">Verified</div>
          </div>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">Avg satisfaction</p>
        </div>
      </div>
    </div>
  );
};

export default ConsultantStats;
