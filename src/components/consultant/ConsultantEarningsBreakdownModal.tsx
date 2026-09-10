import React from 'react';
import { DollarSign, X, CreditCard, ArrowUpRight, Award, ShieldAlert, Download } from 'lucide-react';
import { formatConsultantName } from '../../lib/formatters';

interface ConsultantEarningsBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultations: any[];
  user: any;
}

export default function ConsultantEarningsBreakdownModal({
  isOpen,
  onClose,
  consultations,
  user
}: ConsultantEarningsBreakdownModalProps) {
  if (!isOpen) return null;

  const grossVolume = consultations.reduce((acc, c) => acc + (Number(c.amountPaidGHS || c.amountGHS || 80)), 0);
  const totalEarned = consultations.reduce((acc, c) => acc + (Number(c.payoutAmountGHS) || (Number(c.amountPaidGHS || 80) * 0.8)), 0);
  const platformFeeTotal = grossVolume - totalEarned;
  const estimatedTaxWithholding = totalEarned * 0.075; // 7.5% GRA withholding tax
  const netTakeHome = totalEarned - estimatedTaxWithholding;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-tight">Earnings & Tax Breakdown</h3>
              <p className="text-[9px] text-slate-400 font-medium">Financial revenue splits & GRA tax statements</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Top Metric Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Gross Fees</span>
              <p className="text-sm font-black text-slate-900 mt-0.5 tracking-tight">GHS {grossVolume.toFixed(2)}</p>
            </div>

            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">Gross Payout (80%)</span>
              <p className="text-sm font-black text-emerald-700 mt-0.5 tracking-tight">GHS {totalEarned.toFixed(2)}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Platform Split (20%)</span>
              <p className="text-sm font-black text-slate-600 mt-0.5 tracking-tight">GHS {platformFeeTotal.toFixed(2)}</p>
            </div>

            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <span className="text-[9px] font-bold text-indigo-800 uppercase tracking-wider block">Net Take-Home</span>
              <p className="text-sm font-black text-indigo-700 mt-0.5 tracking-tight">GHS {netTakeHome.toFixed(2)}</p>
            </div>
          </div>

          {/* Tax Escrow Notice */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-2.5">
            <ShieldAlert size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-[10px] uppercase tracking-tight">GRA Withholding Tax</h4>
              <p className="text-[9px] text-amber-800 mt-0.5 leading-normal font-medium">
                7.5% estimated withholding tax (GHS {estimatedTaxWithholding.toFixed(2)}) is calculated per session in compliance with Ghana Income Tax guidelines.
              </p>
            </div>
          </div>

          {/* Session Breakdown List */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 uppercase text-[9px] tracking-widest pl-1">Recent Session Earnings</h4>
            <div className="max-h-[160px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {consultations.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-[10px] font-medium">No completed consultations.</div>
              ) : (
                consultations.map(c => {
                  const gross = Number(c.amountPaidGHS || c.amountGHS || 80);
                  const payout = Number(c.payoutAmountGHS || gross * 0.8);
                  return (
                    <div key={c.id || c.sessionId} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-[11px] block leading-tight">{c.patientName || 'Patient Session'}</span>
                        <span className="text-[9px] text-slate-400 font-mono tracking-tighter uppercase">{c.sessionId?.slice(0, 8) || c.id?.slice(0, 8)} • {c.tierDurationMinutes || 15}m</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-600 text-[11px] block">+GHS {payout.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-400 font-medium">Gross: {gross.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
