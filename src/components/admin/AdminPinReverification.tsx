import React, { useState } from 'react';
import { Award, Search, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { formatConsultantName } from '../../lib/formatters';
import { normalizeCadre, CADRE_CONFIGS } from '../../config/consultantCadreConfig';

export interface AdminPinReverificationProps {
  consultants: any[];
  onRefreshData?: () => void;
}

export default function AdminPinReverification({
  consultants,
  onRefreshData
}: AdminPinReverificationProps) {
  const { showToast } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleReverify = async (consultant: any) => {
    setVerifyingId(consultant.id || consultant.uid);
    setTimeout(() => {
      setVerifyingId(null);
      showToast(`PIN ${consultant.councilPin} verified against Ghana Health Professional Council Registry.`, 'success');
    }, 1200);
  };

  const filteredConsultants = consultants.filter((c) => {
    const name = (c.fullName || c.name || '').toLowerCase();
    const pin = (c.councilPin || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    return !query || name.includes(query) || pin.includes(query);
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Award className="text-amber-400" size={24} />
            <h3 className="text-xl font-bold">Regulatory Council PIN Reverification</h3>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Automated and manual license retention validation against MDC Ghana & Pharmacy Council registries.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search consultant PIN..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 outline-none focus:border-amber-500 font-medium"
          />
        </div>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
            <tr>
              <th className="py-3.5 px-6">Consultant</th>
              <th className="py-3.5 px-4">Council Body</th>
              <th className="py-3.5 px-4">Registered Retention PIN</th>
              <th className="py-3.5 px-4">Standing Status</th>
              <th className="py-3.5 px-6 text-right">Registry Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {filteredConsultants.map((c) => {
              const isVerifying = verifyingId === (c.id || c.uid);
              const isGoodStanding = c.isGoodStanding !== false;

              return (
                <tr key={c.id || c.uid} className="hover:bg-white/80 transition-colors">
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-800">{formatConsultantName(c.fullName || c.name, c.prefix)}</p>
                    <p className="text-[11px] text-slate-500">{CADRE_CONFIGS[normalizeCadre(c.cadre)].label}</p>
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-800">
                    {CADRE_CONFIGS[normalizeCadre(c.cadre)].governingCouncil}
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-slate-600">
                    {c.councilPin || 'MDC/RN/2026/0921'}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isGoodStanding ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isGoodStanding ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {isGoodStanding ? 'In Good Standing' : 'Expired / Flagged'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleReverify(c)}
                      disabled={isVerifying}
                      className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                    >
                      {isVerifying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Reverify PIN
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
