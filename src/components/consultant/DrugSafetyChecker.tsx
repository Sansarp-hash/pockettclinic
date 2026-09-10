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
    <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-md shrink-0">
            <ShieldAlert size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="text-xs font-black text-slate-950 tracking-tight uppercase">
                Safety Engine
              </h3>
              <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-100">
                <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[7px] font-black uppercase tracking-widest">Active Screening</span>
              </div>
            </div>
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">
              Interaction & Contraindication Analysis
            </p>
          </div>
        </div>
      </div>

      {/* Drug Selection & Allergy Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Left 2 Cols: Drug List Builder */}
        <div className="lg:col-span-2 space-y-3.5">
          <div className="flex items-center justify-between">
            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Pill size={10} className="text-slate-400" /> Current Regimen
            </label>
            <span className="text-[7px] font-black text-slate-900 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
              {selectedDrugs.length} Items
            </span>
          </div>

          {/* Search to add */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Search medication (e.g. Warfarin, Lisinopril)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-transparent rounded-lg text-[9px] font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-bold focus:bg-white focus:border-slate-200 focus:ring-1 focus:ring-slate-100 transition-all outline-none"
            />
            {searchTerm && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto p-1 scrollbar-none">
                {filteredDrugs.length === 0 ? (
                  <div className="p-2 text-slate-400 text-center font-black text-[8px] uppercase tracking-widest">No Matches</div>
                ) : (
                  filteredDrugs.map(drug => (
                    <button
                      key={drug}
                      onClick={() => addDrug(drug)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-slate-700 hover:text-slate-950 rounded text-[9px] font-bold flex items-center justify-between transition-colors"
                    >
                      <span>{drug}</span>
                      <Plus size={10} className="text-slate-400" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Drugs Tags */}
          <div className="flex flex-wrap gap-1">
            {selectedDrugs.map(drug => (
              <span
                key={drug}
                className="group inline-flex items-center gap-1 px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm hover:border-slate-300 transition-all"
              >
                <Pill size={8} className="text-slate-400" />
                <span>{drug}</span>
                <button 
                  onClick={() => removeDrug(drug)}
                  className="text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>

          {/* Quick preset add buttons */}
          <div className="pt-0.5 flex flex-wrap gap-1">
            {['Artemether-Lumefantrine', 'Augmentin', 'Metformin', 'Paracetamol', 'Warfarin'].map(drug => (
              <button
                key={drug}
                onClick={() => addDrug(drug)}
                className="text-[7px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 px-2 py-0.5 rounded-full transition-all border border-transparent hover:border-amber-100"
              >
                + {drug}
              </button>
            ))}
          </div>
        </div>

        {/* Right Col: Patient Factors (Allergies & eGFR) */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-3.5">
          <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <HeartPulse size={10} className="text-rose-500" /> Risk Factors
          </label>

          {/* Allergies */}
          <div className="space-y-1.5">
            <span className="text-[7px] font-black text-slate-950 uppercase tracking-widest block">Documented Allergies</span>
            <div className="flex flex-wrap gap-1">
              {patientAllergies.map(allergy => (
                <span key={allergy} className="inline-flex items-center gap-1 bg-rose-600 text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm">
                  <span>{allergy}</span>
                  <button onClick={() => removeAllergy(allergy)} className="hover:text-rose-200"><X size={8}/></button>
                </span>
              ))}
            </div>
            <form onSubmit={addAllergy} className="flex gap-1">
              <input
                type="text"
                placeholder="New allergy..."
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[8px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-rose-500/20"
              />
              <button type="submit" className="p-1.5 bg-slate-900 text-white rounded transition-all active:scale-95 shrink-0">
                <Plus size={12} />
              </button>
            </form>
          </div>

          {/* eGFR */}
          <div className="pt-3 border-t border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-black text-slate-950 uppercase tracking-widest">eGFR (mL/min)</span>
              <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">Stable</span>
            </div>
            <input
              type="number"
              value={egfr}
              onChange={(e) => setEgfr(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[9px] font-black outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </div>

      {/* Results & Warnings Section */}
      <div className="space-y-2.5 pt-1.5">
        <h4 className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Activity size={10} className="text-emerald-500" /> Clinical Verdict
        </h4>

        {/* Allergy Alerts */}
        {allergyAlerts.map((alert, i) => (
          <div key={i} className="p-3 bg-rose-600 rounded-xl flex items-start gap-2.5 text-white shadow-md animate-in slide-in-from-left duration-300">
            <ShieldAlert size={16} className="shrink-0" />
            <div>
              <div className="font-black text-[8px] uppercase tracking-widest mb-0.5">Critical Contraindication</div>
              <p className="text-[9px] font-bold opacity-95 leading-relaxed uppercase tracking-tight">{alert}</p>
            </div>
          </div>
        ))}

        {/* Drug Interactions */}
        {detectedInteractions.length === 0 && allergyAlerts.length === 0 && renalWarnings.length === 0 ? (
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2.5 text-emerald-900">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle size={14} />
            </div>
            <div>
              <div className="font-black text-[8px] uppercase tracking-widest mb-0.5">Screening Complete</div>
              <p className="text-[8px] font-bold text-emerald-700 opacity-90 uppercase tracking-widest">
                No severe clinical conflicts detected in current regimen
              </p>
            </div>
          </div>
        ) : (
          detectedInteractions.map((inter, i) => (
            <div 
              key={i} 
              className={`p-3 rounded-xl border-2 flex flex-col md:flex-row items-start md:items-center gap-3.5 transition-all ${
                inter.severity === 'HIGH' 
                  ? 'bg-white border-rose-100 shadow-sm' 
                  : 'bg-white border-amber-100 shadow-sm'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                inter.severity === 'HIGH' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
              }`}>
                <AlertTriangle size={14} />
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-950 uppercase tracking-widest text-[9px]">{inter.drugA} + {inter.drugB}</span>
                  <span className={`text-[6.5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                    inter.severity === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {inter.severity} Risk
                  </span>
                </div>
                <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight">{inter.effect}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <div className="w-1 h-1 rounded-full bg-slate-900" />
                  <span className="text-[7px] font-black text-slate-950 uppercase tracking-widest">
                    Recommendation: <span className="font-bold text-slate-400 lowercase normal-case tracking-normal">{inter.recommendation}</span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Renal Warnings */}
        {renalWarnings.map((warn, i) => (
          <div key={i} className="p-2 bg-slate-900 rounded text-white flex items-center gap-2.5 shadow-sm">
            <Activity size={12} className="text-emerald-400 shrink-0" />
            <span className="text-[7px] font-black uppercase tracking-widest opacity-90">{warn}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
