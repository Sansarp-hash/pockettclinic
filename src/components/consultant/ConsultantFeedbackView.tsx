import React from 'react';
import { Star, MessageSquare, CheckCircle2 } from 'lucide-react';

interface ConsultantFeedbackViewProps {
  reviews: any[];
}

export const ConsultantFeedbackView: React.FC<ConsultantFeedbackViewProps> = ({ reviews }) => {
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="p-8 md:p-10 border-b border-slate-50 bg-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-950 uppercase">Clinical Feedback</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Patient Experience & Quality Metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
          <Star size={14} className="fill-amber-400 text-amber-400" />
          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
            {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) : '0.0'} Rating
          </span>
        </div>
      </div>
      {reviews.length === 0 ? (
        <div className="p-24 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-[24px] bg-slate-50 flex items-center justify-center text-slate-300 mb-6 border border-slate-100">
            <Star size={32} />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No patient testimonials documented</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {reviews.map(r => (
            <li key={r.sessionId || r.id} className="p-8 md:p-10 hover:bg-slate-50/50 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-[10px] border border-slate-200">
                    {(r.patientName || 'A')[0]}
                  </div>
                  <h4 className="font-black text-slate-950 text-sm uppercase tracking-tight">{r.patientName || 'Verified Patient'}</h4>
                </div>
                <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={10} className={star <= (r.rating || 0) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-300"} />
                  ))}
                </div>
              </div>
              <div className="p-6 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm italic">
                <p className="text-xs text-slate-600 font-bold leading-relaxed">"{r.feedback || 'Clinical experience was positive. No detailed written feedback provided.'}"</p>
              </div>
              <div className="flex items-center justify-between mt-5">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
                  {r.scheduledAt || r.createdAt ? new Date(r.scheduledAt || r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified Session'}
                </p>
                <div className="flex items-center gap-1.5 text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  <CheckCircle2 size={10} /> Verified Review
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ConsultantFeedbackView;
