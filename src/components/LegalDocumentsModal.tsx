import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, FileText, Lock, ChevronRight } from 'lucide-react';

interface LegalDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'tos' | 'privacy';
}

export const LegalDocumentsModal: React.FC<LegalDocumentsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'tos'
}) => {
  const [activeTab, setActiveTab] = useState<'tos' | 'privacy'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-white/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col relative my-8 max-h-[85vh]">
        {/* Header */}
        <div className="p-6 bg-white text-slate-600 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/30 flex items-center justify-center text-slate-600 border border-slate-300/30 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Legal & Compliance Documentation</h3>
              <p className="text-xs text-slate-500 font-medium">Ghana Data Protection Act 843 & Tele-triage Framework</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-3">
          <button
            onClick={() => setActiveTab('tos')}
            className={`pb-3 px-4 font-black text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'tos'
                ? 'border-blue-600 text-slate-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <FileText size={14} />
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-3 px-4 font-black text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'privacy'
                ? 'border-blue-600 text-slate-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Lock size={14} />
            Privacy Policy (DPA 843)
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed font-normal">
          {activeTab === 'tos' ? (
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">1. Telehealth Triage & Consultation Agreement</h4>
              <p>
                PockettClinic provides digital triage, remote clinical consultations, and verifiable electronic prescription issuing in compliance with the Ghana Health Service (GHS) and Medical and Dental Council (MDC) guidelines.
              </p>
              
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">2. Emergency Medical Disclaimer</h4>
              <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-medium">
                PockettClinic is designed for non-emergency digital triage and elective consultations. If you are experiencing a life-threatening medical emergency (e.g., severe chest pain, major trauma, stroke symptoms), immediately visit the nearest emergency facility or call national emergency response lines.
              </p>

              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">3. Consultant Licensing & Verifications</h4>
              <p>
                All consultants (Doctors, Specialists, Pharmacists, Physician Assistants, and Pharmacy Technicians) are verified against national council registries (MDC, Pharmacy Council Ghana) using valid Council PINs and Ghana Card identification before granting access.
              </p>

              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">4. Electronic Prescriptions & Fulfilment</h4>
              <p>
                Digital prescriptions generated through PockettClinic feature verifiable digital signatures and QR codes. Prescriptions are non-transferable and subject to licensed pharmacist verification upon fulfillment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">1. Data Protection Act, 2012 (Act 843) Compliance</h4>
              <p>
                PockettClinic strictly adheres to the provisions of the Ghana Data Protection Act 843. Your personal health information (PHI), biometric verifications, and clinical notes are processed with end-to-end encryption.
              </p>

              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">2. Information Collection & Use</h4>
              <p>
                We collect essential diagnostic vitals, consultation audio/video telemetry logs, and identity verification markers solely for clinical care delivery, prescription processing, and quality assurance.
              </p>

              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">3. Data Retention & Deletion Rights</h4>
              <p>
                Under Act 843, users have the right to request access to their clinical records or initiate account deletion. Deletion requests are routed to the Administrator Console for compliance review and backend data purge in accordance with health record retention laws.
              </p>

              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">4. Third-Party Sharing</h4>
              <p>
                We do not sell or monetize personal medical data. Information is shared strictly with authorized healthcare providers, partner pharmacies, or labs involved directly in your care management.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white hover:bg-white text-slate-600 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
          >
            Close & Understood
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentsModal;
