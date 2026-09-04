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

      setSuccessMessage(`🎉 Welcome to ${plan.name}! Your 30-day subscription is now active${additionalTickets > 0 ? ' + 1 free video consultation ticket credited!' : '.'}`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to save subscription update:", err);
      setErrorMessage(`Payment verification failed: ${err.message || "Profile update failed. Please contact support."}`);
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
        setSuccessMessage(`Switched to ${plan.name} plan.`);
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1200);
      } catch (err: any) {
        console.error("Failed to downgrade plan:", err);
        setErrorMessage("Failed to update subscription. Please try again.");
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
          label: "PockettClinic Subscription Checkout",
          channels: ['card', 'mobile_money'],
          phone: user.phone || '',
          metadata: {
            platform: "PockettClinic",
            business_name: "PockettClinic",
            merchant_name: "PockettClinic",
            custom_fields: [
              { display_name: "Platform", variable_name: "platform_name", value: "PockettClinic" },
              { display_name: "Plan Name", variable_name: "plan_name", value: plan.name },
              { display_name: "User ID", variable_name: "user_id", value: user.uid },
              { display_name: "User Role", variable_name: "user_role", value: user.role }
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
        showToast("Paystack payment gateway is not configured or unavailable.", "error");
      }
    } catch (err: any) {
      console.error("Subscription payment error:", err);
      setErrorMessage(err.message || "Unable to initialize payment checkout.");
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel auto-renewal? You will retain benefits until your current period expires.")) return;
    setIsProcessing(true);
    try {
      await updateUserProfile({
        subscriptionAutoRenew: false,
        subscriptionStatus: 'cancelled'
      });
      setSuccessMessage("Auto-renewal cancelled. Your plan remains active until the expiration date.");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error("Cancellation failed:", err);
      setErrorMessage("Failed to update subscription settings.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white/70 backdrop-blur-md z-[110] flex items-center justify-center p-0 md:p-4 overflow-y-auto">
      <div className="bg-white md:rounded-3xl shadow-2xl max-w-2xl w-full h-full md:h-auto overflow-hidden flex flex-col relative border-none md:border-solid md:border-slate-200 md:my-8">
        
        {/* Decorative Top Banner */}
        <div className={`p-6 md:p-8 text-slate-600 relative overflow-hidden ${
          isConsultant ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900' : 'bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900'
        }`}>
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <Crown size={220} />
          </div>
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-600 text-[11px] font-extrabold uppercase tracking-widest backdrop-blur-md border border-white/20 mb-3">
                <Sparkles size={13} className="text-amber-300" />
                {isConsultant ? 'PockettClinic Partner Tiers' : 'PockettClinic Care Plans'}
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-600">
                {isConsultant ? 'Grow Your Consulting Practice' : 'Unlock Priority Healthcare'}
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1.5 font-medium max-w-md">
                {isConsultant 
                  ? 'Upgrade to Pro Partner for priority referrals, lower platform commissions, and top search placement.' 
                  : 'Upgrade to Care Plus for enhanced wellness support, priority consultant matching, and exclusive session perks.'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-600/70 hover:text-slate-600 bg-white/10 hover:bg-white/20 rounded-full transition-colors shrink-0 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Error / Success Messages */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-start gap-2.5 animate-bounce">
              <Check size={18} className="shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Current Active Plan Pill */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold">
                {isConsultant ? <Award size={20} /> : <Zap size={20} />}
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Your Current Plan</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-extrabold text-slate-800">
                    {plans.find(p => p.id === currentTier)?.name || 'Standard Tier'}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isCurrentlyActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {isCurrentlyActive ? 'ACTIVE' : 'FREE / STANDARD'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {user.subscriptionExpiresAt && (
                <div className="text-right text-xs">
                  <span className="text-slate-500 font-medium block text-[10px]">Renewal / Expiry Date</span>
                  <span className="font-bold text-slate-800">
                    {new Date(user.subscriptionExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Plan Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plans.map((plan) => {
              const isSelected = currentTier === plan.id;
              const isPaid = plan.priceGHS > 0;

              return (
                <div 
                  key={plan.id}
                  className={`rounded-3xl p-6 flex flex-col justify-between border-slate-100 transition-all relative ${
                    plan.popular
                      ? 'border-indigo-600 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-lg'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {plan.badgeText && (
                    <div className="absolute -top-3 right-6 bg-emerald-600 text-white font-extrabold text-[9px] px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                      {plan.badgeText}
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-black text-slate-800">{plan.name}</h3>
                    <p className="text-xs text-slate-600 font-medium mt-1 min-h-[32px]">{plan.tagline}</p>

                    <div className="my-5 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-800">GHS {plan.priceGHS}</span>
                      <span className="text-xs font-bold text-slate-500">
                        {plan.billingCycle === 'monthly' ? '/ month' : ' forever free'}
                      </span>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-200">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            feat.included 
                              ? feat.highlight ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                              : 'bg-white text-slate-500'
                          }`}>
                            <Check size={10} strokeWidth={3} />
                          </div>
                          <span className={`font-medium leading-relaxed ${
                            feat.included 
                              ? feat.highlight ? 'text-slate-800 font-bold' : 'text-slate-800'
                              : 'text-slate-500 line-through'
                          }`}>
                            {feat.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-200">
                    {isSelected ? (
                      <div className="flex flex-col gap-2">
                        <button
                          disabled
                          className="w-full py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-default uppercase tracking-wider"
                        >
                          <Check size={16} /> Current Active Plan
                        </button>
                        {isPaid && user.subscriptionAutoRenew && (
                          <button
                            type="button"
                            onClick={handleCancelSubscription}
                            disabled={isProcessing}
                            className="text-[11px] font-bold text-slate-500 hover:text-rose-600 text-center underline transition-colors cursor-pointer"
                          >
                            Cancel Auto-Renewal
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan)}
                        disabled={isProcessing}
                        className={`w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-95 cursor-pointer ${
                          plan.popular
                            ? 'bg-emerald-600 hover:bg-emerald-600 text-white shadow-indigo-200 shadow-md'
                            : 'bg-white hover:bg-white text-slate-600'
                        }`}
                      >
                        {isProcessing && selectedTier === plan.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : isPaid ? (
                          <>
                            <CreditCard size={15} />
                            Upgrade to {plan.name} (GHS {plan.priceGHS})
                          </>
                        ) : (
                          <>
                            Switch to {plan.name}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auto-Renewal Consent Checkbox */}
          <div className="p-4 bg-slate-50/60 rounded-2xl border border-indigo-100 flex items-start gap-3">
            <input
              type="checkbox"
              id="mainAutoRenewConsent"
              checked={autoRenewConsent}
              onChange={(e) => setAutoRenewConsent(e.target.checked)}
              className="mt-1 w-4 h-4 text-slate-600 rounded border-slate-300 focus:ring-emerald-500/20 cursor-pointer"
            />
            <label htmlFor="mainAutoRenewConsent" className="text-xs text-slate-800 font-medium cursor-pointer leading-relaxed">
              Automatically renew my Care Plus subscription every month using my saved payment method (cancel anytime).
            </label>
          </div>

          {/* Security & Guarantee Note */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 text-[11px] text-slate-600 font-medium flex items-center gap-3">
            <ShieldCheck size={20} className="text-slate-600 shrink-0" />
            <span>
              Secure, instant Mobile Money & Card payment processing via Paystack. Subscriptions can be changed or cancelled at any time from your account settings.
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
