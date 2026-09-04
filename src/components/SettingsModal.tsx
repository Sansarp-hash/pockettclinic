import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { 
  X, 
  Settings, 
  Bell, 
  Shield, 
  Globe, 
  Check, 
  Loader2, 
  Sparkles, 
  Volume2
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, updateUserProfile } = useAppContext();

  // Initialize from user.settings/user.preferences, with fallback defaults
  const userSettings = user?.settings || {};

  const [momoNotifications, setMomoNotifications] = useState<boolean>(userSettings.momoNotifications ?? true);
  const [whatsappReceipts, setWhatsappReceipts] = useState<boolean>(userSettings.whatsappReceipts ?? true);
  const [smsReminders, setSmsReminders] = useState<boolean>(userSettings.smsReminders ?? true);
  const [soundEffects, setSoundEffects] = useState<boolean>(userSettings.soundEffects ?? false);
  const [autoConsultantShare, setAutoConsultantShare] = useState<boolean>(userSettings.autoConsultantShare ?? true);
  const [emergencyOverride, setEmergencyOverride] = useState<boolean>(userSettings.emergencyOverride ?? true);
  const [autoRefills, setAutoRefills] = useState<boolean>(userSettings.autoRefills ?? false);
  const [language, setLanguage] = useState<string>(userSettings.language ?? 'English');
  const [currency, setCurrency] = useState<string>(userSettings.currency ?? 'GHS');

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Persist nested settings block directly to user record in Firestore
      await updateUserProfile({
        settings: {
          momoNotifications,
          whatsappReceipts,
          smsReminders,
          soundEffects,
          autoConsultantShare,
          emergencyOverride,
          autoRefills,
          language,
          currency
        }
      });
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Failed to save patient settings:", err);
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
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Patient Settings</h3>
              <p className="text-xs text-slate-600 font-medium">Configure preferences and medical data access</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-600 bg-white hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto scrollbar-thin">
          
          {/* Section 1: Notifications & Communication */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Bell size={16} className="text-slate-600" />
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Alerts & Communication</h4>
            </div>

            <div className="space-y-3.5">
              {/* WhatsApp Receipts */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    WhatsApp Rx Delivery
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-black">POPULAR</span>
                  </label>
                  <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                    Send digital prescriptions, medication reminders, and treatment plans directly to your WhatsApp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWhatsappReceipts(!whatsappReceipts)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${whatsappReceipts ? 'bg-emerald-600' : 'bg-slate-50'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-transform ${whatsappReceipts ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {/* SMS Consult Reminders */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800">SMS Appointment Reminders</label>
                  <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                    Receive SMS alerts 1 hour before scheduled telemedicine calls and consultant match notifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSmsReminders(!smsReminders)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${smsReminders ? 'bg-emerald-600' : 'bg-slate-50'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-transform ${smsReminders ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {/* MoMo Payments Logs */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800">MoMo Transaction Logs</label>
                  <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                    Receive digital invoice updates via SMS/WhatsApp whenever Mobile Money payments are processed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMomoNotifications(!momoNotifications)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${momoNotifications ? 'bg-emerald-600' : 'bg-slate-50'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-transform ${momoNotifications ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {/* Sound effects */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Volume2 size={13} className="text-slate-500" />
                    In-App Interface Sounds
                  </label>
                  <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                    Play gentle sonic feedback when entering virtual consultation rooms or completing health vault uploads.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSoundEffects(!soundEffects)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${soundEffects ? 'bg-emerald-600' : 'bg-slate-50'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-transform ${soundEffects ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Data & Records Privacy */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Shield size={16} className="text-slate-600" />
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Consultant Records & Security</h4>
            </div>

            <div className="space-y-3.5">
              {/* Auto consultant share */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800">Auto-Share Records with matched Consultant</label>
                  <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                    Instantly grant active consultants view-only access to your Vitals history and medical uploads when you start a consult.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoConsultantShare(!autoConsultantShare)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${autoConsultantShare ? 'bg-emerald-600' : 'bg-slate-50'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-transform ${autoConsultantShare ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {/* Emergency Override */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800">Emergency Smart-Access Protocol</label>
                  <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                    Allow consultant staff to bypass vault approvals during active trauma-room emergency routing (requires verified medical registry bypass).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmergencyOverride(!emergencyOverride)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${emergencyOverride ? 'bg-emerald-600' : 'bg-slate-50'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-transform ${emergencyOverride ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {/* Refills Auto Dispatch */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800">Chronic Refill Smart-Dispatch</label>
                  <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                    Pre-approve recurring maintenance drug refilling alerts to our pharmacy partner chain 7 days before prescription expiration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoRefills(!autoRefills)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${autoRefills ? 'bg-emerald-600' : 'bg-slate-50'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-transform ${autoRefills ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Localization Preferences */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Globe size={16} className="text-slate-600" />
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Localization & Regional</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Preferred Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <option value="English">English</option>
                  <option value="Twi">Twi (Akan)</option>
                  <option value="Ga">Ga</option>
                  <option value="Ewe">Ewe</option>
                  <option value="Hausa">Hausa</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Preferred Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <option value="GHS">GHS (₵)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
              <Check size={16} />
              Settings saved and synchronized with database!
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
