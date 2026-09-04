import React, { useState } from 'react';
import { Ticket, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface VoucherCouponRedemptionInputProps {
  onApplyDiscount: (discountGHS: number, code: string) => void;
}

export default function VoucherCouponRedemptionInput({ onApplyDiscount }: VoucherCouponRedemptionInputProps) {
  const { showToast } = useAppContext();
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    const formatted = code.trim().toUpperCase();
    if (formatted === 'POCKETT20' || formatted === 'HEALTH2026' || formatted.startsWith('CRED-')) {
      const discount = 20; // GHS 20 voucher discount
      setAppliedCode(formatted);
      onApplyDiscount(discount, formatted);
      showToast(`Voucher ${formatted} applied! GHS ${discount} off consultation.`, "success");
    } else {
      showToast("Invalid or expired voucher code.", "error");
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Ticket size={14} className="text-emerald-600" /> Store Credit / Voucher Code
        </label>
        {appliedCode && (
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 size={12} /> GHS 20 Discount Applied
          </span>
        )}
      </div>

      {!appliedCode ? (
        <form onSubmit={handleApply} className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="e.g. POCKETT20 or CRED-88A2"
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 uppercase outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 min-h-[40px]"
          >
            Apply <ArrowRight size={14} />
          </button>
        </form>
      ) : (
        <div className="p-2.5 bg-emerald-100/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
          <span className="font-mono font-bold text-emerald-900">Code: {appliedCode}</span>
          <button
            onClick={() => {
              setAppliedCode(null);
              onApplyDiscount(0, '');
            }}
            className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
