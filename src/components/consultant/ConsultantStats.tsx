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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Queue Status */}
      <div className="bg-white/85 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600 rounded-l-2xl"></div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Queue Status</p>
          <Users size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </div>
        <div className="mt-3">
          <p className="text-2xl font-black tracking-tight text-slate-900">{pendingQueueCount}</p>
          <p className="text-[10px] text-slate-600 font-bold mt-1">Pending clinical dispatch</p>
        </div>
      </div>

      {/* Card 2: Patients Seen */}
      <div className="bg-white/85 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600 rounded-l-2xl"></div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Patients Seen</p>
          <CalendarDays size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </div>
        <div className="mt-3">
          <p className="text-2xl font-black tracking-tight text-slate-900">{patientsSeen}</p>
          <p className="text-[10px] text-slate-600 font-bold mt-1">Total completed cases</p>
        </div>
      </div>

      {/* Card 3: Wallet Balance */}
      <div className="bg-white/85 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600 rounded-l-2xl"></div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Wallet</p>
          <TrendingUp size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </div>
        <div className="mt-3">
          <p className="text-2xl font-black tracking-tight text-[#0A3B24]">GHS {consultant70Earnings.toFixed(2)}</p>
          <p className="text-[10px] text-slate-600 font-bold mt-1">Consultant earnings</p>
        </div>
      </div>

      {/* Card 4: Avg Rating */}
      <div className="bg-white/85 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600 rounded-l-2xl"></div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Avg Rating</p>
          <Star className="text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform" size={14} />
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-black tracking-tight text-slate-900">{averageRating}</p>
            <span className="text-[10px] text-emerald-600 font-bold">★ 100%</span>
          </div>
          <p className="text-[10px] text-slate-600 font-bold mt-1">Patient satisfaction</p>
        </div>
      </div>
    </div>
  );
};

export default ConsultantStats;
