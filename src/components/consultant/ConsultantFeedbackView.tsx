import React from 'react';
import { Star, MessageSquare } from 'lucide-react';

interface ConsultantFeedbackViewProps {
  reviews: any[];
}

export const ConsultantFeedbackView: React.FC<ConsultantFeedbackViewProps> = ({ reviews }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-white flex items-center gap-2">
        <MessageSquare size={18} className="text-slate-600" />
        <h3 className="text-lg font-black tracking-tight text-slate-800">Patient Feedback</h3>
      </div>
      {reviews.length === 0 ? (
        <div className="p-20 text-center flex flex-col items-center">
          <Star size={48} className="text-slate-500 mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No Feedback Received</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {reviews.map(r => (
            <li key={r.sessionId || r.id} className="p-6 hover:bg-white transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-sm">{r.patientName || 'Anonymous Patient'}</h4>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={12} className={star <= (r.rating || 0) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-500"} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-slate-600 italic">"{r.feedback || 'No written feedback provided.'}"</p>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-3">
                {r.scheduledAt || r.createdAt ? new Date(r.scheduledAt || r.createdAt).toLocaleDateString() : 'Recent'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ConsultantFeedbackView;
