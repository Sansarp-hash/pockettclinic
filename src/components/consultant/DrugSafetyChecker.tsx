import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Search, Pill, Plus, X, HeartPulse, Activity, Sparkles } from 'lucide-react';

interface DrugInteraction {
  drugA: string;
  drugB: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW';
  effect: string;
  recommendation: string;
}

const COMMON_DRUGS = [
  'Artemether-Lumefantrine',
  'Amoxicillin',
  'Amoxicillin-Clavulanate (Augmentin)',
  'Amlodipine',
  'Lisinopril',
  'Metformin',
  'Ibuprofen',
  'Diclofenac',
  'Paracetamol',
  'Ciprofloxacin',
  'Azithromycin',
  'Omeprazole',
  'Warfarin',
  'Atorvastatin',
  'Hydrochlorothiazide (HCTZ)',
  'Metronidazole',
  'Fluconazole',
  'Glibenclamide'
];

const KNOWN_INTERACTIONS: DrugInteraction[] = [
  {
    drugA: 'Ibuprofen',
    drugB: 'Lisinopril',
    severity: 'HIGH',
    effect: 'NSAIDs diminish antihypertensive effect of ACE inhibitors and drastically increase risk of acute renal failure.',
    recommendation: 'Avoid combination. Consider Paracetamol for analgesia in hypertensive patients on ACE inhibitors.'
  },
  {
    drugA: 'Diclofenac',
    drugB: 'Lisinopril',
    severity: 'HIGH',
    effect: 'Renal hemodynamic impairment and blunted blood pressure control.',
    recommendation: 'Use Paracetamol or topical analgesics. Monitor serum potassium & eGFR if NSAID unavoidable.'
  },
  {
    drugA: 'Ciprofloxacin',
    drugB: 'Artemether-Lumefantrine',
    severity: 'MODERATE',
    effect: 'Additive QT interval prolongation and elevated arrhythmia risk.',
    recommendation: 'Monitor ECG/pulse if co-prescribed. Use alternative antibiotic like Amoxicillin if possible.'
  },
  {
    drugA: 'Warfarin',
    drugB: 'Metronidazole',
    severity: 'HIGH',
    effect: 'Metronidazole inhibits Warfarin CYP2C9 metabolism, causing profound INR spike and severe hemorrhage risk.',
    recommendation: 'Extreme danger. Reduce Warfarin dose by 50% or choose alternative antimicrobial; monitor INR daily.'
  },
  {
    drugA: 'Metformin',
    drugB: 'Ciprofloxacin',
    severity: 'MODERATE',
    effect: 'Fluoroquinolones may cause severe hypoglycemia or dysglycemia when combined with oral antidiabetics.',
    recommendation: 'Educate patient on hypoglycemia symptoms; frequent blood glucose monitoring.'
  },
  {
    drugA: 'Atorvastatin',
    drugB: 'Fluconazole',
    severity: 'HIGH',
    effect: 'Fluconazole inhibits CYP3A4, causing massive increase in statin plasma concentration and rhabdomyolysis.',
    recommendation: 'Temporarily suspend Atorvastatin during antifungal course or switch to Rosuvastatin/Pravastatin.'
  }
];

