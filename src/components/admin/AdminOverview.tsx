import React, { useState } from 'react';
import { Users, Search, Filter, ShieldCheck, Award, Eye, Phone, Mail, CheckCircle2, AlertTriangle, Stethoscope, Edit3 } from 'lucide-react';
import { TableSkeleton } from '../Skeleton';
import { formatConsultantName } from '../../lib/formatters';
import { normalizeCadre, CADRE_CONFIGS } from '../../config/consultantCadreConfig';
import AdminUserEditorModal from './AdminUserEditorModal';

export interface AdminOverviewProps {
  consultants: any[];
  isLoadingData: boolean;
  indemnityFilter: 'all' | 'provided' | 'deferred_pending';
  setIndemnityFilter: (filter: 'all' | 'provided' | 'deferred_pending') => void;
  onSelectConsultant?: (consultant: any) => void;
}

export default function AdminOverview({
  consultants,
  isLoadingData,
  indemnityFilter,
  setIndemnityFilter,
  onSelectConsultant
}: AdminOverviewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cadreFilter, setCadreFilter] = useState<'ALL' | 'DOCTOR' | 'SPECIALIST' | 'PHARMACIST' | 'PHYSICIAN_ASSISTANT' | 'PHARM_TECH'>('ALL');
  const [editingConsultant, setEditingConsultant] = useState<any | null>(null);

  const filteredConsultants = consultants.filter((c) => {
    const name = (c.fullName || c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const pin = (c.councilPin || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesQuery = !query || name.includes(query) || email.includes(query) || pin.includes(query);

    const matchesIndemnity =
      indemnityFilter === 'all' ||
      (indemnityFilter === 'provided' && c.indemnityStatus === 'provided') ||
      (indemnityFilter === 'deferred_pending' && c.indemnityStatus !== 'provided');

    const matchesCadre =
      cadreFilter === 'ALL' ||
      (c.cadre || '').toUpperCase() === cadreFilter ||
      (normalizeCadre(c.cadre) === cadreFilter);

    return matchesQuery && matchesIndemnity && matchesCadre;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Stethoscope className="text-slate-600" size={24} />
            <h3 className="text-xl font-bold">Registered Healthcare Consultants</h3>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Directory of licensed Doctors, Specialists, Pharmacists, Physician Assistants, and Pharmacy Technicians.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search consultant or PIN..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 outline-none focus:border-slate-300 font-medium shadow-md shadow-slate-200/50 hover:shadow-lg transition-shadow duration-300 border border-slate-200"
          />
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Filter size={14} /> Cadre:
          </span>
          {(['ALL', 'DOCTOR', 'SPECIALIST', 'PHARMACIST', 'PHYSICIAN_ASSISTANT', 'PHARM_TECH'] as const).map((cadre) => (
            <button
              key={cadre}
              onClick={() => setCadreFilter(cadre)}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                cadreFilter === cadre
                  ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-all duration-300'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {cadre === 'PHARM_TECH' ? 'Pharmacy Technician' : cadre === 'SPECIALIST' ? 'Specialist' : cadre === 'PHYSICIAN_ASSISTANT' ? 'Physician Assistant' : cadre.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 uppercase tracking-wider">Indemnity:</span>
          <select
            value={indemnityFilter}
            onChange={(e) => setIndemnityFilter(e.target.value as any)}
            className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-md shadow-slate-200/50 hover:shadow-lg transition-shadow duration-300 border border-slate-200"
          >
            <option value="all">All Records</option>
            <option value="provided">Active Policy Provided</option>
            <option value="deferred_pending">Personal Waiver Signed</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      {isLoadingData ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filteredConsultants.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs">
          <Users size={32} className="mx-auto mb-2 opacity-40 text-slate-500" />
          No healthcare consultants found matching your filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Consultant</th>
                <th className="py-3.5 px-4">Cadre & Speciality</th>
                <th className="py-3.5 px-4">Council PIN</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4">Indemnity</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredConsultants.map((c) => (
                <tr key={c.id || c.uid} className="hover:bg-white/80 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-indigo-100 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0">
                        <img
                          src={c.profilePhotoUrl || c.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${c.id}&backgroundColor=f8fafc`}
                          alt={c.fullName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{formatConsultantName(c.fullName || c.name, c.prefix)}</p>
                        <p className="text-[11px] text-slate-500">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-slate-800">{CADRE_CONFIGS[normalizeCadre(c.cadre)].label}</span>
                    <p className="text-[10px] text-slate-500">{c.specialty || 'General Practice'}</p>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-slate-800">
                    {c.councilPin || 'Pending'}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      c.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.isVerified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {c.isVerified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      c.indemnityStatus === 'provided' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white text-slate-600'
                    }`}>
                      {c.indemnityStatus === 'provided' ? 'Policy Uploaded' : 'Waiver Active'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingConsultant(c)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={13} /> Edit Profile
                    </button>
                    <button
                      onClick={() => onSelectConsultant && onSelectConsultant(c)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={13} /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin User Editor Modal */}
      {editingConsultant && (
        <AdminUserEditorModal
          user={editingConsultant}
          isOpen={!!editingConsultant}
          onClose={() => setEditingConsultant(null)}
        />
      )}
    </div>
  );
}
