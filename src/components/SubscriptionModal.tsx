import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { PATIENT_PLANS, CONSULTANT_PLANS, SubscriptionPlan } from '../lib/subscriptions';
import { SubscriptionTier } from '../types';
import { auth } from '../firebase';
import { 
  X, 
  Check, 
  Sparkles, 
  Crown, 
  ShieldCheck, 
  Zap, 
  Loader2, 
  AlertCircle,
  CreditCard,
  Award
} from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Paystack type declare
declare const PaystackPop: any;

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, updateUserProfile, paystackPublicKey, showToast } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoRenewConsent, setAutoRenewConsent] = useState(true);

  if (!isOpen || !user) return null;

  const isConsultant = user.role === 'consultant';
  const plans: SubscriptionPlan[] = isConsultant 
    ? Object.values(CONSULTANT_PLANS) 
    : Object.values(PATIENT_PLANS);

  const currentTier: SubscriptionTier = user.subscriptionTier || (isConsultant ? 'verified_consultant' : 'pay_as_you_go');
  const isCurrentlyActive = user.subscriptionStatus === 'active';

  const onPaymentSuccess = async (plan: SubscriptionPlan, reference: string, authorizationCode?: string) => {
    setIsProcessing(true);
    try {
      // Real backend verification unless it is a local simulator reference
      if (reference && !reference.startsWith('SUB_SIM_')) {
        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/payments/verify-paystack', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ reference })
        });

        const data = await response.json();
        if (!response.ok || !data.verified) {
          throw new Error(data.error || "Payment verification failed");
        }
      }

      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + thirtyDaysInMs).toISOString();

      const currentTickets = user.videoChatTickets || 0;
      const additionalTickets = plan.id === 'care_plus' ? 1 : 0;
      const authCode = authorizationCode || `AUTH_SIM_${Math.random().toString(36).substring(2, 10)}`;

      await updateUserProfile({
        subscriptionTier: plan.id,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        subscriptionAutoRenew: autoRenewConsent,
        autoRenew: autoRenewConsent,
        videoChatTickets: currentTickets + additionalTickets,
        paystackAuthorizationCode: authCode
      });

      setSuccessMessage(`Welcome to ${plan.name}! Active.`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to save subscription update:", err);
      setErrorMessage(`Verification failed: ${err.message || "Retry later."}`);
    } finally {
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // If selecting the free default plan
    if (plan.priceGHS === 0) {
      setIsProcessing(true);
      try {
        await updateUserProfile({
          subscriptionTier: plan.id,
          subscriptionStatus: 'free',
          subscriptionExpiresAt: undefined,
          subscriptionAutoRenew: false
        });
        setSuccessMessage(`Switched to ${plan.name}.`);
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1200);
      } catch (err: any) {
        console.error("Failed to downgrade plan:", err);
        setErrorMessage("Update failed.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Paid Plan upgrade flow (Care Plus or Pro Partner)
    setIsProcessing(true);
    setSelectedTier(plan.id);

    try {
      const paystackKey = paystackPublicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_pockettclinic_default';

      if (paystackKey && typeof PaystackPop !== 'undefined') {
        const handler = PaystackPop.setup({
          key: paystackKey,
          email: user.email || 'user@pockettclinic.health',
          amount: plan.priceGHS * 100, // Pesewas
          currency: 'GHS',
          ref: `SUB_${plan.id}_${Date.now()}`,
          label: "PockettClinic Subscription",
          channels: ['card', 'mobile_money'],
          phone: user.phone || '',
          metadata: {
            platform: "PockettClinic",
            custom_fields: [
              { display_name: "Plan Name", variable_name: "plan_name", value: plan.name },
              { display_name: "User ID", variable_name: "user_id", value: user.uid }
            ]
          },
          callback: (response: any) => {
            onPaymentSuccess(plan, response.reference || response.trxref, response.authorization?.authorization_code);
          },
          onClose: () => {
            setIsProcessing(false);
            setSelectedTier(null);
          }
        });
        handler.openIframe();
      } else {
        setIsProcessing(false);
        setSelectedTier(null);
        showToast("Gateway unavailable.", "error");
      }
    } catch (err: any) {
      console.error("Subscription payment error:", err);
      setErrorMessage(err.message || "Init failed.");
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Cancel auto-renewal? Benefits remain until expiry.")) return;
    setIsProcessing(true);
    try {
      await updateUserProfile({
        subscriptionAutoRenew: false,
        subscriptionStatus: 'cancelled'
      });
      setSuccessMessage("Renewal cancelled.");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setErrorMessage("Update failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col relative border border-slate-200">
        
        {/* Decorative Top Banner */}
        <div className={`p-5 text-white relative overflow-hidden ${
          isConsultant ? 'bg-slate-900' : 'bg-indigo-900'
        }`}>
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <Crown size={120} />
          </div>
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm border border-white/20 mb-2">
                <Sparkles size={10} className="text-amber-300" />
                {isConsultant ? 'Partner Tiers' : 'Care Plans'}
              </span>
              <h2 className="text-lg font-black tracking-tight text-white leading-tight">
                {isConsultant ? 'Grow Your Practice' : 'Unlock Priority Care'}
              </h2>
              <p className="text-[10px] text-white/80 mt-1 font-medium max-w-[280px]">
                {isConsultant 
                  ? 'Upgrade for priority referrals and lower platform commissions.' 
                  : 'Upgrade for priority matching and exclusive session perks.'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Notifications */}
          {(errorMessage || successMessage) && (
            <div className={`p-2.5 rounded-lg text-[10px] font-bold flex items-center gap-2 ${
              errorMessage ? 'bg-rose-50 border border-rose-100 text-rose-800' : 'bg-emerald-50 border border-emerald-100 text-emerald-800'
            }`}>
              {errorMessage ? <AlertCircle size={14} className="shrink-0" /> : <Check size={14} className="shrink-0" />}
              <span>{errorMessage || successMessage}</span>
            </div>
          )}

          {/* Current Active Plan Pill */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center">
                {isConsultant ? <Award size={16} /> : <Zap size={16} />}
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Current Plan</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-slate-800">
                    {plans.find(p => p.id === currentTier)?.name || 'Standard'}
                  </span>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isCurrentlyActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isCurrentlyActive ? 'ACTIVE' : 'FREE'}
                  </span>
                </div>
              </div>
            </div>

            {user.subscriptionExpiresAt && (
              <div className="text-right">
                <span className="text-slate-400 font-bold block text-[8px] uppercase">Expires</span>
                <span className="text-[10px] font-bold text-slate-700">
                  {new Date(user.subscriptionExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Plan Comparison Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plans.map((plan) => {
              const isSelected = currentTier === plan.id;
              const isPaid = plan.priceGHS > 0;

              return (
                <div 
                  key={plan.id}
                  className={`rounded-xl p-4 flex flex-col justify-between border transition-all relative ${
                    plan.popular
                      ? 'border-indigo-500 bg-indigo-50/20 shadow-sm'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {plan.badgeText && (
                    <div className="absolute -top-2 right-4 bg-emerald-600 text-white font-bold text-[7px] px-1.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                      {plan.badgeText}
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-black text-slate-900">{plan.name}</h3>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5 leading-tight">{plan.tagline}</p>

                    <div className="my-3 flex items-baseline gap-1">
                      <span className="text-xl font-black text-slate-900">GHS {plan.priceGHS}</span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {plan.billingCycle === 'monthly' ? '/mo' : 'free'}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[9px]">
                          <Check size={10} className={`shrink-0 mt-0.5 ${feat.included ? 'text-emerald-500' : 'text-slate-300'}`} />
                          <span className={`font-medium leading-tight ${feat.included ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                            {feat.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {isSelected ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="w-full py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-[9px] flex items-center justify-center gap-1 uppercase tracking-wider">
                          <Check size={12} /> Active
                        </div>
                        {isPaid && user.subscriptionAutoRenew && (
                          <button
                            type="button"
                            onClick={handleCancelSubscription}
                            disabled={isProcessing}
                            className="text-[8px] font-bold text-slate-400 hover:text-rose-500 text-center underline transition-colors cursor-pointer"
                          >
                            Cancel Auto-Renew
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan)}
                        disabled={isProcessing}
                        className={`w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                          plan.popular
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-white'
                        }`}
                      >
                        {isProcessing && selectedTier === plan.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isPaid ? (
                          <>
                            <CreditCard size={12} />
                            Upgrade (GHS {plan.priceGHS})
                          </>
                        ) : (
                          <>Switch</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auto-Renewal Consent */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="mainAutoRenewConsent"
              checked={autoRenewConsent}
              onChange={(e) => setAutoRenewConsent(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer"
            />
            <label htmlFor="mainAutoRenewConsent" className="text-[9px] text-slate-600 font-medium cursor-pointer leading-normal">
              Automatically renew every month (cancel anytime).
            </label>
          </div>

          {/* Security Note */}
          <div className="p-3 bg-white rounded-xl border border-slate-100 text-[9px] text-slate-400 font-medium flex items-center gap-2.5">
            <ShieldCheck size={14} className="text-slate-300 shrink-0" />
            <span>
              Secure processing via Paystack. Encrypted & instant.
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
