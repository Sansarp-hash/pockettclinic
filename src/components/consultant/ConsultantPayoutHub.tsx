import React, { useState, useEffect } from 'react';
import { Landmark, Wallet, ArrowUpRight, Clock, CheckCircle2, AlertCircle, Phone, Calendar, Download, RefreshCw, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { PayoutRequest } from '../../types';
import { getWithdrawalWindowStatus } from '../PayoutModal';

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
  const windowStatus = getWithdrawalWindowStatus();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Withdrawal Form
  const [amountGHS, setAmountGHS] = useState<number | ''>('');
  const [channelType, setChannelType] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [networkProvider, setNetworkProvider] = useState<'MTN' | 'TELECEL' | 'AT'>('MTN');
  const [payoutNumber, setPayoutNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('');
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
      bankCode: channelType === 'bank_transfer' ? branchCode : null,
      bankName: channelType === 'bank_transfer' ? bankName : null,
      accountNumber: channelType === 'mobile_money' ? payoutNumber : bankAccountNumber,
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
      setSuccessMessage(`Payout request for GHS ${withdrawAmt.toFixed(2)} submitted successfully! Disbursing via ${channelType === 'mobile_money' ? `${networkProvider} Mobile Wallet` : bankName}.`);
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
            <Landmark size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Earnings and Payout
              </h3>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">70% Net Share</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2 max-w-xl font-medium leading-relaxed">
              Manage your clinical earnings and initiate secure disbursements to your preferred Mobile Money wallet or commercial bank account.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={availableBalanceGHS <= 0}
          className="group flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-slate-200 transition-all active:scale-95 shrink-0"
        >
          <ArrowUpRight size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          <span className="uppercase tracking-widest">Initiate Payout</span>
        </button>
      </div>

      {/* Financial Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/60 shadow-sm group hover:border-emerald-200 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tighter ${
              windowStatus.isOpen ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
            }`}>
              <div className={`w-1 h-1 rounded-full ${windowStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              {windowStatus.isOpen ? 'Window Open' : 'Batched'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-6 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
            <RefreshCw size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Gross Billed</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-slate-400">GHS</span>
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {totalGrossGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-tight flex items-center gap-1">
            <ShieldCheck size={12} />
            Verified Billings
          </p>
        </div>

        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/60 shadow-sm group hover:border-emerald-200 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
            <RefreshCw size={24} />
          </div>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em] mb-1">Your Earnings</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-emerald-600">GHS</span>
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {consultant70Earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-tight flex items-center gap-1">
            <ShieldCheck size={12} />
            70% Net Share
          </p>
        </div>

        <div className="bg-white p-7 rounded-[2.5rem] border-2 border-emerald-600 shadow-2xl shadow-emerald-100 group relative overflow-hidden transform hover:scale-[1.02] transition-all duration-500">
          <div className="absolute top-0 right-0 p-5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
            <Wallet size={24} />
          </div>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em] mb-1">Available Now</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-emerald-600">GHS</span>
            <span className="text-4xl font-black text-slate-900 tracking-tighter">
              {availableBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-emerald-700 mt-3 font-black uppercase tracking-tight flex items-center gap-1.5">
            <Sparkles size={14} className="animate-pulse" />
            Ready for withdrawal
          </p>
        </div>

        <div className="bg-slate-50 p-7 rounded-[2.5rem] border border-slate-200/60 shadow-sm group">
          <div className="w-12 h-12 rounded-2xl bg-white text-slate-400 flex items-center justify-center mb-6 group-hover:text-slate-600 transition-all">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Settled to Date</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-slate-400">GHS</span>
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {completedPayoutsSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-tight">
            Successfully Disbursed
          </p>
        </div>
      </div>

      {/* History Table Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Payout History</h4>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">{payouts.length} total records found</p>
            </div>
          </div>
          <button className="text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-widest flex items-center gap-1.5">
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Retrieving logs...</p>
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
              <RefreshCw size={32} />
            </div>
            <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest">No payout history yet</h5>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Once you initiate your first withdrawal, records will appear here for your tracking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference & Date</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination Wallet</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Disbursed Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map(p => (
                  <tr key={p.requestId} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 text-sm tracking-tight">{p.requestId}</div>
                      <div className="text-[11px] text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                        <Calendar size={12} />
                        {new Date(p.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors shadow-sm">
                          {p.channelType === 'mobile_money' ? <Phone size={16} /> : <Landmark size={16} />}
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-xs">
                            {p.channelType === 'mobile_money' ? `${p.networkProvider} MoMo` : p.bankName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">{p.accountNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-400">GHS</span>
                        <span className="text-lg font-black text-slate-900 tracking-tight">{p.amountGHS.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        p.status === 'completed' || p.status === 'processed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : p.status === 'rejected' || p.status === 'failed'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {p.status === 'completed' || p.status === 'processed' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ) : (
                          <RefreshCw size={12} className="animate-spin" />
                        )}
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compliance / Security Note */}
      <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
        <div className="relative z-10 flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-400 shrink-0 border border-white/10">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h4 className="text-lg font-black uppercase tracking-widest">Secure Settlements</h4>
            <p className="text-slate-400 text-sm mt-1 max-w-lg font-medium leading-relaxed">
              All transactions are encrypted and audited. Disbursements are processed via the national payment gateway ensuring real-time settlement for Mobile Money wallets.
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Operational Status</div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-5 py-2.5 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">Gateway Healthy</span>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsWithdrawModalOpen(false)}
          />
          
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 md:p-10 shadow-2xl border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 relative z-10">
            <div className="flex items-center gap-5 mb-8">
              <div className="w-16 h-16 rounded-[1.25rem] bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                <Wallet size={32} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">Request Payout</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available</span>
                  <span className="text-sm font-black text-emerald-600 tracking-tight">GHS {availableBalanceGHS.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {successMessage ? (
              <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
                  <ShieldCheck size={40} />
                </div>
                <h5 className="text-lg font-black text-slate-900 mb-2">Request Successful</h5>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {successMessage}
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestPayout} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Withdrawal Amount</label>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300 group-focus-within:text-emerald-600 transition-colors">GHS</span>
                    <input
                      type="number"
                      required
                      min="10"
                      max={availableBalanceGHS}
                      placeholder="0.00"
                      value={amountGHS}
                      onChange={(e) => setAmountGHS(e.target.value ? Number(e.target.value) : '')}
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Payout Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setChannelType('mobile_money')}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl font-black text-sm tracking-tight border-2 transition-all ${
                        channelType === 'mobile_money'
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]'
                          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <Phone size={18} />
                      Mobile Wallet
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelType('bank_transfer')}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl font-black text-sm tracking-tight border-2 transition-all ${
                        channelType === 'bank_transfer'
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]'
                          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <Landmark size={18} />
                      Bank Transfer
                    </button>
                  </div>
                </div>

                {channelType === 'mobile_money' ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-3 gap-2">
                      {(['MTN', 'TELECEL', 'AT'] as const).map(net => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setNetworkProvider(net)}
                          className={`py-3 rounded-xl font-black text-xs border-2 transition-all ${
                            networkProvider === net
                              ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          {net}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Wallet Number</label>
                      <input
                        type="tel"
                        required
                        placeholder="024 XXX XXXX"
                        value={payoutNumber}
                        onChange={(e) => setPayoutNumber(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Bank Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. GCB Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Account Number</label>
                        <input
                          type="text"
                          required
                          placeholder="Account No."
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Branch Code</label>
                        <input
                          type="text"
                          placeholder="Optional"
                          value={branchCode}
                          onChange={(e) => setBranchCode(e.target.value)}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Beneficiary Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Exact registered name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="pt-6 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 transition-all active:scale-95 text-sm uppercase tracking-widest"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={18} className="animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      'Confirm Disbursement'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="w-full py-4 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] transition-colors"
                  >
                    Dismiss Request
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
