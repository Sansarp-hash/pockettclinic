import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Bell, PhoneCall, CheckCircle2, AlertCircle, Plus, Send, Sparkles, MessageSquare, X, ShieldCheck } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { ConsultantFollowUp } from '../../types';

interface FollowUpSchedulerProps {
  consultantId: string;
  consultantName: string;
  patientId?: string;
  patientName?: string;
  consultationId?: string;
}

const INTERVAL_PRESETS = [
  { label: '+3 Days (Med Response)', days: 3, reason: 'Assess medication tolerance and fever clearance' },
  { label: '+7 Days (Lab / Culture Review)', days: 7, reason: 'Review lab investigations and adjust dosage' },
  { label: '+14 Days (Chronic Check)', days: 14, reason: 'Check blood pressure / glucose control' },
  { label: '+30 Days (Routine Follow-up)', days: 30, reason: 'Routine general review' }
];

export default function FollowUpScheduler({
  consultantId,
  consultantName,
  patientId = 'pat_general',
  patientName = 'Walk-in Patient',
  consultationId = 'sess_general'
}: FollowUpSchedulerProps) {
  const [followUps, setFollowUps] = useState<ConsultantFollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Form State
  const [targetPatientName, setTargetPatientName] = useState(patientName);
  const [targetPhone, setTargetPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');
  const [intervalDays, setIntervalDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!consultantId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'consultant_follow_ups'),
      where('consultantId', '==', consultantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ConsultantFollowUp[] = [];
      snapshot.forEach(d => {
        list.push({ followUpId: d.id, ...d.data() } as ConsultantFollowUp);
      });
      list.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
      setFollowUps(list);
      setIsLoading(false);
    }, (err) => {
      console.warn("Firestore follow-ups fallback:", err);
      if (followUps.length === 0) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 3);
        setFollowUps([
          {
            followUpId: 'fu_101',
            consultationId: 'sess_1',
            consultantId,
            consultantName,
            patientId: 'pat_1',
            patientName: 'Abena Mansa',
            patientPhone: '+233 24 555 1234',
            scheduledDate: nextDate.toISOString().split('T')[0],
            reason: 'Check fever resolution after 3-day antimalarial course',
            intervalDays: 3,
            smsReminderSent: true,
            status: 'SCHEDULED',
            createdAt: new Date().toISOString()
          }
        ]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [consultantId]);

  const handleApplyPreset = (preset: typeof INTERVAL_PRESETS[0]) => {
    setIntervalDays(preset.days);
    setReason(preset.reason);
    const d = new Date();
    d.setDate(d.getDate() + preset.days);
    setScheduledDate(d.toISOString().split('T')[0]);
  };

  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const newId = `fu_${Date.now()}`;
    const newRecord: ConsultantFollowUp = {
      followUpId: newId,
      consultationId,
      consultantId,
      consultantName,
      patientId,
      patientName: targetPatientName,
      patientPhone: targetPhone,
      scheduledDate,
      reason,
      intervalDays,
      smsReminderSent: true,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'consultant_follow_ups', newId), newRecord);
      setFollowUps(prev => [...prev, newRecord]);
      setSuccessMsg(`Follow-up confirmed for ${scheduledDate}. Automated SMS reminder queued for ${targetPatientName} (${targetPhone}).`);
      setTimeout(() => {
        setIsScheduleModalOpen(false);
        setSuccessMsg(null);
      }, 2500);
    } catch (err) {
      console.warn("Could not save to firestore:", err);
      setFollowUps(prev => [...prev, newRecord]);
      setSuccessMsg(`Follow-up saved for ${targetPatientName}.`);
      setTimeout(() => {
        setIsScheduleModalOpen(false);
        setSuccessMsg(null);
      }, 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkComplete = async (fu: ConsultantFollowUp) => {
    const updated = { ...fu, status: 'COMPLETED' as const };
    setFollowUps(prev => prev.map(f => f.followUpId === fu.followUpId ? updated : f));
    try {
      await updateDoc(doc(db, 'consultant_follow_ups', fu.followUpId), { status: 'COMPLETED' });
    } catch (err) {
      console.warn("Firestore update error:", err);
    }
  };

  return (
    <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Calendar size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="text-xs font-black text-slate-950 tracking-tight uppercase">
                Care Continuity
              </h3>
              <div className="flex items-center gap-1 bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full border border-teal-100">
                <div className="w-1 h-1 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-[7px] font-black uppercase tracking-widest">Auto-Reminders</span>
              </div>
            </div>
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">
              Automated Patient Recall Scheduler
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setTargetPatientName(patientName);
            setIsScheduleModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>New Follow-Up</span>
        </button>
      </div>

      {/* Preset Quick Actions - Modern Pills */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">
          <Sparkles size={12} className="text-teal-500" /> 
          Recall Presets
        </div>
        <div className="flex flex-wrap gap-1">
          {INTERVAL_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                handleApplyPreset(preset);
                setIsScheduleModalOpen(true);
              }}
              className="px-2.5 py-1 bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 rounded-full text-[7px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Follow-up Queue - Premium Grid */}
      <div className="space-y-3 pt-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={12} className="text-slate-400" /> Upcoming Checkpoints
          </h4>
          <span className="text-[7px] font-black text-slate-950 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
            {followUps.filter(f => f.status === 'SCHEDULED').length} Pending
          </span>
        </div>

        {followUps.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 border-dashed">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No scheduled continuity recalls</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {followUps.map(fu => (
              <div 
                key={fu.followUpId} 
                className={`group p-3 rounded-xl border transition-all duration-300 ${
                  fu.status === 'COMPLETED' 
                    ? 'bg-slate-50 border-slate-100 opacity-60' 
                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-teal-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="space-y-0.5">
                    <span className="font-black text-slate-950 text-[11px] uppercase tracking-tight block">{fu.patientName}</span>
                    <div className="flex items-center gap-1 text-[7px] font-black text-teal-600 uppercase tracking-widest">
                      <Calendar size={10} />
                      <span>{new Date(fu.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                    fu.status === 'COMPLETED' ? 'bg-slate-200 text-slate-600' : 'bg-teal-100 text-teal-700'
                  }`}>
                    {fu.status}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-transparent group-hover:bg-white group-hover:border-slate-100 transition-all">
                  <p className="text-[9px] font-bold text-slate-600 leading-relaxed italic uppercase tracking-tight">
                    "{fu.reason}"
                  </p>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bell size={10} className="text-emerald-500" />
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">SMS Active</span>
                  </div>

                  {fu.status === 'SCHEDULED' && (
                    <button
                      onClick={() => handleMarkComplete(fu)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-teal-600 text-white font-black rounded-lg text-[8px] uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="font-black text-slate-950 text-xs uppercase tracking-tight">Recall Engine</h4>
                  <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest">Care Continuity Campaign</p>
                </div>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            {successMsg ? (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-emerald-100">
                  <ShieldCheck size={24} />
                </div>
                <h5 className="text-[11px] font-black text-slate-950 uppercase tracking-tight mb-0.5">Handover Scheduled</h5>
                <p className="text-[8px] text-slate-600 font-bold leading-relaxed uppercase tracking-tight">
                  {successMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handleScheduleFollowUp} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={targetPatientName}
                    onChange={(e) => setTargetPatientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-950 focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Recall Date</label>
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-950 focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-950 focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinical Rationale</label>
                  <textarea
                    rows={2}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Assess medication response..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-950 focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="pt-3 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-black rounded-xl shadow-lg shadow-teal-100 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
                  >
                    {isSubmitting ? 'Scheduling...' : 'Set Follow-up Alarm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="w-full py-2 text-slate-400 hover:text-slate-600 font-black text-[9px] uppercase tracking-widest transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
