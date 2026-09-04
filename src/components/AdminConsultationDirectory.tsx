import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, MessageSquare, Phone, Search, Calendar, User, Stethoscope, CheckCircle2, Eye, CreditCard, FileText, Trash2, Clock, ShieldAlert, UserCheck, Sliders, Loader2 } from 'lucide-react';
import { TableSkeleton } from './Skeleton';
import { useAppContext } from '../AppContext';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface AdminConsultationDirectoryProps {
  consultations: any[];
  isLoading: boolean;
  onInspectSession?: (session: any) => void;
}

export default function AdminConsultationDirectory({
  consultations,
  isLoading,
  onInspectSession
}: AdminConsultationDirectoryProps) {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'PAID' | 'RINGING' | 'CANCELLED'>('ALL');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [localConsultations, setLocalConsultations] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [isUpdatingOverride, setIsUpdatingOverride] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [selectedReassignDoc, setSelectedReassignDoc] = useState<string>('');

  // Sync local consultations with global state
  useEffect(() => {
    if (consultations && consultations.length > 0 && localConsultations.length === 0) {
      setLocalConsultations(consultations);
    }
  }, [consultations, localConsultations.length]);

  // Fetch available consultants for reassignment
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', 'in', ['consultant', 'doctor', 'pharmacist', 'specialist', 'physician_assistant']));
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach(d => list.push({ ...d.data(), uid: d.id, id: d.id }));
        setDoctorsList(list);
      } catch (err) {
        console.warn("Could not fetch consultants for reassignment:", err);
      }
    };
    fetchDoctors();
  }, []);

  const activeConsultations = localConsultations.length > 0 ? localConsultations : consultations;

  const filteredConsultations = activeConsultations.filter((c) => {
    const pName = (c.patientName || '').toLowerCase();
    const cName = (c.consultantName || '').toLowerCase();
    const sId = (c.sessionId || c.id || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesQuery = !query || pName.includes(query) || cName.includes(query) || sId.includes(query);

    const cStatus = (c.status || '').toUpperCase();
    const dStatus = (c.dispatchStatus || '').toUpperCase();

    if (statusFilter === 'ALL') return matchesQuery;
    if (statusFilter === 'IN_PROGRESS') return matchesQuery && (
      cStatus === 'IN_PROGRESS' || 
      cStatus === 'ACTIVE' || 
      dStatus === 'CONNECTED' || 
      dStatus === 'ACCEPTED'
    );
    if (statusFilter === 'COMPLETED') return matchesQuery && cStatus === 'COMPLETED';
    if (statusFilter === 'PAID') return matchesQuery && (cStatus === 'PAID' || c.isPaid);
    if (statusFilter === 'RINGING') return matchesQuery && (dStatus === 'RINGING' || dStatus === 'ESCALATED' || dStatus === 'RE-ROUTING');
    if (statusFilter === 'CANCELLED') return matchesQuery && (cStatus === 'CANCELLED' || cStatus === 'EXPIRED');

    return matchesQuery;
  });

  const getStatusBadge = (c: any) => {
    const status = (c.status || '').toUpperCase();
    const dispatch = (c.dispatchStatus || '').toLowerCase();

    if (dispatch === 'ringing' || dispatch === 'escalated' || dispatch === 're-routing') {
      return (
        <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          {dispatch === 're-routing' ? 'Re-Routing Dispatch' : 'Ringing Dispatch'}
        </span>
      );
    }

    if (status === 'IN_PROGRESS' || status === 'ACTIVE' || dispatch === 'connected' || dispatch === 'accepted') {
      return (
        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live In-Progress
        </span>
      );
    }

    if (status === 'COMPLETED') {
      return (
        <span className="bg-white text-slate-800 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-600" />
          Completed
        </span>
      );
    }

    if (status === 'PAID') {
      return (
        <span className="bg-slate-200 text-slate-600 border border-slate-300 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
          Booked & Paid
        </span>
      );
    }

    return (
      <span className="bg-white text-slate-600 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
        {status || 'PENDING'}
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'CHAT') return <MessageSquare size={14} className="text-slate-600" />;
    if (t === 'VOICE') return <Phone size={14} className="text-emerald-600" />;
    return <Video size={14} className="text-slate-600" />;
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 overflow-hidden">
      {/* Header & Controls */}
      <div className="p-6 md:p-8 border-b border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-800">Consultation Directory</h3>
            <p className="text-xs text-slate-600 mt-1">
              Master register of all clinical consultations, appointments, diagnoses, and telehealth sessions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-slate-50 text-slate-600 px-3 py-1.5 rounded-xl border border-indigo-100">
              Total Records: {consultations.length}
            </span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search by patient, consultant name, or session ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto w-full sm:w-auto">
            {(['ALL', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'RINGING'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {filter === 'ALL'
                  ? 'All'
                  : filter === 'IN_PROGRESS'
                  ? 'Live'
                  : filter === 'COMPLETED'
                  ? 'Completed'
                  : filter === 'PAID'
                  ? 'Paid/Booked'
                  : 'Ringing'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : filteredConsultations.length === 0 ? (
        <div className="p-16 text-center text-slate-500">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold text-slate-600 text-sm">No consultations found matching your criteria</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Session ID / Type</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Consultant</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Fee / Ledger</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredConsultations.map((c) => {
                const sId = c.sessionId || c.id || '';
                const displayDate = c.scheduledAt
                  ? new Date(c.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : c.createdAt?.seconds
                  ? new Date(c.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Recently';

                return (
                  <tr key={sId} className="hover:bg-white transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                          {getTypeIcon(c.sessionType)}
                        </div>
                        <div>
                          <span className="font-mono font-bold text-slate-800 text-[11px]">
                            #{sId.slice(0, 8)}
                          </span>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">
                            {c.sessionType || 'VIDEO'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center font-bold text-xs">
                          <User size={12} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{c.patientName || 'Unnamed Patient'}</p>
                          <p className="text-[10px] text-slate-500">{c.patientPhone || c.patientEmail || 'Verified ID'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                          <Stethoscope size={12} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{c.consultantName || 'Assigned Consultant'}</p>
                          <p className="text-[10px] text-slate-600 font-medium uppercase">{c.consultantCadre || 'Doctor'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {getStatusBadge(c)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-800 text-xs">
                        GHS {c.amountPaidGHS || c.feeGHS || 50}.00
                      </div>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <CreditCard size={10} /> {c.paymentMethod || 'MoMo / Card'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                      {displayDate}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(c.status === 'IN_PROGRESS' || c.status === 'PAID' || c.dispatchStatus === 'ringing' || c.status === 'ACTIVE' || c.dispatchStatus === 're-routing') && (
                          <button
                            onClick={() => navigate(`/consultation/${c.sessionId || c.id}`)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                            title="Join Active Room"
                          >
                            <Video size={12} /> Room
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (onInspectSession) onInspectSession(c);
                            setSelectedSession(c);
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 hover:text-slate-600 text-slate-800 rounded-xl font-bold transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <Eye size={12} /> Inspect
                        </button>
                        {(c.status === 'IN_PROGRESS' || c.status === 'PAID' || c.dispatchStatus === 'ringing') && (
                          <button
                            onClick={async () => {
                              try {
                                const targetId = c.id || c.sessionId;
                                
                                setLocalConsultations(prev => prev.map(session => 
                                  (session.id === targetId || session.sessionId === targetId) 
                                    ? { ...session, status: 'CANCELLED', dispatchStatus: 'cancelled' } 
                                    : session
                                ));

                                const sessionRef = doc(db, 'consultations', targetId);
                                await updateDoc(sessionRef, {
                                  status: 'CANCELLED',
                                  dispatchStatus: 'cancelled',
                                  isOnHold: false,
                                  holdReason: "",
                                  updatedAt: new Date().toISOString()
                                });
                                showToast(`Session #${targetId.slice(0, 8)} successfully ended.`, "success");
                              } catch (err: any) {
                                console.error("Failed to end session:", err);
                                showToast('Failed to end session: ' + err.message, "error");
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <Trash2 size={12} /> End
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-white text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-600 text-base">Consultation Record</h4>
                  <p className="text-xs text-slate-500 font-mono">#{selectedSession.sessionId || selectedSession.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-slate-500 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded-lg cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-800 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Patient</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedSession.patientName || 'Patient'}</p>
                  <p className="text-[11px] text-slate-600">{selectedSession.patientPhone || selectedSession.patientEmail}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Consultant</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedSession.consultantName || 'Consultant'}</p>
                  <p className="text-[11px] text-slate-600 font-bold">{selectedSession.consultantCadre || 'Doctor'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Mode</span>
                  <p className="font-bold text-slate-800 uppercase mt-0.5">{selectedSession.sessionType || 'VIDEO'}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Status</span>
                  <p className="font-bold text-slate-600 mt-0.5">{selectedSession.status || 'PAID'}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Fee</span>
                  <p className="font-bold text-emerald-600 font-mono mt-0.5">GHS {selectedSession.amountPaidGHS || 50}.00</p>
                </div>
              </div>

              {selectedSession.chiefComplaint && (
                <div className="p-3 bg-slate-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-slate-600 font-bold uppercase block">Chief Complaint</span>
                  <p className="text-xs text-indigo-950 mt-1 font-medium">{selectedSession.chiefComplaint}</p>
                </div>
              )}

              {selectedSession.clinicalNotes && (
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-600 font-bold uppercase flex items-center gap-1">
                    <FileText size={12} /> Clinical Notes / Diagnosis
                  </span>
                  <p className="text-xs text-slate-800 mt-1 leading-relaxed">{selectedSession.clinicalNotes}</p>
                </div>
              )}

              {selectedSession.prescriptionId && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-900 text-xs">Prescription Issued</p>
                      <p className="text-[10px] text-emerald-700 font-mono">Rx #{selectedSession.prescriptionId}</p>
                    </div>
                  </div>
                  <a
                    href={`/prescriptions/${selectedSession.prescriptionId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[10px] hover:bg-emerald-700 transition-colors"
                  >
                    View Rx
                  </a>
                </div>
              )}

              {/* ADMIN LIVE OVERRIDE CONTROLS SECTION */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sliders size={14} /> Admin Live Override Panel
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Direct Firestore Sync</span>
                </div>

                {/* Status Override */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Override Status</label>
                    <select
                      value={newStatus || selectedSession.status || 'PAID'}
                      onChange={e => setNewStatus(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="PAID">PAID / BOOKED</option>
                      <option value="IN_PROGRESS">IN_PROGRESS (LIVE)</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED / REFUNDED</option>
                      <option value="MISSED">MISSED</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={isUpdatingOverride}
                    onClick={async () => {
                      if (!newStatus) return;
                      setIsUpdatingOverride(true);
                      try {
                        const targetId = selectedSession.id || selectedSession.sessionId;
                        await updateDoc(doc(db, 'consultations', targetId), {
                          status: newStatus,
                          updatedAt: new Date().toISOString()
                        });
                        setSelectedSession({ ...selectedSession, status: newStatus });
                        setLocalConsultations(prev => prev.map(s => (s.id === targetId || s.sessionId === targetId) ? { ...s, status: newStatus } : s));
                        showToast(`Status updated to ${newStatus}`, "success");
                      } catch (err: any) {
                        showToast(`Failed status update: ${err.message}`, "error");
                      } finally {
                        setIsUpdatingOverride(false);
                      }
                    }}
                    className="mt-4 sm:mt-0 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingOverride ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                    Apply Status Override
                  </button>
                </div>

                {/* Doctor Reassignment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reassign Consultant</label>
                    <select
                      value={selectedReassignDoc}
                      onChange={e => setSelectedReassignDoc(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                    >
                      <option value="">Select Doctor / Specialist...</option>
                      {doctorsList.map(docItem => (
                        <option key={docItem.uid || docItem.id} value={docItem.uid || docItem.id}>
                          {docItem.fullName || docItem.name} ({docItem.cadre || 'UNASSIGNED'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={isUpdatingOverride || !selectedReassignDoc}
                    onClick={async () => {
                      const docObj = doctorsList.find(d => (d.uid || d.id) === selectedReassignDoc);
                      if (!docObj) return;
                      setIsUpdatingOverride(true);
                      try {
                        const targetId = selectedSession.id || selectedSession.sessionId;
                        const docName = docObj.fullName || docObj.name;
                        await updateDoc(doc(db, 'consultations', targetId), {
                          consultantId: docObj.uid || docObj.id,
                          assignedConsultantId: docObj.uid || docObj.id,
                          consultantName: docName,
                          consultantCadre: docObj.cadre || 'UNASSIGNED',
                          updatedAt: new Date().toISOString()
                        });
                        setSelectedSession({ ...selectedSession, consultantName: docName, consultantId: docObj.uid || docObj.id });
                        setLocalConsultations(prev => prev.map(s => (s.id === targetId || s.sessionId === targetId) ? { ...s, consultantName: docName } : s));
                        showToast(`Session reassigned to Dr. ${docName}`, "success");
                      } catch (err: any) {
                        showToast(`Reassignment error: ${err.message}`, "error");
                      } finally {
                        setIsUpdatingOverride(false);
                      }
                    }}
                    className="mt-4 sm:mt-0 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck size={12} /> Reassign Doctor
                  </button>
                </div>

                {/* Time Extension */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Grant Call Extension:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUpdatingOverride}
                      onClick={async () => {
                        setIsUpdatingOverride(true);
                        try {
                          const targetId = selectedSession.id || selectedSession.sessionId;
                          const currentDuration = Number(selectedSession.tierDurationMinutes) || 15;
                          const updatedDuration = currentDuration + 10;
                          await updateDoc(doc(db, 'consultations', targetId), {
                            tierDurationMinutes: updatedDuration,
                            extendedMinutes: (selectedSession.extendedMinutes || 0) + 10,
                            updatedAt: new Date().toISOString()
                          });
                          setSelectedSession({ ...selectedSession, tierDurationMinutes: updatedDuration });
                          showToast("+10 Minutes extended to session room.", "success");
                        } catch (err: any) {
                          showToast(`Failed to extend time: ${err.message}`, "error");
                        } finally {
                          setIsUpdatingOverride(false);
                        }
                      }}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Clock size={11} /> +10 Mins
                    </button>

                    <button
                      type="button"
                      disabled={isUpdatingOverride}
                      onClick={async () => {
                        setIsUpdatingOverride(true);
                        try {
                          const targetId = selectedSession.id || selectedSession.sessionId;
                          const currentDuration = Number(selectedSession.tierDurationMinutes) || 15;
                          const updatedDuration = currentDuration + 15;
                          await updateDoc(doc(db, 'consultations', targetId), {
                            tierDurationMinutes: updatedDuration,
                            extendedMinutes: (selectedSession.extendedMinutes || 0) + 15,
                            updatedAt: new Date().toISOString()
                          });
                          setSelectedSession({ ...selectedSession, tierDurationMinutes: updatedDuration });
                          showToast("+15 Minutes extended to session room.", "success");
                        } catch (err: any) {
                          showToast(`Failed to extend time: ${err.message}`, "error");
                        } finally {
                          setIsUpdatingOverride(false);
                        }
                      }}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Clock size={11} /> +15 Mins
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => navigate(`/consultation/${selectedSession.sessionId || selectedSession.id}`)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
              >
                <Video size={14} /> Enter Consultation Room
              </button>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-5 py-2 bg-white text-slate-600 font-bold rounded-xl text-xs hover:bg-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
