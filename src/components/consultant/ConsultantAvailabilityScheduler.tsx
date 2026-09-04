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
    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black border border-indigo-100 shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Weekly Shift & Telehealth Availability Planner</h3>
            <p className="text-xs text-slate-500">Configure your recurring consultation hours for automated patient queue routing.</p>
          </div>
        </div>

        <button
          onClick={handleSaveSchedule}
          disabled={isSaving}
          className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Weekly Shift Hours
        </button>
      </div>

      <div className="space-y-3">
        {schedule.map((item, idx) => (
          <div key={item.day} className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            item.enabled ? 'bg-slate-50 border-slate-200' : 'bg-slate-100/50 border-slate-200/60 opacity-60'
          }`}>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => handleToggleDay(idx)}
                className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="font-bold text-sm text-slate-800 w-28">{item.day}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                item.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {item.enabled ? 'Active On-Duty' : 'Off-Duty'}
              </span>
            </div>

            {item.enabled && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-200 rounded-xl">
                  <Clock size={14} className="text-slate-400" />
                  <input
                    type="time"
                    value={item.startTime}
                    onChange={e => handleTimeChange(idx, 'startTime', e.target.value)}
                    className="font-bold text-slate-800 outline-none"
                  />
                </div>
                <span className="font-bold text-slate-400">to</span>
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-200 rounded-xl">
                  <Clock size={14} className="text-slate-400" />
                  <input
                    type="time"
                    value={item.endTime}
                    onChange={e => handleTimeChange(idx, 'endTime', e.target.value)}
                    className="font-bold text-slate-800 outline-none"
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
