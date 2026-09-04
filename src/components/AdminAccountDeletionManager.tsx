import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  User, 
  Mail, 
  AlertTriangle, 
  ShieldCheck, 
  Loader2, 
  FileText, 
  RefreshCw, 
  X, 
  ChevronRight,
  Database,
  Info,
  Calendar,
  Lock,
  UserX,
  Stethoscope,
  HeartHandshake
} from 'lucide-react';
import { AccountDeletionRequest } from '../types';

export default function AdminAccountDeletionManager() {
  const { 
    approveAccountDeletion, 
    rejectAccountDeletion, 
    user: adminUser,
    showToast,
    showConfirm
  } = useAppContext();
  
  const [requests, setRequests] = useState<AccountDeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [roleFilter, setRoleFilter] = useState<'all' | 'patient' | 'consultant'>('all');

  // Approval Modal State
  const [selectedApproveRequest, setSelectedApproveRequest] = useState<AccountDeletionRequest | null>(null);
  const [adminApproveNotes, setAdminApproveNotes] = useState('');
  const [isProcessingApprove, setIsProcessingApprove] = useState(false);
  const [approveSuccessMsg, setApproveSuccessMsg] = useState<string | null>(null);

  // Rejection Modal State
  const [selectedRejectRequest, setSelectedRejectRequest] = useState<AccountDeletionRequest | null>(null);
  const [adminRejectReason, setAdminRejectReason] = useState('');
  const [isProcessingReject, setIsProcessingReject] = useState(false);

  // Direct User Lookup & Purge Tool State
  const [directSearchUid, setDirectSearchUid] = useState('');
  const [directFoundUser, setDirectFoundUser] = useState<any | null>(null);
  const [isSearchingDirectUser, setIsSearchingDirectUser] = useState(false);
  const [directSearchError, setDirectSearchError] = useState<string | null>(null);
  const [isDirectPurging, setIsDirectPurging] = useState(false);
  const [showDirectPurgeConfirm, setShowDirectPurgeConfirm] = useState(false);

  // Real-time Firestore subscription to deletion_requests
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'deletion_requests'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AccountDeletionRequest[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          requestId: docSnap.id,
          ...docSnap.data()
        } as AccountDeletionRequest);
      });
      setRequests(items);
      setIsLoading(false);
    }, (error) => {
      console.error("Failed to stream deletion requests:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesRole = roleFilter === 'all' || req.userRole === roleFilter;
    const matchesSearch = 
      (req.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.userId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.reason || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesRole && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  const handleConfirmApproval = async () => {
    if (!selectedApproveRequest) return;
    const targetRequestId = selectedApproveRequest.requestId;
    setIsProcessingApprove(true);
    try {
      // 1. DIRECT IMPLEMENTATION: Filter out instantly from local UI
      setRequests(prev => prev.filter(r => r.requestId !== targetRequestId));
      
      await approveAccountDeletion(
        targetRequestId, 
        selectedApproveRequest.userId,
        adminApproveNotes
      );
      setApproveSuccessMsg(`Successfully purged user ${selectedApproveRequest.userName} (${selectedApproveRequest.userEmail}) from the backend database.`);
      setSelectedApproveRequest(null);
      setAdminApproveNotes('');
      setTimeout(() => setApproveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      showToast(`Approval error: ${err.message || 'Failed to purge account'}`, "error");
    } finally {
      setIsProcessingApprove(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!selectedRejectRequest) return;
    if (!adminRejectReason.trim()) {
      showToast('Please provide a reason for declining this deletion request.', "error");
      return;
    }
    setIsProcessingReject(true);
    try {
      await rejectAccountDeletion(
        selectedRejectRequest.requestId,
        selectedRejectRequest.userId,
        adminRejectReason
      );
      setSelectedRejectRequest(null);
      setAdminRejectReason('');
    } catch (err: any) {
      console.error(err);
      showToast(`Rejection error: ${err.message || 'Failed to reject deletion request'}`, "error");
    } finally {
      setIsProcessingReject(false);
    }
  };

  const handleDirectUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSearchUid.trim()) return;
    setIsSearchingDirectUser(true);
    setDirectSearchError(null);
    setDirectFoundUser(null);

    try {
      const docRef = doc(db, 'users', directSearchUid.trim());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setDirectFoundUser({ id: docSnap.id, ...docSnap.data() });
      } else {
        setDirectSearchError(`No user found in 'users' collection with ID "${directSearchUid}".`);
      }
    } catch (err: any) {
      console.error(err);
      setDirectSearchError('Error querying Firestore users collection.');
    } finally {
      setIsSearchingDirectUser(false);
    }
  };

  const handleDirectPurgeConfirm = async () => {
    if (!directFoundUser) return;
    setIsDirectPurging(true);
    try {
      // Create a direct synthetic request and approve it immediately
      const syntheticReqId = `direct_purge_${Date.now()}`;
      await approveAccountDeletion(
        syntheticReqId,
        directFoundUser.id,
        'Direct Administrative Emergency Backend Purge'
      );
      setApproveSuccessMsg(`Direct purge complete: User doc ${directFoundUser.id} permanently deleted.`);
      setShowDirectPurgeConfirm(false);
      setDirectFoundUser(null);
      setDirectSearchUid('');
      setTimeout(() => setApproveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      showToast(`Direct purge error: ${err.message}`, "error");
    } finally {
      setIsDirectPurging(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 border border-rose-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <UserX size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-800 tracking-tight">Account Deletions & Backend Purge Approval</h2>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Admin-gated workflow for patient & consultant account deletion and permanent backend record purges
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Status Metric Badges */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block leading-none">Pending Action</span>
              <span className="text-lg font-black text-amber-900 leading-tight">{pendingCount}</span>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <div>
              <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider block leading-none">Purged</span>
              <span className="text-lg font-black text-rose-900 leading-tight">{approvedCount}</span>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div>
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block leading-none">Restored</span>
              <span className="text-lg font-black text-emerald-900 leading-tight">{rejectedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {approveSuccessMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 size={18} />
            <span>{approveSuccessMsg}</span>
          </div>
          <button onClick={() => setApproveSuccessMsg(null)} className="text-emerald-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Direct Administrative Backend User Lookup & Purge Tool */}
      <div className="bg-white text-slate-600 p-6 rounded-3xl shadow-lg border border-slate-200">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Database className="text-slate-600" size={18} />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
              Direct Backend User Purge & Inspection
            </h3>
          </div>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
            Super-Admin Override
          </span>
        </div>
        
        <form onSubmit={handleDirectUserSearch} className="flex gap-3 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              value={directSearchUid}
              onChange={e => setDirectSearchUid(e.target.value)}
              placeholder="Enter exact User UID to query backend (e.g. eYy9A...)"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 placeholder-slate-400 focus:outline-none focus:border-slate-300 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingDirectUser || !directSearchUid.trim()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-600 disabled:opacity-50 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            {isSearchingDirectUser ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Inspect User Doc
          </button>
        </form>

        {directSearchError && (
          <p className="text-xs text-rose-400 mt-3 flex items-center gap-1.5 font-medium">
            <AlertTriangle size={14} /> {directSearchError}
          </p>
        )}

        {directFoundUser && (
          <div className="mt-4 p-4 bg-white/80 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 text-sm">{directFoundUser.fullName || directFoundUser.displayName || 'Unnamed User'}</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600/20 text-slate-600 border border-slate-300/30">
                  {directFoundUser.role}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {directFoundUser.accountStatus || directFoundUser.verificationStatus || 'Active'}
                </span>
              </div>
              <p className="text-xs text-slate-500">{directFoundUser.email} • UID: <span className="font-mono text-slate-500">{directFoundUser.id}</span></p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDirectFoundUser(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-600 text-slate-500 text-xs font-bold rounded-xl transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => setShowDirectPurgeConfirm(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-slate-600 text-xs font-bold rounded-xl transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Direct Purge from Backend
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by user name, email, user ID, or deletion reason..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center bg-white p-1 rounded-2xl">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'pending' ? 'bg-white text-amber-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                All ({requests.length})
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'approved' ? 'bg-white text-rose-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Purged ({approvedCount})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'rejected' ? 'bg-white text-emerald-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Restored ({rejectedCount})
              </button>
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            >
              <option value="all">All Roles</option>
              <option value="patient">Patients Only</option>
              <option value="consultant">Consultants Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-slate-600 mb-3" size={28} />
            <p className="text-xs font-bold text-slate-600">Streaming deletion requests from Firestore...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-500 mb-3">
              <CheckCircle2 size={28} />
            </div>
            <h4 className="text-base font-bold text-slate-800">No Deletion Requests Found</h4>
            <p className="text-xs text-slate-600 mt-1 max-w-sm">
              {statusFilter === 'pending'
                ? 'All user deletion requests have been reviewed and resolved.'
                : 'No records match your selected search criteria.'}
            </p>
          </div>
        ) : (
          filteredRequests.map(request => {
            const isPending = request.status === 'pending';
            const isApproved = request.status === 'approved';
            const isRejected = request.status === 'rejected';

            const createdDateStr = request.createdAt 
              ? new Date(request.createdAt).toLocaleString() 
              : 'Recently requested';

            return (
              <div 
                key={request.requestId}
                className={`bg-white rounded-3xl border transition-all p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${
                  isPending 
                    ? 'border-amber-300 bg-amber-50/10' 
                    : isApproved
                    ? 'border-rose-200 bg-rose-50/10 opacity-90'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  
                  {/* User Profile & Request Summary */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-black text-slate-800">{request.userName || 'Unnamed User'}</h3>
                      
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        request.userRole === 'consultant'
                          ? 'bg-slate-200 text-slate-600 border border-slate-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {request.userRole === 'consultant' ? <Stethoscope size={11} /> : <User size={11} />}
                        {request.userRole}
                      </span>

                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isPending 
                          ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                          : isApproved
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {isPending && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                        {isApproved && <CheckCircle2 size={12} />}
                        {isRejected && <XCircle size={12} />}
                        {isPending ? 'Pending Admin Backend Purge' : isApproved ? 'Purged from Backend' : 'Request Declined / Restored'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} className="text-slate-500 shrink-0" />
                        <span className="truncate">{request.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-500 shrink-0" />
                        <span>Requested: {createdDateStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Database size={13} className="text-slate-500 shrink-0" />
                        <span className="font-mono text-[11px] truncate">UID: {request.userId}</span>
                      </div>
                    </div>

                    {/* Stated Reason & User Feedback */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Info size={14} className="text-slate-600" />
                        <span>Reason: <span className="text-slate-800 capitalize font-black">{request.reason}</span></span>
                      </div>
                      {request.details && (
                        <p className="text-xs text-slate-600 italic font-medium">
                          "{request.details}"
                        </p>
                      )}
                    </div>

                    {/* Review Notes (if already processed) */}
                    {(request.reviewedAt || request.reviewNotes) && (
                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-800">Audit Trail: </span>
                        Reviewed by <span className="font-semibold">{request.reviewedByEmail || 'Super Admin'}</span> on {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : 'N/A'}.
                        {request.reviewNotes && <span className="block mt-0.5 text-slate-600 italic">Note: "{request.reviewNotes}"</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-row lg:flex-col items-center justify-end gap-2.5 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedApproveRequest(request);
                            setAdminApproveNotes('');
                          }}
                          className="w-full lg:w-48 px-4 py-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>Approve & Purge</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedRejectRequest(request);
                            setAdminRejectReason('');
                          }}
                          className="w-full lg:w-48 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <XCircle size={14} className="text-slate-600" />
                          <span>Decline Request</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-right lg:text-center w-full lg:w-48 py-2 text-xs font-bold text-slate-500">
                        Processed
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Explicit Admin Approval & Backend Purge Confirmation */}
      {selectedApproveRequest && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-rose-100 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-slate-600 flex items-center justify-center shadow-md">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950">Approve Account Deletion & Backend Purge</h3>
                  <p className="text-xs text-rose-700 font-medium">Irreversible Administrative Backend Operation</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedApproveRequest(null)}
                className="p-2 text-rose-400 hover:text-rose-700 rounded-full bg-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                <p className="font-bold text-slate-800">Target User Details:</p>
                <p className="text-slate-600"><span className="font-semibold">Name:</span> {selectedApproveRequest.userName}</p>
                <p className="text-slate-600"><span className="font-semibold">Email:</span> {selectedApproveRequest.userEmail}</p>
                <p className="text-slate-600"><span className="font-semibold">Role:</span> <span className="uppercase font-bold">{selectedApproveRequest.userRole}</span></p>
                <p className="text-slate-600 font-mono text-[11px]"><span className="font-sans font-semibold">User UID:</span> {selectedApproveRequest.userId}</p>
                <p className="text-slate-600"><span className="font-semibold">Stated Reason:</span> {selectedApproveRequest.reason}</p>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert size={15} className="text-amber-700 shrink-0" />
                  What happens when you approve:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pl-1">
                  <li>User document <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">users/{selectedApproveRequest.userId}</code> will be permanently deleted from Firestore.</li>
                  <li>The request state will update to <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">approved</code>.</li>
                  <li>An immutable audit record will be logged in <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">admin_audit_logs</code>.</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Admin Approval Notes (Optional)
                </label>
                <input 
                  type="text" 
                  value={adminApproveNotes}
                  onChange={e => setAdminApproveNotes(e.target.value)}
                  placeholder="e.g. Verified compliance retention policy; no pending disputes"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedApproveRequest(null)}
                  disabled={isProcessingApprove}
                  className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproval}
                  disabled={isProcessingApprove}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-slate-600 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-rose-600/20"
                >
                  {isProcessingApprove ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirm & Purge from Backend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Admin Rejection Dialog */}
      {selectedRejectRequest && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center font-bold">
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Decline Deletion Request</h3>
                  <p className="text-xs text-slate-600 font-medium">Restore user account to active status</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRejectRequest(null)}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-full bg-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Declining this request will restore <span className="font-bold text-slate-800">{selectedRejectRequest.userName}</span>'s account status to active. Please provide a clear explanation for compliance audit records.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Reason for Declining Deletion <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  required
                  rows={3}
                  value={adminRejectReason}
                  onChange={e => setAdminRejectReason(e.target.value)}
                  placeholder="e.g. Account has active consultations scheduled or statutory medical record retention requires account holding period..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRejectRequest(null)}
                  disabled={isProcessingReject}
                  className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejection}
                  disabled={isProcessingReject || !adminRejectReason.trim()}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  {isProcessingReject ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Submit & Restore User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Direct Purge Confirmation */}
      {showDirectPurgeConfirm && directFoundUser && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-black text-slate-800">Emergency Direct Purge</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you absolutely sure you want to purge user doc <code className="font-mono bg-white px-1 py-0.5 rounded text-rose-700 font-bold">{directFoundUser.id}</code> ({directFoundUser.email}) from Firestore?
            </p>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDirectPurgeConfirm(false)}
                disabled={isDirectPurging}
                className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDirectPurgeConfirm}
                disabled={isDirectPurging}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-slate-600 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isDirectPurging ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Confirm Direct Purge
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
