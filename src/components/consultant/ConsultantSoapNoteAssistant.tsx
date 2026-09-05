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
    <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-slate-200/40 border border-slate-100 space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-slate-50">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[24px] bg-slate-900 text-white flex items-center justify-center shadow-2xl shadow-slate-900/20 shrink-0">
            <FileText size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-2xl font-black text-slate-950 tracking-tight uppercase">
                Clinical Note Pad
              </h3>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest">Voice Enabled</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              Structured SOAP Documentation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyNote}
            className="flex items-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-slate-200"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {saveSuccess ? <ShieldCheck size={16} /> : <Save size={16} />}
            <span>{saveSuccess ? 'Finalized' : isSaving ? 'Signing...' : 'Sign & Save'}</span>
          </button>
        </div>
      </div>

      {/* Disease Presets - Modern Pills */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          <Sparkles size={14} className="text-amber-500" /> 
          Clinical Presets
        </div>
        <div className="flex flex-wrap gap-2">
          {CONSULTANT_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(preset)}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Structured SOAP Grid - Premium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { label: 'Subjective', id: 'S' as const, field: 'subjective', icon: 'S', color: 'bg-indigo-600', val: subjective, set: setSubjective, placeholder: 'Symptoms, onset, HPI...' },
          { label: 'Objective', id: 'O' as const, field: 'objective', icon: 'O', color: 'bg-emerald-600', val: objective, set: setObjective, placeholder: 'Vitals, physical exam, labs...' },
          { label: 'Assessment', id: 'A' as const, field: 'assessment', icon: 'A', color: 'bg-amber-600', val: assessment, set: setAssessment, placeholder: 'Clinical impression, diagnosis...' },
          { label: 'Plan', id: 'P' as const, field: 'plan', icon: 'P', color: 'bg-rose-600', val: plan, set: setPlan, placeholder: 'Rx, follow-up, advice...' },
        ].map((item) => (
          <div key={item.id} className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200 transition-all duration-300 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl ${item.color} text-white flex items-center justify-center text-xs font-black shadow-lg`}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleVoiceDictation(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                  isDictating && activeDictationField === item.id
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {isDictating && activeDictationField === item.id ? <MicOff size={12} /> : <Mic size={12} />}
                <span>{isDictating && activeDictationField === item.id ? 'Listening' : 'Voice'}</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={item.val}
              onChange={(e) => item.set(e.target.value)}
              placeholder={item.placeholder}
              className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-bold focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-100 transition-all outline-none resize-none leading-relaxed"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
