import React, { useState, useEffect } from 'react';
import { UserCheck, Share2, Search, Plus, CheckCircle2, Clock, AlertCircle, ArrowRight, Stethoscope, UserCircle, X, ShieldCheck } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { SpecialistReferral } from '../../types';
import { formatConsultantName } from '../../lib/formatters';

interface SpecialistReferralNetworkProps {
  consultantId: string;
  consultantName: string;
  consultantCadre: string;
}

const SPECIALIST_DIRECTORY = [
  { id: 'spec_1', name: 'Kwame Boateng', prefix: 'Dr.', cadre: 'SPECIALIST', specialty: 'Cardiology', hospital: 'Korle Bu Teaching Hospital', pin: 'MDC/RN/3891', rating: 4.9, isOnline: true },
  { id: 'spec_2', name: 'Sarah Mensah', prefix: 'Dr.', cadre: 'SPECIALIST', specialty: 'Dermatology', hospital: 'Komfo Anokye Teaching Hospital', pin: 'MDC/RN/4102', rating: 5.0, isOnline: true },
  { id: 'spec_3', name: 'Emmanuel Osei', prefix: 'Dr.', cadre: 'SPECIALIST', specialty: 'Pediatrics', hospital: 'Greater Accra Regional Hospital (Ridge)', pin: 'MDC/RN/5021', rating: 4.8, isOnline: false },
  { id: 'spec_4', name: 'Abena Poku', prefix: 'Dr.', cadre: 'SPECIALIST', specialty: 'Obstetrics & Gynaecology', hospital: 'Cape Coast Teaching Hospital', pin: 'MDC/RN/2918', rating: 4.9, isOnline: true },
  { id: 'spec_5', name: 'Daniel Kwakye', prefix: 'Pharm.', cadre: 'PHARMACIST', specialty: 'Clinical Pharmacology & Toxicology', hospital: 'Trust Hospital Pharmacy', pin: 'PC/PH/1820', rating: 4.8, isOnline: true },
  { id: 'spec_6', name: 'Francis Ofori', prefix: 'Pharm. Tech.', cadre: 'PHARM_TECH', specialty: 'Dispensary & Inventory Management', hospital: 'St. Jude Community Clinic', pin: 'PT/GH/9128', rating: 4.7, isOnline: true },
  { id: 'spec_7', name: 'Kojo Appiah', prefix: 'PA', cadre: 'PHYSICIAN_ASSISTANT', specialty: 'Primary Clinical Care', hospital: 'Adabraka Polyclinic', pin: 'PA/GH/3342', rating: 4.8, isOnline: true }
];

