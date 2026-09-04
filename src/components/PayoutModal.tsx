import React, { useState } from 'react';
import { X, Building2, Smartphone, AlertCircle, CheckCircle2, Clock, ShieldAlert, ArrowUpRight, Loader2, Landmark, Wallet } from 'lucide-react';
import { auth } from '../firebase';
import { useAppContext } from '../AppContext';
import { PayoutRequest } from '../types';

interface PayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceGHS: number;
  totalEarningsGHS: number;
  pastPayoutRequests: PayoutRequest[];
  onSuccess?: () => void;
}

export const GHANA_BANKS = [
  { code: 'GCB', name: 'GCB Bank Plc' },
  { code: 'ECOBANK', name: 'Ecobank Ghana' },
  { code: 'STANBIC', name: 'Stanbic Bank Ghana' },
  { code: 'FIDELITY', name: 'Fidelity Bank Ghana' },
  { code: 'ABSA', name: 'Absa Bank Ghana' },
  { code: 'CALBANK', name: 'CalBank Plc' },
  { code: 'ACCESS', name: 'Access Bank Ghana' },
  { code: 'ZENITH', name: 'Zenith Bank Ghana' },
  { code: 'CBG', name: 'Consolidated Bank Ghana (CBG)' },
  { code: 'REPUBLIC', name: 'Republic Bank Ghana' },
  { code: 'FNB', name: 'First National Bank Ghana' },
  { code: 'SG', name: 'Société Générale Ghana' },
  { code: 'UBA', name: 'United Bank for Africa (UBA)' },
  { code: 'PRUDENTIAL', name: 'Prudential Bank Ghana' },
];

export function getWithdrawalWindowStatus() {
  const now = new Date();
  // Get day of week in GMT / UTC
  const dayNum = now.getUTCDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  const isOpen = dayNum >= 1 && dayNum <= 3; // Mon - Wed

  let requestDayOfWeek: "Monday" | "Tuesday" | "Wednesday" | null = null;
  if (dayNum === 1) requestDayOfWeek = "Monday";
  else if (dayNum === 2) requestDayOfWeek = "Tuesday";
  else if (dayNum === 3) requestDayOfWeek = "Wednesday";

  return {
    isOpen,
    requestDayOfWeek,
    dayNum,
    message: "Withdrawal requests are open every Monday to Wednesday. Requests submitted during this window are batched and disbursed accordingly."
  };
}

