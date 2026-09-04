import React from 'react';
import { ConsultationSession } from '../types';
import { X, FileText, Printer, CheckCircle2 } from 'lucide-react';

import { CADRE_CONFIGS, normalizeCadre } from '../config/consultantCadreConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  consultation: ConsultationSession;
}

export default function ClinicalTriageSlipModal({ isOpen, onClose, consultation }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Clinical Triage Slip</h3>
              <p className="text-xs text-slate-600">ID: {consultation.sessionId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Patient</span>
              <span className="font-bold text-slate-800">{consultation.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Cadre</span>
              <span className="font-bold text-slate-600">
                {CADRE_CONFIGS[normalizeCadre(consultation.cadreNeeded)]?.label || consultation.cadreNeeded || 'UNASSIGNED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Status</span>
              <span className="font-bold text-emerald-600">{consultation.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Scheduled At</span>
              <span className="font-mono text-slate-800">{new Date(consultation.scheduledAt).toLocaleString()}</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 font-bold uppercase text-[10px]">Chief Complaints</span>
            <p className="font-medium text-slate-800 bg-white p-3 rounded-xl border border-slate-200 mt-1 leading-relaxed">
              {consultation.chiefComplaints || 'No specific complaints recorded.'}
            </p>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-200 hover:bg-white transition-colors flex items-center gap-1.5"
          >
            <Printer size={14} /> Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
