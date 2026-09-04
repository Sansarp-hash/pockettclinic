import React, { useState } from 'react';
import { ConsultationSession } from '../types';
import { X, FileText, CheckCircle2, Loader2, Download } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  consultation: ConsultationSession;
  onSuccess?: () => void;
}

export default function VisitSummaryModal({ isOpen, onClose, consultation, onSuccess }: Props) {
  const { showToast } = useAppContext();
  const [summary, setSummary] = useState(consultation.visitSummary || consultation.clinicalNotes || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'consultations', consultation.sessionId), {
        visitSummary: summary,
        status: 'COMPLETED',
        isOnHold: false,
        holdReason: "",
        updatedAt: new Date().toISOString()
      });
      showToast('Visit summary saved and consultation finalized.', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving visit summary:', err);
      showToast('Failed to save visit summary.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col animate-in fade-in">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Consultation Summary</h3>
              <p className="text-xs text-slate-600">Session ID: {consultation.sessionId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Clinical Advice & Patient Instructions
            </label>
            <textarea
              rows={6}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Enter comprehensive instructions, diagnostic insights, and follow-up guidance for the patient..."
              className="w-full p-3.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none leading-relaxed"
            />
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !summary.trim()}
            className="bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-200 text-slate-600 font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Finalize Summary
          </button>
        </div>
      </div>
    </div>
  );
}
