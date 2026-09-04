import React, { useState } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote, ShieldCheck } from 'lucide-react';

export default function PatientReviewsCarousel() {
  const reviews = [
    {
      id: 1,
      name: 'Abena K.',
      location: 'East Legon, Accra',
      cadreSeen: 'Pharmacist',
      text: 'Got my drug-drug interaction issue resolved in 10 minutes flat! Pharm. Mensah explained my blood pressure medications clearly without me sitting in traffic.',
      stars: 5,
      date: 'Yesterday'
    },
    {
      id: 2,
      name: 'Kofi A.',
      location: 'Kumasi, Ashanti',
      cadreSeen: 'Doctor',
      text: 'Dr. Owusu diagnosed my acute fever virtually and sent my e-prescription straight to the pharmacy. Best telehealth app in Ghana!',
      stars: 5,
      date: '3 days ago'
    },
    {
      id: 3,
      name: 'Grace M.',
      location: 'Takoradi, Western Region',
      cadreSeen: 'Physician Assistant',
      text: 'Very professional PA session for my child’s allergic rash. Warm, patient, and extremely attentive.',
      stars: 5,
      date: '4 days ago'
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  const prev = () => setCurrentIndex(i => (i === 0 ? reviews.length - 1 : i - 1));
  const next = () => setCurrentIndex(i => (i === reviews.length - 1 ? 0 : i + 1));

  const current = reviews[currentIndex];

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Quote size={20} className="text-emerald-400" />
          <h3 className="font-bold text-sm text-white">Verified Patient Experiences</h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="p-2 min-w-[38px] min-h-[38px] bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors cursor-pointer flex items-center justify-center"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={next}
            className="p-2 min-w-[38px] min-h-[38px] bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors cursor-pointer flex items-center justify-center"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3 min-h-[120px]">
        <div className="flex items-center gap-1 text-amber-400">
          {[...Array(current.stars)].map((_, idx) => (
            <Star key={idx} size={16} className="fill-amber-400" />
          ))}
        </div>

        <p className="text-sm text-slate-200 italic font-medium leading-relaxed">
          "{current.text}"
        </p>

        <div className="flex items-center justify-between pt-2 text-xs">
          <div>
            <span className="font-bold text-white block">{current.name}</span>
            <span className="text-[10px] text-slate-400 font-medium">{current.location}</span>
          </div>

          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
            <ShieldCheck size={12} /> {current.cadreSeen} Consult
          </span>
        </div>
      </div>
    </div>
  );
}
