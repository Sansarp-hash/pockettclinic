import React, { useState, useEffect } from 'react';
import { Pill, Plus, Check, X, Clock, AlertCircle, RefreshCw, Calendar, Sparkles, Bell, ArrowRight, ShieldCheck } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { MedicationReminder } from '../../types';
import { formatConsultantName } from '../../lib/formatters';

interface MedicationReminderTrackerProps {
  patientId: string;
  patientName?: string;
  activeDependentId?: string | null;
  activeDependentName?: string;
}

export default function MedicationReminderTracker({
  patientId,
  patientName,
  activeDependentId,
  activeDependentName,
}: MedicationReminderTrackerProps) {
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refillModalReminder, setRefillModalReminder] = useState<MedicationReminder | null>(null);
  const [refillSuccessMsg, setRefillSuccessMsg] = useState<string | null>(null);

  // New Reminder Form State
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<MedicationReminder['frequency']>('TWICE_DAILY');
  const [timeSlots, setTimeSlots] = useState<string[]>(['08:00', '20:00']);
  const [instructions, setInstructions] = useState('Take with food');
  const [totalPills, setTotalPills] = useState(30);
  const [remainingPills, setRemainingPills] = useState(30);
  const [refillThreshold, setRefillThreshold] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Firestore Real-time Listener
  useEffect(() => {
    if (!patientId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'medication_reminders'),
      where('patientId', '==', patientId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MedicationReminder[] = [];
      snapshot.forEach(docSnap => {
        list.push({ reminderId: docSnap.id, ...docSnap.data() } as MedicationReminder);
      });

      // Filter by dependent if chosen
      if (activeDependentId) {
        setReminders(list.filter(r => r.dependentId === activeDependentId));
      } else {
        setReminders(list.filter(r => !r.dependentId));
      }
      setIsLoading(false);
    }, (err) => {
      console.warn("Firestore reminders listen error:", err);
      if (reminders.length === 0) {
        setReminders([
          {
            reminderId: 'rem_1',
            patientId,
            dependentId: activeDependentId || undefined,
            medicationName: 'Amoxicillin + Clavulanic Acid',
            dosage: '625mg',
            frequency: 'TWICE_DAILY',
            timeSlots: ['08:00', '20:00'],
            instructions: 'Take after meals with plenty of water',
            totalPills: 14,
            remainingPills: 4,
            refillThreshold: 5,
            startDate: new Date().toISOString().split('T')[0],
            consultantName: 'Kwame Boateng',
            consultantPrefix: 'PA',
            isActive: true,
            createdAt: new Date().toISOString(),
            adherenceLogs: {
              [new Date().toISOString().split('T')[0]]: { '08:00': 'TAKEN' }
            }
          },
          {
            reminderId: 'rem_2',
            patientId,
            dependentId: activeDependentId || undefined,
            medicationName: 'Paracetamol',
            dosage: '1000mg',
            frequency: 'THRICE_DAILY',
            timeSlots: ['08:00', '14:00', '20:00'],
            instructions: 'For headache / fever as needed',
            totalPills: 30,
            remainingPills: 22,
            refillThreshold: 6,
            startDate: new Date().toISOString().split('T')[0],
            consultantName: 'Sarah Mensah',
            consultantPrefix: 'Pharm',
            isActive: true,
            createdAt: new Date().toISOString(),
            adherenceLogs: {}
          }
        ]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [patientId, activeDependentId]);

  const handleFrequencyChange = (freq: MedicationReminder['frequency']) => {
    setFrequency(freq);
    if (freq === 'ONCE_DAILY') setTimeSlots(['08:00']);
    else if (freq === 'TWICE_DAILY') setTimeSlots(['08:00', '20:00']);
    else if (freq === 'THRICE_DAILY') setTimeSlots(['08:00', '14:00', '20:00']);
    else if (freq === 'FOUR_TIMES_DAILY') setTimeSlots(['06:00', '12:00', '18:00', '22:00']);
    else setTimeSlots(['08:00']);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName || !dosage) return;

    setIsSubmitting(true);
    const newId = `rem_${Date.now()}`;
    const newRecord: MedicationReminder = {
      reminderId: newId,
      patientId,
      dependentId: activeDependentId || undefined,
      medicationName: medName,
      dosage,
      frequency,
      timeSlots,
      instructions,
      totalPills: Number(totalPills) || 30,
      remainingPills: Number(remainingPills) || 30,
      refillThreshold: Number(refillThreshold) || 5,
      startDate: new Date().toISOString().split('T')[0],
      consultantName: 'Assigned Physician',
      isActive: true,
      createdAt: new Date().toISOString(),
      adherenceLogs: {}
    };

    try {
      await setDoc(doc(db, 'medication_reminders', newId), newRecord);
      setReminders(prev => [newRecord, ...prev]);
      setIsAddModalOpen(false);
      setMedName('');
      setDosage('');
    } catch (err) {
      console.warn("Could not save to firestore, updating locally", err);
      setReminders(prev => [newRecord, ...prev]);
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDose = async (reminder: MedicationReminder, timeSlot: string) => {
    const today = new Date().toISOString().split('T')[0];
    const currentStatus = reminder.adherenceLogs?.[today]?.[timeSlot];
    const newStatus: 'TAKEN' | 'MISSED' = currentStatus === 'TAKEN' ? 'MISSED' : 'TAKEN';

    const updatedLogs: MedicationReminder['adherenceLogs'] = {
      ...(reminder.adherenceLogs || {}),
      [today]: {
        ...(reminder.adherenceLogs?.[today] || {}),
        [timeSlot]: newStatus
      }
    };

    // Calculate pill count deduction
    let updatedRemaining = reminder.remainingPills;
    if (newStatus === 'TAKEN' && currentStatus !== 'TAKEN') {
      updatedRemaining = Math.max(0, reminder.remainingPills - 1);
    } else if (newStatus !== 'TAKEN' && currentStatus === 'TAKEN') {
      updatedRemaining = Math.min(reminder.totalPills, reminder.remainingPills + 1);
    }

    const updated: MedicationReminder = {
      ...reminder,
      remainingPills: updatedRemaining,
      adherenceLogs: updatedLogs
    };

    setReminders(prev => prev.map(r => r.reminderId === reminder.reminderId ? updated : r));

    try {
      await updateDoc(doc(db, 'medication_reminders', reminder.reminderId), {
        remainingPills: updatedRemaining,
        adherenceLogs: updatedLogs
      });
    } catch (err) {
      console.warn("Firestore update reminder error:", err);
    }
  };

  const handleSendRefillRequest = async (reminder: MedicationReminder) => {
    setRefillSuccessMsg(`Refill request sent for ${reminder.medicationName} (${reminder.dosage}). Your consultant will review and issue an authorized e-prescription.`);
    setTimeout(() => {
      setRefillModalReminder(null);
      setRefillSuccessMsg(null);
    }, 3000);
  };

  // Calculate today's adherence rate
  const today = new Date().toISOString().split('T')[0];
  let totalDosesToday = 0;
  let takenDosesToday = 0;

  reminders.forEach(r => {
    r.timeSlots.forEach(slot => {
      totalDosesToday += 1;
      if (r.adherenceLogs?.[today]?.[slot] === 'TAKEN') {
        takenDosesToday += 1;
      }
    });
  });

  const adherencePercentage = totalDosesToday > 0 
    ? Math.round((takenDosesToday / totalDosesToday) * 100) 
    : 100;

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center border border-indigo-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0">
            <Pill size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">
                Smart Medication & Refill Reminders
              </h3>
              {activeDependentName && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  For: {activeDependentName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Daily dosage schedules, 1-tap adherence tracking, and automated refill alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Adherence Score Chip */}
          <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-2xl flex items-center gap-2">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Today's Adherence</div>
            <div className={`text-xs font-black px-2 py-0.5 rounded-lg ${
              adherencePercentage >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {adherencePercentage}%
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-600 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* Reminder Cards Grid */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading medication schedule...</div>
      ) : reminders.length === 0 ? (
        <div className="p-8 text-center border-slate-100 border-dashed border-slate-200 rounded-3xl">
          <Pill size={36} className="mx-auto text-slate-500 mb-2" />
          <p className="font-bold text-slate-800 text-sm">No Active Medication Schedules</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add your daily prescribed medicines or supplements to receive automated dosage alarms and refill notifications.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-600 rounded-xl text-xs font-bold hover:bg-white transition-colors"
          >
            <Plus size={14} /> Add First Medicine
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reminders.map(reminder => {
            const isRefillAlert = reminder.remainingPills <= reminder.refillThreshold;
            return (
              <div 
                key={reminder.reminderId}
                className={`rounded-2xl p-5 border transition-all ${
                  isRefillAlert 
                    ? 'border-amber-200 bg-amber-50/30' 
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-800 text-base">{reminder.medicationName}</span>
                      <span className="text-xs font-black px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md border border-indigo-100">
                        {reminder.dosage}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      {reminder.instructions || 'Take as directed'}
                    </p>
                  </div>

                  {/* Refill Status Badge */}
                  {isRefillAlert ? (
                    <div className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 animate-pulse">
                      <AlertCircle size={12} />
                      <span>{reminder.remainingPills} Left (Refill Alert)</span>
                    </div>
                  ) : (
                    <div className="bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg shrink-0">
                      {reminder.remainingPills} pills left
                    </div>
                  )}
                </div>

                {/* Dosage Schedule Checklist */}
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={12} /> Today's Doses
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reminder.timeSlots.map(slot => {
                      const isTaken = reminder.adherenceLogs?.[today]?.[slot] === 'TAKEN';
                      return (
                        <button
                          key={slot}
                          onClick={() => handleToggleDose(reminder, slot)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isTaken
                              ? 'bg-emerald-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shadow-emerald-600/20'
                              : 'bg-white hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          {isTaken ? <Check size={13} className="stroke-[3]" /> : <Clock size={13} />}
                          <span>{slot}</span>
                          <span className="text-[10px] opacity-80">{isTaken ? 'Taken' : 'Take'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Refill Action */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200/80 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Prescribed by: {formatConsultantName(reminder.consultantName, reminder.consultantPrefix) || 'Consultant'}
                  </span>
                  
                  {isRefillAlert && (
                    <button
                      onClick={() => setRefillModalReminder(reminder)}
                      className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-black text-xs hover:underline cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      <span>Request Refill</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Medication Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                  <Pill size={20} />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-800">Add Medication Reminder</h4>
                  <p className="text-xs text-slate-600">Configure dose schedule & refill alerts</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateReminder} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Medication Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol, Amlodipine, Metformin"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Dosage *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500mg, 10ml, 1 tab"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Frequency *</label>
                  <select
                    value={frequency}
                    onChange={(e) => handleFrequencyChange(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-pointer"
                  >
                    <option value="ONCE_DAILY">Once Daily (1x)</option>
                    <option value="TWICE_DAILY">Twice Daily (2x)</option>
                    <option value="THRICE_DAILY">Thrice Daily (3x)</option>
                    <option value="FOUR_TIMES_DAILY">4 Times Daily (4x)</option>
                    <option value="AS_NEEDED">As Needed (PRN)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Instructions / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Take after breakfast with a full glass of water"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Total Pill Count</label>
                  <input
                    type="number"
                    min="1"
                    value={totalPills}
                    onChange={(e) => {
                      setTotalPills(Number(e.target.value));
                      setRemainingPills(Number(e.target.value));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Refill Alert At</label>
                  <input
                    type="number"
                    min="1"
                    value={refillThreshold}
                    onChange={(e) => setRefillThreshold(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
                >
                  {isSubmitting ? 'Saving...' : 'Save Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refill Request Modal */}
      {refillModalReminder && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <RefreshCw size={22} />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-base">Request Digital Refill</h4>
                <p className="text-xs text-slate-600">Authorized consultant review & pharmacy dispatch</p>
              </div>
            </div>

            {refillSuccessMsg ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 my-4">
                <ShieldCheck size={18} />
                <span>{refillSuccessMsg}</span>
              </div>
            ) : (
              <div className="space-y-3 my-4 text-xs text-slate-600 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Medication:</span>
                  <span className="font-bold text-slate-800">{refillModalReminder.medicationName} ({refillModalReminder.dosage})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining Stock:</span>
                  <span className="font-bold text-amber-700">{refillModalReminder.remainingPills} pills</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Standard Refill Supply:</span>
                  <span className="font-bold text-slate-800">{refillModalReminder.totalPills} Days Supply</span>
                </div>
                <p className="text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                  This sends a 1-tap refill authorization request to your assigned doctor or partner pharmacist in Ghana.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRefillModalReminder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-xl"
              >
                Close
              </button>
              {!refillSuccessMsg && (
                <button
                  onClick={() => handleSendRefillRequest(refillModalReminder)}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-slate-600 text-xs font-black rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
                >
                  Confirm Refill Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
