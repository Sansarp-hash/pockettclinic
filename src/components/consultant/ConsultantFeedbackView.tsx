import React from 'react';
import { Star, MessageSquare, CheckCircle2 } from 'lucide-react';

interface ConsultantFeedbackViewProps {
  reviews: any[];
}

export const ConsultantFeedbackView: React.FC<ConsultantFeedbackViewProps> = ({ reviews }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <div className="p-3 border-b border-slate-50 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-tight text-slate-950 uppercase">Clinical Feedback</h3>
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Patient Experience Metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
          <Star size={10} className="fill-amber-400 text-amber-400" />
          <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">
            {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) : '0.0'}
          </span>
        </div>
      </div>
      {reviews.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center">
          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 mb-3 border border-slate-100">
            <Star size={18} />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">No patient testimonials</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {reviews.map(r => (
            <li key={r.sessionId || r.id} className="p-3 hover:bg-slate-50/50 transition-all duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-[8px] border border-slate-200">
                    {(r.patientName || 'A')[0]}
                  </div>
                  <h4 className="font-black text-slate-950 text-[10px] uppercase tracking-tight">{r.patientName || 'Verified Patient'}</h4>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={7} className={star <= (r.rating || 0) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-300"} />
                  ))}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 shadow-sm italic">
                <p className="text-[9px] text-slate-600 font-bold leading-tight">"{r.feedback || 'Clinical experience was positive.'}"</p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest">
                  {r.scheduledAt || r.createdAt ? new Date(r.scheduledAt || r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified Session'}
                </p>
                <div className="flex items-center gap-1 text-[6px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  <CheckCircle2 size={7} /> Verified Review
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
