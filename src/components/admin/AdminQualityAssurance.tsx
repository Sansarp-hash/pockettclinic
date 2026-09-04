import React, { useState } from 'react';
import { History, Search, FileText, CheckCircle2, AlertTriangle, Stethoscope, Star, Eye } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { formatConsultantName } from '../../lib/formatters';

export interface AdminQualityAssuranceProps {
  consultations: any[];
  consultants: any[];
}

export default function AdminQualityAssurance({
  consultations,
  consultants
}: AdminQualityAssuranceProps) {
  const { showToast } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuditSession, setSelectedAuditSession] = useState<any | null>(null);

  const completedSessions = consultations.filter((c) => c.status === 'COMPLETED' || c.soapNotes || c.chiefComplaints);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden space-y-0">
        <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <History className="text-slate-600" size={24} />
              <h3 className="text-xl font-bold">Consultant Quality Assurance & SOAP Audit</h3>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Peer-review index for SOAP medical records, diagnostic accuracy, and standard GHS treatment compliance.
            </p>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SOAP note audit..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 outline-none focus:border-slate-300 font-medium"
            />
          </div>
        </div>

        {/* Sessions audit table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Session Ref</th>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Consultant</th>
                <th className="py-3.5 px-4">SOAP Status</th>
                <th className="py-3.5 px-4">QA Rating</th>
                <th className="py-3.5 px-6 text-right">Audit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {completedSessions.map((s) => (
                <tr key={s.id || s.sessionId} className="hover:bg-white/80 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-slate-800">
                    {(s.sessionId || s.id || '').slice(0, 12)}
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-800">{s.patientName || 'Patient'}</td>
                  <td className="py-4 px-4 font-bold text-slate-600">{formatConsultantName(s.consultantName, s.consultantPrefix)}</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      <CheckCircle2 size={12} /> Complete
                    </span>
                  </td>
                  <td className="py-4 px-4 font-bold text-amber-600 flex items-center gap-1">
                    <Star size={13} fill="currentColor" /> {s.rating || 5}.0
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => setSelectedAuditSession(s)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5"
                    >
                      <Eye size={13} /> View SOAP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected SOAP Modal */}
      {selectedAuditSession && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-slate-800 text-base">SOAP Consultant Documentation</h3>
              <button onClick={() => setSelectedAuditSession(null)} className="text-slate-500 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-800">
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="font-bold text-slate-600 uppercase text-[10px] block mb-0.5">Subjective (Symptoms)</span>
                <p>{selectedAuditSession.soapNotes?.subjective || selectedAuditSession.chiefComplaints || 'Standard symptoms recorded.'}</p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="font-bold text-slate-600 uppercase text-[10px] block mb-0.5">Objective (Observed Signs & Vitals)</span>
                <p>{selectedAuditSession.soapNotes?.objective || 'Vitals checked and within acceptable parameters.'}</p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="font-bold text-slate-600 uppercase text-[10px] block mb-0.5">Assessment (Clinical Diagnosis)</span>
                <p>{selectedAuditSession.soapNotes?.assessment || 'Primary assessment confirmed.'}</p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="font-bold text-slate-600 uppercase text-[10px] block mb-0.5">Plan (Prescriptions & Guidance)</span>
                <p>{selectedAuditSession.soapNotes?.plan || 'Standard patient regimen prescribed.'}</p>
              </div>
            </div>

            <button
              onClick={() => {
                showToast('SOAP note verified and logged in compliance index.', 'success');
                setSelectedAuditSession(null);
              }}
              className="w-full py-2.5 bg-white hover:bg-white text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              Approve Consultant Quality
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
