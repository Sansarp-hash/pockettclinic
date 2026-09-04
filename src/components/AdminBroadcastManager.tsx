import React, { useState, useEffect } from 'react';
import { Megaphone, Send, Bell, Smartphone, Users, CheckCircle2, Trash2, Clock, AlertCircle, Sparkles, User, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import { SystemBroadcast, UserProfile } from '../types';

export default function AdminBroadcastManager() {
  const { showToast } = useAppContext();
  const [broadcasts, setBroadcasts] = useState<SystemBroadcast[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<SystemBroadcast['targetAudience']>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [priority, setPriority] = useState<SystemBroadcast['priority']>('NORMAL');
  const [channels, setChannels] = useState<('IN_APP_BANNER' | 'SMS_ALERT')[]>(['IN_APP_BANNER', 'SMS_ALERT']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Fetch users for individual broadcast targeted selection
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: UserProfile[] = [];
        snap.forEach(d => list.push({ ...d.data(), uid: d.id } as UserProfile));
        setAllUsers(list);
      } catch (err) {
        console.warn("Could not fetch user directory for broadcast targeting:", err);
      }
    };
    fetchUsers();

    const q = query(collection(db, 'system_broadcasts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SystemBroadcast[] = [];
      snapshot.forEach(d => {
        list.push({ broadcastId: d.id, ...d.data() } as SystemBroadcast);
      });
      list.sort((a, b) => new Date(b.createdAt || b.sentAt || 0).getTime() - new Date(a.createdAt || a.sentAt || 0).getTime());
      setBroadcasts(list);
      setIsLoading(false);
    }, (err) => {
      console.warn("Firestore broadcast listener fallback:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const patientsList = allUsers.filter(u => u.role === 'patient');
  const consultantsList = allUsers.filter(u => u.role === 'consultant');

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    if ((targetAudience === 'INDIVIDUAL_PATIENT' || targetAudience === 'INDIVIDUAL_CONSULTANT') && !selectedUserId) {
      showToast("Please select a specific individual target user from the directory dropdown.", "error");
      return;
    }

    const targetUserObj = allUsers.find(u => u.uid === selectedUserId);
    const targetUserName = targetUserObj ? (targetUserObj.fullName || targetUserObj.displayName || targetUserObj.email) : undefined;

    setIsSubmitting(true);
    const newId = `bc_${Date.now()}`;
    const newBroadcast: SystemBroadcast = {
      broadcastId: newId,
      title,
      message,
      targetAudience,
      targetUserId: selectedUserId || undefined,
      targetUserName: targetUserName,
      priority,
      channels,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      isActive: true,
      authorName: 'Admin Central'
    };

    try {
      await setDoc(doc(db, 'system_broadcasts', newId), newBroadcast);
      setBroadcasts(prev => [newBroadcast, ...prev]);
      const targetLabel = targetUserName ? `individual user ${targetUserName}` : targetAudience === 'ALL' ? 'all users' : targetAudience.toLowerCase();
      setToastMessage(`✓ Targeted broadcast dispatched to ${targetLabel} via ${channels.join(' & ')}.`);
      setTimeout(() => {
        setIsCreating(false);
        setToastMessage(null);
        setTitle('');
        setMessage('');
        setSelectedUserId('');
      }, 2500);
    } catch (err) {
      console.warn("Could not save broadcast:", err);
      setBroadcasts(prev => [newBroadcast, ...prev]);
      setToastMessage(`✓ Broadcast created locally.`);
      setTimeout(() => {
        setIsCreating(false);
        setToastMessage(null);
      }, 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleBroadcastActive = async (broadcast: SystemBroadcast) => {
    const newActiveState = !broadcast.isActive;
    try {
      await updateDoc(doc(db, 'system_broadcasts', broadcast.broadcastId), {
        isActive: newActiveState,
        updatedAt: new Date().toISOString()
      });
      setBroadcasts(prev => prev.map(b => b.broadcastId === broadcast.broadcastId ? { ...b, isActive: newActiveState } : b));
      setToastMessage(`Broadcast banner ${newActiveState ? 'ACTIVATED and sent to targeted dashboards' : 'DEACTIVATED and hidden from dashboards'}.`);
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.warn("Could not toggle broadcast:", err);
      setBroadcasts(prev => prev.map(b => b.broadcastId === broadcast.broadcastId ? { ...b, isActive: newActiveState } : b));
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      // 1. DIRECT IMPLEMENTATION: Filter out instantly from UI
      setBroadcasts(prev => prev.filter(b => b.broadcastId !== id));
      
      // 2. Perform background deletion
      await deleteDoc(doc(db, 'system_broadcasts', id));
      setToastMessage("Broadcast removed.");
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.warn("Could not delete broadcast:", err);
      // Item is already removed from UI; error handling could re-fetch if needed
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white text-slate-600 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
            <Megaphone size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black tracking-tight">
                Targeted Broadcast System & Dashboard Notifier
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-300 px-2.5 py-0.5 rounded-md border border-rose-500/40">
                Individual & Group Dispatch
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Publish custom broadcast banners directly to individual Patients, Consultants, or specific groups. Banners only appear when active.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-slate-600 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all cursor-pointer whitespace-nowrap"
        >
          <Send size={16} />
          <span>New System Announcement</span>
        </button>
      </div>

      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Create Broadcast Form Modal / Panel */}
      {isCreating && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-rose-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2.5">
              <Megaphone size={20} className="text-rose-600" />
              <h4 className="font-black text-slate-800 text-base">Compose Broadcast Notice</h4>
            </div>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateBroadcast} className="space-y-4 text-xs">
            {/* Template Selector */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">⚡ Quick Notification Templates</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTitle("🚨 URGENT SURGE: Doctors & Specialists Needed On Duty");
                    setMessage("High consultation queue volume detected. Online consultants are requested to go on duty immediately. Earn 1.25x surge bonus!");
                    setTargetAudience("CONSULTANTS");
                    setPriority("URGENT");
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl font-bold text-[11px] cursor-pointer"
                >
                  🚨 Urgent Doctor Surge Alert
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle("🛡️ COMPLIANCE NOTICE: Council PIN & Indemnity Policy Update");
                    setMessage("Please ensure your Medical Council Retention PIN and active Professional Indemnity Policy are uploaded in your profile to maintain active call status.");
                    setTargetAudience("CONSULTANTS");
                    setPriority("WARNING");
                  }}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-bold text-[11px] cursor-pointer"
                >
                  🛡️ Indemnity & PIN Audit Notice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle("⚙️ SYSTEM MAINTENANCE: Scheduled Platform Upgrade");
                    setMessage("PockettClinic will undergo scheduled system optimization tonight from 02:00 UTC to 02:30 UTC. Emergency video dispatch will remain active.");
                    setTargetAudience("ALL");
                    setPriority("NORMAL");
                  }}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl font-bold text-[11px] cursor-pointer"
                >
                  ⚙️ System Maintenance Notice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle("🎁 CarePlus Subscriber Perk: Free Medication Delivery Upgrade");
                    setMessage("Enjoy zero delivery fees on all prescribed e-pharmacy orders fulfilled this week through CarePlus partner pharmacies.");
                    setTargetAudience("PATIENTS");
                    setPriority("NORMAL");
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-[11px] cursor-pointer"
                >
                  🎁 CarePlus Perk Broadcast
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">Announcement Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Infrastructure Maintenance or Specific Patient Advisory"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Target Audience *</label>
                <select
                  value={targetAudience}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setTargetAudience(val);
                    setSelectedUserId('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Platform Users (Global)</option>
                  <option value="PATIENTS">All Patients</option>
                  <option value="CONSULTANTS">All Consultants & Doctors</option>
                  <option value="INDIVIDUAL_PATIENT">Specific Individual Patient</option>
                  <option value="INDIVIDUAL_CONSULTANT">Specific Individual Consultant</option>
                </select>
              </div>
            </div>

            {/* Individual Target Selector */}
            {targetAudience === 'INDIVIDUAL_PATIENT' && (
              <div className="p-4 bg-slate-50/60 border border-indigo-100 rounded-2xl animate-in fade-in">
                <label className="block font-bold text-slate-600 mb-1">Select Patient *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose a Patient from Directory --</option>
                  {patientsList.map(p => (
                    <option key={p.uid} value={p.uid}>
                      {p.fullName || p.displayName || p.email} ({p.email || 'No email'}) — Ref: {p.uid.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetAudience === 'INDIVIDUAL_CONSULTANT' && (
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl animate-in fade-in">
                <label className="block font-bold text-emerald-900 mb-1">Select Consultant *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-emerald-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose a Consultant from Directory --</option>
                  {consultantsList.map(c => (
                    <option key={c.uid} value={c.uid}>
                      {c.fullName || c.displayName || c.email} ({c.cadre || 'UNASSIGNED'} • {(c as any).specialty || (c as any).medicalSpecialty || 'General Practice'}) — Ref: {c.uid.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-800 mb-1">Notice Content & Guidance *</label>
              <textarea
                rows={3}
                required
                placeholder="Enter full notice text to appear in user dashboard banners and SMS dispatches..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Priority Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NORMAL', 'URGENT', 'EMERGENCY'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriority(lvl)}
                      className={`py-2 rounded-xl font-black text-[11px] border transition-all ${
                        priority === lvl
                          ? lvl === 'EMERGENCY'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : lvl === 'URGENT'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Dispatch Channels</label>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={channels.includes('IN_APP_BANNER')}
                      onChange={(e) => {
                        if (e.target.checked) setChannels(prev => [...prev, 'IN_APP_BANNER']);
                        else setChannels(prev => prev.filter(c => c !== 'IN_APP_BANNER'));
                      }}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>In-App Banner</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={channels.includes('SMS_ALERT')}
                      onChange={(e) => {
                        if (e.target.checked) setChannels(prev => [...prev, 'SMS_ALERT']);
                        else setChannels(prev => prev.filter(c => c !== 'SMS_ALERT'));
                      }}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>SMS Gateway Alert</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-slate-600 font-black rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all cursor-pointer"
              >
                {isSubmitting ? 'Transmitting Notice...' : 'Send Broadcast Now'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Broadcasts History */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-black text-slate-800 text-sm">Active & Targeted Broadcast Records ({broadcasts.length})</h4>
          <span className="text-xs text-slate-500 font-bold">System Announcements</span>
        </div>

        {broadcasts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No active system announcements.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {broadcasts.map(bc => {
              const isActive = bc.isActive !== false;
              return (
                <div key={bc.broadcastId} className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  isActive ? 'bg-white' : 'bg-white/70 opacity-60'
                }`}>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleToggleBroadcastActive(bc)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-emerald-500 text-slate-600 border-emerald-600 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                            : 'bg-slate-50 text-slate-600 border-slate-300'
                        }`}
                        title="Click to toggle broadcasting on/off for target dashboards"
                      >
                        {isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {isActive ? 'BROADCASTING LIVE' : 'PAUSED / OFF'}
                      </button>

                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        bc.priority?.toUpperCase() === 'EMERGENCY'
                          ? 'bg-rose-100 text-rose-800'
                          : bc.priority?.toUpperCase() === 'URGENT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {bc.priority}
                      </span>

                      <span className="text-[10px] font-black uppercase bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                        <Users size={10} />
                        Target: {
                          bc.targetUserName 
                            ? `User (${bc.targetUserName})`
                            : bc.targetAudience === 'INDIVIDUAL_PATIENT' 
                              ? 'Specific Patient'
                              : bc.targetAudience === 'INDIVIDUAL_CONSULTANT'
                                ? 'Specific Consultant'
                                : bc.targetAudience
                        }
                      </span>

                      <span className="text-xs text-slate-500">
                        {new Date(bc.createdAt || bc.sentAt || Date.now()).toLocaleString()}
                      </span>
                    </div>

                    <h5 className="font-black text-slate-800 text-sm flex items-center gap-2">
                      {bc.title}
                    </h5>
                    <p className="text-xs text-slate-600 font-medium max-w-3xl">{bc.message}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-[11px] text-slate-500">
                      <span className="font-bold text-slate-600">{bc.channels?.join(' • ') || 'IN_APP_BANNER'}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteBroadcast(bc.broadcastId)}
                      className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete Announcement"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
