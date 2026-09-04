import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  CheckCircle2, 
  ShieldAlert, 
  Loader2, 
  FileText, 
  DatabaseZap, 
  Info,
  Lock
} from 'lucide-react';

interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DELETION_REASONS = [
  'I no longer require telemedicine or health consultations',
  'I am switching to another healthcare provider/service',
  'Privacy and personal data storage concerns',
  'Created a duplicate account by mistake',
  'Experiencing technical or usability difficulties',
  'Other reason'
];

export default function AccountDeletionModal({ isOpen, onClose }: AccountDeletionModalProps) {
  const { user, requestAccountDeletion, logout } = useAppContext();
  
  const [reason, setReason] = useState(DELETION_REASONS[0]);
  const [customFeedback, setCustomFeedback] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const isConfirmed = confirmPhrase.trim().toUpperCase() === 'DELETE';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await requestAccountDeletion(reason, customFeedback);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        logout().then(() => {
          window.location.href = '/';
        });
      }, 3000);
    } catch (err: any) {
      console.error("Account deletion request failed:", err);
      setErrorMsg(err.message || 'Failed to submit account deletion request. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white/70 backdrop-blur-md z-[120] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-rose-100 flex flex-col relative my-8">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-rose-600 to-rose-700 text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-slate-600 shrink-0 backdrop-blur-sm">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Delete Account & Purge Data</h3>
            </div>
          </div>
          {!isSuccess && (
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-rose-100 hover:text-slate-600 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-xl font-black tracking-tight text-slate-800">Deletion Request Queued</h4>
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              Your account is now deactivated on the frontend. The request has been routed to the <strong>Administrator Console</strong> for review and permanent backend purge in accordance with clinical records governance.
            </p>
            <div className="p-3 bg-white border border-slate-200 rounded-2xl text-xs text-slate-600 font-medium">
              Signing you out securely in a few moments...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            
            {/* Warning Card */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                    Please Read Carefully Before Continuing
                  </h4>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    Requesting account deletion will immediately deactivate your session on the frontend. Under Ghana Health Data Governance and Act 843, an <strong>Administrator must review and approve the final backend data purge</strong> to ensure no unfulfilled clinical orders remain.
                  </p>
                </div>
              </div>
            </div>

            {/* User Details Summary */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Account To Be Deleted</span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">User Name:</span>
                <span className="font-bold text-slate-800">{user.fullName || user.displayName || 'Account User'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Account Email:</span>
                <span className="font-bold text-slate-800">{user.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Account Role:</span>
                <span className="font-bold text-slate-600 capitalize bg-slate-50 px-2 py-0.5 rounded-md">
                  {user.role} {user.cadre ? `(${user.cadre})` : ''}
                </span>
              </div>
            </div>

            {/* Reason Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                Reason For Deletion <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-xs font-semibold text-slate-800 cursor-pointer"
              >
                {DELETION_REASONS.map((r, idx) => (
                  <option key={idx} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Optional Feedback */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                Additional Comments / Feedback (Optional)
              </label>
              <textarea
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                placeholder="Tell us what we could improve..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-xs font-medium text-slate-800"
              />
            </div>

            {/* Confirmation Input */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-800">
                To confirm, type <span className="text-rose-600 font-black">DELETE</span> below:
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  required
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-rose-50/50 border border-rose-300 focus:ring-2 focus:ring-rose-500 outline-none text-sm font-black text-rose-900 tracking-wider placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-500"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-100 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={16} />
                {errorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-sm transition-colors"
              >
                Keep Account
              </button>
              <button
                type="submit"
                disabled={!isConfirmed || isSubmitting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-50 disabled:text-slate-500 text-white rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Confirm & Request Deletion
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
