import React, { useState, useEffect } from 'react';
import { Landmark, Wallet, ArrowUpRight, Clock, CheckCircle2, AlertCircle, Phone, Calendar, Download, RefreshCw, ShieldCheck, ChevronRight } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { PayoutRequest } from '../../types';

interface ConsultantPayoutHubProps {
  consultantId: string;
  consultantName: string;
  totalGrossGHS: number;
  consultant70Earnings: number;
}

export default function ConsultantPayoutHub({
  consultantId,
  consultantName,
  totalGrossGHS,
  consultant70Earnings
}: ConsultantPayoutHubProps) {
  const { showToast } = useAppContext();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Withdrawal Form
  const [amountGHS, setAmountGHS] = useState<number | ''>('');
  const [channelType, setChannelType] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [networkProvider, setNetworkProvider] = useState<'MTN' | 'TELECEL' | 'AT'>('MTN');
  const [momoNumber, setMomoNumber] = useState('0244123456');
  const [accountName, setAccountName] = useState(consultantName || 'Consultant');
  const [bankName, setBankName] = useState('GCB Bank');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate settlement balances
  const platformCut30 = totalGrossGHS * 0.3;
  const completedPayoutsSum = payouts
    .filter(p => p.status === 'completed' || p.status === 'processed')
    .reduce((sum, p) => sum + (p.amountGHS || 0), 0);
  
  const pendingPayoutsSum = payouts
    .filter(p => p.status === 'processing')
    .reduce((sum, p) => sum + (p.amountGHS || 0), 0);

  const availableBalanceGHS = Math.max(0, consultant70Earnings - completedPayoutsSum - pendingPayoutsSum);

  useEffect(() => {
    if (!consultantId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'payout_requests'),
      where('consultantId', '==', consultantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PayoutRequest[] = [];
      snapshot.forEach(d => {
        list.push({ requestId: d.id, ...d.data() } as PayoutRequest);
      });
      list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      setPayouts(list);
      setIsLoading(false);
    }, (err) => {
      console.warn("Firestore payout listen error:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [consultantId]);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawAmt = Number(amountGHS);
    if (!withdrawAmt || withdrawAmt <= 0 || withdrawAmt > availableBalanceGHS) {
      showToast(`Please enter a valid amount up to GHS ${availableBalanceGHS.toFixed(2)}`, "error");
      return;
    }

    setIsSubmitting(true);
    const newId = `payout_${Date.now()}`;
    const days: PayoutRequest['requestDayOfWeek'][] = ['Monday', 'Tuesday', 'Wednesday'];
    const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()] as any;

    const newRequest: PayoutRequest = {
      requestId: newId,
      consultantId,
      consultantName,
      amountGHS: withdrawAmt,
      channelType,
      networkProvider: channelType === 'mobile_money' ? networkProvider : null,
      bankCode: null,
      bankName: channelType === 'bank_transfer' ? bankName : null,
      accountNumber: channelType === 'mobile_money' ? momoNumber : bankAccountNumber,
      accountName,
      status: 'processing',
      requestDayOfWeek: days.includes(currentDay) ? currentDay : 'Monday',
      requestedAt: new Date().toISOString(),
      settledAt: null,
      feeAgreementAccepted: true,
      feeAgreementAcceptedAt: new Date().toISOString()
    };

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ requestData: newRequest })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit payout request");
      }

      const result = await response.json();
      const finalRequest = { ...newRequest, requestId: result.requestId || newId };

      setPayouts(prev => [finalRequest, ...prev]);
      setSuccessMessage(`Payout request for GHS ${withdrawAmt.toFixed(2)} submitted successfully! Disbursing via ${channelType === 'mobile_money' ? `${networkProvider} MoMo` : bankName}.`);
      setTimeout(() => {
        setIsWithdrawModalOpen(false);
        setSuccessMessage(null);
        setAmountGHS('');
      }, 2500);
    } catch (err: any) {
      console.error("Payout request error:", err);
      showToast(err.message || "Failed to submit payout request. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0">
            <Landmark size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">
                Consultant Earnings & MoMo Payout Hub
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                70% Guaranteed Take
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Direct Mobile Money disbursement (MTN MoMo, Telecel Cash) and automated settlement tracking.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={availableBalanceGHS <= 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-slate-600 px-5 py-2.5 rounded-2xl text-xs font-black shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <ArrowUpRight size={16} />
          <span>Withdraw to MoMo / Bank</span>
        </button>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Gross Billed (100%)</span>
          <div className="text-xl font-black text-slate-800 mt-1">
            GHS {totalGrossGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-600 font-medium">Total patient consult fees</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Your Net Share (70%)</span>
          <div className="text-xl font-black text-emerald-950 mt-1">
            GHS {consultant70Earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">Consultant contract entitlement</span>
        </div>

        <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200">
          <span className="text-[10px] font-black text-sky-700 uppercase tracking-wider">Available for Payout</span>
          <div className="text-xl font-black text-sky-950 mt-1">
            GHS {availableBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-sky-700 font-medium">Instant transfer eligible</span>
        </div>

        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-300">
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Settled to Date</span>
          <div className="text-xl font-black text-purple-950 mt-1">
            GHS {completedPayoutsSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-600 font-medium">Disbursed to your wallet</span>
        </div>
      </div>

      {/* Payout History Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={14} className="text-slate-600" /> Recent Payout Dispatches
          </h4>
          <span className="text-xs text-slate-500 font-bold">{payouts.length} Records</span>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading payout records...</div>
        ) : payouts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
            No withdrawal requests logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Reference / Date</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map(p => (
                  <tr key={p.requestId || Math.random()} className="hover:bg-white/80">
                    <td className="p-3 font-medium">
                      <div className="font-bold text-slate-800">{p.requestId}</div>
                      <span className="text-[11px] text-slate-500">{new Date(p.requestedAt).toLocaleString()}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">
                        {p.channelType === 'mobile_money' ? `${p.networkProvider} MoMo` : p.bankName}
                      </div>
                      <span className="text-[11px] text-slate-600">{p.accountNumber} ({p.accountName})</span>
                    </td>
                    <td className="p-3 font-black text-slate-800">
                      GHS {p.amountGHS.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        p.status === 'completed' || p.status === 'processed'
                          ? 'bg-emerald-100 text-emerald-800' 
                          : p.status === 'rejected' || p.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status === 'completed' || p.status === 'processed' ? <CheckCircle2 size={11} /> : <RefreshCw size={11} className="animate-spin" />}
                        <span>{p.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Wallet size={22} />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-base">Request Consultant Payout</h4>
                <p className="text-xs text-slate-600">Available Balance: GHS {availableBalanceGHS.toFixed(2)}</p>
              </div>
            </div>

            {successMessage ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 my-4">
                <ShieldCheck size={18} />
                <span>{successMessage}</span>
              </div>
            ) : (
              <form onSubmit={handleRequestPayout} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Withdrawal Amount (GHS) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 font-black text-slate-500">GHS</span>
                    <input
                      type="number"
                      required
                      min="10"
                      max={availableBalanceGHS}
                      placeholder={`Max ${availableBalanceGHS.toFixed(2)}`}
                      value={amountGHS}
                      onChange={(e) => setAmountGHS(e.target.value ? Number(e.target.value) : '')}
                      className="w-full pl-14 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Payout Channel *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChannelType('mobile_money')}
                      className={`p-2.5 rounded-xl font-bold border transition-all ${
                        channelType === 'mobile_money'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Mobile Money (MoMo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelType('bank_transfer')}
                      className={`p-2.5 rounded-xl font-bold border transition-all ${
                        channelType === 'bank_transfer'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Bank Transfer
                    </button>
                  </div>
                </div>

                {channelType === 'mobile_money' ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {(['MTN', 'TELECEL', 'AT'] as const).map(net => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setNetworkProvider(net)}
                          className={`py-2 rounded-xl font-black border text-center transition-all ${
                            networkProvider === net
                              ? 'bg-white text-slate-600 border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          {net}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">MoMo Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="0244 000 000"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Bank Name *</label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="GCB Bank">GCB Bank</option>
                        <option value="Ecobank Ghana">Ecobank Ghana</option>
                        <option value="Stanbic Bank">Stanbic Bank</option>
                        <option value="Absa Bank Ghana">Absa Bank Ghana</option>
                        <option value="Fidelity Bank">Fidelity Bank</option>
                        <option value="CalBank">CalBank</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Account Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1041010000000"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Registered Account Name *</label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
                  >
                    {isSubmitting ? 'Submitting...' : 'Confirm Withdrawal'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
