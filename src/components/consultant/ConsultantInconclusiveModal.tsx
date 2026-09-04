import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, FileText, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface ConsultantInconclusiveModalProps {
  consultationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConsultantInconclusiveModal({ consultationId, onClose, onSuccess }: ConsultantInconclusiveModalProps) {
  const [reason, setReason] = useState('Requires Doctor Escalation for POM');
  const [clinicalContext, setClinicalContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!clinicalContext.trim()) {
      setError('Please provide the clinical context gathered so far.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await updateDoc(doc(db, 'consultations', consultationId), {
        status: 'INCONCLUSIVE',
        inconclusiveReason: reason,
        inconclusiveContext: clinicalContext,
        endedAt: serverTimestamp(),
      });
      onSuccess();
    } catch (err: any) {
      console.error('Error marking as inconclusive:', err);
      setError(err.message || 'Failed to submit form');
      setIsSubmitting(false);
    }
  };

  const predefinedReasons = [
    "Requires Doctor Escalation for POM",
    "Specialist intervention needed",
    "Patient disconnected/unresponsive",
    "Technical difficulties during session",
    "Symptoms require physical examination",
    "Patient cannot afford top-up right now",
    "Other"
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-amber-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                <AlertTriangle size={24} className="stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Inconclusive Wrap-up</h2>
                <p className="text-amber-700 text-xs font-bold uppercase tracking-wider mt-0.5">Session Add-up Sheet</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-white/50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-blue-800 text-sm">
              <FileText size={20} className="shrink-0 mt-0.5 text-blue-600" />
              <p className="font-medium leading-relaxed">
                Use this form to document the preliminary findings from the current session. This ensures the patient's progress is saved when they book a higher-tier consultant.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm font-bold border border-rose-100 flex items-center gap-2">
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-extrabold text-slate-700 block tracking-tight">
                Reason for Inconclusive Status
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              >
                {predefinedReasons.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-extrabold text-slate-700 block tracking-tight flex items-center justify-between">
                <span>Clinical Context & Findings So Far</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">Required</span>
              </label>
              <textarea
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                placeholder="Briefly document the symptoms discussed, patient history gathered, and any preliminary observations before the session was escalated or ended..."
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none leading-relaxed placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !clinicalContext.trim()}
              className="flex-[2] px-4 py-4 rounded-xl font-black text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Submit Add-up Sheet</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
