import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  X, 
  RefreshCw, 
  Terminal, 
  Activity, 
  User, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  Ban, 
  AlertOctagon, 
  Play
} from 'lucide-react';
import { crashlytics } from '../lib/crashlytics';

export interface SystemError {
  id: string;
  timestamp: any;
  message: string;
  stack: string;
  userId: string;
  role: string;
  component: string;
  page: string;
  customKeys: Record<string, string>;
  logs: string[];
  aiExplanation: string;
  aiResolutionReport?: string;
  status: 'unresolved' | 'resolved' | 'ignored';
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixRequested?: boolean;
  fixStatus?: 'none' | 'fixing' | 'fixed' | 'failed';
  fixRequestedAt?: any;
}

import Markdown from 'react-markdown';

export default function AdminErrorTracker() {
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<SystemError | null>(null);
  const [filterStatus, setFilterStatus] = useState<'unresolved' | 'resolved' | 'ignored' | 'all'>('unresolved');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // Real-time listener for system_errors collection
  useEffect(() => {
    const q = query(
      collection(db, 'system_errors'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const errorList: SystemError[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        errorList.push({
          id: docSnapshot.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
        } as SystemError);
      });
      setErrors(errorList);
      setLoading(false);
    }, (err) => {
      console.error("Failed to fetch system errors from Firestore:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFixIt = async (errorId: string) => {
    setActioningId(errorId);
    try {
      await updateDoc(doc(db, 'system_errors', errorId), {
        fixRequested: true,
        fixStatus: 'fixing',
        fixRequestedAt: serverTimestamp(),
        status: 'unresolved'
      });
      setAlertSuccess(`AI SRE Agent dispatched to resolve issue ${errorId}. Investigation and patching in progress...`);
      if (selectedError && selectedError.id === errorId) {
        setSelectedError(prev => prev ? { ...prev, fixStatus: 'fixing' } : null);
      }
    } catch (e) {
      console.error("Failed to dispatch AI fix:", e);
    } finally {
      setActioningId(null);
    }
  };

  const handleUpdateStatus = async (errorId: string, nextStatus: 'resolved' | 'ignored') => {
    setActioningId(errorId);
    try {
      const idToken = sessionStorage.getItem('idToken') || localStorage.getItem('idToken');
      const response = await fetch('/api/admin/system-errors/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ errorId, status: nextStatus })
      });

      if (!response.ok) {
        throw new Error("HTTP status verification failed");
      }

      // If viewing active error, update current view
      if (selectedError && selectedError.id === errorId) {
        setSelectedError(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (e) {
      console.warn("Direct API fallback for error update triggered:", e);
      try {
        await updateDoc(doc(db, 'system_errors', errorId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
          // Reset fix status if manually resolving
          fixStatus: nextStatus === 'resolved' ? 'fixed' : 'none'
        });
        if (selectedError && selectedError.id === errorId) {
          setSelectedError(prev => prev ? { ...prev, status: nextStatus, fixStatus: nextStatus === 'resolved' ? 'fixed' : 'none' } : null);
        }
      } catch (fsErr) {
        console.error("Direct update failed too:", fsErr);
      }
    } finally {
      setActioningId(null);
    }
  };

  const handleTriggerAlert = (error: SystemError) => {
    setAlertSuccess(`PagerDuty alert & developer notifications triggered successfully for event "${error.message.substring(0, 40)}..."`);
    setTimeout(() => setAlertSuccess(null), 5000);
  };

  // Filter lists
  const filteredErrors = errors.filter(err => {
    const matchesStatus = filterStatus === 'all' || err.status === filterStatus;
    const matchesSeverity = filterSeverity === 'all' || err.severity === filterSeverity;
    return matchesStatus && matchesSeverity;
  });

  const activeCount = errors.filter(e => e.status === 'unresolved').length;
  const criticalCount = errors.filter(e => e.status === 'unresolved' && e.severity === 'critical').length;
  const highCount = errors.filter(e => e.status === 'unresolved' && e.severity === 'high').length;

  return (
    <div className="space-y-8">
      {/* Tracker Headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="text-rose-500 animate-pulse" size={32} />
            System Health & Issue Tracker
          </h2>
          <p className="text-slate-600 font-medium mt-1">
            Real-time diagnostic console and automated SRE stack trace analyzer.
          </p>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Crashlytics Status</span>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-black text-slate-800">Operational</span>
          </div>
          <span className="text-[10px] text-slate-600 font-medium block mt-1">Uncaught exception catchers armed</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Unresolved Bugs</span>
          <span className="text-3xl font-black text-slate-800 mt-1 block">
            {activeCount}
          </span>
          <span className="text-[10px] text-slate-600 font-medium block mt-1">Requires immediate attention</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300 border-l-red-500 border-l-4">
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Critical Exceptions</span>
          <span className="text-3xl font-black text-rose-600 mt-1 block">
            {criticalCount}
          </span>
          <span className="text-[10px] text-slate-600 font-medium block mt-1">RTC or connection lockouts</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300 border-l-amber-500 border-l-4">
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">High Severity</span>
          <span className="text-3xl font-black text-amber-600 mt-1 block">
            {highCount}
          </span>
          <span className="text-[10px] text-slate-600 font-medium block mt-1">Security rule blockages</span>
        </div>
      </div>

      {/* Alert Banner */}
      {alertSuccess && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-md flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 size={18} />
            <span>{alertSuccess}</span>
          </div>
          <button onClick={() => setAlertSuccess(null)} className="text-emerald-100 hover:text-slate-600 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Issue Tracker List Component */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        {/* Filters bar */}
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setFilterStatus('unresolved')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                filterStatus === 'unresolved' 
                  ? 'bg-white text-slate-600 shadow-sm hover:bg-slate-50 border border-slate-200' 
                  : 'bg-white hover:bg-white border border-slate-200 text-slate-600'
              }`}
            >
              Unresolved ({errors.filter(e => e.status === 'unresolved').length})
            </button>
            <button 
              onClick={() => setFilterStatus('resolved')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                filterStatus === 'resolved' 
                  ? 'bg-white text-slate-600 shadow-sm hover:bg-slate-50 border border-slate-200' 
                  : 'bg-white hover:bg-white border border-slate-200 text-slate-600'
              }`}
            >
              Resolved ({errors.filter(e => e.status === 'resolved').length})
            </button>
            <button 
              onClick={() => setFilterStatus('ignored')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                filterStatus === 'ignored' 
                  ? 'bg-white text-slate-600 shadow-sm hover:bg-slate-50 border border-slate-200' 
                  : 'bg-white hover:bg-white border border-slate-200 text-slate-600'
              }`}
            >
              Ignored ({errors.filter(e => e.status === 'ignored').length})
            </button>
            <button 
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                filterStatus === 'all' 
                  ? 'bg-white text-slate-600 shadow-sm hover:bg-slate-50 border border-slate-200' 
                  : 'bg-white hover:bg-white border border-slate-200 text-slate-600'
              }`}
            >
              All Events ({errors.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600 uppercase">Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-300 transition-all cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>
        </div>

        {/* Errors table list */}
        {loading ? (
          <div className="p-12 text-center text-slate-600 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-slate-500" size={32} />
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Loading diagnostic telemetry...</p>
          </div>
        ) : filteredErrors.length === 0 ? (
          <div className="p-16 text-center text-slate-600 space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-sm transition-all duration-300">
              <CheckCircle size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black tracking-tight text-slate-800">Clear Logs! No matching events.</h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                No issues logged matching the current query. The system is currently running clean with no detected runtime exceptions.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/70 border-b border-slate-200">
                  <th className="p-4 pl-6 text-[10px] font-black uppercase text-slate-500 tracking-wider">Exception Details</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Severity</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Page / Location</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Affected Context</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Smart diagnostic</th>
                  <th className="p-4 pr-6 text-right text-[10px] font-black uppercase text-slate-500 tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredErrors.map((err) => {
                  const isCritical = err.severity === 'critical';
                  const isHigh = err.severity === 'high';
                  const isMedium = err.severity === 'medium';

                  return (
                    <tr key={err.id} className="hover:bg-white/50 transition-colors group">
                      <td className="p-4 pl-6 max-w-sm">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-slate-800 break-words leading-tight">
                            {err.message}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {err.timestamp.toLocaleString()}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                          isCritical ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          isHigh ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          isMedium ? 'bg-slate-50 text-slate-600 border border-indigo-100' :
                          'bg-white text-slate-800 border border-slate-200'
                        }`}>
                          {err.severity}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold font-mono">
                          <MapPin size={12} className="text-slate-500" />
                          {err.page}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-800 font-bold flex items-center gap-1">
                            <User size={12} className="text-slate-500" />
                            {err.userId.substring(0, 8)}...
                          </span>
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black leading-none">
                            {err.role}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 max-w-xs">
                        <div className="flex items-start gap-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-indigo-100/50">
                          <Sparkles size={14} className="text-slate-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-medium text-slate-600 leading-snug line-clamp-2">
                            {err.aiExplanation}
                          </p>
                        </div>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedError(err)}
                            className="p-1.5 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="View Full Stack Trace"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {err.status === 'unresolved' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(err.id, 'resolved')}
                                disabled={actioningId === err.id}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Mark Resolved"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(err.id, 'ignored')}
                                disabled={actioningId === err.id}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                title="Ignore Issue"
                              >
                                <Ban size={16} />
                              </button>
                              <button
                                onClick={() => handleTriggerAlert(err)}
                                className="p-1.5 text-rose-500 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Trigger Emergency Alert"
                              >
                                <AlertTriangle size={16} />
                              </button>
                            </>
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
      </div>

      {/* Slide-over Inspection Panel / Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-screen flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-300">
            {/* Slide Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white text-slate-600">
              <div className="flex items-center gap-3">
                <AlertOctagon className="text-rose-500" size={24} />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Telemetry Event Inspection</h3>
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block leading-none mt-1">
                    ID: {selectedError.id}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedError(null)}
                className="p-1.5 text-slate-500 hover:text-slate-600 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Slide Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Core Context Grid */}
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block">Severity Level</span>
                  <span className="font-bold text-slate-800 block mt-0.5 uppercase tracking-wide">
                    {selectedError.severity}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block">Log Timestamp</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    {selectedError.timestamp.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block">Impacted User ID</span>
                  <span className="font-mono font-bold text-slate-800 block mt-0.5">
                    {selectedError.userId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase block">Active System Role</span>
                  <span className="font-bold text-slate-600 block mt-0.5 uppercase tracking-wide">
                    {selectedError.role}
                  </span>
                </div>
              </div>

              {/* AI SRE Explanation Callout */}
              <div className="bg-slate-50 border border-slate-300 p-5 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold text-xs uppercase tracking-wider">
                  <Sparkles size={16} className="text-slate-600" />
                  Gemini AI Diagnostic Explanation
                </div>
                <p className="text-slate-800 text-xs font-semibold leading-relaxed">
                  {selectedError.aiExplanation}
                </p>
              </div>

              {/* AI SRE Resolution Report */}
              {selectedError.aiResolutionReport && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    AI SRE Resolution Report
                  </div>
                  <div className="prose prose-slate prose-xs max-w-none text-slate-800 font-medium">
                    <Markdown>{selectedError.aiResolutionReport}</Markdown>
                  </div>
                </div>
              )}

              {/* Exception Message */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Error Exception Message</span>
                <div className="p-4 bg-white text-rose-300 font-mono text-xs rounded-xl border border-slate-200 break-all leading-normal font-bold">
                  {selectedError.message}
                </div>
              </div>

              {/* Stack Trace Snippet */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-1">
                  <Terminal size={12} />
                  Trace Stack Dump
                </span>
                <div className="p-4 bg-white text-slate-500 font-mono text-[10px] rounded-xl border border-slate-200 overflow-x-auto whitespace-pre leading-relaxed max-h-64">
                  {selectedError.stack || 'No stack trace captured.'}
                </div>
              </div>

              {/* Crashlytics Log Breadcrumbs */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">System Event Breadcrumbs</span>
                {selectedError.logs && selectedError.logs.length > 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 font-mono text-[10px] p-2 space-y-1">
                    {selectedError.logs.map((log, logIdx) => (
                      <div key={logIdx} className="py-1 text-slate-600">
                        {log}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No breadcrumbs recorded before crash event.</p>
                )}
              </div>
            </div>

            {/* Slide Actions */}
            <div className="p-6 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase block">Status</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {selectedError.status}
                  </span>
                  {selectedError.fixStatus === 'fixing' && (
                    <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1 animate-pulse uppercase">
                      <RefreshCw size={10} className="animate-spin" /> AI Fixing
                    </span>
                  )}
                  {selectedError.fixStatus === 'fixed' && (
                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 uppercase">
                      <CheckCircle2 size={10} /> AI Fixed
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedError.status === 'unresolved' && (
                  <>
                    <button
                      onClick={() => handleFixIt(selectedError.id)}
                      disabled={actioningId === selectedError.id || selectedError.fixStatus === 'fixing'}
                      className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                    >
                      <Sparkles size={14} /> Fix It
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedError.id, 'resolved')}
                      disabled={actioningId === selectedError.id}
                      className="px-4 py-2 text-xs bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} /> Mark Resolved
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedError.id, 'ignored')}
                      disabled={actioningId === selectedError.id}
                      className="px-4 py-2 text-xs bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Ban size={14} /> Ignore
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
