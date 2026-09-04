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
            <div 
              onClick={() => setIsModalOpen(true)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                hasActiveUpgrade 
                  ? 'bg-gradient-to-r from-indigo-900 to-purple-900 text-slate-600 border-indigo-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  hasActiveUpgrade ? 'bg-amber-400 text-slate-800' : 'bg-slate-50 text-slate-600'
                }`}>
                  {hasActiveUpgrade ? <Crown size={18} /> : <Zap size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-black ${hasActiveUpgrade ? 'text-slate-600' : 'text-slate-800'}`}>
                      {title}
                    </span>
                    {hasActiveUpgrade && (
                      <span className="bg-amber-400 text-emerald-700 font-black text-[9px] px-1.5 py-0.2 rounded uppercase">
                        PRO
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] block ${hasActiveUpgrade ? 'text-slate-600' : 'text-slate-500'}`}>
                    {description}
                  </span>
                </div>
              </div>

              <button className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                hasActiveUpgrade 
                  ? 'bg-white/10 hover:bg-white/20 text-slate-600 border border-white/20'
                  : 'bg-slate-50 group-hover:bg-emerald-600 group-hover:text-slate-600 text-slate-600'
              }`}>
                <span>Manage</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <SubscriptionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
          </>
        )}
      </AdminCardWrapper>
    );
  }

  return (
    <AdminCardWrapper cardId={`subscription_full_${user.uid}`} defaultTitle={plan.name} defaultDescription={isConsultant ? 'Consultant Partner Tier' : 'Patient Membership'}>
      {({ title, description }) => (
        <>
          <div className={`rounded-3xl p-6 relative overflow-hidden border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all ${
            hasActiveUpgrade
              ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-slate-600 border-slate-200'
              : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
              <Crown size={180} />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${
                    hasActiveUpgrade ? 'bg-amber-400 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {hasActiveUpgrade ? <Crown size={20} /> : <Zap size={20} />}
                  </div>
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest block ${
                      hasActiveUpgrade ? 'text-amber-300' : 'text-slate-600'
                    }`}>
                      {description}
                    </span>
                    <h3 className={`text-lg font-black ${hasActiveUpgrade ? 'text-slate-600' : 'text-slate-800'}`}>
                      {title}
                    </h3>
                  </div>
                </div>

                <span className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                  hasActiveUpgrade 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}>
                  {hasActiveUpgrade ? 'Active' : 'Standard'}
                </span>
              </div>

              <p className={`text-xs mb-5 font-medium leading-relaxed ${
                hasActiveUpgrade ? 'text-slate-600' : 'text-slate-600'
              }`}>
                {plan.tagline}
              </p>

              <div className="space-y-2 mb-6">
                {plan.features.slice(0, 3).map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 size={14} className={hasActiveUpgrade ? 'text-amber-400' : 'text-slate-600'} />
                    <span className={`font-semibold ${hasActiveUpgrade ? 'text-slate-500' : 'text-slate-800'}`}>
                      {feat.text}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className={`w-full py-3 rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-95 cursor-pointer ${
                  hasActiveUpgrade
                    ? 'bg-amber-400 hover:bg-amber-300 text-emerald-700 shadow-amber-400/20'
                    : 'bg-emerald-600 hover:bg-emerald-600 text-white shadow-indigo-200'
                }`}
              >
                <Sparkles size={16} />
                {hasActiveUpgrade ? 'Manage Subscription' : `Upgrade to ${isConsultant ? 'Pro Partner' : 'Care Plus'}`}
              </button>
            </div>
          </div>

          <SubscriptionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
      )}
    </AdminCardWrapper>
  );
}