export default function DrugSafetyChecker() {
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>(['Lisinopril', 'Ibuprofen']);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientAllergies, setPatientAllergies] = useState<string[]>(['Penicillin']);
  const [newAllergy, setNewAllergy] = useState('');
  const [egfr, setEgfr] = useState<number | ''>(65);

  const addDrug = (drug: string) => {
    if (!selectedDrugs.includes(drug)) {
      setSelectedDrugs(prev => [...prev, drug]);
    }
    setSearchTerm('');
  };

  const removeDrug = (drug: string) => {
    setSelectedDrugs(prev => prev.filter(d => d !== drug));
  };

  const addAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAllergy && !patientAllergies.includes(newAllergy)) {
      setPatientAllergies(prev => [...prev, newAllergy]);
      setNewAllergy('');
    }
  };

  const removeAllergy = (allergy: string) => {
    setPatientAllergies(prev => prev.filter(a => a !== allergy));
  };

  // Find interactions among selected drugs
  const detectedInteractions: DrugInteraction[] = [];
  for (let i = 0; i < selectedDrugs.length; i++) {
    for (let j = i + 1; j < selectedDrugs.length; j++) {
      const d1 = selectedDrugs[i];
      const d2 = selectedDrugs[j];

      const match = KNOWN_INTERACTIONS.find(
        k => (k.drugA.toLowerCase() === d1.toLowerCase() && k.drugB.toLowerCase() === d2.toLowerCase()) ||
             (k.drugA.toLowerCase() === d2.toLowerCase() && k.drugB.toLowerCase() === d1.toLowerCase())
      );

      if (match) {
        detectedInteractions.push(match);
      }
    }
  }

  // Allergy Cross-reference Check
  const allergyAlerts: string[] = [];
  selectedDrugs.forEach(drug => {
    if (patientAllergies.some(a => a.toLowerCase().includes('penicillin')) && 
       (drug.toLowerCase().includes('amoxicillin') || drug.toLowerCase().includes('augmentin'))) {
      allergyAlerts.push(`CRITICAL ALLERGY: Patient has Penicillin allergy, but "${drug}" is a beta-lactam penicillin! High risk of anaphylaxis.`);
    }
  });

  // Renal Clearance Adjustments
  const renalWarnings: string[] = [];
  if (typeof egfr === 'number' && egfr < 45) {
    if (selectedDrugs.includes('Metformin')) {
      renalWarnings.push(`eGFR < 45 mL/min: Metformin maximum dose should be restricted to 1000mg/day (contraindicated if eGFR < 30).`);
    }
    if (selectedDrugs.includes('Ciprofloxacin')) {
      renalWarnings.push(`eGFR < 50 mL/min: Reduce Ciprofloxacin dose by 50% to prevent drug accumulation and neurotoxicity.`);
    }
  }

  const filteredDrugs = COMMON_DRUGS.filter(d => 
    d.toLowerCase().includes(searchTerm.toLowerCase()) && !selectedDrugs.includes(d)
  );

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">
                Drug Interaction & Safety Reference Engine
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                Clinical Pharmacology
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Screen multi-drug regimens for severe interactions, patient allergy cross-reactivity, and renal dosage limits.
            </p>
          </div>
        </div>
      </div>

      {/* Drug Selection & Allergy Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Drug List Builder */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Pill size={14} className="text-slate-600" /> Active Prescribed Medication Regimen
            </label>
            <span className="text-[11px] text-slate-500 font-bold">{selectedDrugs.length} Drugs Selected</span>
          </div>

          {/* Search to add */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search medication to test interactions (e.g. Amlodipine, Metformin, Warfarin)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            {searchTerm && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 text-xs">
                {filteredDrugs.length === 0 ? (
                  <div className="p-3 text-slate-500 text-center">No matching formulary medication</div>
                ) : (
                  filteredDrugs.map(drug => (
                    <button
                      key={drug}
                      onClick={() => addDrug(drug)}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 hover:text-amber-900 rounded-xl font-bold flex items-center justify-between"
                    >
                      <span>{drug}</span>
                      <Plus size={14} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Drugs Tags */}
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedDrugs.map(drug => (
              <span
                key={drug}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 rounded-xl text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
              >
                <Pill size={12} />
                <span>{drug}</span>
                <button 
                  onClick={() => removeDrug(drug)}
                  className="hover:text-rose-400 p-0.5 rounded ml-1"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>

          {/* Quick preset add buttons */}
          <div className="pt-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-2">Quick Add:</span>
            {['Artemether-Lumefantrine', 'Augmentin', 'Metformin', 'Paracetamol', 'Warfarin'].map(drug => (
              <button
                key={drug}
                onClick={() => addDrug(drug)}
                className="text-[11px] font-bold text-slate-600 hover:text-amber-700 bg-white hover:bg-amber-50 px-2 py-0.5 rounded-md mr-1.5 mb-1 transition-colors"
              >
                + {drug}
              </button>
            ))}
          </div>
        </div>

        {/* Right Col: Patient Factors (Allergies & eGFR) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <HeartPulse size={14} className="text-rose-600" /> Patient Risk Factors
          </label>

          {/* Allergies */}
          <div>
            <span className="text-[11px] font-bold text-slate-600 block mb-1.5">Documented Allergies:</span>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {patientAllergies.map(allergy => (
                <span key={allergy} className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-rose-200">
                  <span>{allergy}</span>
                  <button onClick={() => removeAllergy(allergy)} className="hover:text-rose-950"><X size={10}/></button>
                </span>
              ))}
            </div>
            <form onSubmit={addAllergy} className="flex gap-1.5">
              <input
                type="text"
                placeholder="e.g. Sulfa, NSAID"
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
              />
              <button type="submit" className="px-2.5 py-1.5 bg-white text-slate-600 rounded-lg text-xs font-bold">Add</button>
            </form>
          </div>

          {/* eGFR */}
          <div className="pt-2 border-t border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 block mb-1">Patient eGFR (mL/min):</span>
            <input
              type="number"
              value={egfr}
              onChange={(e) => setEgfr(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Normal: &gt;60 | Moderate CKD: 30-59</span>
          </div>
        </div>
      </div>

      {/* Results & Warnings Section */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Activity size={14} className="text-emerald-600" /> Clinical Safety Verdict
        </h4>

        {/* Allergy Alerts */}
        {allergyAlerts.map((alert, i) => (
          <div key={i} className="p-4 bg-rose-50 border-slate-100 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-900 animate-in fade-in">
            <ShieldAlert size={20} className="shrink-0 text-rose-600 mt-0.5" />
            <div>
              <div className="font-black text-xs uppercase tracking-wide">Severe Allergy Contraindication</div>
              <p className="text-xs font-medium mt-0.5">{alert}</p>
            </div>
          </div>
        ))}

        {/* Drug Interactions */}
        {detectedInteractions.length === 0 && allergyAlerts.length === 0 && renalWarnings.length === 0 ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            <div>
              <div className="font-black text-xs uppercase tracking-wide">No Severe Drug Conflicts Detected</div>
              <p className="text-xs text-emerald-700 mt-0.5">
                The {selectedDrugs.length} selected formulary agents do not have documented severe cytochrome P450 or QT prolongation conflicts.
              </p>
            </div>
          </div>
        ) : (
          detectedInteractions.map((inter, i) => (
            <div 
              key={i} 
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                inter.severity === 'HIGH' 
                  ? 'bg-rose-50 border-rose-200 text-rose-950' 
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <AlertTriangle size={18} className={`shrink-0 mt-0.5 ${inter.severity === 'HIGH' ? 'text-rose-600' : 'text-amber-600'}`} />
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black uppercase">{inter.drugA} + {inter.drugB}</span>
                  <span className={`text-[10px] font-black px-2 py-0.2 rounded-md uppercase ${
                    inter.severity === 'HIGH' ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                  }`}>
                    {inter.severity} Risk
                  </span>
                </div>
                <p className="font-medium">{inter.effect}</p>
                <div className="text-[11px] font-bold text-slate-800 pt-1">
                  💡 Clinical Rec: <span className="font-normal text-slate-800">{inter.recommendation}</span>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Renal Warnings */}
        {renalWarnings.map((warn, i) => (
          <div key={i} className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-sky-950 text-xs flex items-center gap-2.5">
            <Activity size={16} className="text-sky-600 shrink-0" />
            <span className="font-medium">{warn}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
