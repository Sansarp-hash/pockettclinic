import React, { useState } from 'react';
import { Search, Filter, ShieldCheck, Stethoscope, Star, Calendar, ArrowRight } from 'lucide-react';
import { formatConsultantName } from '../../lib/formatters';
import { CADRE_CONFIGS, normalizeCadre, CadreType } from '../../config/consultantCadreConfig';

interface PublicConsultantDirectoryViewProps {
  consultants: any[];
  onBookConsultant: (consultant: any) => void;
}

export default function PublicConsultantDirectoryView({
  consultants,
  onBookConsultant
}: PublicConsultantDirectoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cadreFilter, setCadreFilter] = useState<string>('ALL');

  const filtered = consultants.filter((c) => {
    const name = (c.fullName || c.name || '').toLowerCase();
    const spec = (c.specialty || c.specialization || '').toLowerCase();
    const matchesQuery = !searchQuery || name.includes(searchQuery.toLowerCase()) || spec.includes(searchQuery.toLowerCase());

    if (cadreFilter === 'ALL') return matchesQuery;
    const cadre = normalizeCadre(c.cadre);
    return matchesQuery && cadre === cadreFilter;
  });

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h3 className="text-xl font-black text-slate-800">Verified Healthcare Consultants</h3>
          <p className="text-xs text-slate-500 mt-1">
            Browse Council-verified Doctors, Pharmacists, Physician Assistants, and Pharmacy Technicians.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name, specialty..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto max-w-full no-scrollbar">
            <button
              onClick={() => setCadreFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${cadreFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              All
            </button>
            <button
              onClick={() => setCadreFilter('DOCTOR')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${cadreFilter === 'DOCTOR' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              Doctors
            </button>
            <button
              onClick={() => setCadreFilter('PHARMACIST')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${cadreFilter === 'PHARMACIST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              Pharmacists
            </button>
            <button
              onClick={() => setCadreFilter('PHYSICIAN_ASSISTANT')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${cadreFilter === 'PHYSICIAN_ASSISTANT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              PAs
            </button>
            <button
              onClick={() => setCadreFilter('PHARM_TECH')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${cadreFilter === 'PHARM_TECH' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              Pharmacy Techs
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Consultant Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id || c.uid} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-emerald-500/50 hover:shadow-lg transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg border border-emerald-200">
                  {(c.fullName || c.name || 'C')[0]}
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base">{formatConsultantName(c.fullName || c.name, c.prefix, c.cadre)}</h4>
                <p className="text-xs text-slate-500 font-medium">{c.specialty || c.specialization || 'General Practice'}</p>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                  {CADRE_CONFIGS[normalizeCadre(c.cadre)]?.label || 'CONSULTANT'}
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                <span>4.9</span>
                <span className="text-slate-400 font-normal ml-1">(48 consultations)</span>
              </div>
            </div>

            <button
              onClick={() => onBookConsultant(c)}
              className="w-full py-3 min-h-[44px] bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              Book Consultation <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