export default function PayoutModal({
  isOpen,
  onClose,
  availableBalanceGHS,
  totalEarningsGHS,
  pastPayoutRequests,
  onSuccess
}: PayoutModalProps) {
  const { user } = useAppContext();
  const windowStatus = getWithdrawalWindowStatus();

  const [channelType, setChannelType] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [networkProvider, setNetworkProvider] = useState<'MTN' | 'TELECEL' | 'AT'>('MTN');
  const [selectedBankCode, setSelectedBankCode] = useState<string>('GCB');
  
  const [accountNumber, setAccountNumber] = useState(user?.phone || '');
  const [accountName, setAccountName] = useState(user?.fullName || user?.displayName || '');
  const [amountGHS, setAmountGHS] = useState<number | ''>(availableBalanceGHS >= 50 ? availableBalanceGHS : 50);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agreedToFees, setAgreedToFees] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBalanceLocked = availableBalanceGHS < 50;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user) {
      setErrorMessage("You must be logged in as a consultant to request a payout.");
      return;
    }

    if (!windowStatus.isOpen) {
      setErrorMessage(windowStatus.message);
      return;
    }

    if (isBalanceLocked) {
      setErrorMessage("System Reserve Lock: Minimum available balance required for payout is GHS 50.00.");
      return;
    }

    const numAmount = Number(amountGHS);
    if (!numAmount || isNaN(numAmount) || numAmount < 50) {
      setErrorMessage("Minimum single withdrawal amount is GHS 50.00.");
      return;
    }

    if (numAmount > availableBalanceGHS) {
      setErrorMessage(`Withdrawal amount cannot exceed available balance of GHS ${availableBalanceGHS.toFixed(2)}.`);
      return;
    }

    if (!accountNumber.trim()) {
      setErrorMessage("Please enter a valid account or mobile money phone number.");
      return;
    }

    if (!accountName.trim()) {
      setErrorMessage("Please enter the account holder name for verification.");
      return;
    }

    let bankNameStr: string | null = null;
    let bankCodeStr: string | null = null;
    let networkStr: "MTN" | "TELECEL" | "AT" | null = null;

    if (channelType === 'bank_transfer') {
      const bankObj = GHANA_BANKS.find(b => b.code === selectedBankCode);
      if (!bankObj) {
        setErrorMessage("Please select a valid commercial bank.");
        return;
      }
      bankCodeStr = bankObj.code;
      bankNameStr = bankObj.name;
    } else {
      networkStr = networkProvider;
    }

    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const newRequestData: Partial<PayoutRequest> = {
        consultantId: user.uid,
        consultantName: user.fullName || user.displayName || 'Consultant',
        amountGHS: numAmount,
        channelType,
        networkProvider: networkStr,
        bankCode: bankCodeStr,
        bankName: bankNameStr,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        status: 'processing',
        requestDayOfWeek: windowStatus.requestDayOfWeek || 'Monday',
        requestedAt: new Date().toISOString(),
        settledAt: null,
        feeAgreementAccepted: true,
        feeAgreementAcceptedAt: new Date().toISOString()
      };

      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ requestData: newRequestData })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit payout request");
      }

      setSuccessMessage(`Payout request for GHS ${numAmount.toFixed(2)} submitted successfully! Processing via ${channelType === 'mobile_money' ? networkStr : bankNameStr}.`);
      if (onSuccess) onSuccess();
      
      // Reset form or auto close after brief delay
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2200);

    } catch (err: any) {
      console.error("Payout request error:", err);
      setErrorMessage(err.message || "Failed to submit payout request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-50 p-4 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 bg-white text-slate-600 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 border border-slate-300/30 flex items-center justify-center text-slate-600 shadow-inner">
              <Landmark size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-600">Consultant Payout & Withdrawal</h3>
              <p className="text-xs text-slate-500 mt-0.5">Disburse earned consultation fees to MoMo or Commercial Bank</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-500 hover:text-slate-600 flex items-center justify-center transition-colors relative z-10 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 md:p-8 space-y-6">

          {/* Balance & Threshold Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Available Wallet Balance</p>
                <p className="text-3xl font-black tracking-tight text-slate-800 mt-0.5">GHS {availableBalanceGHS.toFixed(2)}</p>
              </div>
              <Wallet size={28} className="text-emerald-600" />
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Gross 70% Cumulative</p>
                <p className="text-3xl font-black tracking-tight text-slate-800 mt-0.5">GHS {totalEarningsGHS.toFixed(2)}</p>
              </div>
              <ArrowUpRight size={28} className="text-slate-600" />
            </div>
          </div>

          {/* Weekly Window Enforcement Banner */}
          {!windowStatus.isOpen ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-3">
              <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">Weekly Withdrawal Window Closed</p>
                <p className="text-xs text-amber-800/90 leading-relaxed mt-1">
                  {windowStatus.message}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-800">
                Withdrawal Window Active ({windowStatus.requestDayOfWeek} GMT) — Requests submitted now will be batched and disbursed.
              </p>
            </div>
          )}

          {/* Balance Lock Warning */}
          {isBalanceLocked && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
              <ShieldAlert size={18} className="text-rose-600 shrink-0" />
              <p className="text-xs font-bold text-rose-800">
                System Reserve Lock: Available wallet balance must be at least GHS 50.00 to initiate a withdrawal.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Withdrawal Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Payout Channel Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Select Payout Channel *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setChannelType('mobile_money')}
                  className={`p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    channelType === 'mobile_money'
                      ? 'bg-emerald-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-white'
                  }`}
                >
                  <Smartphone size={16} />
                  <span>Mobile Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChannelType('bank_transfer')}
                  className={`p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    channelType === 'bank_transfer'
                      ? 'bg-emerald-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-white'
                  }`}
                >
                  <Building2 size={16} />
                  <span>Bank Transfer (GHIPSS)</span>
                </button>
              </div>
            </div>

            {/* Mobile Money Options */}
            {channelType === 'mobile_money' && (
              <div className="space-y-4 bg-white/70 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">MoMo Network Provider *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'MTN', name: 'MTN MoMo' },
                      { id: 'TELECEL', name: 'Telecel Cash' },
                      { id: 'AT', name: 'AT Money' },
                    ].map(net => (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => setNetworkProvider(net.id as any)}
                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          networkProvider === net.id 
                            ? 'ring-2 ring-lime-300 border-indigo-600 bg-white font-extrabold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {net.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase mb-1">MoMo Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                      placeholder="e.g. 0241234567"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase mb-1">Registered Account Name *</label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                      placeholder="e.g. Dr. Kwame Mensah"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bank Transfer Options */}
            {channelType === 'bank_transfer' && (
              <div className="space-y-4 bg-white/70 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Commercial Bank (Ghana) *</label>
                  <select
                    value={selectedBankCode}
                    onChange={e => setSelectedBankCode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {GHANA_BANKS.map(bank => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase mb-1">Bank Account Number *</label>
                    <input
                      type="text"
                      required
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                      placeholder="e.g. 1011009823019"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase mb-1">Account Holder Name *</label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                      placeholder="e.g. Dr. Kwame Mensah"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Withdrawal Amount (GHS) *</label>
                <span className="text-xs text-slate-600 font-bold">Min: GHS 50.00</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">GHS</span>
                <input
                  type="number"
                  min={50}
                  step="0.01"
                  max={availableBalanceGHS}
                  required
                  value={amountGHS}
                  onChange={e => setAmountGHS(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-14 pr-24 py-3 rounded-2xl bg-white border border-slate-200 text-lg font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setAmountGHS(availableBalanceGHS)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-200 hover:bg-slate-200 text-slate-600 text-xs font-extrabold rounded-lg transition-colors cursor-pointer"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Fee Breakdown & Agreement */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Requested Amount:</span>
                <span className="font-bold text-slate-800">GHS {Number(amountGHS || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Estimated Gateway Fee (1.5%):</span>
                <span className="font-bold text-rose-600">- GHS {(Number(amountGHS || 0) * 0.015).toFixed(2)}</span>
              </div>
              <div className="h-px w-full bg-slate-50 my-1" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-800">Net Payout Total:</span>
                <span className="font-black text-emerald-600">GHS {(Number(amountGHS || 0) * 0.985).toFixed(2)}</span>
              </div>
              
              <label className="flex items-start gap-3 mt-4 pt-3 border-t border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agreedToFees}
                  onChange={(e) => setAgreedToFees(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-slate-600 rounded-xs border-slate-300 focus:ring-emerald-500/20 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-800 leading-tight">
                  I agree to the deduction of applicable processing fees for this payout transfer.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-800 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !windowStatus.isOpen || isBalanceLocked || !agreedToFees}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-slate-600 py-4 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <span>Submit Payout Request</span>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Past Payout History */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Recent Withdrawal Requests</h4>
            {pastPayoutRequests.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No previous withdrawal requests found.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {pastPayoutRequests.map((req, idx) => (
                  <div key={req.requestId || idx} className="p-3 rounded-xl bg-white border border-slate-200/60 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800">GHS {req.amountGHS.toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-50/60 px-2 py-0.5 rounded-full uppercase">
                          {req.channelType === 'mobile_money' ? req.networkProvider : req.bankCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {new Date(req.requestedAt).toLocaleDateString()} • {req.accountNumber} ({req.accountName})
                      </p>
                    </div>

                    <div>
                      {req.status === 'processing' && (
                        <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wide flex items-center gap-1">
                          <Clock size={10} /> Processing
                        </span>
                      )}
                      {(req.status === 'completed' || req.status === 'processed') && (
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 size={10} /> Completed
                        </span>
                      )}
                      {(req.status === 'failed' || req.status === 'rejected') && (
                        <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wide flex items-center gap-1">
                          <AlertCircle size={10} /> Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