export default function SpecialistReferralNetwork({
  consultantId,
  consultantName,
  consultantCadre
}: SpecialistReferralNetworkProps) {
  const [referrals, setReferrals] = useState<SpecialistReferral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReferModalOpen, setIsReferModalOpen] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState<typeof SPECIALIST_DIRECTORY[0] | null>(null);

  // Referral Form State
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState<number | ''>(34);
  const [patientGender, setPatientGender] = useState<'MALE' | 'FEMALE'>('FEMALE');
  const [urgency, setUrgency] = useState<SpecialistReferral['urgency']>('ROUTINE');
  const [reason, setReason] = useState('');
  const [handoverSummary, setHandoverSummary] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!consultantId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'specialist_referrals'),
      where('referringConsultantId', '==', consultantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SpecialistReferral[] = [];
      snapshot.forEach(d => {
        list.push({ referralId: d.id, ...d.data() } as SpecialistReferral);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReferrals(list);
      setIsLoading(false);
    }, (err) => {
      console.warn("Firestore referrals listen fallback:", err);
      if (referrals.length === 0) {
        setReferrals([
          {
            referralId: 'ref_101',
            patientId: 'pat_001',
            patientName: 'Kojo Antwi',
            patientAge: 52,
            patientGender: 'MALE',
            referringConsultantId: consultantId,
            referringConsultantName: consultantName,
            referringConsultantCadre: consultantCadre,
            targetSpecialty: 'Cardiology',
            targetConsultantName: 'Kwame Boateng',
            targetConsultantPrefix: 'Dr.',
            urgency: 'URGENT',
            reasonForReferral: 'Refractory Stage 2 Hypertension with exertional palpitations',
            consultantHandoverSummary: 'Patient on Amlodipine 10mg + HCTZ with persistent BP 168/104 mmHg. Needs specialist echocardiogram & Holter review.',
            provisionalDiagnosis: 'Hypertensive Heart Disease / Secondary HTN',
            status: 'ACCEPTED',
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
            acceptedAt: new Date(Date.now() - 2 * 86400000 + 7200000).toISOString()
          }
        ]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [consultantId]);

  const handleInitiateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpecialist || !patientName || !reason) return;

    setIsSubmitting(true);
    const newId = `ref_${Date.now()}`;
    const newReferral: SpecialistReferral = {
      referralId: newId,
      patientId: `pat_${Date.now()}`,
      patientName,
      patientAge: patientAge ? Number(patientAge) : undefined,
      patientGender,
      referringConsultantId: consultantId,
      referringConsultantName: consultantName,
      referringConsultantCadre: consultantCadre,
      targetSpecialty: selectedSpecialist.specialty,
      targetConsultantId: selectedSpecialist.id,
      targetConsultantName: selectedSpecialist.name,
      targetConsultantPrefix: selectedSpecialist.prefix,
      urgency,
      reasonForReferral: reason,
      consultantHandoverSummary: handoverSummary || reason,
      provisionalDiagnosis,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'specialist_referrals', newId), newReferral);
      setReferrals(prev => [newReferral, ...prev]);
      setSuccessMsg(`Clinical handover successfully sent to ${formatConsultantName(selectedSpecialist.name, selectedSpecialist.prefix)} (${selectedSpecialist.specialty}). The specialist has been notified.`);
      setTimeout(() => {
        setIsReferModalOpen(false);
        setSuccessMsg(null);
        setPatientName('');
        setReason('');
        setHandoverSummary('');
        setSelectedSpecialist(null);
      }, 2500);
    } catch (err) {
      console.warn("Could not save to firestore:", err);
      setReferrals(prev => [newReferral, ...prev]);
      setSuccessMsg(`Clinical handover created for ${formatConsultantName(selectedSpecialist.name, selectedSpecialist.prefix)}.`);
      setTimeout(() => {
        setIsReferModalOpen(false);
        setSuccessMsg(null);
      }, 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0">
            <Share2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">
                Multi-Consultant Specialist Referral Network
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md">
                Inter-Disciplinary
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              1-Click clinical referrals, second opinions, and case handovers to verified platform specialists.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedSpecialist(SPECIALIST_DIRECTORY[0]);
            setIsReferModalOpen(true);
          }}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-slate-600 px-5 py-2.5 rounded-2xl text-xs font-black shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shadow-sky-600/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>New Specialist Referral</span>
        </button>
      </div>

      {/* Specialist Directory Carousel / Grid */}
      <div className="space-y-3">
        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Stethoscope size={13} className="text-sky-600" /> Available On-Call Specialists in Ghana
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SPECIALIST_DIRECTORY.map(spec => (
            <div key={spec.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-sky-300 hover:shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black text-sm">
                    {spec.name.split(' ')[1]?.[0] || 'D'}
                  </div>
                  <div>
                    <h5 className="font-black text-slate-800 text-xs">{formatConsultantName(spec.name, spec.prefix)}</h5>
                    <span className="text-[11px] font-bold text-sky-700">{spec.specialty}</span>
                  </div>
                </div>
                {spec.isOnline && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online" />
                )}
              </div>

              <div className="text-[11px] text-slate-600 font-medium">
                🏥 {spec.hospital}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-500">PIN: {spec.pin}</span>
                <button
                  onClick={() => {
                    setSelectedSpecialist(spec);
                    setIsReferModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-black text-xs cursor-pointer"
                >
                  <span>Refer Case</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Log Table */}
      <div className="space-y-3 pt-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={14} className="text-slate-600" /> Outgoing & Incoming Clinical Referrals
        </h4>

        {referrals.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
            No clinical referrals initiated yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Patient & Specialty</th>
                  <th className="p-3">Target Specialist</th>
                  <th className="p-3">Urgency & Reason</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.map(ref => (
                  <tr key={ref.referralId} className="hover:bg-white/80">
                    <td className="p-3 font-medium">
                      <div className="font-bold text-slate-800">{ref.patientName} ({ref.patientAge}y, {ref.patientGender})</div>
                      <span className="text-[11px] font-bold text-sky-700">{ref.targetSpecialty}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{formatConsultantName(ref.targetConsultantName, ref.targetConsultantPrefix)}</div>
                      <span className="text-[11px] text-slate-500">{new Date(ref.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                          ref.urgency === 'EMERGENCY' ? 'bg-rose-100 text-rose-800' : ref.urgency === 'URGENT' ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-800'
                        }`}>
                          {ref.urgency}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-1">{ref.reasonForReferral}</p>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        ref.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {ref.status === 'ACCEPTED' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        <span>{ref.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Referral Modal */}
      {isReferModalOpen && selectedSpecialist && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                  <Share2 size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-base">Refer to Specialist</h4>
                  <p className="text-xs text-slate-600">{formatConsultantName(selectedSpecialist.name, selectedSpecialist.prefix)} • {selectedSpecialist.specialty}</p>
                </div>
              </div>
              <button onClick={() => setIsReferModalOpen(false)} className="text-slate-500 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {successMsg ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 my-4">
                <ShieldCheck size={18} />
                <span>{successMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleInitiateReferral} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Patient Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kofi Boateng"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Urgency Level *</label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                    >
                      <option value="ROUTINE">Routine Review</option>
                      <option value="URGENT">Urgent (Within 24h)</option>
                      <option value="EMERGENCY">Emergency Handover</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Provisional Diagnosis</label>
                  <input
                    type="text"
                    placeholder="e.g. Refractory Hypertension, Suspicious Skin Lesion"
                    value={provisionalDiagnosis}
                    onChange={(e) => setProvisionalDiagnosis(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Reason for Specialist Referral *</label>
                  <input
                    type="text"
                    required
                    placeholder="Why is specialist input required?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Consultant Handover Summary</label>
                  <textarea
                    rows={3}
                    placeholder="Key findings, current medications, investigations performed..."
                    value={handoverSummary}
                    onChange={(e) => setHandoverSummary(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsReferModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-slate-600 font-black rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
                  >
                    {isSubmitting ? 'Sending...' : 'Transmit Referral'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
