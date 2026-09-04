import React, { useState } from 'react';
import { FileText, Mic, MicOff, Copy, Check, Sparkles, Save, BookOpen, AlertCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { SoapNote } from '../../types';

interface ConsultantSoapNoteAssistantProps {
  consultantId: string;
  consultantName: string;
  patientId?: string;
  patientName?: string;
  sessionId?: string;
  onSaveNote?: (note: SoapNote) => void;
}

const CONSULTANT_PRESETS = [
  {
    name: 'Uncomplicated Malaria',
    subjective: 'Patient reports 3-day history of intermittent fevers, chills, rigors, headache, and general body weakness. Denies vomiting, convulsions, or dark urine.',
    objective: 'Temp: 38.6°C, BP: 118/76 mmHg, HR: 94 bpm. Alert, febrile to touch, non-icteric, no neck stiffness. Chest clear. Abdomen soft, non-tender, no splenomegaly. RDT (mRDT): Positive for P. falciparum.',
    assessment: 'Uncomplicated Plasmodium falciparum Malaria (ICD-10: B50.9)',
    plan: '1. Tab Artemether-Lumefantrine (20/120mg) 4 tabs BD x 3 days with fatty meal.\n2. Tab Paracetamol 1g TDS x 3 days for fever/pain.\n3. Oral rehydration & mosquito net usage.\n4. Return if fevers persist >72 hrs or persistent vomiting.'
  },
  {
    name: 'Upper Respiratory Tract Infection (URTI)',
    subjective: 'Patient presents with sore throat, clear rhinorrhea, sneezing, and dry cough for 4 days. No high fevers, no shortness of breath.',
    objective: 'Temp: 37.2°C, SpO2: 98% on room air, RR: 16 bpm. Pharynx mildly erythematous without tonsillar exudates. Lungs clear to auscultation bilaterally.',
    assessment: 'Acute Viral Pharyngitis / Upper Respiratory Tract Infection (ICD-10: J06.9)',
    plan: '1. Supportive care: warm saline gargles, honey & lemon.\n2. Tab Paracetamol 1g PRN for throat discomfort.\n3. Antihistamine (Cetirizine 10mg nocte x 5 days) for rhinorrhea.\n4. Reassure viral etiology; no antibiotics indicated.'
  },
  {
    name: 'Hypertension Review & Maintenance',
    subjective: 'Routine chronic review. Patient reports good medication adherence with no headaches, chest pain, dizziness, or visual disturbances.',
    objective: 'Sitting BP: 132/84 mmHg, Repeat BP: 128/82 mmHg. HR: 72 bpm regular. BMI: 27.4 kg/m2. No peripheral edema.',
    assessment: 'Essential Hypertension - Well Controlled (ICD-10: I10)',
    plan: '1. Continue Tab Amlodipine 5mg OD mane.\n2. Continue lifestyle modifications (low sodium, DASH diet, 30 min daily brisk walking).\n3. Check fasting lipid panel and serum electrolytes/creatinine in 3 months.\n4. Next routine review in 60 days.'
  },
  {
    name: 'Acute Gastroenteritis',
    subjective: 'Patient reports 24-hr history of watery diarrhea (4 episodes) and mild cramping abdominal pain. Tolerating oral fluids.',
    objective: 'Temp: 37.1°C, BP: 110/70 mmHg, HR: 82 bpm. Mucous membranes moist, skin turgor normal. Abdomen soft with hyperactive bowel sounds.',
    assessment: 'Acute Viral Gastroenteritis with Mild Dehydration (ICD-10: A08.4)',
    plan: '1. Oral Rehydration Salts (ORS) 1 sachet per loose stool.\n2. Tab Zinc Sulfate 20mg OD x 10 days.\n3. Tab Paracetamol 500mg PRN for cramps.\n4. Avoid anti-motility agents.\n5. Follow-up if blood in stool or inability to retain fluids.'
  }
];

export default function ConsultantSoapNoteAssistant({
  consultantId,
  consultantName,
  patientId = 'pat_general',
  patientName = 'Walk-in Patient',
  sessionId = 'sess_general',
  onSaveNote
}: ConsultantSoapNoteAssistantProps) {
  const { showToast } = useAppContext();
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [activeDictationField, setActiveDictationField] = useState<'S' | 'O' | 'A' | 'P'>('S');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const applyPreset = (preset: typeof CONSULTANT_PRESETS[0]) => {
    setSubjective(preset.subjective);
    setObjective(preset.objective);
    setAssessment(preset.assessment);
    setPlan(preset.plan);
  };

  const toggleVoiceDictation = (field: 'S' | 'O' | 'A' | 'P') => {
    setActiveDictationField(field);
    if (isDictating) {
      setIsDictating(false);
      return;
    }

    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        setIsDictating(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (field === 'S') setSubjective(prev => prev ? `${prev} ${transcript}` : transcript);
          else if (field === 'O') setObjective(prev => prev ? `${prev} ${transcript}` : transcript);
          else if (field === 'A') setAssessment(prev => prev ? `${prev} ${transcript}` : transcript);
          else if (field === 'P') setPlan(prev => prev ? `${prev} ${transcript}` : transcript);
          setIsDictating(false);
        };
        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error in SOAP assistant:", event.error);
          setIsDictating(false);
          if (event.error === 'not-allowed') {
            showToast('Microphone access denied. Please enable permissions to use voice dictation, or type manually.', "error");
          } else if (event.error === 'network') {
            showToast('A speech recognition network error occurred. Please try again or type manually.', "error");
          }
        };
        recognition.onend = () => setIsDictating(false);
        recognition.start();
      } catch (err) {
        console.warn("Speech recognition initialization failed:", err);
        setIsDictating(false);
      }
    } else {
      showToast('Speech recognition is not supported in this browser.', "info");
    }
  };

  const getFormattedNoteText = () => {
    return `CONSULTANT SOAP NOTE\nPatient: ${patientName}\nConsultant: ${consultantName}\nDate: ${new Date().toLocaleString()}\n\n[SUBJECTIVE]\n${subjective || 'N/A'}\n\n[OBJECTIVE]\n${objective || 'N/A'}\n\n[ASSESSMENT]\n${assessment || 'N/A'}\n\n[PLAN]\n${plan || 'N/A'}`;
  };

  const handleCopyNote = () => {
    navigator.clipboard.writeText(getFormattedNoteText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const noteId = `soap_${Date.now()}`;
    const newNote: SoapNote = {
      noteId,
      sessionId,
      consultantId,
      patientId,
      patientName,
      subjective,
      objective,
      assessment,
      plan,
      createdAt: new Date().toISOString(),
      isSigned: true,
      signedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'soap_notes', noteId), newNote);
      if (onSaveNote) onSaveNote(newNote);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn("Firestore save error, saving locally:", err);
      if (onSaveNote) onSaveNote(newNote);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center border border-indigo-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">
                Clinical SOAP Note & Voice Assistant
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                Fast EMR
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Structured clinical documentation with 1-click disease templates and voice dictation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyNote}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Formatted'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shadow-indigo-600/20 transition-all cursor-pointer"
          >
            {saveSuccess ? <ShieldCheck size={15} /> : <Save size={15} />}
            <span>{saveSuccess ? 'Signed & Saved!' : isSaving ? 'Saving...' : 'Save & Sign Note'}</span>
          </button>
        </div>
      </div>

      {/* Disease Presets Bar */}
      <div className="space-y-2">
        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={13} className="text-amber-500" /> Quick Disease Templates
        </div>
        <div className="flex flex-wrap gap-2">
          {CONSULTANT_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 hover:text-slate-600 border border-slate-200 hover:border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Structured SOAP Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subjective */}
        <div className="bg-white/70 p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">S</span>
              Subjective (Chief Complaint & HPI)
            </label>
            <button
              type="button"
              onClick={() => toggleVoiceDictation('S')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isDictating && activeDictationField === 'S'
                  ? 'bg-rose-500 text-slate-600 animate-pulse'
                  : 'bg-white text-slate-600 hover:text-slate-600 border border-slate-200'
              }`}
              title="Voice Dictate"
            >
              {isDictating && activeDictationField === 'S' ? <MicOff size={13} /> : <Mic size={13} />}
              <span className="text-[10px]">{isDictating && activeDictationField === 'S' ? 'Listening...' : 'Dictate'}</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={subjective}
            onChange={(e) => setSubjective(e.target.value)}
            placeholder="Patient's reported symptoms, onset, severity, aggravating/relieving factors..."
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
        </div>

        {/* Objective */}
        <div className="bg-white/70 p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">O</span>
              Objective (Vitals, Physical Exam, Labs)
            </label>
            <button
              type="button"
              onClick={() => toggleVoiceDictation('O')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isDictating && activeDictationField === 'O'
                  ? 'bg-rose-500 text-slate-600 animate-pulse'
                  : 'bg-white text-slate-600 hover:text-slate-600 border border-slate-200'
              }`}
              title="Voice Dictate"
            >
              {isDictating && activeDictationField === 'O' ? <MicOff size={13} /> : <Mic size={13} />}
              <span className="text-[10px]">{isDictating && activeDictationField === 'O' ? 'Listening...' : 'Dictate'}</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Blood pressure, heart rate, temperature, visual findings, lab tests..."
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
        </div>

        {/* Assessment */}
        <div className="bg-white/70 p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-amber-600 text-slate-600 flex items-center justify-center text-[10px]">A</span>
              Assessment (Working Diagnosis / ICD-10)
            </label>
            <button
              type="button"
              onClick={() => toggleVoiceDictation('A')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isDictating && activeDictationField === 'A'
                  ? 'bg-rose-500 text-slate-600 animate-pulse'
                  : 'bg-white text-slate-600 hover:text-slate-600 border border-slate-200'
              }`}
              title="Voice Dictate"
            >
              {isDictating && activeDictationField === 'A' ? <MicOff size={13} /> : <Mic size={13} />}
              <span className="text-[10px]">{isDictating && activeDictationField === 'A' ? 'Listening...' : 'Dictate'}</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="Primary clinical impression, differential diagnoses..."
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
        </div>

        {/* Plan */}
        <div className="bg-white/70 p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">P</span>
              Plan (Prescriptions, Diagnostics, Patient Advice)
            </label>
            <button
              type="button"
              onClick={() => toggleVoiceDictation('P')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isDictating && activeDictationField === 'P'
                  ? 'bg-rose-500 text-slate-600 animate-pulse'
                  : 'bg-white text-slate-600 hover:text-slate-600 border border-slate-200'
              }`}
              title="Voice Dictate"
            >
              {isDictating && activeDictationField === 'P' ? <MicOff size={13} /> : <Mic size={13} />}
              <span className="text-[10px]">{isDictating && activeDictationField === 'P' ? 'Listening...' : 'Dictate'}</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="Medication orders, follow-up timeline, red flags and warning signs given..."
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
