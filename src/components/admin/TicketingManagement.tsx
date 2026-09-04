import React, { useState } from 'react';
import { Ticket, Plus, Search, CheckCircle2, XCircle, Clock, User, MessageSquare, AlertCircle, ChevronDown } from 'lucide-react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';

export default function TicketingManagement() {
  const { tickets, issueTicket, revokeTicket, showToast } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [amountGHS, setAmountGHS] = useState('');
  
  const [patients, setPatients] = useState<any[]>([]);
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  React.useEffect(() => {
    if (isCreating) {
      const fetchPatients = async () => {
        try {
          const q = query(collection(db, 'users'), where('role', '==', 'patient'));
          const snap = await getDocs(q);
          const pts: any[] = [];
          snap.forEach(d => {
            pts.push({ id: d.id, ...d.data() });
          });
          setPatients(pts);
        } catch(e) {
          console.error(e);
        }
      };
      fetchPatients();
    }
  }, [isCreating]);
  
  const filteredPatients = patients.filter(p => {
    const term = patientSearch.toLowerCase();
    return (p.fullName || '').toLowerCase().includes(term) || p.id.toLowerCase().includes(term);
  });

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;

    await issueTicket({
      patientName,
      patientId: patientId || `PAT-${Date.now().toString(36).toUpperCase()}`,
      reason,
      notes,
      valueGHS: parseFloat(amountGHS) || 0
    });

    showToast(`Support credit ticket issued for ${patientName}.`, 'success');
    setPatientName('');
    setPatientId('');
    setNotes('');
    setIsCreating(false);
  };

  const filteredTickets = (tickets || []).filter((t) => {
    const pName = (t.patientName || '').toLowerCase();
    const tId = (t.ticketId || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    return !query || pName.includes(query) || tId.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden space-y-0">
        <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Ticket className="text-amber-400" size={24} />
              <h3 className="text-xl font-bold">Support Compensation & Credit Tickets</h3>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Issue and manage 1-click consultation voucher tickets for patient network compensation.
            </p>
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-800 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0"
          >
            <Plus size={16} /> Issue Compensation Ticket
          </button>
        </div>

        {/* Tickets Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Ticket ID</th>
                <th className="py-3.5 px-4">Patient Name</th>
                <th className="py-3.5 px-4">Amount (GHS)</th>
                <th className="py-3.5 px-4">Reason / Issue</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Issued At</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                    No support tickets currently active.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr key={t.ticketId} className="hover:bg-white/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-slate-800">{t.ticketId}</td>
                    <td className="py-4 px-4 font-bold text-slate-800">{t.patientName}</td>
                    <td className="py-4 px-4 font-black text-amber-600">GHS {t.valueGHS || 0}</td>
                    <td className="py-4 px-4 text-slate-600">{t.reason}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                        t.status === 'redeemed' ? 'bg-slate-200 text-slate-600' :
                        'bg-white text-slate-600'
                      }`}>
                        {t.status === 'active' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {t.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-[11px]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {t.status === 'active' && (
                        <button
                          onClick={() => revokeTicket(t.ticketId)}
                          className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleCreateTicket} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-slate-800 text-base">Issue Patient Credit Ticket</h3>
              <button type="button" onClick={() => setIsCreating(false)} className="text-slate-500 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="relative">
                <label className="font-bold text-slate-800 block mb-1">Select Patient</label>
                <div 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white flex justify-between items-center cursor-pointer"
                  onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)}
                >
                  <span className={patientName ? 'text-slate-800' : 'text-slate-400'}>
                    {patientName ? `${patientName} (${patientId})` : 'Search by Name or ID...'}
                  </span>
                  <ChevronDown size={16} className="text-slate-500" />
                </div>
                
                {isPatientDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                      <input 
                        type="text"
                        placeholder="Type to search..."
                        value={patientSearch}
                        onChange={e => setPatientSearch(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                      />
                    </div>
                    <div className="p-1">
                      {filteredPatients.length === 0 ? (
                        <div className="p-2 text-center text-slate-500 text-xs">No patients found</div>
                      ) : (
                        filteredPatients.map(p => (
                          <div 
                            key={p.id}
                            onClick={() => {
                              setPatientName(p.fullName || p.email || 'Unknown Patient');
                              setPatientId(p.id);
                              setIsPatientDropdownOpen(false);
                            }}
                            className="p-2 hover:bg-slate-50 cursor-pointer rounded-lg flex flex-col"
                          >
                            <span className="font-bold text-slate-800">{p.fullName || p.email}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{p.id}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="font-bold text-slate-800 block mb-1">Amount (GHS)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amountGHS}
                  onChange={(e) => setAmountGHS(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Compensation Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="Network Interruption Credit">Network Interruption Credit</option>
                  <option value="Consultant No-Show Refund">Consultant No-Show Voucher</option>
                  <option value="Audio Quality Compensation">Audio Quality Compensation</option>
                  <option value="Promotional Health Credit">Promotional Health Credit</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional support logs..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2.5 bg-white text-slate-600 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-800 font-black rounded-xl text-xs shadow-md"
              >
                Dispatch Credit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
