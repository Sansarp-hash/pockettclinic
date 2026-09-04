import React, { useState, useEffect } from 'react';
import { Database, Search, ShieldCheck, Filter, Clock, Eye, AlertTriangle } from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export default function AdminSystemLogsAudit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'system_audit_logs'));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setLogs(list);
      setIsLoading(false);
    }, (err) => {
      // If collection doesn't exist yet, fallback gracefully
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = logs.filter(l => 
    !searchQuery || 
    l.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Database size={22} className="text-emerald-600" /> Administrative Security & Override Audit Logs
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Immutable system logs tracking admin balance changes, consultant reassignments, and pin verifications.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search action, details..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Log ID</th>
              <th className="py-3.5 px-4">Action Event</th>
              <th className="py-3.5 px-4">Performed By</th>
              <th className="py-3.5 px-4">Target / Record</th>
              <th className="py-3.5 px-4">Details</th>
              <th className="py-3.5 px-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{l.id}</td>
                <td className="py-3.5 px-4">
                  <span className="bg-slate-900 text-emerald-400 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg">
                    {l.action}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-700 font-semibold">{l.performedBy}</td>
                <td className="py-3.5 px-4 font-mono text-slate-500">{l.targetId}</td>
                <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{l.details}</td>
                <td className="py-3.5 px-4 text-slate-400 text-[11px]">{new Date(l.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
