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
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Consultant Earnings & Tax Breakdown</h3>
              <p className="text-[11px] text-slate-400">Financial revenue splits, platform commissions & GRA tax statements</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs text-slate-700">
          {/* Top Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Consultation Fees</span>
              <p className="text-lg font-black text-slate-800 mt-1">GHS {grossVolume.toFixed(2)}</p>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Gross Payout (80%)</span>
              <p className="text-lg font-black text-emerald-700 mt-1">GHS {totalEarned.toFixed(2)}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Platform Split (20%)</span>
              <p className="text-lg font-black text-slate-600 mt-1">GHS {platformFeeTotal.toFixed(2)}</p>
            </div>

            <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Net Take-Home</span>
              <p className="text-lg font-black text-indigo-700 mt-1">GHS {netTakeHome.toFixed(2)}</p>
            </div>
          </div>

          {/* Tax Escrow Notice */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-xs uppercase">Ghana Revenue Authority (GRA) Withholding Tax</h4>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                7.5% estimated withholding tax (GHS {estimatedTaxWithholding.toFixed(2)}) is calculated per session in compliance with Ghana Income Tax guidelines for professional healthcare services.
              </p>
            </div>
          </div>

          {/* Session Breakdown List */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 uppercase text-[11px]">Recent Completed Session Earnings</h4>
            <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {consultations.length === 0 ? (
                <div className="p-4 text-center text-slate-400">No completed consultations recorded yet.</div>
              ) : (
                consultations.map(c => {
                  const gross = Number(c.amountPaidGHS || c.amountGHS || 80);
                  const payout = Number(c.payoutAmountGHS || gross * 0.8);
                  return (
                    <div key={c.id || c.sessionId} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{c.patientName || 'Patient Session'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.sessionId || c.id} • {c.tierDurationMinutes || 15} mins</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 block">+GHS {payout.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">Gross: GHS {gross.toFixed(2)}</span>
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
