import React, { useState } from 'react';
import { ConsultationSession, DigitalPrescription } from '../types';
import { X, Plus, Trash2, FileText, CheckCircle2, QrCode, Download, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';

import { CADRE_CONFIGS, normalizeCadre } from '../config/consultantCadreConfig';

type RxMedication = DigitalPrescription['medications'][number];

interface Props {
  consultation: ConsultationSession;
  onClose: () => void;
  onSuccess?: (rxId: string) => void;
}

export default function PrescriptionGenerator({ consultation, onClose, onSuccess }: Props) {
  const { showToast, user } = useAppContext();
  const [diagnosis, setDiagnosis] = useState(consultation.chiefComplaints || '');
  const [medications, setMedications] = useState<RxMedication[]>([
    { drugName: 'Paracetamol', name: 'Paracetamol', dosage: '500mg', frequency: '8 hourly', duration: '5 days', instructions: 'Take with full glass of water after meals' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedRxId, setGeneratedRxId] = useState<string | null>(null);

  const addMedication = () => {
    setMedications(prev => [
      ...prev,
      { drugName: '', name: '', dosage: '', frequency: '12 hourly', duration: '3 days', instructions: '' }
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof RxMedication, val: any) => {
    setMedications(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'drugName' || field === 'name') {
        copy[index].drugName = val;
        copy[index].name = val;
      }
      return copy;
    });
  };

  const handleIssuePrescription = async () => {
    if (medications.some(m => !(m.drugName || m.name || '').trim())) {
      showToast('Please specify a medication name for all entries.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const rxId = `RX-${Date.now().toString(36).toUpperCase()}`;
      const rxData: DigitalPrescription = {
        rxId,
        sessionId: consultation.sessionId,
        patientName: consultation.patientName,
        patientAge: consultation.patientAge || 30,
        patientGender: consultation.patientGender || 'Not Specified',
        consultantId: consultation.consultantId || user?.uid || 'doc_current',
        consultantName: consultation.consultantName || user?.fullName || 'Consultant',
        consultantPin: user?.councilPin || (consultation as any).consultantPin || 'Pending',
        consultantCadre: normalizeCadre(consultation.cadreNeeded || user?.cadre || 'UNASSIGNED'),
        medications,
        diagnosisNotes: diagnosis,
        qrCodeVerificationUrl: `https://pockettclinic.health/verify-rx/${rxId}`,
        isFulfilled: false,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'prescriptions', rxId), rxData);
      setGeneratedRxId(rxId);
      showToast(`Digital Prescription ${rxId} issued successfully!`, 'success');
      if (onSuccess) onSuccess(rxId);
    } catch (err: any) {
      console.error('Error saving prescription:', err);
      showToast('Failed to issue digital prescription.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Digital Prescription Generator</h3>
              <p className="text-xs text-slate-600">Patient: {consultation.patientName} • Session: {consultation.sessionId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {generatedRxId ? (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-800">Prescription Issued Successfully</h4>
                <p className="text-xs text-slate-600 mt-1">Prescription ID: <span className="font-mono font-bold text-slate-600">{generatedRxId}</span></p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center max-w-xs mx-auto">
                <QRCodeSVG value={`https://pockettclinic.health/verify-rx/${generatedRxId}`} size={160} />
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-4">Pharmacy Verification QR</p>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Clinical Diagnosis / Indications</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="E.g., Acute upper respiratory tract infection"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Prescribed Medications</label>
                  <button
                    type="button"
                    onClick={addMedication}
                    className="text-xs font-bold text-slate-600 hover:text-slate-600 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {medications.map((med, idx) => (
                    <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Drug #{idx + 1}</span>
                        {medications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMedication(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Drug Name (e.g. Amoxicillin)"
                          value={med.name}
                          onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs font-semibold"
                        />
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 500mg)"
                          value={med.dosage}
                          onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs font-semibold"
                        />
                        <input
                          type="text"
                          placeholder="Frequency (e.g. 8 hourly)"
                          value={med.frequency}
                          onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Duration (e.g. 7 days)"
                          value={med.duration}
                          onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Special Instructions"
                          value={med.instructions || ''}
                          onChange={(e) => updateMedication(idx, 'instructions', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleIssuePrescription}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-200 text-slate-600 font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Sign & Issue Prescription
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
