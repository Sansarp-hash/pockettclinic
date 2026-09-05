import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { getPlanForUser, isCarePlus, isProPartner } from '../lib/subscriptions';
import { Crown, Sparkles, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import SubscriptionModal from './SubscriptionModal';
import { AdminCardWrapper } from './admin/AdminCardWrapper';

interface SubscriptionCardProps {
  compact?: boolean;
}

export default function SubscriptionCard({ compact = false }: SubscriptionCardProps) {
  const { user } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!user) return null;

  const plan = getPlanForUser(user.role, user.subscriptionTier);
  const isConsultant = user.role === 'consultant';
  const hasActiveUpgrade = isConsultant ? isProPartner(user) : isCarePlus(user);

  if (compact) {
    return (
      <AdminCardWrapper cardId={`subscription_compact_${user.uid}`} defaultTitle={plan.name} defaultDescription={hasActiveUpgrade ? 'Active Plan Perks Enabled' : 'Free Standard Tier'}>
        {({ title, description }) => (
          <>
    <div className={`p-5 rounded-[2rem] border transition-all cursor-pointer group ${
      hasActiveUpgrade 
        ? 'bg-slate-950 text-white border-slate-900 shadow-2xl shadow-slate-950/20'
        : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/40'
    }`}
    onClick={() => setIsModalOpen(true)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
            hasActiveUpgrade ? 'bg-amber-400 text-slate-950' : 'bg-slate-50 text-slate-400'
          }`}>
            {hasActiveUpgrade ? <Crown size={24} /> : <Zap size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-tight ${hasActiveUpgrade ? 'text-white' : 'text-slate-950'}`}>
                {title}
              </span>
              {hasActiveUpgrade && (
                <span className="bg-emerald-500 text-white font-black text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                  PRO
                </span>
              )}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[0.15em] block mt-0.5 ${hasActiveUpgrade ? 'text-slate-500' : 'text-slate-400'}`}>
              {description}
            </span>
          </div>
        </div>

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          hasActiveUpgrade 
            ? 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
            : 'bg-slate-50 text-slate-400 group-hover:bg-slate-950 group-hover:text-white'
        }`}>
          <ArrowRight size={18} />
        </div>
      </div>

      <SubscriptionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
          </>
        )}
      </AdminCardWrapper>
    );
  }

  return (
    <AdminCardWrapper cardId={`subscription_full_${user.uid}`} defaultTitle={plan.name} defaultDescription={isConsultant ? 'Consultant Partner Tier' : 'Patient Membership'}>
      {({ title, description }) => (
        <>
          <div className={`rounded-[3rem] p-10 relative overflow-hidden border transition-all duration-500 ${
            hasActiveUpgrade
              ? 'bg-slate-950 text-white border-slate-900 shadow-2xl shadow-slate-950/40'
              : 'bg-white border-slate-100 text-slate-900 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-slate-200/60'
          }`}>
            <div className="absolute -top-12 -right-12 transform opacity-[0.03] pointer-events-none">
              <Crown size={320} />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                <div className="flex items-center gap-5">
                  <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-2xl ${
                    hasActiveUpgrade ? 'bg-amber-400 text-slate-950 shadow-amber-400/20' : 'bg-slate-950 text-white shadow-slate-950/20'
                  }`}>
                    {hasActiveUpgrade ? <Crown size={32} /> : <Zap size={32} />}
                  </div>
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1 ${
                      hasActiveUpgrade ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {description}
                    </span>
                    <h3 className={`text-2xl font-black uppercase tracking-tight ${hasActiveUpgrade ? 'text-white' : 'text-slate-950'}`}>
                      {title}
                    </h3>
                  </div>
                </div>

                <div className={`self-start md:self-center px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  hasActiveUpgrade 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/10' 
                    : 'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                  {hasActiveUpgrade ? 'Current Plan' : 'Standard Access'}
                </div>
              </div>

              <div className="p-8 rounded-[2rem] bg-black/5 border border-white/5 mb-10">
                <p className={`text-[13px] font-bold italic leading-relaxed ${
                  hasActiveUpgrade ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  "{plan.tagline}"
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                    <div className={`mt-0.5 shrink-0 ${hasActiveUpgrade ? 'text-amber-400' : 'text-emerald-600'}`}>
                      <CheckCircle2 size={18} />
                    </div>
                    <span className={`text-xs font-black uppercase tracking-tight leading-relaxed ${hasActiveUpgrade ? 'text-slate-300' : 'text-slate-700'}`}>
                      {feat.text}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className={`w-full py-6 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl ${
                  hasActiveUpgrade
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20'
                    : 'bg-slate-950 hover:bg-slate-800 text-white shadow-slate-950/20'
                }`}
              >
                <Sparkles size={18} />
                {hasActiveUpgrade ? 'Manage My Membership' : `Activate ${isConsultant ? 'Pro Partner' : 'Care Plus'} Tier`}
              </button>
            </div>
          </div>

          <SubscriptionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
      )}
    </AdminCardWrapper>
  );
}
