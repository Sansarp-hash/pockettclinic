import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface DaySchedule {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export default function ConsultantAvailabilityScheduler() {
  const { user, showToast } = useAppContext();
  const [isSaving, setIsSaving] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[]>([
    { day: 'Monday', enabled: true, startTime: '08:00', endTime: '17:00' },
    { day: 'Tuesday', enabled: true, startTime: '08:00', endTime: '17:00' },
    { day: 'Wednesday', enabled: true, startTime: '08:00', endTime: '17:00' },
    { day: 'Thursday', enabled: true, startTime: '08:00', endTime: '17:00' },
    { day: 'Friday', enabled: true, startTime: '08:00', endTime: '17:00' },
    { day: 'Saturday', enabled: false, startTime: '09:00', endTime: '14:00' },
    { day: 'Sunday', enabled: false, startTime: '09:00', endTime: '14:00' },
  ]);

  useEffect(() => {
    if (!user) return;
    const fetchSchedule = async () => {
      try {
        const userId = user.uid || user.id;
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists() && snap.data().weeklySchedule) {
          setSchedule(snap.data().weeklySchedule);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    };
    fetchSchedule();
  }, [user?.uid]);

  const handleToggleDay = (index: number) => {
    const updated = [...schedule];
    updated[index].enabled = !updated[index].enabled;
    setSchedule(updated);
  };

  const handleTimeChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const updated = [...schedule];
    updated[index][field] = value;
    setSchedule(updated);
  };

  const handleSaveSchedule = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const userId = user.uid || user.id;
      await updateDoc(doc(db, 'users', userId), {
        weeklySchedule: schedule,
        scheduleUpdatedAt: new Date().toISOString()
      });
      showToast("Weekly shift schedule saved successfully.", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      showToast("Failed to save schedule.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black border border-indigo-100 shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">Shift & Availability Planner</h3>
            <p className="text-[10px] text-slate-500 font-medium">Configure recurring hours for automated patient routing.</p>
          </div>
        </div>

        <button
          onClick={handleSaveSchedule}
          disabled={isSaving}
          className="w-full sm:w-auto px-4 py-2 min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Shift Hours
        </button>
      </div>

      <div className="space-y-2">
        {schedule.map((item, idx) => (
          <div key={item.day} className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            item.enabled ? 'bg-slate-50 border-slate-200' : 'bg-slate-100/50 border-slate-200/60 opacity-60'
          }`}>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => handleToggleDay(idx)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
              />
              <span className="font-bold text-xs text-slate-900 w-20">{item.day}</span>
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                item.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {item.enabled ? 'On-Duty' : 'Off-Duty'}
              </span>
            </div>

            {item.enabled && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg shadow-sm">
                  <Clock size={12} className="text-slate-400" />
                  <input
                    type="time"
                    value={item.startTime}
                    onChange={e => handleTimeChange(idx, 'startTime', e.target.value)}
                    className="font-bold text-[11px] text-slate-900 outline-none bg-transparent"
                  />
                </div>
                <span className="font-bold text-slate-300 text-[10px] uppercase">to</span>
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg shadow-sm">
                  <Clock size={12} className="text-slate-400" />
                  <input
                    type="time"
                    value={item.endTime}
                    onChange={e => handleTimeChange(idx, 'endTime', e.target.value)}
                    className="font-bold text-[11px] text-slate-900 outline-none bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
