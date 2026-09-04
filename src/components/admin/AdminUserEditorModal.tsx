import React, { useState } from 'react';
import { X, ShieldCheck, User, CreditCard, Award, DollarSign, Loader2, Save, AlertTriangle, Plus, Trash2, CheckCircle2, Shield } from 'lucide-react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { Role } from '../../types';

interface AdminUserEditorModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedUser: any) => void;
}

export default function AdminUserEditorModal({
  user,
  isOpen,
  onClose,
  onSaved
}: AdminUserEditorModalProps) {
  const { showToast } = useAppContext();
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState(user?.fullName || user?.displayName || '');
  const [prefix, setPrefix] = useState(user?.prefix || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || user?.phoneNumber || '');
  const [cadre, setCadre] = useState(user?.cadre || 'UNASSIGNED');
  const [specialty, setSpecialty] = useState(user?.specialty || user?.specialization || '');
  const [councilPin, setCouncilPin] = useState(user?.councilPin || '');
  const [qualification, setQualification] = useState(user?.qualification || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isVerified, setIsVerified] = useState<boolean>(user?.isVerified || false);
  const [isGoodStanding, setIsGoodStanding] = useState<boolean>(user?.isGoodStanding !== false);
  const [accountStatus, setAccountStatus] = useState<string>(user?.accountStatus || 'active');
  const [userRole, setUserRole] = useState<Role>(user?.role || 'patient');
  
  // Financial Overrides
  const [walletBalance, setWalletBalance] = useState<number>(Number(user?.walletBalanceGHS) || 0);
  const [walletReason, setWalletReason] = useState<string>('');
  
  // Issue Credit Ticket
  const [showIssueTicket, setShowIssueTicket] = useState(false);
  const [ticketAmount, setTicketAmount] = useState<number>(30);
  const [ticketReason, setTicketReason] = useState<string>('Administrative Goodwill Support Credit');
  const [isIssuingTicket, setIsIssuingTicket] = useState(false);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let updatedRole = userRole;

      const updates: any = {
        fullName,
        displayName: fullName,
        prefix: prefix || null,
        email,
        phone,
        phoneNumber: phone,
        cadre,
        role: updatedRole,
        specialty,
        specialization: specialty,
        councilPin,
        qualification,
        bio,
        isVerified,
        verificationStatus: isVerified ? 'verified' : 'unverified',
        isGoodStanding,
        accountStatus,
        walletBalanceGHS: Number(walletBalance),
        updatedAt: new Date().toISOString()
      };

      const userId = user.id || user.uid;
      await updateDoc(doc(db, 'users', userId), updates);

      // Log audit trail if wallet balance was changed
      if (Number(walletBalance) !== Number(user.walletBalanceGHS || 0)) {
        await addDoc(collection(db, 'admin_audit_logs'), {
          adminUid: 'admin',
          targetUserId: userId,
          targetUserName: fullName,
          action: 'WALLET_BALANCE_OVERRIDE',
          oldBalance: Number(user.walletBalanceGHS || 0),
          newBalance: Number(walletBalance),
          reason: walletReason || 'Admin Manual Override',
          timestamp: serverTimestamp()
        }).catch(e => console.warn("Audit log error:", e));
      }

      showToast(`Profile & overrides saved for ${fullName}.`, "success");
      if (onSaved) onSaved({ ...user, ...updates });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id || user.uid}`);
      showToast("Failed to update user profile.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleIssueTicket = async () => {
    if (!ticketAmount || ticketAmount <= 0) return;
    setIsIssuingTicket(true);
    try {
      const ticketId = `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const userId = user.id || user.uid;

      await addDoc(collection(db, 'rescheduling_tickets'), {
        ticketId,
        patientId: userId,
        patientName: fullName,
        valueGHS: Number(ticketAmount),
        remainingGHS: Number(ticketAmount),
        reason: ticketReason,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      });

      showToast(`Store credit ticket ${ticketId} (GHS ${ticketAmount}) issued successfully.`, "success");
      setShowIssueTicket(false);
      setTicketReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'rescheduling_tickets');
      showToast("Failed to issue store credit ticket.", "error");
    } finally {
      setIsIssuingTicket(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Manual Profile & Wallet Override</h3>
              <p className="text-xs text-slate-400">UID: {user.id || user.uid}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSaveProfile} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          {/* Section 1: Basic Identity */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <User size={15} className="text-indigo-600" /> Identity & Contact Details
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title / Prefix</label>
                <select
                  value={prefix}
                  onChange={e => setPrefix(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Pharm.">Pharm.</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Pharm. Tech.">Pharm. Tech.</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Credentials (for Consultants) */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Award size={15} className="text-indigo-600" /> Cadre & Licensing Info
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Clinical Cadre</label>
                <select
                  value={cadre}
                  onChange={e => {
                    const newCadre = e.target.value;
                    setCadre(newCadre);
                    if (newCadre === 'PATIENT') {
                      setUserRole('patient');
                    } else if (['DOCTOR', 'PHARMACIST', 'PHYSICIAN_ASSISTANT', 'PHARM_TECH', 'SPECIALIST'].includes(newCadre)) {
                      setUserRole('consultant');
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="UNASSIGNED">Unassigned Consultant</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="SPECIALIST">Specialist</option>
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="PHYSICIAN_ASSISTANT">Physician Assistant (PA)</option>
                  <option value="PHARM_TECH">Pharmacy Technician</option>
                  <option value="PATIENT">Patient Account</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Council Retention PIN</label>
                <input
                  type="text"
                  value={councilPin}
                  onChange={e => setCouncilPin(e.target.value)}
                  placeholder="e.g. MDC/RN/2026/0192"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Specialty Focus</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  placeholder="e.g. General Practice, Pediatrics, Dermatology"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qualification / Degrees</label>
                <input
                  type="text"
                  value={qualification}
                  onChange={e => setQualification(e.target.value)}
                  placeholder="e.g. MBChB, PharmD, FWACP"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bio Summary</label>
              <textarea
                rows={2}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Professional background description..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Section 3: Verification & Standing Toggles */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-emerald-600" /> Verification & Account Status
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Identity Verification</label>
                <select
                  value={isVerified ? 'true' : 'false'}
                  onChange={e => setIsVerified(e.target.value === 'true')}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none ${
                    isVerified ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'
                  }`}
                >
                  <option value="true">✓ Verified Account</option>
                  <option value="false">⚠ Unverified / Pending</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Registry Standing</label>
                <select
                  value={isGoodStanding ? 'true' : 'false'}
                  onChange={e => setIsGoodStanding(e.target.value === 'true')}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none ${
                    isGoodStanding ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  <option value="true">✓ In Good Standing</option>
                  <option value="false">✗ Suspended / Under Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Platform Account Status</label>
                <select
                  value={accountStatus}
                  onChange={e => setAccountStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="flagged_for_deletion">Pending Deletion</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">System Authorization Role</label>
                <select
                  value={userRole}
                  onChange={e => setUserRole(e.target.value as Role)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="patient">Patient</option>
                  <option value="consultant">Consultant</option>
                  <option value="public">Public</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Wallet & Store Credit Controls */}
          <div className="space-y-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
            <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <DollarSign size={15} className="text-emerald-600" /> Wallet Balance & Store Credit Adjustments
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Wallet Balance (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  value={walletBalance}
                  onChange={e => setWalletBalance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reason for Balance Override</label>
                <input
                  type="text"
                  value={walletReason}
                  onChange={e => setWalletReason(e.target.value)}
                  placeholder="e.g. Manual correction, bonus, refund adjustment"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
              <span className="text-[10px] text-emerald-800 font-bold">Issue Store Credit Voucher</span>
              <button
                type="button"
                onClick={() => setShowIssueTicket(!showIssueTicket)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} /> {showIssueTicket ? 'Cancel' : 'Issue Credit Voucher'}
              </button>
            </div>

            {showIssueTicket && (
              <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Voucher Amount (GHS)</label>
                    <input
                      type="number"
                      value={ticketAmount}
                      onChange={e => setTicketAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Issue Reason</label>
                    <input
                      type="text"
                      value={ticketReason}
                      onChange={e => setTicketReason(e.target.value)}
                      placeholder="e.g. Goodwill support voucher"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleIssueTicket}
                  disabled={isIssuingTicket}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isIssuingTicket ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Dispatch Credit Voucher
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save All Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
