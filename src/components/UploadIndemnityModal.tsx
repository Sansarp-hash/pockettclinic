import React, { useState } from 'react';
import { X, ShieldCheck, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAppContext } from '../AppContext';

interface UploadIndemnityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UploadIndemnityModal({ isOpen, onClose, onSuccess }: UploadIndemnityModalProps) {
  const { user, updateUserProfile } = useAppContext();

  const [provider, setProvider] = useState(user?.indemnityInsuranceProvider || 'Star Assurance Ghana');
  const [policyNo, setPolicyNo] = useState(user?.indemnityPolicyNo || 'IND-2026-');
  const [expiryDate, setExpiryDate] = useState(user?.indemnityExpiryDate || '2027-12-31');
  const [fileData, setFileData] = useState<string | null>(user?.indemnityDocUrl || null);
  const [fileName, setFileName] = useState<string>(user?.indemnityDocUrl ? 'Indemnity_Certificate.pdf' : '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setFileData(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!provider.trim()) {
      setError("Please specify your insurance provider.");
      return;
    }

    if (!policyNo.trim()) {
      setError("Please enter your policy number.");
      return;
    }

    if (!expiryDate) {
      setError("Please select the policy expiry date.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateUserProfile({
        indemnityStatus: 'provided',
        indemnityInsuranceProvider: provider.trim(),
        indemnityPolicyNo: policyNo.trim(),
        indemnityExpiryDate: expiryDate,
        indemnityDocUrl: fileData || `doc_${Date.now()}_${fileName || 'certificate.pdf'}`,
        verificationStatus: 'verified'
      });

      setSuccess("Professional Indemnity Certificate uploaded and verified successfully!");
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update indemnity certificate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-white text-slate-600 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-600">Upload Indemnity Certificate</h3>
              <p className="text-xs text-slate-500">Clear deferred personal liability by submitting active policy details</p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Insurance Provider *</label>
            <input 
              type="text"
              required
              value={provider}
              onChange={e => setProvider(e.target.value)}
              placeholder="e.g. Enterprise Insurance / Star Assurance"
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Policy Number *</label>
              <input 
                type="text"
                required
                value={policyNo}
                onChange={e => setPolicyNo(e.target.value)}
                placeholder="e.g. IND-2026-9921"
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Policy Expiry Date *</label>
              <input 
                type="date"
                required
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Certificate Document (PDF or Image)</label>
            <div className="border-slate-100 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl p-4 text-center bg-white transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <Upload size={24} className="text-slate-600" />
                <p className="text-xs font-bold text-slate-800">
                  {fileName ? fileName : 'Click or Drag & Drop Indemnity Certificate'}
                </p>
                <p className="text-[11px] text-slate-500">PDF, PNG, or JPG up to 10MB</p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-slate-600 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Verify & Save Certificate
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
