import React, { useState, useEffect } from 'react';
import { CreditCard, Search, ArrowUpRight, CheckCircle2, Clock, DollarSign, Download, Filter, FileSpreadsheet, Check, X, ShieldAlert, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { formatConsultantName } from '../../lib/formatters';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export interface AdminSettlementLedgerProps {
  consultations: any[];
}

export default function AdminSettlementLedger({
  consultations
}: AdminSettlementLedgerProps) {
  const { showToast } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PROCESSED' | 'PENDING'>('ALL');
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [isProcessingPayout, setIsProcessingPayout] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'payout_requests'));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
      setPayoutRequests(list);
    }, (err) => {
      console.warn("Payout requests listener error:", err);
    });
    return () => unsub();
  }, []);

  const totalPlatformVolume = consultations.reduce((acc, c) => acc + (Number(c.amountPaidGHS || c.amountGHS) || 0), 0);
  const totalConsultantPayouts = consultations.reduce((acc, c) => acc + (Number(c.payoutAmountGHS) || (Number(c.amountPaidGHS || c.amountGHS || 0) * 0.8)), 0);
  const platformNetFee = totalPlatformVolume - totalConsultantPayouts;
  const estimatedTaxWithholding = totalConsultantPayouts * 0.075; // 7.5% GRA withholding tax estimation

  const filtered = consultations.filter((c) => {
    const pName = (c.patientName || '').toLowerCase();
    const cName = (c.consultantName || '').toLowerCase();
    const sId = (c.sessionId || c.id || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesQuery = !query || pName.includes(query) || cName.includes(query) || sId.includes(query);
    const isProcessed = c.ledgerProcessed || c.status === 'COMPLETED';

    if (filterType === 'PROCESSED') return matchesQuery && isProcessed;
    if (filterType === 'PENDING') return matchesQuery && !isProcessed;
    return matchesQuery;
  });

  // Export Financial CSV Statement
  const handleExportCSV = () => {
    const headers = ["Session ID", "Date", "Patient Name", "Consultant Name", "Gross Fee (GHS)", "Consultant Payout (80%)", "Platform Fee (20%)", "Est. Tax Withholding (7.5%)", "Status"];
    const rows = filtered.map(c => {
      const gross = Number(c.amountPaidGHS || c.amountGHS || 80);
      const payout = Number(c.payoutAmountGHS || gross * 0.8);
      const fee = gross - payout;
      const tax = payout * 0.075;
      const dateStr = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : 'Recent';
      return [
        `"${c.sessionId || c.id}"`,
        `"${dateStr}"`,
        `"${c.patientName || 'Patient'}"`,
        `"${c.consultantName || 'Consultant'}"`,
        gross.toFixed(2),
        payout.toFixed(2),
        fee.toFixed(2),
        tax.toFixed(2),
        `"${c.status || 'COMPLETED'}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PockettClinic_Financial_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Financial & Tax Statement CSV generated and downloaded.", "success");
  };

  const handleApprovePayout = async (req: any) => {
    setIsProcessingPayout(req.id);
    try {
      const refId = `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await updateDoc(doc(db, 'payout_requests', req.id), {
        status: 'APPROVED',
        paystackRef: refId,
        processedAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'payout_logs'), {
        requestId: req.id,
        consultantName: req.consultantName,
        amountGHS: req.amountGHS,
        paystackRef: refId,
        approvedAt: serverTimestamp()
      });

      showToast(`Payout of GHS ${req.amountGHS} approved (Ref: ${refId}).`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payout_requests/${req.id}`);
      showToast("Failed to approve payout request.", "error");
    } finally {
      setIsProcessingPayout(null);
    }
  };

  const handleRejectPayout = async (req: any) => {
    setIsProcessingPayout(req.id);
    try {
      await updateDoc(doc(db, 'payout_requests', req.id), {
        status: 'REJECTED',
        rejectedAt: new Date().toISOString()
      });
      showToast(`Payout request of GHS ${req.amountGHS} rejected.`, "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payout_requests/${req.id}`);
      showToast("Failed to reject payout request.", "error");
    } finally {
      setIsProcessingPayout(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Gross Transaction Volume</p>
          <p className="text-3xl font-black tracking-tight text-slate-800 mt-2">GHS {totalPlatformVolume.toFixed(2)}</p>
          <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
            <ArrowUpRight size={14} /> 100% Paystack settled
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Consultant Payout Liability (80%)</p>
          <p className="text-2xl font-black text-slate-600 mt-2">GHS {totalConsultantPayouts.toFixed(2)}</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Disbursed via Mobile Money / GIP</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Platform Retained Commission</p>
          <p className="text-2xl font-black text-emerald-600 mt-2">GHS {platformNetFee.toFixed(2)}</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Net revenue after clinical splits</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Est. Tax Withholding (7.5%)</p>
          <p className="text-2xl font-black text-indigo-600 mt-2">GHS {estimatedTaxWithholding.toFixed(2)}</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Ghana Revenue Authority Tax Escrow</p>
        </div>
      </div>

      {/* Payout Authorizations Banner */}
      {payoutRequests.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <DollarSign className="text-amber-500" size={18} /> Consultant Mobile Money Payout Requests
            </h4>
            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
              {payoutRequests.filter(p => p.status === 'PENDING').length} Pending Requests
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {payoutRequests.map(req => (
              <div key={req.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-800">{req.consultantName || 'Consultant'}</span>
                  <span className="text-emerald-700 font-mono">GHS {Number(req.amountGHS || 0).toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-500">MoMo / Bank: {req.momoNumber || req.bankAccount || 'Default Wallet'}</p>
                <div className="pt-2 flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : req.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {req.status || 'PENDING'}
                  </span>
                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleApprovePayout(req)}
                        disabled={isProcessingPayout === req.id}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {isProcessingPayout === req.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectPayout(req)}
                        disabled={isProcessingPayout === req.id}
                        className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <X size={10} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger Table Header & Export Controls */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden space-y-0">
        <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <CreditCard className="text-emerald-400" size={24} />
              <h3 className="text-xl font-bold">Consultation Financial Settlement Ledger</h3>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Automated 80/20 escrow splits, mobile money disbursements, and referral bonuses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Export Financial & Tax Report (CSV)
            </button>

            <div className="relative min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ledger session..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 outline-none focus:border-emerald-500 font-medium"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Session ID</th>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Consultant</th>
                <th className="py-3.5 px-4">Gross Fee (GHS)</th>
                <th className="py-3.5 px-4">Consultant Payout (80%)</th>
                <th className="py-3.5 px-4">Escrow Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filtered.map((c) => {
                const gross = Number(c.amountPaidGHS || c.amountGHS || 80);
                const payout = Number(c.payoutAmountGHS || gross * 0.8);
                const isProcessed = c.ledgerProcessed || c.status === 'COMPLETED';

                return (
                  <tr key={c.id || c.sessionId} className="hover:bg-white/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-slate-800">
                      {(c.sessionId || c.id || '').slice(0, 12)}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800">
                      {c.patientName || 'Patient'}
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-600">
                      {formatConsultantName(c.consultantName, c.consultantPrefix) || 'Assigned Consultant'}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-slate-800">
                      GHS {gross.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-600">
                      GHS {payout.toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isProcessed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isProcessed ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {isProcessed ? 'Disbursed' : 'Escrow Hold'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
