import React, { useState } from 'react';
import { Users, Search, User, Eye, Phone, Mail, CreditCard, HeartPulse, ShieldCheck, Edit3 } from 'lucide-react';
import { TableSkeleton } from '../Skeleton';
import AdminUserEditorModal from './AdminUserEditorModal';

export interface AdminPatientManagerProps {
  patients: any[];
  isLoading: boolean;
  onSelectPatient?: (patient: any) => void;
}

export default function AdminPatientManager({
  patients,
  isLoading,
  onSelectPatient
}: AdminPatientManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPatient, setEditingPatient] = useState<any | null>(null);

  const filteredPatients = patients.filter((p) => {
    const name = (p.fullName || p.name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    const phone = (p.phone || p.phoneNumber || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    return !query || name.includes(query) || email.includes(query) || phone.includes(query);
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="text-emerald-400" size={24} />
            <h3 className="text-xl font-bold">Patient Accounts & Medical Records</h3>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Registered patient profiles, clinical history index, and electronic triage summaries.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, email, phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 outline-none focus:border-emerald-500 font-medium"
          />
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filteredPatients.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs">
          <Users size={32} className="mx-auto mb-2 opacity-40 text-slate-500" />
          No patient records found matching your search.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Patient</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">National ID (Ghana Card)</th>
                <th className="py-3.5 px-4">Wallet Balance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredPatients.map((p) => (
                <tr key={p.id || p.uid} className="hover:bg-white/80 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold overflow-hidden shrink-0">
                        <img
                          src={p.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${p.id}&backgroundColor=f8fafc`}
                          alt={p.fullName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{p.fullName || 'Anonymous Patient'}</p>
                        <p className="text-[11px] text-slate-500">UID: {(p.id || p.uid || '').slice(0, 10)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-medium text-slate-800">{p.email || 'No email'}</p>
                    <p className="text-[11px] text-slate-500">{p.phone || p.phoneNumber || 'No phone'}</p>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-slate-800">
                    {p.ghanaCardNumber || 'Unlinked'}
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-mono font-bold text-slate-800">
                      GHS {Number(p.walletBalanceGHS || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      <ShieldCheck size={12} /> Active
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingPatient(p)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={13} /> Edit Profile
                    </button>
                    <button
                      onClick={() => onSelectPatient && onSelectPatient(p)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={13} /> View Portal
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin User Editor Modal */}
      {editingPatient && (
        <AdminUserEditorModal
          user={editingPatient}
          isOpen={!!editingPatient}
          onClose={() => setEditingPatient(null)}
        />
      )}
    </div>
  );
}
