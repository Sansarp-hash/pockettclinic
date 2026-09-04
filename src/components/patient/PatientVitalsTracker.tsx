import React, { useState, useEffect } from 'react';
import { HeartPulse, Plus, Activity, Thermometer, Scale, ArrowUpRight, ArrowDownRight, Trash2, Save, X, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface VitalRecord {
  id?: string;
  sysBP?: number; // Systolic mmHg
  diaBP?: number; // Diastolic mmHg
  heartRate?: number; // bpm
  bloodGlucose?: number; // mmol/L
  temperature?: number; // °C
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  loggedAt?: string;
  notes?: string;
}

export default function PatientVitalsTracker() {
  const { user, showToast } = useAppContext();
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [sysBP, setSysBP] = useState<number | ''>(120);
  const [diaBP, setDiaBP] = useState<number | ''>(80);
  const [heartRate, setHeartRate] = useState<number | ''>(72);
  const [bloodGlucose, setBloodGlucose] = useState<number | ''>(5.6);
  const [temperature, setTemperature] = useState<number | ''>(36.6);
  const [weightKg, setWeightKg] = useState<number | ''>(70);
  const [heightCm, setHeightCm] = useState<number | ''>(175);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    const userId = user.uid || user.id;
    const q = query(collection(db, 'patient_vitals'), where('patientId', '==', userId));
    
    const unsub = onSnapshot(q, (snap) => {
      const list: VitalRecord[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() as VitalRecord }));
      list.sort((a, b) => new Date(b.loggedAt || 0).getTime() - new Date(a.loggedAt || 0).getTime());
      setVitals(list);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'patient_vitals');
      setIsLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const calculateBMI = (w?: number | '', h?: number | '') => {
    if (!w || !h) return null;
    const heightM = Number(h) / 100;
    if (heightM <= 0) return null;
    return Number((Number(w) / (heightM * heightM)).toFixed(1));
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const userId = user.uid || user.id;
      const bmiVal = calculateBMI(weightKg, heightCm);

      await addDoc(collection(db, 'patient_vitals'), {
        patientId: userId,
        sysBP: sysBP !== '' ? Number(sysBP) : null,
        diaBP: diaBP !== '' ? Number(diaBP) : null,
        heartRate: heartRate !== '' ? Number(heartRate) : null,
        bloodGlucose: bloodGlucose !== '' ? Number(bloodGlucose) : null,
        temperature: temperature !== '' ? Number(temperature) : null,
        weightKg: weightKg !== '' ? Number(weightKg) : null,
        heightCm: heightCm !== '' ? Number(heightCm) : null,
        bmi: bmiVal,
        notes,
        loggedAt: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      showToast("Vitals reading logged successfully.", "success");
      setShowAddModal(false);
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'patient_vitals');
      showToast("Failed to log vitals.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVital = async (id?: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'patient_vitals', id));
      showToast("Vitals record removed.", "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `patient_vitals/${id}`);
    }
  };

  const latestVital = vitals[0];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black border border-emerald-100 shrink-0">
            <HeartPulse size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Health Vitals & Biometrics</h3>
            <p className="text-xs text-slate-500">Track blood pressure, heart rate, glucose, and BMI trends for your doctor.</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          <Plus size={16} /> Log Vitals Reading
        </button>
      </div>

      {/* Latest Highlights Cards */}
      {latestVital && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Blood Pressure</span>
            <p className="text-lg sm:text-xl font-black text-slate-800 mt-1">
              {latestVital.sysBP && latestVital.diaBP ? `${latestVital.sysBP}/${latestVital.diaBP}` : 'N/A'}
              <span className="text-[10px] text-slate-400 font-normal ml-1">mmHg</span>
            </p>
            <span className={`text-[10px] font-bold mt-1 block ${
              (latestVital.sysBP || 0) > 130 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {(latestVital.sysBP || 0) > 130 ? 'High Normal' : 'Optimal Target'}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pulse Rate</span>
            <p className="text-lg sm:text-xl font-black text-slate-800 mt-1">
              {latestVital.heartRate || 'N/A'} <span className="text-[10px] text-slate-400 font-normal">bpm</span>
            </p>
            <span className="text-[10px] font-bold text-emerald-600 mt-1 block">Resting Normal</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Blood Sugar</span>
            <p className="text-lg sm:text-xl font-black text-slate-800 mt-1">
              {latestVital.bloodGlucose || 'N/A'} <span className="text-[10px] text-slate-400 font-normal">mmol/L</span>
            </p>
            <span className="text-[10px] font-bold text-emerald-600 mt-1 block">Fasting Target</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BMI Index</span>
            <p className="text-lg sm:text-xl font-black text-slate-800 mt-1">
              {latestVital.bmi || calculateBMI(latestVital.weightKg, latestVital.heightCm) || 'N/A'}
            </p>
            <span className="text-[10px] font-bold text-emerald-600 mt-1 block">Normal Range</span>
          </div>
        </div>
      )}

      {/* Vitals History List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recorded Vitals History</h4>
        
        {vitals.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-medium">
            No vitals logged yet. Click "Log Vitals Reading" to track your health trends.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
            {vitals.map(v => (
              <div key={v.id} className="p-3 sm:p-4 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-3 font-bold text-slate-800">
                    <span>BP: {v.sysBP}/{v.diaBP} mmHg</span>
                    <span>HR: {v.heartRate} bpm</span>
                    <span>Glucose: {v.bloodGlucose} mmol/L</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                    {v.loggedAt ? new Date(v.loggedAt).toLocaleString() : 'Recent'} {v.notes ? `• ${v.notes}` : ''}
                  </span>
                </div>

                <button
                  onClick={() => handleDeleteVital(v.id)}
                  className="p-2 min-w-[36px] min-h-[36px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Vitals Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse size={20} className="text-emerald-400" />
                <h3 className="font-bold text-sm">Log Vitals Reading</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVitals} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={sysBP}
                    onChange={e => setSysBP(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={diaBP}
                    onChange={e => setDiaBP(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                    placeholder="80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={e => setHeartRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fasting Glucose (mmol/L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodGlucose}
                    onChange={e => setBloodGlucose(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                    placeholder="5.6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={e => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                    placeholder="70"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={e => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                    placeholder="175"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes / Symptoms</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Measured in morning before breakfast"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-medium text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-3 min-h-[44px] border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
