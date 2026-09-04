import React, { useState } from 'react';
import { FileText, Plus, Copy, CheckCircle2, Trash2, X } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface SoapTemplate {
  id: string;
  title: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface QuickCdrTemplateManagerProps {
  onSelectTemplate?: (template: SoapTemplate) => void;
}

export default function QuickCdrTemplateManager({ onSelectTemplate }: QuickCdrTemplateManagerProps) {
  const { showToast } = useAppContext();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [templates] = useState<SoapTemplate[]>([
    {
      id: 'hypertension-review',
      title: 'Hypertension Follow-Up Review',
      subjective: 'Patient reports good compliance with antihypertensive regimen. No severe headaches, dizziness, or blurred vision.',
      objective: 'BP 130/84 mmHg, HR 72 bpm. Heart sounds S1 S2 present, no murmurs.',
      assessment: 'Essential Hypertension — Well controlled on current therapy.',
      plan: 'Continue Amlodipine 5mg daily. Recheck BP in 4 weeks. DASH diet counseling.'
    },
    {
      id: 'malaria-uncomplicated',
      title: 'Uncomplicated Malaria Consult',
      subjective: '3-day history of high grade fever, chills, rigors, malaise and headache.',
      objective: 'Temp 38.5°C, HR 98 bpm. RDT positive for P. falciparum.',
      assessment: 'Uncomplicated Acute Falciparum Malaria.',
      plan: 'Artemether-Lumefantrine (20/120mg) 4 tabs BD x 3 days with fatty meal. Paracetamol 1g TDS x 3 days.'
    },
    {
      id: 'pharmacy-counseling',
      title: 'Clinical Pharmacy Medication Review',
      subjective: 'Patient seeks counseling on drug-drug interactions and side effect mitigation.',
      objective: 'Polypharmacy review: 4 active medications identified.',
      assessment: 'Drug Therapy Problem: Subtherapeutic dosing and minor gastric irritation.',
      plan: 'Advise taking NSAID with food or PPI cover. Adjust dosing interval to 12-hourly.'
    }
  ]);

  const handleApply = (tpl: SoapTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(tpl);
      showToast(`Applied ${tpl.title} template to chart.`, "success");
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={15} className="text-emerald-600" /> Quick SOAP Charting Templates
        </h4>
        <span className="text-[10px] text-slate-400 font-semibold">1-Click Chart Pre-fills</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {templates.map(tpl => (
          <div key={tpl.id} className="p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-500/50 transition-all flex flex-col justify-between gap-2">
            <div>
              <span className="font-bold text-slate-800 text-xs block">{tpl.title}</span>
              <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 font-medium">{tpl.plan}</p>
            </div>

            <button
              onClick={() => handleApply(tpl)}
              className="w-full py-1.5 bg-slate-900 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
            >
              Use Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
