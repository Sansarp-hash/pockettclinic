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
    <div className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
      hasActiveUpgrade 
        ? 'bg-slate-900 text-white border-slate-800 shadow-lg'
        : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md'
    }`}
    onClick={() => setIsModalOpen(true)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            hasActiveUpgrade ? 'bg-amber-400 text-slate-950' : 'bg-slate-50 text-slate-400'
          }`}>
            {hasActiveUpgrade ? <Crown size={18} /> : <Zap size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-bold uppercase tracking-tight ${hasActiveUpgrade ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </span>
              {hasActiveUpgrade && (
                <span className="bg-emerald-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                  PRO
                </span>
              )}
            </div>
            <span className={`text-[9px] font-medium uppercase tracking-wider block mt-0.5 ${hasActiveUpgrade ? 'text-slate-400' : 'text-slate-400'}`}>
              {description}
            </span>
          </div>
        </div>

        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          hasActiveUpgrade 
            ? 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
            : 'bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'
        }`}>
          <ArrowRight size={14} />
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
          <div className={`rounded-xl p-5 relative overflow-hidden border transition-all duration-300 ${
            hasActiveUpgrade
              ? 'bg-slate-950 text-white border-slate-900 shadow-xl'
              : 'bg-white border-slate-100 text-slate-900 shadow-md hover:shadow-lg'
          }`}>
            <div className="absolute -top-8 -right-8 transform opacity-[0.03] pointer-events-none">
              <Crown size={180} />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                    hasActiveUpgrade ? 'bg-amber-400 text-slate-950 shadow-amber-400/10' : 'bg-slate-950 text-white shadow-slate-950/10'
                  }`}>
                    {hasActiveUpgrade ? <Crown size={24} /> : <Zap size={24} />}
                  </div>
                  <div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest block mb-0.5 ${
                      hasActiveUpgrade ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {description}
                    </span>
                    <h3 className={`text-sm font-black uppercase tracking-tight ${hasActiveUpgrade ? 'text-white' : 'text-slate-950'}`}>
                      {title}
                    </h3>
                  </div>
                </div>

                <div className={`self-start sm:self-center px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                  hasActiveUpgrade 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm' 
                    : 'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                  {hasActiveUpgrade ? 'Current Plan' : 'Standard Access'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/5 border border-white/5 mb-5">
                <p className={`text-[11px] font-bold italic leading-relaxed ${
                  hasActiveUpgrade ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  "{plan.tagline}"
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                    <div className={`mt-0.5 shrink-0 ${hasActiveUpgrade ? 'text-amber-400' : 'text-emerald-600'}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-tight leading-relaxed ${hasActiveUpgrade ? 'text-slate-300' : 'text-slate-700'}`}>
                      {feat.text}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className={`w-full py-3.5 rounded-lg font-black text-[9px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${
                  hasActiveUpgrade
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/10'
                    : 'bg-slate-950 hover:bg-slate-900 text-white shadow-slate-950/10'
                }`}
              >
                <Sparkles size={14} />
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
