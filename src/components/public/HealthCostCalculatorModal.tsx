import React, { useState } from 'react';
import { Calculator, X, DollarSign, Clock, CheckCircle2 } from 'lucide-react';

interface HealthCostCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HealthCostCalculatorModal({ isOpen, onClose }: HealthCostCalculatorModalProps) {
  const [sessionTier, setSessionTier] = useState<15 | 30 | 60>(15);

  if (!isOpen) return null;

  const virtualCost = sessionTier === 15 ? 80 : sessionTier === 30 ? 140 : 220;
  const standardHospitalConsultFee = sessionTier === 15 ? 250 : sessionTier === 30 ? 400 : 650;
  const transportFuelEstimate = 80;
  const totalHospitalCost = standardHospitalConsultFee + transportFuelEstimate;
  const savingsGHS = totalHospitalCost - virtualCost;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Virtual vs Hospital Cost Calculator</h3>
              <p className="text-[11px] text-slate-400">Compare immediate telehealth savings in Ghana</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs text-slate-700">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Select Virtual Consultation Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 60].map(mins => (
                <button
                  key={mins}
                  onClick={() => setSessionTier(mins as any)}
                  className={`py-3 min-h-[44px] rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
                    sessionTier === mins ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {mins} Minutes
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">In-Person Hospital Visit</span>
              <p className="text-xl font-black text-slate-800 mt-1">GHS {totalHospitalCost}</p>
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">Includes GHS {transportFuelEstimate} transport/traffic cost</span>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">PocketsClinic Virtual</span>
              <p className="text-xl font-black text-emerald-700 mt-1">GHS {virtualCost}</p>
              <span className="text-[10px] font-bold text-emerald-800 mt-1 block">Zero transport • Instant call</span>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest block">Your Estimated Instant Savings</span>
            <p className="text-3xl font-black text-indigo-700 mt-1">GHS {savingsGHS} Saved</p>
            <span className="text-[11px] font-semibold text-indigo-900 mt-1 block">+ Saves 3.5 hours waiting room time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
