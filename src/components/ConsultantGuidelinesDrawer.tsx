import React, { useState } from 'react';
import { 
  BookOpen, Search, ExternalLink, FileText, ShieldAlert, X, ChevronRight, 
  Stethoscope, Pill, Download, Globe, CheckCircle, Info, AlertTriangle, 
  ShieldCheck, HeartPulse, Scale, User, HelpCircle, Loader2
} from 'lucide-react';

interface ConsultantGuidelinesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Key summary protocols from Ghana Standard Treatment Guidelines (STG 7th Edition 2017)
const GHANA_STG_PROTOCOLS = [
  {
    category: 'Infectious & Parasitic',
    condition: 'Uncomplicated Malaria',
    code: 'STG-INF-01',
    firstLine: 'Artemether + Lumefantrine (AL) 20mg/120mg oral twice daily with fat-containing meal for 3 days OR Artesunate + Amodiaquine (AA).',
    secondLine: 'Dihydroartemisinin + Piperaquine (DHAP) for 3 days.',
    specialNotes: 'Always confirm diagnosis with RDT or Microscopy before initiating ACTs. For pregnant women in 1st trimester, use Oral Quinine + Clindamycin.',
  },
  {
    category: 'Infectious & Parasitic',
    condition: 'Severe Malaria (Emergency)',
    code: 'STG-INF-02',
    firstLine: 'Artesunate IV/IM 2.4 mg/kg at 0, 12, and 24 hours, then once daily until patient can tolerate oral ACT.',
    secondLine: 'Quinine IV infusion 10 mg/kg in 5% Dextrose over 4 hours every 8 hours.',
    specialNotes: 'Check for hypoglycemia, severe anemia, and cerebral complications.',
  },
  {
    category: 'Infectious & Parasitic',
    condition: 'Typhoid Fever (Enteric Fever)',
    code: 'STG-INF-03',
    firstLine: 'Ciprofloxacin 500mg PO BD for 7–10 days OR Ceftriaxone 1–2g IV OD for 7 days.',
    secondLine: 'Azithromycin 500mg PO OD for 7 days.',
    specialNotes: 'Send blood/stool culture where available before antibiotics. Monitor for intestinal perforation.',
  },
  {
    category: 'Cardiovascular',
    condition: 'Essential Hypertension (Stage 1 & 2)',
    code: 'STG-CVD-01',
    firstLine: 'Black African patients: Calcium Channel Blocker (Amlodipine 5-10mg PO OD) OR Thiazide-like Diuretic (Bendroflumethiazide 2.5mg PO OD). Add ACE Inhibitor (Lisinopril 5-20mg PO OD) or ARB (Losartan 50mg PO OD) if BP remains >140/90 mmHg.',
    secondLine: 'Combination therapy (CCB + ACEi/ARB or CCB + Thiazide).',
    specialNotes: 'Target BP <140/90 mmHg (<130/80 in Diabetes or CKD). Lifestyle modification mandatory.',
  },
  {
    category: 'Respiratory',
    condition: 'Acute Asthma Exacerbation',
    code: 'STG-RSP-01',
    firstLine: 'Salbutamol Nebulization 2.5–5mg OR 4-8 puffs via Spacer every 20 mins for 1 hour + Hydrocortisone 100–200mg IV OR Prednisolone 40mg PO OD for 5 days.',
    secondLine: 'Add Ipratropium Bromide Nebulization 500mcg + Magnesium Sulfate 2g IV over 20 mins if severe/refractory.',
    specialNotes: 'Administer high-flow Oxygen to maintain SpO2 94–98%. Monitor PEFR.',
  },
  {
    category: 'Respiratory',
    condition: 'Community-Acquired Pneumonia (CAP)',
    code: 'STG-RSP-02',
    firstLine: 'Outpatient: Amoxicillin 500mg–1g PO TID for 7 days OR Amoxicillin-Clavulanate 625mg PO BD. Add Azithromycin 500mg PO OD if atypical suspected.',
    secondLine: 'Inpatient: Ceftriaxone 1–2g IV OD + IV Azithromycin 500mg OD.',
    specialNotes: 'Assess severity using CURB-65 score (Confusion, Urea >7, RR >=30, BP <90/60, Age >=65).',
  },
  {
    category: 'Endocrine & Metabolic',
    condition: 'Type 2 Diabetes Mellitus',
    code: 'STG-END-01',
    firstLine: 'Metformin 500mg PO BD (titrate up to 1g BD with meals). Add Sulfonylurea (Glibenclamide 5mg OD or Gliclazide 80mg BD) if HbA1c >7.0% despite Metformin.',
    secondLine: 'Add Basal Insulin or DPP-4 inhibitor if dual oral therapy fails.',
    specialNotes: 'Check HbA1c every 3–6 months. Annual screening for diabetic retinopathy, nephropathy, and neuropathy.',
  },
  {
    category: 'Obstetrics & Gynecology',
    condition: 'Severe Preeclampsia & Eclampsia',
    code: 'STG-OBG-01',
    firstLine: 'Magnesium Sulfate loading dose: 4g IV (20% solution over 10-15 mins) + 10g IM (5g in each buttock). Maintenance: 5g IM every 4 hours in alternating buttocks.',
    secondLine: 'Antihypertensive: Labetalol 20mg IV bolus OR Nifedipine 10mg PO (short-acting, not sublingual).',
    specialNotes: 'Keep Calcium Gluconate 10% IV at bedside as antidote. Monitor patellar reflexes, respiratory rate (>16/min), and urine output (>25ml/hr).',
  },
  {
    category: 'Pediatrics',
    condition: 'Acute Watery Diarrhea & Dehydration (Child)',
    code: 'STG-PED-01',
    firstLine: 'Low-Osmolality ORS (Zinc Supplementation 20mg PO OD for 14 days; 10mg for infants under 6 months). Plan A for no dehydration, Plan B for some dehydration.',
    secondLine: 'Plan C (Severe dehydration): IV Ringer’s Lactate 100mg/kg rapid fluid resuscitation.',
    specialNotes: 'Do NOT prescribe antidiarrheal or antiemetic medications in young children.',
  }
];

