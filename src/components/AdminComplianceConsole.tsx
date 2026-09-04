import React from 'react';
import { ShieldCheck, Search, Filter, Award, CreditCard, ShieldAlert, CheckCircle2, Clock, AlertCircle, Bell, FileText, Loader2 } from 'lucide-react';
import { TableSkeleton } from '../Skeleton';

export interface AdminComplianceConsoleProps {
  consultants: any[];
  isLoadingData: boolean;
  complianceFilter: 'all' | 'pending' | 'unverified' | 'deferred_pending' | 'verified' | 'flagged_modified';
  setComplianceFilter: (filter: any) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setAuditingConsultant: (consultant: any) => void;
  sendIndemnityReminder: (consultant: any) => void;
  sendingReminderUid: string | null;
}

export default function AdminComplianceConsole({
  consultants,
  isLoadingData,
  complianceFilter,
  setComplianceFilter,
  searchQuery,
  setSearchQuery,
  setAuditingConsultant,
  sendIndemnityReminder,
  sendingReminderUid
}: AdminComplianceConsoleProps) {
  return (
    <div className="bg-white rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 overflow-hidden space-y-0">
      <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" size={24} />
            <h3 className="text-xl font-bold">Consultant Compliance Audit Console</h3>
          </div>
          <p className="text-slate-500 text-xs mt-1">Inspect Ghana Cards, Council License Retention PINs, and Professional Indemnity Policy or Signed Personal Liability Waivers.</p>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Name, PIN, or Ghana Card..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 outline-none focus:border-slate-300 transition-all font-medium"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter size={14} /> Filter:
          </span>
          {[
            { id: 'all', label: `All Consultants (${consultants.length})` },
            { id: 'pending', label: `Manual Review (${consultants.filter(c => c.verificationStatus === 'pending').length})` },
            { id: 'flagged_modified', label: `⚠️ Flagged Modified (${consultants.filter(c => c.verificationPendingReview).length})` },
            { id: 'unverified', label: `Legacy Unverified (${consultants.filter(c => !c.isVerified && c.verificationStatus !== 'pending').length})` },
            { id: 'verified', label: `Verified & Active (${consultants.filter(c => c.isVerified).length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setComplianceFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                complianceFilter === tab.id
                  ? 'bg-white text-slate-600 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compliance Audit Table */}
      {isLoadingData ? (
        <TableSkeleton />
      ) : consultants.length === 0 ? (
        <div className="p-12 text-center text-slate-600">
          <p className="font-bold">No consultant records found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/70 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Consultant Profile</th>
                <th className="px-6 py-4">Council License PIN</th>
                <th className="px-6 py-4">Ghana Card Identification</th>
                <th className="px-6 py-4">Indemnity Policy / Sign-Off</th>
                <th className="px-6 py-4">Account Status</th>
                <th className="px-6 py-4 text-right">Audit & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consultants
                .filter(c => {
                  if (complianceFilter === 'pending') return c.verificationStatus === 'pending';
                  if (complianceFilter === 'unverified') return !c.isVerified && c.verificationStatus !== 'pending';
                  if (complianceFilter === 'deferred_pending') return c.indemnityStatus === 'deferred_pending';
                  if (complianceFilter === 'verified') return c.isVerified;
                  if (complianceFilter === 'flagged_modified') return c.verificationPendingReview === true;
                  return true;
                })
                .filter(c => {
                  if (!(searchQuery || '').trim()) return true;
                  const q = (searchQuery || '').toLowerCase();
                  return (
                    (c.fullName?.toLowerCase() || '').includes(q) ||
                    (c.email?.toLowerCase() || '').includes(q) ||
                    (c.councilPin?.toLowerCase() || '').includes(q) ||
                    (c.ghanaCardNumber?.toLowerCase() || '').includes(q) ||
                    (c.indemnityLegalSignoff?.ghanaCardNumber?.toLowerCase() || '').includes(q)
                  );
                })
                .map(c => (
                  <tr key={c.uid || c.id} className="hover:bg-white/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                          <img
                            src={c.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${c.uid || c.id}&backgroundColor=f8fafc`}
                            alt={c.fullName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{c.fullName}</div>
                          <div className="text-xs text-slate-600 font-medium capitalize">{c.cadre}</div>
                          <div className="text-[11px] text-slate-500">{c.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit">
                        <Award size={14} className="text-slate-600 shrink-0" />
                        <span>{c.councilPin || 'Pending PIN'}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">Retention Pin</p>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit">
                        <CreditCard size={14} className="text-slate-600 shrink-0" />
                        <span>{c.ghanaCardNumber || c.indemnityLegalSignoff?.ghanaCardNumber || 'GHA-Pending'}</span>
                      </div>
                      <span className="inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1">
                        Ghana Card Registered
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {c.indemnityStatus === 'provided' ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                            Policy Verified
                          </span>
                          <p className="text-[11px] text-slate-600 mt-1 font-mono">
                            {c.indemnityPolicyNo ? `Policy #${c.indemnityPolicyNo}` : 'Policy Uploaded'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-950 px-3 py-1 rounded-full text-xs font-extrabold border border-amber-300">
                            <ShieldAlert size={14} className="text-amber-600 shrink-0" />
                            Deferred (Personal Liability)
                          </span>
                          {c.indemnityLegalSignoff?.signerFullName && (
                            <p className="text-[11px] text-amber-900 font-medium leading-tight">
                              Signed: {c.indemnityLegalSignoff.signerFullName}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {c.isVerified ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                            <CheckCircle2 size={12} /> Verified & Active
                          </span>
                        ) : c.verificationStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-300">
                            <Clock size={12} className="animate-pulse" /> Manual Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
                            <AlertCircle size={12} /> Unverified
                          </span>
                        )}

                        {c.verificationPendingReview && (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-rose-200 mt-1 animate-pulse">
                            ⚠️ Modified Post-Verification
                          </span>
                        )}
                        
                        {c.notificationSent && (
                          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-[10px] font-bold border border-sky-200 mt-1">
                            <Bell size={10} /> Face-to-Face Scheduled
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right space-y-2">
                      <button
                        onClick={() => setAuditingConsultant(c)}
                        className="w-full sm:w-auto bg-white hover:bg-white text-slate-600 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <FileText size={14} />
                        Audit Compliance File
                      </button>

                      {c.indemnityStatus === 'deferred_pending' && (
                        <button
                          onClick={() => sendIndemnityReminder(c)}
                          disabled={sendingReminderUid === (c.uid || c.id)}
                          className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-slate-600 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 ml-auto shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                        >
                          {sendingReminderUid === (c.uid || c.id) ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                          Remind Indemnity Upload
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
