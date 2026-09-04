import React, { useState } from 'react';
import { 
  X, UserPlus, Stethoscope, Pill, AlertCircle, ArrowRight, CheckCircle2, Loader2 
} from 'lucide-react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ConsultationSession, User, UserProfile } from '../types';
import { formatConsultantName } from '../lib/formatters';

interface ConsultantReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultation: ConsultationSession;
  currentUser: User | UserProfile;
}

export default function ConsultantReferralModal({
  isOpen,
  onClose,
  consultation,
  currentUser
}: ConsultantReferralModalProps) {
  const [targetCategory, setTargetCategory] = useState<'DOCTOR' | 'PHARMACIST'>('DOCTOR');
  const [referralNote, setReferralNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const feeAmount = targetCategory === 'DOCTOR' ? 30 : 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralNote.trim()) {
      setErrorMsg("Please provide a brief clinical rationale or note for this referral.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const consultantName = formatConsultantName(currentUser.fullName || currentUser.displayName, (currentUser as any).prefix) || 'Primary Consultant';
      const consRef = doc(db, 'consultations', consultation.sessionId);

      // 1. Update Consultation State to PROPOSED
      await updateDoc(consRef, {
        referralState: 'PROPOSED',
        referralTargetCategory: targetCategory,
        referralNote: referralNote.trim(),
        referralFeeGHS: feeAmount,
        referralProposedByUid: currentUser.uid,
        referralProposedByName: consultantName,
        referralProposedAt: new Date().toISOString()
      });

      // 2. Post System Chat Message
      const categoryTitle = targetCategory === 'DOCTOR' ? 'Doctor' : 'Pharmacist';
      const messagesRef = collection(db, 'consultations', consultation.sessionId, 'messages');
      await addDoc(messagesRef, {
        senderId: 'system',
        senderName: 'System Notice',
        senderRole: 'system',
        text: `📋 [Referral Proposed] ${consultantName} has recommended an online referral to a ${categoryTitle}.\n• Rationale: "${referralNote.trim()}"\n• Required Fee Top-Up: GHS ${feeAmount}.\n\nAwaiting patient confirmation and payment top-up to broadcast to online specialists.`,
        timestamp: new Date().toISOString()
      }).catch(() => {});

      onClose();
    } catch (err: any) {
      console.error("Failed to propose referral:", err);
      setErrorMsg(err?.message || "Failed to submit referral. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-indigo-100 flex items-center justify-center text-slate-800">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-950">Refer to Consultant Online</h3>
              <p className="text-xs text-slate-800 font-semibold">Request a specialist consultation for patient</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-50 text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {errorMsg && (
            <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Category Selection */}
          <div>
            <label className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-3">
              Select Specialist Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetCategory('DOCTOR')}
                className={`p-4 rounded-2xl border-slate-100 text-left transition-all flex flex-col justify-between cursor-pointer ${
                  targetCategory === 'DOCTOR'
                    ? 'border-indigo-600 bg-slate-50/50 text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${targetCategory === 'DOCTOR' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-800'}`}>
                    <Stethoscope size={20} />
                  </div>
                  {targetCategory === 'DOCTOR' && <CheckCircle2 size={18} className="text-slate-800" />}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm">Doctor</h4>
                  <p className="text-[11px] text-slate-800 mt-0.5">Doctor / Specialist</p>
                  <span className="inline-block mt-2 bg-slate-200 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                    +GHS 30 Top-Up
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetCategory('PHARMACIST')}
                className={`p-4 rounded-2xl border-slate-100 text-left transition-all flex flex-col justify-between cursor-pointer ${
                  targetCategory === 'PHARMACIST'
                    ? 'border-teal-600 bg-teal-50/50 text-teal-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${targetCategory === 'PHARMACIST' ? 'bg-teal-600 text-slate-800' : 'bg-white text-slate-800'}`}>
                    <Pill size={20} />
                  </div>
                  {targetCategory === 'PHARMACIST' && <CheckCircle2 size={18} className="text-teal-600" />}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm">Pharmacist</h4>
                  <p className="text-[11px] text-slate-800 mt-0.5">Pharmacist</p>
                  <span className="inline-block mt-2 bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                    +GHS 20 Top-Up
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Referral Note / Clinical Rationale */}
          <div>
            <label htmlFor="referralNote" className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-2">
              Clinical Rationale / Referral Note
            </label>
            <textarea
              id="referralNote"
              rows={3}
              value={referralNote}
              onChange={(e) => setReferralNote(e.target.value)}
              placeholder="e.g. Patient presents with high fever and respiratory symptoms requiring physician assessment and POM medication authorization..."
              className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all resize-none font-semibold"
            />
            <p className="text-[11px] text-slate-700 mt-1.5">
              This rationale will be displayed to the patient and attached to the specialist broadcast.
            </p>
          </div>

          {/* Summary Box */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed font-semibold">
              Submitting will send a referral proposal to <strong>{consultation.patientName}</strong>. Once accepted and settled, the consultation request will automatically broadcast to available online {targetCategory === 'DOCTOR' ? 'Doctors' : 'Pharmacists'}.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 hover:bg-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting Proposal...
                </>
              ) : (
                <>
                  Send Referral Request
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