export function ConsultantGuidelinesContent() {
  const [activeTab, setActiveTab] = useState<'sop' | 'stg' | 'medical'>('sop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stgSubTab, setStgSubTab] = useState<'search' | 'pdf'>('search');

  const categories = ['ALL', ...Array.from(new Set(GHANA_STG_PROTOCOLS.map(p => p.category)))];

  const filteredProtocols = GHANA_STG_PROTOCOLS.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesQuery = searchQuery === '' || 
      p.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.firstLine.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const officialPdfUrl = "https://www.ghs.gov.gh/wp-content/uploads/2021/08/Ghana-Standard-Treatment-Guidelines-2017.pdf";
  const embeddedViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(officialPdfUrl)}&embedded=true`;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 text-slate-900 overflow-hidden" id="guidelines-content-container">
      {/* Universal Guidelines Tabs */}
      <div className="flex items-center bg-white px-3 pt-2 gap-1.5 shrink-0 overflow-x-auto no-scrollbar border-b border-slate-100" id="guidelines-tab-header">
        {[
          { id: 'sop', label: 'Platform SOPs', icon: Scale },
          { id: 'stg', label: 'STG Guidelines', icon: Stethoscope },
          { id: 'medical', label: 'Clinical Dosing', icon: HeartPulse },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-[8px] font-black rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap uppercase tracking-widest ${
                isActive
                  ? 'border-slate-950 bg-slate-50 text-slate-950'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={11} className={isActive ? 'text-slate-950' : 'text-slate-400'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab View */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar" id="guidelines-body">
        
        {/* TAB 1: SOP & Platform Protocols */}
        {activeTab === 'sop' && (
          <div className="space-y-2.5 animate-in fade-in duration-300" id="sop-tab-panel">
            <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-xs">
              <h4 className="text-[8px] font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-widest mb-1.5">
                <ShieldCheck size={12} className="text-emerald-600" />
                SOP.01: Professional Environment
              </h4>
              <p className="text-[10px] text-slate-600 leading-normal font-bold uppercase tracking-tight">
                Consultants must operate from a <span className="text-slate-950 underline decoration-emerald-200 underline-offset-4">private, quiet, well-lit professional environment</span>. Professional framing and attire are required. Maintain eye contact and eliminate background audio distractions.
              </p>
            </div>

            <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-xs space-y-2">
              <h4 className="text-[8px] font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-widest">
                <User size={12} className="text-indigo-600" />
                SOP.02: Clinical Consent
              </h4>
              <ul className="space-y-1.5 text-[9px] text-slate-600 font-bold uppercase tracking-tight">
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mt-1 shrink-0" />
                  Explicitly state your name, prefix, and legal specialty.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mt-1 shrink-0" />
                  Verify patient identity and geographic location in Ghana.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mt-1 shrink-0" />
                  Obtain verbal informed consent for session recording.
                </li>
              </ul>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg shadow-xs">
              <h4 className="text-[8px] font-black text-amber-900 flex items-center gap-1.5 uppercase tracking-widest mb-2">
                <AlertTriangle size={12} />
                SOP.03: Connection Fallback
              </h4>
              <p className="text-[9px] text-amber-800 leading-normal font-bold uppercase tracking-tight">
                If bandwidth falls below <span className="font-black">3G speeds (384kbps)</span>, prioritize voice fidelity:
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="p-2 bg-white/60 rounded-md border border-amber-100">
                  <span className="text-[7px] font-black text-amber-900 block mb-0.5 uppercase">Step A</span>
                  <p className="text-[8px] text-amber-800 font-bold leading-tight uppercase tracking-tight">Disable video track to preserve audio packets.</p>
                </div>
                <div className="p-2 bg-white/60 rounded-md border border-amber-100">
                  <span className="text-[7px] font-black text-amber-900 block mb-0.5 uppercase">Step B</span>
                  <p className="text-[8px] text-amber-800 font-bold leading-tight uppercase tracking-tight">Use secure consultant chat for clinical dispatches.</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg shadow-xs">
              <h4 className="text-[8px] font-black text-rose-900 flex items-center gap-1.5 uppercase tracking-widest mb-1.5">
                <ShieldAlert size={12} />
                SOP.04: Prescribing Limits
              </h4>
              <p className="text-[9px] text-rose-800 leading-normal font-bold italic uppercase tracking-tight">
                "Strict prohibition of tele-prescribing for narcotics, benzodiazepines, or abortifacients. Immediate physical referral required."
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Standard Treatment Guidelines (STG) */}
        {activeTab === 'stg' && (
          <div className="space-y-3.5 animate-in fade-in duration-300" id="stg-tab-panel">
            {/* Sub-tabs for STG: Quick Search or PDF Viewer */}
            <div className="flex gap-1.5 p-1 bg-white rounded-lg border border-slate-100 shadow-xs">
              <button
                type="button"
                onClick={() => setStgSubTab('search')}
                className={`flex-1 py-1.5 text-[8px] font-black rounded-md transition-all uppercase tracking-widest ${
                  stgSubTab === 'search' ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Protocol Search
              </button>
              <button
                type="button"
                onClick={() => setStgSubTab('pdf')}
                className={`flex-1 py-1.5 text-[8px] font-black rounded-md transition-all uppercase tracking-widest ${
                  stgSubTab === 'pdf' ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Official PDF
              </button>
            </div>

            {stgSubTab === 'search' ? (
              <div className="space-y-3.5">
                {/* Search Inputs */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search protocol (e.g. Malaria, Asthma)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-950 placeholder:text-slate-400 placeholder:font-black placeholder:uppercase focus:outline-none"
                    />
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 text-[7.5px] font-black rounded-full whitespace-nowrap transition-all border uppercase tracking-wider ${
                          selectedCategory === cat
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-150 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Protocols list */}
                <div className="space-y-2.5">
                  {filteredProtocols.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-lg border border-slate-100 shadow-inner">
                      <ShieldAlert className="mx-auto text-amber-400 mb-2" size={20} />
                      <p className="text-[9px] font-black text-slate-950 uppercase tracking-widest">Zero Protocols Found</p>
                      <p className="text-[8px] text-slate-400 mt-1 font-bold uppercase">Try a different keyword.</p>
                    </div>
                  ) : (
                    filteredProtocols.map((p) => (
                      <div key={p.code} className="bg-white border border-slate-100 rounded-lg p-3 shadow-xs space-y-2.5 group hover:border-emerald-200 transition-all duration-300 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[7.5px] font-black text-white bg-slate-950 px-1.5 py-0.5 rounded font-mono tracking-tighter">
                                {p.code}
                              </span>
                              <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">
                                {p.category}
                              </span>
                            </div>
                            <h4 className="font-black text-[10px] text-slate-950 leading-tight uppercase tracking-tight group-hover:text-emerald-700 transition-colors">{p.condition}</h4>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest block mb-1">
                              Primary Clinical Pathway (MOH Ghana)
                            </span>
                            <p className="text-slate-900 leading-normal font-bold text-[9px] uppercase tracking-tight">{p.firstLine}</p>
                          </div>

                          {p.secondLine && (
                            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                              <span className="text-[7px] font-black text-amber-600 uppercase tracking-widest block mb-1">
                                Secondary Refractory Pathway
                              </span>
                              <p className="text-slate-600 leading-normal font-bold text-[9px] italic uppercase tracking-tight">{p.secondLine}</p>
                            </div>
                          )}

                          {p.specialNotes && (
                            <div className="flex items-start gap-1.5 p-2 bg-emerald-50/30 rounded-md border border-emerald-100/50">
                              <Info size={11} className="text-emerald-600 shrink-0 mt-0.5" />
                              <p className="text-[8.5px] text-emerald-900 font-bold leading-normal uppercase tracking-tight"><span className="font-black underline decoration-emerald-200 decoration-2">Clinical Note:</span> {p.specialNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 flex flex-col h-full animate-in fade-in duration-300">
                <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-950">
                    <Globe size={12} className="text-emerald-600" />
                    <span className="text-[8px] font-black uppercase tracking-widest">STG 7th Edition (PDF)</span>
                  </div>
                  <a
                    href={officialPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-slate-950 text-white text-[8px] font-black uppercase tracking-widest rounded-md hover:bg-slate-800 transition-all flex items-center gap-1"
                  >
                    <Download size={10} /> External Download
                  </a>
                </div>

                <div className="flex-1 min-h-[350px] bg-white border border-slate-100 rounded-lg overflow-hidden shadow-sm relative">
                  <iframe
                    src={embeddedViewerUrl}
                    title="Ghana Standard Treatment Guidelines 2017 PDF"
                    className="w-full h-full min-h-[350px] border-0"
                  />
                  <div className="absolute inset-0 bg-slate-50/50 pointer-events-none flex items-center justify-center -z-10">
                    <Loader2 size={24} className="animate-spin text-slate-200" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Medical Guidelines & Dosing */}
        {activeTab === 'medical' && (
          <div className="space-y-3.5 animate-in fade-in duration-300" id="medical-tab-panel">
            <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-xs space-y-3 text-left">
              <h4 className="text-[8px] font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-widest">
                <Pill size={12} className="text-indigo-600" />
                01. Paediatric Dosing Suite
              </h4>
              <p className="text-[9px] text-slate-500 font-bold leading-normal italic border-l-2 border-slate-200 pl-2 uppercase tracking-tight">
                "Mandatory weight-based calculation required for all neonatal and pediatric prescriptions. Verify weight before initiating therapy."
              </p>
              
              <div className="grid gap-2">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 group">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1 group-hover:text-indigo-600">Weight Estimation (Age 1–9)</span>
                  <p className="text-slate-950 font-black text-[10px] tracking-tight uppercase">Weight (kg) = (Age × 2) + 8</p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-100 group">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1 group-hover:text-emerald-600">Paracetamol Pediatric</span>
                  <p className="text-slate-950 font-black text-[10px] tracking-tight uppercase">15 mg/kg PO q4–6h (Max 4/day)</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg shadow-xs space-y-3 text-left">
              <h4 className="text-[8px] font-black text-rose-900 flex items-center gap-1.5 uppercase tracking-widest">
                <ShieldAlert size={12} />
                02. Emergency Referral Red Flags
              </h4>
              <p className="text-[9px] text-rose-800 font-bold italic leading-normal uppercase tracking-tight">
                Trigger immediate physical emergency protocol if any of these thresholds are breached:
              </p>
              
              <div className="space-y-2">
                {[
                  { label: 'Hypertensive Crisis', desc: 'BP > 180/120 + acute organ damage (chest pain, dyspnea).' },
                  { label: 'Respiratory Failure', desc: 'RR > 30/min, SpO2 < 92% (Room Air), Cyanosis.' },
                  { label: 'Sepsis (qSOFA)', desc: 'Altered mental state + SBP ≤ 100 + RR ≥ 22.' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-white/60 p-2.5 rounded-md border border-rose-250/50 group hover:border-rose-300">
                    <div className="w-1 h-1 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-[9px] font-black text-rose-950 uppercase tracking-tight block mb-0.5">{item.label}</strong>
                      <p className="text-[8.5px] text-rose-800 font-bold leading-normal uppercase tracking-tight">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-xs space-y-3 text-left">
              <h4 className="text-[8px] font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-widest">
                <Info size={12} className="text-slate-400" />
                03. High-Risk Contraindications
              </h4>
              <div className="space-y-2">
                {[
                  { drug: 'Fluoroquinolones', note: 'Contraindicated in pregnancy, lactation, and pediatric (<18) users.' },
                  { drug: 'NSAIDs (Diclofenac)', note: 'Contraindicated in severe CKD, PUD, and 3rd-trimester pregnancy.' },
                  { drug: 'Beta Blockers', note: 'Strictly contraindicated in active Asthma, COPD, or heart blocks.' },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-slate-950 uppercase tracking-tight block">{item.drug}</span>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function ConsultantGuidelinesDrawer({ isOpen, onClose }: ConsultantGuidelinesDrawerProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[120] flex justify-end bg-slate-950/40 backdrop-blur-sm" 
      onClick={onClose}
      id="guidelines-drawer-overlay"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="w-full sm:w-[420px] bg-white text-slate-950 shadow-2xl flex flex-col h-full border-l border-slate-100 animate-in slide-in-from-right duration-200"
        id="guidelines-drawer-container"
      >
        {/* Header */}
        <div className="p-3 bg-white flex items-center justify-between shrink-0 border-b border-slate-100 relative z-10" id="guidelines-drawer-header">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-lg bg-slate-950 text-white flex items-center justify-center shadow-md">
              <BookOpen size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="font-black text-xs text-slate-950 uppercase tracking-tight">Clinical Vault</h3>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                  MOH Ghana
                </span>
              </div>
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Standard Treatment Guidelines</p>
            </div>
          </div>
          <button
            id="close-guidelines-btn"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-950 hover:bg-slate-50 rounded-full transition-all cursor-pointer border border-slate-100"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        <ConsultantGuidelinesContent />
      </div>
    </div>
  );
}
