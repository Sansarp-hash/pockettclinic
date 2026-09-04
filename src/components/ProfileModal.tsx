import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { formatMemberId } from '../lib/memberId';
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  Camera, 
  Check, 
  Sparkles, 
  Loader2, 
  ShieldAlert, 
  LogOut, 
  ShieldCheck, 
  Award
} from 'lucide-react';
import UploadIndemnityModal from './UploadIndemnityModal';
import AccountDeletionModal from './AccountDeletionModal';
import SubscriptionCard from './SubscriptionCard';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: any; // Optional prop to override context user (for admin mirroring)
}

export default function ProfileModal({ isOpen, onClose, targetUser }: ProfileModalProps) {
  const { user: contextUser, updateUserProfile, logout } = useAppContext();
  const isActualAdmin = contextUser?.role === 'admin';
  
  const activeUser = targetUser || contextUser;
  const isConsultant = activeUser?.role === 'consultant';
  const isVerified = activeUser?.isVerified === true;
  const hasPendingChanges = activeUser?.verificationPendingReview && activeUser?.pendingProfileChanges;
  const pending = activeUser?.pendingProfileChanges || {};

  const [displayName, setDisplayName] = useState(
    hasPendingChanges ? (pending.displayName || pending.fullName || '') : (activeUser?.displayName || activeUser?.fullName || '')
  );
  const [phone, setPhone] = useState(activeUser?.phone || '');
  const [prefix, setPrefix] = useState(
    hasPendingChanges ? (pending.prefix || '') : (activeUser?.prefix || '')
  );
  const [qualification, setQualification] = useState(
    hasPendingChanges ? (pending.qualification || '') : (activeUser?.qualification || '')
  );
  const [cadre, setCadre] = useState<string>(
    hasPendingChanges ? (pending.cadre || activeUser?.cadre || 'UNASSIGNED') : (activeUser?.cadre || 'UNASSIGNED')
  );
  const [councilPin, setCouncilPin] = useState(
    hasPendingChanges ? (pending.councilPin || '') : (activeUser?.councilPin || '')
  );
  const [manualReviewFile, setManualReviewFile] = useState(
    hasPendingChanges ? (pending.manualReviewFile || '') : (activeUser?.manualReviewFile || '')
  );
  const [manualReviewFileName, setManualReviewFileName] = useState(
    hasPendingChanges ? (pending.manualReviewFileName || '') : (activeUser?.manualReviewFileName || '')
  );
  const [avatarUrl, setAvatarUrl] = useState(activeUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(activeUser?.displayName || activeUser?.fullName || 'PockettClinic')}`);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [isIndemnityModalOpen, setIsIndemnityModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRequestingChange, setIsRequestingChange] = useState(false);

  if (!isOpen) return null;

  const handleCustomAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setManualReviewFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setManualReviewFile(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isConsultant && isVerified && isRequestingChange && !isActualAdmin) {
        // Intercept and save as pending profile changes
        const pendingChanges = {
          fullName: displayName,
          displayName,
          prefix,
          cadre,
          qualification,
          councilPin,
          manualReviewFile,
          manualReviewFileName,
          requestedAt: new Date().toISOString()
        };

        await updateUserProfile({
          phone,
          avatarUrl,
          verificationPendingReview: true,
          pendingProfileChanges: pendingChanges
        });
        
        setSuccessMsg(true);
        setTimeout(() => {
          setSuccessMsg(false);
          setIsRequestingChange(false);
          onClose();
        }, 1000);
      } else {
        // Normal direct update (either patient, or unverified consultant, or admin override)
        const updates: any = {
          displayName,
          fullName: displayName,
          phone,
          avatarUrl
        };

        if (isConsultant) {
          updates.prefix = prefix;
          updates.cadre = cadre;
          updates.qualification = qualification;
          updates.councilPin = councilPin;
          updates.manualReviewFile = manualReviewFile;
          updates.manualReviewFileName = manualReviewFileName;
          
          // If admin edited, clear pending since admin overrides
          if (isActualAdmin) {
            updates.verificationPendingReview = false;
            updates.pendingProfileChanges = null;
          }
        }

        await updateUserProfile(updates);
        setSuccessMsg(true);
        setTimeout(() => {
          setSuccessMsg(false);
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col relative border border-slate-200 my-8">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 font-bold border border-indigo-100">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Account & Profile Details</h3>
              <p className="text-xs text-slate-600 font-medium">Manage your personal credentials and preferences</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-600 bg-white hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Avatar Preview & Photo Picker */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group">
              <img 
                src={avatarUrl} 
                alt="Avatar Preview" 
                className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 shadow-md bg-white" 
              />
              <label className="absolute bottom-0 right-0 bg-emerald-600 hover:bg-emerald-600 text-white p-2.5 rounded-full cursor-pointer shadow-md transition-transform hover:scale-110">
                <Camera size={16} />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleCustomAvatar} 
                  className="hidden" 
                />
              </label>
            </div>
            <p className="text-[11px] font-medium text-slate-500">Click camera icon to change photo</p>
          </div>

          {/* Account Overview Cards (Information Display) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Account Overview</span>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Role</span>
                <span className="font-bold text-slate-600 capitalize flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={13} /> {activeUser?.role} {activeUser?.cadre ? `(${activeUser.cadre})` : ''}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Status</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {activeUser?.accountStatus === 'pending_deletion' ? 'Pending Deletion' : (activeUser?.verificationStatus || 'Active')}
                </span>
              </div>

              {isConsultant && (
                <>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Council PIN</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">
                      {(activeUser as any)?.councilPin || 'Pending PIN'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Ghana Card ID</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">
                      {(activeUser as any)?.ghanaCardId || activeUser?.ghanaCardNo || 'Verified Card'}
                    </span>
                  </div>
                </>
              )}

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Member ID</span>
                <span className="font-mono text-xs font-bold text-slate-600 block mt-0.5">
                  {formatMemberId(activeUser)}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Tier Management */}
          <SubscriptionCard compact={true} />

          {/* Post-Verification Banner / Controls */}
          {isConsultant && isVerified && (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-start gap-2.5">
              <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <span className="text-xs font-black text-slate-800">Verified Consultant Profile</span>
                <p className="text-[11px] text-slate-600 mt-0.5">Your professional credentials have been authenticated. Editing critical consultant fields requires administrative review.</p>
                {!activeUser?.verificationPendingReview ? (
                  !isRequestingChange ? (
                    <button
                      type="button"
                      onClick={() => setIsRequestingChange(true)}
                      className="mt-2 text-xs font-bold text-slate-600 hover:text-slate-600 flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer active:scale-95 transition-all"
                    >
                      ✏️ Request Change to Verified Info
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRequestingChange(false)}
                      className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer active:scale-95 transition-all"
                    >
                      Cancel Change Request
                    </button>
                  )
                ) : (
                  <div className="mt-2 text-xs font-bold text-amber-600 flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1 w-fit">
                    ⚠️ Change Request Pending Admin Review
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editable Fields */}
          <div className="space-y-4">
            {isConsultant && (
              <>
                {/* Prefix Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>Professional Title / Prefix</span>
                    {isConsultant && isVerified && !isRequestingChange && !isActualAdmin && (
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">Verified & Locked</span>
                    )}
                    {isConsultant && isVerified && isRequestingChange && (
                      <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">Modifying (Under Review)</span>
                    )}
                  </label>
                  <div className="relative">
                    <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <select
                      value={prefix}
                      onChange={e => setPrefix(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium text-slate-800 text-sm appearance-none cursor-pointer"
                    >
                      <option value="">Auto Title (Mr. / Ms. according to name)</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Pharm.">Pharm.</option>
                      <option value="PA">PA</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Pharm. Tech.">Pharm. Tech.</option>
                    </select>
                    {(!isConsultant || !isVerified || isRequestingChange || isActualAdmin) && <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>}
                  </div>
                </div>

                {/* Cadre Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>Professional Cadre / Role</span>
                    {isVerified && !isRequestingChange && !isActualAdmin && (
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">Verified & Locked</span>
                    )}
                  </label>
                  <div className="relative">
                    <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    {(!isVerified || isRequestingChange || isActualAdmin) ? (
                      <select
                        value={cadre}
                        onChange={e => setCadre(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium text-slate-800 text-sm appearance-none cursor-pointer"
                      >
                        <option value="UNASSIGNED" disabled>Unassigned Consultant (Select Cadre below)</option>
                        <option value="PHARM_TECH">Pharmacy Technician (GHS 20 Chat / GHS 30 Video)</option>
                        <option value="PHYSICIAN_ASSISTANT">Physician Assistant (PA) (GHS 30 Chat / GHS 45 Video)</option>
                        <option value="PHARMACIST">Pharmacist (GHS 50 Chat / GHS 70 Video)</option>
                        <option value="DOCTOR">Doctor (GHS 70 Chat / GHS 90 Video)</option>
                        <option value="SPECIALIST">Specialist (GHS 90 Chat / GHS 130 Video)</option>
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        disabled
                        value={cadre === 'PHARM_TECH' ? 'Pharmacy Technician' : cadre === 'PHYSICIAN_ASSISTANT' ? 'Physician Assistant (PA)' : cadre === 'PHARMACIST' ? 'Pharmacist' : cadre === 'SPECIALIST' ? 'Specialist' : cadre === 'UNASSIGNED' ? 'Unassigned Consultant' : 'Doctor'}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm cursor-not-allowed font-medium"
                      />
                    )}
                    {(!isVerified || isRequestingChange || isActualAdmin) && <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>}
                  </div>
                </div>

                {/* Qualification Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>Professional Qualification</span>
                    {isVerified && !isRequestingChange && !isActualAdmin && (
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">Verified & Locked</span>
                    )}
                  </label>
                  <div className="relative">
                    <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    {(!isVerified || isRequestingChange || isActualAdmin) ? (
                      <select
                        value={qualification}
                        onChange={e => setQualification(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium text-slate-800 text-sm appearance-none cursor-pointer"
                      >
                        <option value="Doctor of Medicine (MBChB/MD)">Doctor of Medicine (MBChB/MD)</option>
                        <option value="PharmD">Doctor of Pharmacy (PharmD)</option>
                        <option value="Bachelors of Pharmacy (BPharm)">Bachelors of Pharmacy (BPharm)</option>
                        <option value="Fellowship (GCPS/WACP/WACS)">Fellowship (GCPS/WACP/WACS)</option>
                        <option value="Dispensing Technician Certificate">Dispensing Technician Certificate</option>
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        disabled
                        value={qualification || 'No Qualification'}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm cursor-not-allowed font-medium"
                      />
                    )}
                    {(!isVerified || isRequestingChange || isActualAdmin) && <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>}
                  </div>
                </div>

                {/* Council PIN / License Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>Council PIN / License Number</span>
                    {isVerified && !isRequestingChange && !isActualAdmin && (
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">Verified & Locked</span>
                    )}
                  </label>
                  <div className="relative">
                    <ShieldAlert className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      required
                      disabled={isVerified && !isRequestingChange && !isActualAdmin}
                      value={councilPin}
                      onChange={e => setCouncilPin(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none ${
                        isVerified && !isRequestingChange && !isActualAdmin
                          ? 'bg-white border-slate-200 text-slate-600 cursor-not-allowed'
                          : 'bg-white border-slate-200 focus:ring-2 focus:ring-emerald-500/20 text-slate-800'
                      }`}
                      placeholder="e.g. MDC/RN/1029"
                    />
                  </div>
                </div>

                {/* Certificate File Upload for Change Request */}
                {(!isVerified || isRequestingChange || isActualAdmin) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide">
                      Clinical License / Certificate Document
                    </label>
                    <div className="mt-1 flex items-center justify-between p-3.5 bg-white border border-dashed border-slate-300 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Award className="text-slate-600 shrink-0" size={20} />
                        <span className="text-xs text-slate-600 font-bold truncate max-w-[200px]">
                          {manualReviewFileName || 'No certificate uploaded'}
                        </span>
                      </div>
                      <label className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer transition-all active:scale-95">
                        Choose File
                        <input 
                          type="file" 
                          accept=".pdf,image/*" 
                          onChange={handleCertificateUpload} 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide flex items-center justify-between">
                <span>Full Legal Name</span>
                {isConsultant && isVerified && !isRequestingChange && !isActualAdmin && (
                  <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">Verified & Locked</span>
                )}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  required
                  disabled={isConsultant && isVerified && !isRequestingChange && !isActualAdmin}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none ${
                    isConsultant && isVerified && !isRequestingChange && !isActualAdmin
                      ? 'bg-white border-slate-200 text-slate-600 cursor-not-allowed'
                      : 'bg-white border-slate-200 focus:ring-2 focus:ring-emerald-500/20 text-slate-800'
                  }`}
                  placeholder="e.g. Kwame Mensah"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide flex items-center justify-between">
                <span>Phone Number (MoMo / WhatsApp)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="tel" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium text-slate-800 text-sm"
                  placeholder="+233 24 123 4567"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide">Email Address (Read-only)</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  disabled
                  value={activeUser?.email || 'guest@pockettclinic.com'}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm cursor-not-allowed font-medium"
                />
              </div>
            </div>

            {/* Persistent Amber Indemnity Warning Badge for Consultants */}
            {activeUser?.indemnityStatus === 'deferred_pending' && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="inline-block bg-amber-100 text-amber-900 font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200">
                      Indemnity: Pending Upload (Operating under Personal Liability Agreement)
                    </span>
                    <p className="text-[11px] text-amber-900 mt-1 leading-snug">
                      You are currently operating under a personal liability sign-off. Submit your active indemnity policy document to clear this warning.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsIndemnityModalOpen(true)}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-slate-600 rounded-xl text-xs font-bold transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                >
                  Upload Indemnity Certificate Now
                </button>
              </div>
            )}
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check size={16} />
              Profile updated successfully!
            </div>
          )}

          <div className="pt-2 flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Save Changes
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => { 
                logout().then(() => {
                  window.location.href = '/';
                });
              }}
              className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
            >
              <LogOut size={18} />
              Sign Out of PockettClinic
            </button>

            {/* Danger Zone: Delete Account */}
            <div className="pt-3 mt-2 border-t border-rose-100">
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <p className="text-xs text-rose-800 font-medium leading-relaxed">
                  This action completely deletes your account and it cannot be recovered.
                </p>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  Delete Account
                </button>
              </div>
            </div>

          </div>
        </form>

        <UploadIndemnityModal 
          isOpen={isIndemnityModalOpen} 
          onClose={() => setIsIndemnityModalOpen(false)} 
        />

        <AccountDeletionModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
        />
      </div>
    </div>
  );
}
