import React, { useState } from 'react';
import { X, ShieldCheck, Stethoscope, Pill, AlertCircle, CreditCard, Smartphone, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ConsultationSession } from '../types';
import { useAppContext } from '../AppContext';

interface ReferralPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultation: ConsultationSession;
}

export default function ReferralPaymentModal({
  isOpen,
  onClose,
  consultation
}: ReferralPaymentModalProps) {
  const { showConfirm } = useAppContext();
  const [step, setStep] = useState<'decision' | 'payment' | 'success'>('decision');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card'>('momo');
  const [momoProvider, setMomoProvider] = useState<string>('MTN Mobile Money');
  const [momoNumber, setMomoNumber] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !consultation || consultation.referralState !== 'PROPOSED') return null;

  const targetCategory = consultation.referralTargetCategory || 'UNASSIGNED';
  const feeGHS = consultation.referralFeeGHS || (targetCategory === 'DOCTOR' ? 30 : 20);
  const isDoctor = targetCategory === 'DOCTOR';

  const handleDecline = async () => {
    showConfirm({
      title: "Decline Referral",
      message: "Are you sure you want to decline this consultant referral? Your current consultation will remain unchanged.",
      type: 'warning',
      onConfirm: async () => {
        setIsProcessing(true);
        setErrorMsg(null);

        try {
          const consRef = doc(db, 'consultations', consultation.sessionId);
          await updateDoc(consRef, {
            referralState: 'DECLINED'
          });

          const messagesRef = collection(db, 'consultations', consultation.sessionId, 'messages');
          await addDoc(messagesRef, {
            senderId: 'system',
            senderName: 'System Notice',
            senderRole: 'system',
            text: `❌ [Referral Declined] Patient chose not to proceed with the proposed referral to a ${isDoctor ? 'Doctor' : 'Pharmacist'}.`,
            timestamp: new Date().toISOString()
          }).catch(() => {});

          onClose();
        } catch (err: any) {
          console.error("Error declining referral:", err);
          setErrorMsg("Failed to decline referral. Please try again.");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handleCompletePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'momo' && !momoNumber.trim()) {
      setErrorMsg("Please enter your Mobile Money phone number.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Real payment integration would be triggered here (e.g. Paystack / MoMo API)

      const consRef = doc(db, 'consultations', consultation.sessionId);
      const newTotalPaid = (consultation.amountPaidGHS || 0) + feeGHS;

      // Update consultation document to BROADCASTING state
      await updateDoc(consRef, {
        referralState: 'BROADCASTING',
        cadreNeeded: targetCategory,
        dispatchStatus: 'ringing',
        status: 'PAID',
        ringingStartedAt: Date.now(),
        ringingExpiresAt: Date.now() + 120000, // 2-minute ringing timeout for target pool
        amountPaidGHS: newTotalPaid,
        isReferralToDoctor: isDoctor,
        isReferralToPharmacist: !isDoctor,
        declinedBy: [], // Reset declines so available specialists in pool receive the call
        isOnHold: false,
        holdReason: null
      });

      // Post system message
      const messagesRef = collection(db, 'consultations', consultation.sessionId, 'messages');
      await addDoc(messagesRef, {
        senderId: 'system',
        senderName: 'System Notice',
        senderRole: 'system',
        text: `✅ [Referral Payment Confirmed] Patient accepted referral and completed GHS ${feeGHS} top-up payment.\n• Dispatch Status: Ringing available online ${isDoctor ? 'Doctors' : 'Pharmacists'}.\n• Searching for online specialist...`,
        timestamp: new Date().toISOString()
      }).catch(() => {});

      setStep('success');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Error completing payment top-up:", err);
      setErrorMsg(err?.message || "Payment top-up failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-slate-600 shadow-md ${
              isDoctor ? 'bg-emerald-600 shadow-indigo-600/20' : 'bg-teal-600 shadow-teal-600/20'
            }`}>
              {isDoctor ? <Stethoscope size={20} /> : <Pill size={20} />}
            </div>
            <div>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                Action Required
              </span>
              <h3 className="text-lg font-extrabold text-slate-800">Inter-Consultant Referral</h3>
            </div>
          </div>
          {step === 'decision' && (
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="w-8 h-8 rounded-full bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Referral Decision */}
        {step === 'decision' && (
          <div className="mt-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Referring Consultant:</span>
                <span className="text-slate-800 font-extrabold">{consultation.referralProposedByName || 'Primary Consultant'}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Recommended Specialist:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                  isDoctor ? 'bg-slate-200 text-slate-600' : 'bg-teal-100 text-teal-800'
                }`}>
                  {isDoctor ? 'Doctor' : 'Pharmacist'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Clinical Rationale</span>
                <p className="text-xs text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200 shadow-inner italic">
                  &quot;{consultation.referralNote || 'Consultant has recommended a specialist review.'}&quot;
                </p>
              </div>
            </div>

            {/* Fee Top-Up Card */}
            <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">Required Top-Up Fee</span>
                <p className="text-3xl font-black tracking-tight text-slate-800 mt-0.5">
                  GHS {feeGHS}.00
                </p>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Covers full live consultation with {isDoctor ? 'Doctor' : 'Pharmacist'} pool
                </p>
              </div>
              <div className="w-12 h-12 bg-white rounded-2xl border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0">
                <ShieldCheck size={24} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleDecline}
                disabled={isProcessing}
                className="py-3.5 px-4 rounded-xl border-slate-100 border-slate-200 hover:bg-white text-slate-800 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center cursor-pointer"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : "Decline"}
              </button>
              <button
                type="button"
                onClick={() => setStep('payment')}
                disabled={isProcessing}
                className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Accept & Pay GHS {feeGHS}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Payment Gateway */}
        {step === 'payment' && (
          <form onSubmit={handleCompletePayment} className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('decision')}
                disabled={isProcessing}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Details
              </button>
              <span className="text-xs font-extrabold text-slate-600">Step 2 of 2: Payment Settlement</span>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                Select Payment Channel
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('momo')}
                  className={`p-3.5 rounded-2xl border-slate-100 text-left flex items-center gap-3 transition-all cursor-pointer ${
                    paymentMethod === 'momo'
                      ? 'border-indigo-600 bg-slate-50/50 text-slate-600 font-bold'
                      : 'border-slate-200 text-slate-600 font-medium hover:border-slate-300'
                  }`}
                >
                  <Smartphone size={20} className={paymentMethod === 'momo' ? 'text-slate-600' : 'text-slate-500'} />
                  <span className="text-xs">Mobile Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3.5 rounded-2xl border-slate-100 text-left flex items-center gap-3 transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-indigo-600 bg-slate-50/50 text-slate-600 font-bold'
                      : 'border-slate-200 text-slate-600 font-medium hover:border-slate-300'
                  }`}
                >
                  <CreditCard size={20} className={paymentMethod === 'card' ? 'text-slate-600' : 'text-slate-500'} />
                  <span className="text-xs">Debit/Credit Card</span>
                </button>
              </div>
            </div>

            {/* MoMo Details */}
            {paymentMethod === 'momo' ? (
              <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    Network Provider
                  </label>
                  <select
                    value={momoProvider}
                    onChange={(e) => setMomoProvider(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Telecel Cash">Telecel Cash (Vodafone)</option>
                    <option value="AirtelTigo Money">AirtelTigo Money</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    Mobile Money Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0244123456"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    A payment prompt will be sent to your mobile money wallet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Paystack Secure Gateway</span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Encrypted</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Clicking below will authorize GHS {feeGHS}.00 via Paystack secure card payment.
                </p>
              </div>
            )}

            {/* Total Summary */}
            <div className="flex items-center justify-between py-3 border-t border-b border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Total Top-Up Due:</span>
              <span className="font-black text-slate-600 text-base">GHS {feeGHS}.00</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-slate-600 font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing Payment Top-Up...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Authorize Payment & Broadcast Request
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: Success State */}
        {step === 'success' && (
          <div className="py-8 text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-slate-100 border-emerald-300 text-emerald-600 mx-auto flex items-center justify-center shadow-md">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-800">Payment Confirmed!</h4>
              <p className="text-xs text-slate-600 font-medium mt-1 max-w-xs mx-auto">
                Referral request is now broadcasting to available online {isDoctor ? 'Doctors' : 'Pharmacists'}.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
