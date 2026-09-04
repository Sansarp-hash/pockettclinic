import React from 'react';
import { ConsultationSession } from '../types';
import { AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface Props {
  consultation: ConsultationSession;
}

export default function ReferralGuidanceBanner({ consultation }: Props) {
  if (consultation.cadreNeeded !== 'PHARM_TECH' && !consultation.isReferralToDoctor) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 border border-amber-300 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <ShieldAlert size={18} />
      </div>
      <div className="text-xs">
        <h5 className="font-bold text-amber-950">Clinical Scope Guidance</h5>
        <p className="text-amber-900 mt-0.5 leading-relaxed">
          {consultation.cadreNeeded === 'PHARM_TECH'
            ? 'Pharmacy Technicians provide medication counseling and symptom triaging. Inconclusive cases can be escalated to a licensed Doctor with automated split fee adjustments.'
            : 'This consultation has been flagged for medical specialist review.'}
        </p>
      </div>
    </div>
  );
}
