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
    <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-slate-200/40 border border-slate-100 space-y-10 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-slate-50">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[24px] bg-sky-600 text-white flex items-center justify-center shadow-2xl shadow-sky-600/20 shrink-0">
            <Share2 size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-2xl font-black text-slate-950 tracking-tight uppercase">
                Specialist Network
              </h3>
              <div className="flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full border border-sky-100">
                <div className="w-1 h-1 rounded-full bg-sky-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest">Global Directory</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              Inter-Disciplinary Case Handovers
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedSpecialist(SPECIALIST_DIRECTORY[0]);
            setIsReferModalOpen(true);
          }}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 transition-all active:scale-95"
        >
          <Plus size={16} />
          <span>New Referral</span>
        </button>
      </div>

      {/* Specialist Directory - Premium Grid */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          <Stethoscope size={14} className="text-sky-500" /> 
          On-Call Specialists
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SPECIALIST_DIRECTORY.map(spec => (
            <div key={spec.id} className="group p-6 rounded-[2rem] border border-slate-100 bg-white hover:border-sky-200 hover:shadow-2xl hover:shadow-sky-100/40 transition-all duration-500 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-950 flex items-center justify-center font-black text-sm group-hover:bg-sky-600 group-hover:text-white group-hover:border-sky-600 transition-all">
                    {spec.name.split(' ')[1]?.[0] || 'D'}
                  </div>
                  <div>
                    <h5 className="font-black text-slate-950 text-[13px] uppercase tracking-tight">{formatConsultantName(spec.name, spec.prefix)}</h5>
                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">{spec.specialty}</span>
                  </div>
                </div>
                {spec.isOnline && (
                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Online</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2 leading-relaxed">
                <div className="w-1 h-1 rounded-full bg-slate-200" />
                {spec.hospital}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{spec.pin}</span>
                <button
                  onClick={() => {
                    setSelectedSpecialist(spec);
                    setIsReferModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-slate-950 hover:text-sky-600 font-black text-[10px] uppercase tracking-widest transition-colors group-hover:translate-x-1 duration-300"
                >
                  <span>Refer</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Log Table - Premium Styling */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Clock size={14} className="text-slate-400" /> Activity Log
          </h4>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Showing last {referrals.length} cases</span>
        </div>

        {referrals.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border border-slate-100 border-dashed">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No clinical referrals documented</p>
          </div>
        ) : (
          <div className="overflow-hidden bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Patient & Context</th>
                  <th className="px-8 py-5">Recipient</th>
                  <th className="px-8 py-5">Clinical Priority</th>
                  <th className="px-8 py-5">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {referrals.map(ref => (
                  <tr key={ref.referralId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-950 text-xs uppercase tracking-tight mb-1">{ref.patientName}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest">{ref.targetSpecialty}</span>
                        <span className="text-[9px] font-bold text-slate-400">({ref.patientAge}y, {ref.patientGender})</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-950 text-[11px] uppercase tracking-tight mb-1">
                        {formatConsultantName(ref.targetConsultantName, ref.targetConsultantPrefix)}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(ref.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <span className={`w-fit text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          ref.urgency === 'EMERGENCY' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 
                          ref.urgency === 'URGENT' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {ref.urgency}
                        </span>
                        <p className="text-[10px] font-bold text-slate-500 lowercase first-letter:uppercase line-clamp-1 italic">"{ref.reasonForReferral}"</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                        ref.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {ref.status === 'ACCEPTED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
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
