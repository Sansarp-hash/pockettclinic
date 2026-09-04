import React, { useState } from 'react';
import { 
  BookOpen, Search, ExternalLink, FileText, ShieldAlert, X, ChevronRight, 
  Stethoscope, Pill, Download, Globe, CheckCircle, Info, AlertTriangle, 
  ShieldCheck, HeartPulse, Scale, User, HelpCircle
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
    <div className="flex-1 flex flex-col h-full bg-transparent text-slate-200 overflow-hidden" id="guidelines-content-container">
      {/* 3 Universal Guidelines Tabs */}
      <div className="flex items-center bg-transparent px-3 pt-2 gap-1 shrink-0 overflow-x-auto scrollbar-none" id="guidelines-tab-header">
        <button
          id="tab-sop"
          onClick={() => setActiveTab('sop')}
          className={`px-3 py-2 text-[11px] font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'sop'
              ? 'border-slate-300 bg-transparent text-slate-200 font-black'
              : 'border-transparent text-slate-300 hover:text-slate-300'
          }`}
        >
          <Scale size={13} /> SOP & Platform Protocols
        </button>
        <button
          id="tab-stg"
          onClick={() => setActiveTab('stg')}
          className={`px-3 py-2 text-[11px] font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'stg'
              ? 'border-slate-300 bg-transparent text-slate-200 font-black'
              : 'border-transparent text-slate-300 hover:text-slate-300'
          }`}
        >
          <Stethoscope size={13} /> Standard Treatment (STG)
        </button>
        <button
          id="tab-medical"
          onClick={() => setActiveTab('medical')}
          className={`px-3 py-2 text-[11px] font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'medical'
              ? 'border-slate-300 bg-transparent text-slate-200 font-black'
              : 'border-transparent text-slate-300 hover:text-slate-300'
          }`}
        >
          <HeartPulse size={13} /> Medical Guidelines & Dosing
        </button>
      </div>

      {/* Main Tab View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" id="guidelines-body">
        
        {/* TAB 1: SOP & Platform Protocols */}
        {activeTab === 'sop' && (
          <div className="space-y-4" id="sop-tab-panel">
            <div className="p-3 bg-slate-900/80 border border-white/20 rounded-2xl">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider mb-1">
                <ShieldCheck size={14} /> SOP.01: Telemedicine Consultant Readiness
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Before activating a live audio/video session, consultants must ensure they are operating from a <strong>private, quiet, well-lit professional environment</strong>. Professional consultant framing and attire are required. Maintain eye contact and eliminate background audio distractions to uphold privacy standards.
              </p>
            </div>

            <div className="p-3 bg-slate-900/60 border-white/10 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <User size={14} className="text-white" /> SOP.02: Mandatory Informed Consent
              </h4>
              <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc pl-4">
                <li>Explicitly state your name, prefix (Dr./Pharm./Mr.), and legal specialty.</li>
                <li>Verify the patient's full identity and location in Ghana.</li>
                <li>Obtain <strong>verbal informed consent</strong> to record summary vitals and conduct the consultation via digital medium.</li>
                <li>Briefly explain that telemedicine holds technical limits and physical referral remains a standard secondary option.</li>
              </ul>
            </div>

            <div className="p-3 bg-amber-950/80 border border-amber-900/40 rounded-2xl">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider mb-1">
                <AlertTriangle size={14} /> SOP.03: Audio-Video Connection Fallback
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                In cases of severe connection degradation or bandwidth falling below <strong>3G speeds</strong>:
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-slate-900/60 rounded-xl border border-white/10">
                  <span className="font-bold text-white block mb-0.5">Step A</span>
                  Toggle video track off to prioritize high-fidelity clinical audio and prevent voice clipping.
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-white/10">
                  <span className="font-bold text-white block mb-0.5">Step B</span>
                  Utilize secure consultant chat for medical documentation, prescribing details, and patient follow-ups.
                </div>
              </div>
            </div>

            <div className="p-3 bg-rose-950/80 border border-rose-500/30 rounded-2xl">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5 uppercase tracking-wider mb-1">
                <ShieldAlert size={14} /> SOP.04: Restricted Prescribing Limits
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                PockettClinic strictly prohibits the tele-prescribing of <strong>narcotic analgesics, benzodiazepines, barbiturates, or abortifacients</strong>. Any clinical requirement for these controlled substances requires an immediate physical facility referral.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Standard Treatment Guidelines (STG) */}
        {activeTab === 'stg' && (
          <div className="space-y-3" id="stg-tab-panel">
            {/* Sub-tabs for STG: Quick Search or PDF Viewer */}
            <div className="flex gap-2 p-1 bg-slate-900/60 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setStgSubTab('search')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  stgSubTab === 'search' ? 'bg-emerald-600 text-white font-black' : 'text-slate-300 hover:text-slate-300'
                }`}
              >
                Quick Guidelines Search
              </button>
              <button
                type="button"
                onClick={() => setStgSubTab('pdf')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  stgSubTab === 'pdf' ? 'bg-emerald-600 text-white font-black' : 'text-slate-300 hover:text-slate-300'
                }`}
              >
                Official PDF Viewer
              </button>
            </div>

            {stgSubTab === 'search' ? (
              <div className="space-y-3">
                {/* Search Inputs */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-300" />
                    <input
                      type="text"
                      placeholder="Search condition, drug, STG protocol..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-300"
                    />
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-emerald-600 text-white font-black'
                            : 'bg-transparent text-slate-300 hover:bg-transparent/10 hover:text-slate-300'
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
                    <div className="p-6 text-center bg-slate-800/80 rounded-2xl border border-white/10">
                      <ShieldAlert className="mx-auto text-amber-400 mb-2" size={24} />
                      <p className="text-xs font-bold text-slate-300">No matching STG protocols found</p>
                      <p className="text-[11px] text-white mt-1">Try another search or switch to the Official PDF viewer tab.</p>
                    </div>
                  ) : (
                    filteredProtocols.map((p) => (
                      <div key={p.code} className="bg-slate-900/60 border-white/10 hover:border-white/10 rounded-2xl p-3 transition-all space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-white bg-slate-800/80 border border-white/20 px-1.5 py-0.5 rounded font-mono">
                                {p.code}
                              </span>
                              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">
                                {p.category}
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-white mt-1">{p.condition}</h4>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="bg-slate-900/60 p-2 rounded-xl border border-white/10">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">
                              1st Line Treatment (Ghana STG)
                            </span>
                            <p className="text-slate-300 leading-relaxed font-mono text-[10px]">{p.firstLine}</p>
                          </div>

                          {p.secondLine && (
                            <div className="bg-slate-900/40 p-2 rounded-xl border border-white/10/60">
                              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block mb-0.5">
                                2nd Line / Refractory
                              </span>
                              <p className="text-slate-300 leading-relaxed font-mono text-[10px]">{p.secondLine}</p>
                            </div>
                          )}

                          {p.specialNotes && (
                            <div className="flex items-start gap-1.5 text-slate-300 text-[10px] pt-0.5">
                              <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                              <p><strong className="text-slate-300">Caution:</strong> {p.specialNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2 flex flex-col h-full">
                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-white/10 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                    <Globe size={14} className="text-white shrink-0" />
                    <span>MOH Republic of Ghana Guidelines (7th Ed)</span>
                  </div>
                  <a
                    href={officialPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 text-[11px] shrink-0"
                  >
                    <Download size={11} /> Open PDF
                  </a>
                </div>

                <div className="flex-1 min-h-[350px] bg-slate-900/60 border-white/10 rounded-2xl overflow-hidden relative">
                  <iframe
                    src={embeddedViewerUrl}
                    title="Ghana Standard Treatment Guidelines 2017 PDF"
                    className="w-full h-full min-h-[350px] border-0 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Medical Guidelines & Dosing */}
        {activeTab === 'medical' && (
          <div className="space-y-4" id="medical-tab-panel">
            {/* Subsection 1: Paediatric weight formulas */}
            <div className="p-4 bg-slate-900/60 border-white/10 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Pill size={14} className="text-white" /> 1. Pediatric Dosing Standards
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Always compute weight-based doses where weight is verified. In absence of active scaling, use weight estimation calculations:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/10 space-y-1">
                  <span className="font-bold text-emerald-400 block">Weight Estimation (Age 1–9)</span>
                  <p className="text-slate-300 font-mono">Weight (kg) = (Age in Years × 2) + 8</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/10 space-y-1">
                  <span className="font-bold text-white block">Paediatric Paracetamol Dosing</span>
                  <p className="text-slate-300 font-mono">15 mg/kg PO every 4 to 6 hours (Max 4 doses daily)</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/10 space-y-1 col-span-1 sm:col-span-2">
                  <span className="font-bold text-amber-400 block">Paediatric Amoxicillin Dosing</span>
                  <p className="text-slate-300 font-mono">40–90 mg/kg/day PO divided into 2 or 3 doses based on severity of community pneumonia</p>
                </div>
              </div>
            </div>

            {/* Subsection 2: Red flags & specialist routing */}
            <div className="p-4 bg-rose-950/80 border border-rose-500/30 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldAlert size={14} /> 2. Red Flags & Immediate Specialist Routing
              </h4>
              <p className="text-[11px] text-slate-300">
                Immediately trigger a physical referral or direct emergency routing if the patient demonstrates any of the following parameters:
              </p>
              
              <div className="space-y-2 text-[10px]">
                <div className="flex items-start gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white block">Hypertensive Emergency</strong>
                    Systolic BP &gt; 180 mmHg OR Diastolic BP &gt; 120 mmHg in association with acute organ damage (chest pain, dyspnea, neurological signs).
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white block">Acute Respiratory Distress</strong>
                    Respiratory rate &gt; 30 breaths/minute, oxygen saturation &lt; 92% on room air, accessory muscle recruitment, or cyanosis.
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white block">Suspected Sepsis</strong>
                    Two or more qSOFA parameters (altered mental state, systolic BP &le; 100 mmHg, respiratory rate &ge; 22/min) with suspected source of infection.
                  </div>
                </div>
              </div>
            </div>

            {/* Subsection 3: Contraindications */}
            <div className="p-4 bg-slate-900/60 border-white/10 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Info size={14} className="text-white" /> 3. High-Alert Contraindications
              </h4>
              <div className="space-y-2 text-[10px] text-slate-300">
                <div className="flex justify-between items-start border-b border-white/10 pb-2">
                  <span className="font-bold text-slate-300">Fluoroquinolones (e.g. Ciprofloxacin)</span>
                  <span className="text-rose-400 text-right">Contraindicated in pregnancy, lactation, and pediatric populations under 18 (cartilage safety).</span>
                </div>
                <div className="flex justify-between items-start border-b border-white/10 pb-2">
                  <span className="font-bold text-slate-300">NSAIDs (e.g. Diclofenac, Ibuprofen)</span>
                  <span className="text-rose-400 text-right">Contraindicated in severe chronic kidney disease (CKD), active peptic ulcer disease, and 3rd-trimester pregnancy.</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-300">Beta Blockers (e.g. Propranolol)</span>
                  <span className="text-rose-400 text-right">Strictly contraindicated in active asthma, severe COPD, or second/third-degree heart blocks.</span>
                </div>
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
        className="w-full sm:w-[480px] bg-slate-900/80 backdrop-blur-2xl text-slate-200 shadow-2xl flex flex-col h-full border-l border-white/10 animate-in slide-in-from-right duration-200"
        id="guidelines-drawer-container"
      >
        {/* Header */}
        <div className="p-3 sm:p-4 bg-transparent flex items-center justify-between shrink-0" id="guidelines-drawer-header">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 text-white rounded-xl border border-slate-300/30">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                Consultant Guidelines
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">
                  MOH Ghana
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">Ghana Standard Treatment Guidelines & Platform SOPs</p>
            </div>
          </div>
          <button
            id="close-guidelines-btn"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-transparent rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <ConsultantGuidelinesContent />
      </div>
    </div>
  );
}
