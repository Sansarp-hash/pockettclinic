const fs = require('fs');
let code = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

const target = `  if (activeConsultation?.status === 'INCONCLUSIVE') {
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center max-w-md mx-auto mt-12 bg-white rounded-[32px] border border-slate-200 shadow-lg animate-in fade-in">
        <AlertTriangle size={48} className="text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-black tracking-tight text-slate-800">Consultation Inconclusive</h2>
        <p className="text-slate-600 text-sm mt-2 leading-relaxed">
          The consultant was unable to accept your request within the ringing period. The session has timed out.
        </p>
        <div className="mt-4 p-3.5 bg-slate-50 border border-indigo-100 rounded-2xl text-indigo-950 text-xs font-bold leading-relaxed text-center">
          The medical issue still holds and has been onboarded! A full refund ticket has been generated and credited to your account.
        </div>`;

const replacement = `  if (activeConsultation?.status === 'INCONCLUSIVE') {
    const isEscalated = !!activeConsultation?.inconclusiveContext;
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center max-w-md mx-auto mt-12 bg-white rounded-[32px] border border-slate-200 shadow-lg animate-in fade-in">
        <AlertTriangle size={48} className="text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-black tracking-tight text-slate-800">{isEscalated ? 'Consultation Escalated/Inconclusive' : 'Consultation Inconclusive'}</h2>
        <p className="text-slate-600 text-sm mt-2 leading-relaxed">
          {isEscalated 
            ? "The consultant has marked this session as inconclusive (e.g., requires escalation to a doctor). Your progress has been saved to your vault."
            : "The consultant was unable to accept your request within the ringing period. The session has timed out."
          }
        </p>
        {!isEscalated && (
          <div className="mt-4 p-3.5 bg-slate-50 border border-indigo-100 rounded-2xl text-indigo-950 text-xs font-bold leading-relaxed text-center">
            The medical issue still holds and has been onboarded! A full refund ticket has been generated and credited to your account.
          </div>
        )}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ConsultationRoom.tsx', code);
  console.log("Patched successfully");
} else {
  console.error("Target not found");
}
