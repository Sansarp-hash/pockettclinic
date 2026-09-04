import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../AppContext';
import { 
  Sliders, Shield, DollarSign, Clock, PhoneCall, Database, Bell, CheckCircle2, 
  AlertTriangle, RefreshCw, Save, Plus, Trash2, Edit3, Search, Eye, Code, 
  Check, X, Sparkles, Server, Zap, Globe, FileText, ChevronRight, Lock, Unlock, Award
} from 'lucide-react';
import { SystemAppConfig } from '../../types';
import { 
  collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

type AdminTab = 'features' | 'pricing' | 'operations' | 'emergency' | 'database' | 'announcements' | 'branding';

interface CollectionRecord {
  id: string;
  data: Record<string, any>;
}

// Inline Branding Manager for Global Logo Sync
function BrandingSettingsSection() {
  const { showToast } = useAppContext();
  const [logoUrl, setLogoUrl] = useState<string>('/logo.svg');
  const [slogan, setSlogan] = useState<string>('Your Digital Hospital Anywhere');
  const [title, setTitle] = useState<string>('PockettClinic');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'branding'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.logoUrl) setLogoUrl(data.logoUrl);
        if (data.slogan) setSlogan(data.slogan);
        if (data.title) setTitle(data.title);
      }
    }, (err) => {
      console.warn("Error fetching branding settings:", err);
    });
    return () => unsub();
  }, []);

  const handleSaveBranding = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'branding'), {
        logoUrl,
        slogan,
        title,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast("Global branding updated successfully across all clients!", "success");
    } catch (err: any) {
      console.error("Failed to update branding:", err);
      showToast("Failed to update branding: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("Logo file size must be less than 2MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setLogoUrl(evt.target.result as string);
        showToast("Image loaded into preview. Click 'Save Branding' to apply.", "info");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200">
      <div className="flex flex-col md:flex-row items-start gap-8">
        <div className="w-24 h-24 rounded-2xl bg-white border-slate-200 border flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-lg relative group">
          <img src={logoUrl} alt="Platform Logo Preview" className="max-w-full max-h-full object-contain" />
          <label className="absolute inset-0 bg-emerald-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all rounded-2xl">
            <Plus className="text-white w-6 h-6" />
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="flex-1 space-y-4 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Platform Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. PockettClinic"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-bold text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Global Slogan
              </label>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="e.g. Your Digital Hospital Anywhere"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-medium text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Logo URL or Base64 Data
            </label>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png or data:image/png;base64,..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-600 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveBranding}
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 uppercase tracking-widest"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Global Branding</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Integration Keys & Notification SMTP / FCM credentials section
function IntegrationKeysSection() {
  const { showToast } = useAppContext();
  const [keys, setKeys] = useState({
    paystackPublicKey: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    fcmVapidKey: '',
    fcmSenderId: '',
    firebaseServiceAccountKey: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showServiceAccount, setShowServiceAccount] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'integration_keys'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setKeys({
          paystackPublicKey: d.paystackPublicKey || '',
          smtpHost: d.smtpHost || '',
          smtpPort: d.smtpPort || '587',
          smtpUser: d.smtpUser || '',
          smtpPass: d.smtpPass || '',
          fcmVapidKey: d.fcmVapidKey || '',
          fcmSenderId: d.fcmSenderId || '',
          firebaseServiceAccountKey: d.firebaseServiceAccountKey || '',
        });
      }
    }, (err) => {
      console.warn("Error fetching integration keys:", err);
    });
    return () => unsub();
  }, []);

  const handleSaveKeys = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'integration_keys'), {
        ...keys,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast("System Integration Keys & Notification settings updated successfully!", "success");
    } catch (err: any) {
      console.error("Failed to update integration keys:", err);
      showToast("Failed to update keys: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-500" />
          API & Gateway Integration Keys (SMTP, FCM, Paystack)
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Configure API credentials securely. These are stored directly in your Firestore instance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Paystack Public Key */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Paystack Public Key
          </label>
          <input
            type="text"
            value={keys.paystackPublicKey}
            onChange={(e) => setKeys({ ...keys, paystackPublicKey: e.target.value })}
            placeholder="pk_live_... or pk_test_..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        {/* SMTP Configuration */}
        <div className="md:col-span-2 pt-2 border-t border-slate-50 mt-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            Outgoing Mail Server Configuration (SMTP)
          </h4>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            SMTP Server Host
          </label>
          <input
            type="text"
            value={keys.smtpHost}
            onChange={(e) => setKeys({ ...keys, smtpHost: e.target.value })}
            placeholder="e.g. smtp.gmail.com"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            SMTP Server Port
          </label>
          <input
            type="text"
            value={keys.smtpPort}
            onChange={(e) => setKeys({ ...keys, smtpPort: e.target.value })}
            placeholder="e.g. 587 or 465"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            SMTP Authenticated User Email
          </label>
          <input
            type="email"
            value={keys.smtpUser}
            onChange={(e) => setKeys({ ...keys, smtpUser: e.target.value })}
            placeholder="e.g. alerts@pockettclinic.health"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            SMTP App Password
          </label>
          <div className="relative">
            <input
              type={showSmtpPass ? "text" : "password"}
              value={keys.smtpPass}
              onChange={(e) => setKeys({ ...keys, smtpPass: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 text-xs pr-10 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSmtpPass(!showSmtpPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <Eye size={16} />
            </button>
          </div>
        </div>

        {/* Firebase Cloud Messaging Configuration */}
        <div className="md:col-span-2 pt-2 border-t border-slate-50 mt-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-emerald-500" />
            Firebase Cloud Messaging (FCM Web Push)
          </h4>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            FCM Sender ID
          </label>
          <input
            type="text"
            value={keys.fcmSenderId}
            onChange={(e) => setKeys({ ...keys, fcmSenderId: e.target.value })}
            placeholder="e.g. 512810860395"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            FCM Web Push VAPID Key
          </label>
          <input
            type="text"
            value={keys.fcmVapidKey}
            onChange={(e) => setKeys({ ...keys, fcmVapidKey: e.target.value })}
            placeholder="e.g. BIPXgP69_uOaL-hZ7..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
          />
        </div>

        {/* Firebase Admin SDK Service Account Key */}
        <div className="md:col-span-2 pt-2 border-t border-slate-50 mt-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            Firebase Admin SDK Service Account Key
          </h4>
          <p className="text-[11px] text-slate-400 mb-3 font-medium">
            Paste your Firebase private key JSON payload below. Highly recommended for production-grade persistent data synchronization and real-time backend dispatches.
          </p>
          <div className="relative">
            <textarea
              rows={5}
              value={keys.firebaseServiceAccountKey}
              onChange={(e) => setKeys({ ...keys, firebaseServiceAccountKey: e.target.value })}
              placeholder='{ "type": "service_account", "project_id": "...", "private_key_id": "...", "private_key": "..." }'
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white font-mono leading-relaxed"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          onClick={handleSaveKeys}
          disabled={isSaving}
          className="px-6 py-3 bg-[#0A3B24] hover:bg-emerald-950 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save Integration Keys</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminMasterLiveControl() {
  const { 
    systemConfig, 
    updateSystemFeature, 
    user,
    showToast
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<AdminTab>('features');
  const [localConfig, setLocalConfig] = useState<SystemAppConfig>(systemConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Database Inspector State
  const [selectedCollection, setSelectedCollection] = useState<string>('users');
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  
  // Record Editor Modal State
  const [editingRecord, setEditingRecord] = useState<CollectionRecord | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newRecordId, setNewRecordId] = useState('');
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<Record<string, any>>({});
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Gazette Registry Bulk Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importingText, setImportingText] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedRowsCount, setImportedRowsCount] = useState(0);

  // Sync local config when systemConfig changes externally
  useEffect(() => {
    if (systemConfig) {
      setLocalConfig({
        ...systemConfig,
        features: {
          videoConsultationsEnabled: true,
          audioConsultationsEnabled: true,
          chatConsultationsEnabled: true,
          instantMomoPayoutsEnabled: true,
          aiTriageEnabled: true,
          drugSafetyCheckerEnabled: true,
          familyProfilesEnabled: true,
          medicationRemindersEnabled: true,
          emergencyAutoEscalation: true,
          strictCouncilPinVerification: true,
          smsGatewayAlertsEnabled: true,
          maintenanceMode: false,
          offlineFallbackAllowed: true,
          allowDirectPatientRegistration: true,
          allowSelfConsultantRegistration: true,
          ...(systemConfig.features || {})
        },
        pricing: {
          consultantSharePercent: 70,
          platformCommissionPercent: 30,
          minWithdrawalGHS: 20,
          tiers: {
            PHARM_TECH: { chatFeeGHS: 20, voiceVideoFeeGHS: 30, durationMins: 15, extensionFeeGHS: 15 },
            PHYSICIAN_ASSISTANT: { chatFeeGHS: 30, voiceVideoFeeGHS: 45, durationMins: 15, extensionFeeGHS: 20 },
            PHARMACIST: { chatFeeGHS: 50, voiceVideoFeeGHS: 70, durationMins: 15, extensionFeeGHS: 35 },
            DOCTOR: { chatFeeGHS: 70, voiceVideoFeeGHS: 90, durationMins: 20, extensionFeeGHS: 45 },
            SPECIALIST: { chatFeeGHS: 90, voiceVideoFeeGHS: 130, durationMins: 20, extensionFeeGHS: 65 },
            ...(systemConfig.pricing?.tiers || {})
          },
          ...(systemConfig.pricing || {})
        },
        operations: {
          ringingTimeoutSeconds: 45,
          escalationTimeoutSeconds: 60,
          prescriptionValidityDays: 30,
          maxDailyConsultationsPerDoctor: 25,
          defaultSTGLevel: 'Ghana Standard Treatment Guidelines (STG) 2022 / Level 1 Triage',
          ...(systemConfig.operations || {})
        },
        emergencyAmbulanceNumber: systemConfig.emergencyAmbulanceNumber || '193 / 112',
        emergencyPoliceNumber: systemConfig.emergencyPoliceNumber || '191 / 18555',
        medicalDirectorContact: systemConfig.medicalDirectorContact || 'MDC/RN/8839 (Dr. Emmanuel Sarpong)',
        supportEmail: systemConfig.supportEmail || 'support@pockettclinic.com',
        supportPhone: systemConfig.supportPhone || '+233 24 000 0000',
        announcements: {
          headerBannerActive: false,
          headerBannerText: 'Welcome to PockettClinic — Your Digital Hospital Anywhere',
          headerBannerType: 'info',
          careDisclaimerNotice: 'PockettClinic is an accredited telemedicine triage platform. Emergency symptoms require immediate evaluation at a regional hospital facility.',
          maintenanceMessage: 'System is undergoing scheduled maintenance. Emergency channels remain active.',
          ...(systemConfig.announcements || {})
        }
      });
    }
  }, [systemConfig]);

  // Load records for selected collection
  useEffect(() => {
    if (activeTab !== 'database') return;
    setIsLoadingRecords(true);

    const unsub = onSnapshot(collection(db, selectedCollection), (snapshot) => {
      const records: CollectionRecord[] = [];
      snapshot.forEach(docSnap => {
        records.push({
          id: docSnap.id,
          data: docSnap.data()
        });
      });
      setCollectionRecords(records);
      setIsLoadingRecords(false);
    }, (err) => {
      console.error(`Error loading ${selectedCollection}:`, err);
      handleFirestoreError(err, OperationType.LIST, selectedCollection);
      setIsLoadingRecords(false);
    });

    return () => unsub();
  }, [selectedCollection, activeTab]);

  const handleSaveGlobalConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMessage(null);
    try {
      await setDoc(doc(db, 'app_settings', 'system_config'), {
        ...localConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSaveSuccessMessage("System configuration updated & synced live across all clients!");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to save system configuration: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeatureToggle = async (key: string) => {
    const currentVal = localConfig.features?.[key] ?? true;
    const newVal = !currentVal;
    const updated = {
      ...localConfig,
      features: {
        ...(localConfig.features || {}),
        [key]: newVal
      }
    };
    setLocalConfig(updated);
    try {
      if (updateSystemFeature) {
        await updateSystemFeature(key as any, newVal);
      } else {
        await setDoc(doc(db, 'app_settings', 'system_config'), {
          features: { [key]: newVal },
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      setSaveSuccessMessage(`Feature "${key}" set to ${newVal ? 'ENABLED' : 'DISABLED'}`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Open Record for Editing
  const openEditRecord = (record: CollectionRecord) => {
    setEditingRecord(record);
    setIsCreatingNew(false);
    setFormFields({ ...record.data });
    setJsonText(JSON.stringify(record.data, null, 2));
    setJsonError(null);
    setEditorMode('form');
  };

  // Open Create Record Modal
  const openCreateRecord = () => {
    const autoId = `doc_${Date.now()}`;
    const initialData: Record<string, any> = selectedCollection === 'users' ? {
      fullName: 'New Consultant',
      email: 'consultant@example.com',
      role: 'consultant',
      createdAt: new Date().toISOString()
    } : selectedCollection === 'council_registry' ? {
      councilPin: 'MDC/RN/9999',
      fullName: 'Example Consultant',
      prefix: 'Dr.',
      cadre: 'DOCTOR',
    } : {
      title: 'New Document',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingRecord(null);
    setIsCreatingNew(true);
    setNewRecordId(autoId);
    setFormFields(initialData);
    setJsonText(JSON.stringify(initialData, null, 2));
    setJsonError(null);
    setEditorMode('form');
  };

  // Save Record Changes
  const handleSaveRecord = async () => {
    setIsSavingRecord(true);
    setJsonError(null);

    let dataToSave: Record<string, any> = {};

    if (editorMode === 'json') {
      try {
        dataToSave = JSON.parse(jsonText);
      } catch (err: any) {
        setJsonError(`Invalid JSON format: ${err.message}`);
        setIsSavingRecord(false);
        return;
      }
    } else {
      dataToSave = { ...formFields };
    }

    try {
      const docId = isCreatingNew ? (newRecordId.trim() || `doc_${Date.now()}`) : editingRecord!.id;
      const targetRef = doc(db, selectedCollection, docId);
      
      await setDoc(targetRef, {
        ...dataToSave,
        lastAdminModifiedAt: new Date().toISOString(),
        lastAdminModifiedBy: user?.email || 'admin'
      }, { merge: true });

      setSaveSuccessMessage(`Record [${docId}] in "${selectedCollection}" successfully updated in backend!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      setEditingRecord(null);
      setIsCreatingNew(false);
    } catch (err: any) {
      console.error("Save record error:", err);
      handleFirestoreError(err, OperationType.WRITE, `${selectedCollection}/${editingRecord?.id || newRecordId}`);
      showToast(`Error saving document: ${err.message}`, "error");
    } finally {
      setIsSavingRecord(false);
    }
  };

  // Helper to parse CSV securely without external dependencies
  const parseCSVData = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const results: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values: string[] = [];
      let currentVal = '';
      let insideQuotes = false;
      
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
      
      const item: Record<string, any> = {};
      headers.forEach((header, index) => {
        let val: any = values[index] !== undefined ? values[index] : '';
        if (val === 'true' || val === 'TRUE') val = true;
        else if (val === 'false' || val === 'FALSE') val = false;
        else if (val !== '' && !isNaN(Number(val))) val = Number(val);
        item[header] = val;
      });
      results.push(item);
    }
    return results;
  };

  const handleBulkImport = async (inputText: string) => {
    setIsImporting(true);
    setImportProgress(0);
    setImportError(null);
    setImportedRowsCount(0);
    
    try {
      let dataToImport: any[] = [];
      
      const cleanedText = inputText.trim();
      if (cleanedText.startsWith('[') || cleanedText.startsWith('{')) {
        dataToImport = JSON.parse(cleanedText);
        if (!Array.isArray(dataToImport)) {
          dataToImport = [dataToImport];
        }
      } else {
        dataToImport = parseCSVData(cleanedText);
      }
      
      if (dataToImport.length === 0) {
        throw new Error("No records parsed from file contents. Please verify headers and formats.");
      }
      
      let successCount = 0;
      
      for (let i = 0; i < dataToImport.length; i++) {
        const entry = dataToImport[i];
        if (!entry.councilPin) {
          continue;
        }
        
        const docId = entry.councilPin.trim().replace(/\//g, '-');
        const targetRef = doc(db, 'council_registry', docId);
        
        await setDoc(targetRef, {
          councilPin: entry.councilPin.trim(),
          fullName: entry.fullName || entry.name || 'Anonymous Consultant',
          prefix: entry.prefix || entry.legalTitle || 'Dr.',
          cadre: entry.cadre || 'DOCTOR',
          registrationYear: Number(entry.registrationYear) || 2026,
          specialty: entry.specialty || 'General Practice',
          isGoodStanding: entry.isGoodStanding === true || entry.isGoodStanding === 'true' || entry.isGoodStanding === undefined,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
        
        successCount++;
        setImportedRowsCount(successCount);
        setImportProgress(Math.round(((i + 1) / dataToImport.length) * 100));
      }
      
      showToast(`Successfully imported ${successCount} verified Gazette entries into the database!`, "success");
      setSaveSuccessMessage(`Import complete: ${successCount} consultants now fully verified and live.`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
      setIsImportOpen(false);
      setImportingText('');
    } catch (err: any) {
      console.error("Bulk Import failed:", err);
      setImportError(err.message || "Unknown file parsing or network error.");
    } finally {
      setIsImporting(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (docId: string) => {
    try {
      await deleteDoc(doc(db, selectedCollection, docId));
      setDeleteConfirmId(null);
      setSaveSuccessMessage(`Record [${docId}] deleted from "${selectedCollection}".`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `${selectedCollection}/${docId}`);
      showToast(`Failed to delete record: ${err.message}`, "error");
    }
  };

  // Filtered records
  const filteredRecords = collectionRecords.filter(r => {
    const searchLower = recordSearch.toLowerCase();
    const idMatch = r.id.toLowerCase().includes(searchLower);
    const dataMatch = JSON.stringify(r.data).toLowerCase().includes(searchLower);
    return idMatch || dataMatch;
  });

  return (
    <div id="admin-master-live-control-root" className="space-y-6">
      {/* Header Banner */}
      <div id="admin-live-header" className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-600 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              LIVE ADMIN CONTROL
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Synced: {new Date(localConfig.updatedAt || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-2 text-slate-600 flex items-center gap-2">
            Master Live App & Database Control
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Direct real-time administrative power to configure features, customize financial commissions, modify clinical rules, and edit any record in the live database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="admin-save-all-btn"
            onClick={handleSaveGlobalConfig}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/40 transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>SAVE LIVE CONFIG</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {saveSuccessMessage && (
        <div id="admin-save-alert" className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 font-medium text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage(null)} className="text-slate-500 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div id="admin-live-subtabs" className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: 'features', label: 'Platform Features', icon: Sliders },
          { id: 'pricing', label: 'Pricing & Split', icon: DollarSign },
          { id: 'operations', label: 'Clinical Timers', icon: Clock },
          { id: 'emergency', label: 'Emergency Hotlines', icon: PhoneCall },
          { id: 'branding', label: 'Branding & Keys', icon: Award },
          { id: 'database', label: 'Universal DB Editor', icon: Database },
          { id: 'announcements', label: 'Banners & Notices', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition whitespace-nowrap ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-md shadow-blue-900/30' 
                  : 'bg-white text-slate-500 hover:text-slate-500 hover:bg-white border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: BRANDING & LOGO */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-600 flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Global Platform Logo & Branding Manager
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Upload your custom circular badge or platform logo. Once saved, it will instantly synchronize across the header and landing pages for all users.
            </p>
            <BrandingSettingsSection />
          </div>

          <IntegrationKeysSection />
        </div>
      )}

      {/* TAB 1: LIVE FEATURE SWITCHES */}
      {activeTab === 'features' && (
        <div id="tab-content-features" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-600 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-slate-600" />
              Real-Time Feature Flags & Service Switches
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Toggle any module on or off instantly. When toggled, changes take effect immediately across all connected clients.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {[
                {
                  key: 'videoConsultationsEnabled',
                  title: 'Video Consultations',
                  desc: 'Allow real-time WebRTC HD video sessions between doctors and patients.',
                  tag: 'Consultation'
                },
                {
                  key: 'audioConsultationsEnabled',
                  title: 'Voice / Audio Calls',
                  desc: 'Enable low-bandwidth cellular & web audio calls.',
                  tag: 'Consultation'
                },
                {
                  key: 'chatConsultationsEnabled',
                  title: 'Secure Clinical Chat',
                  desc: 'Enable end-to-end encrypted messaging with attachment sharing.',
                  tag: 'Messaging'
                },
                {
                  key: 'instantMomoPayoutsEnabled',
                  title: 'Instant MoMo Payouts',
                  desc: 'Allow automated MTN/Telecel/AirtelTigo cash-out for consultants.',
                  tag: 'Finance'
                },
                {
                  key: 'aiTriageEnabled',
                  title: 'AI Clinical Triage Assistant',
                  desc: 'Ghana Standard Treatment Guidelines triage AI pre-screening.',
                  tag: 'AI Engine'
                },
                {
                  key: 'drugSafetyCheckerEnabled',
                  title: 'Drug Interaction & Safety Engine',
                  desc: 'Automated contraindication and adverse reaction detector on prescriptions.',
                  tag: 'Pharmacy'
                },
                {
                  key: 'familyProfilesEnabled',
                  title: 'Family & Dependent Accounts',
                  desc: 'Allow primary account holders to manage care for children and elderly parents.',
                  tag: 'Patients'
                },
                {
                  key: 'medicationRemindersEnabled',
                  title: 'Adherence Reminders & Alarms',
                  desc: 'Patient dosage push alerts and refill scheduling system.',
                  tag: 'Adherence'
                },
                {
                  key: 'emergencyAutoEscalation',
                  title: 'Auto-Emergency Escalation',
                  desc: 'Automatically re-route unaccepted critical calls after timer expires.',
                  tag: 'Clinical'
                },
                {
                  key: 'strictCouncilPinVerification',
                  title: 'Strict MDC / PC PIN Check',
                  desc: 'Require valid registry PIN before permitting consultant login and onboarding.',
                  tag: 'Compliance'
                },
                {
                  key: 'smsGatewayAlertsEnabled',
                  title: 'SMS Gateway Dispatch',
                  desc: 'Send urgent SMS notifications to Ghana mobile numbers via Hubtel/Arkesel.',
                  tag: 'Telemetry'
                },
                {
                  key: 'maintenanceMode',
                  title: 'System Maintenance Mode',
                  desc: 'Displays scheduled maintenance alert to patients while keeping admin accessible.',
                  tag: 'System'
                },
                {
                  key: 'offlineFallbackAllowed',
                  title: 'Offline Cache & PWA Mode',
                  desc: 'Allows client app to utilize IndexedDB / LocalStorage cache when internet drops.',
                  tag: 'Network'
                },
                {
                  key: 'allowDirectPatientRegistration',
                  title: 'Direct Patient Self-Registration',
                  desc: 'Allow new patients to register directly without manual invitation.',
                  tag: 'Access'
                },
                {
                  key: 'allowSelfConsultantRegistration',
                  title: 'Consultant Self-Registration',
                  desc: 'Allow licensed consultants to initiate verification and onboarding.',
                  tag: 'Access'
                }
              ].map((feat) => {
                const isEnabled = localConfig.features?.[feat.key] ?? true;
                return (
                  <div
                    key={feat.key}
                    id={`feature-card-${feat.key}`}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                      isEnabled
                        ? 'bg-white/80 border-slate-200'
                        : 'bg-white/50 border-slate-200/60 opacity-70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                          {feat.tag}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-600 mt-2.5">{feat.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{feat.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-mono">Live Sync</span>
                      <button
                        type="button"
                        id={`toggle-btn-${feat.key}`}
                        onClick={() => handleFeatureToggle(feat.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          isEnabled ? 'bg-emerald-600' : 'bg-slate-100'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRICING & FINANCIAL SPLIT */}
      {activeTab === 'pricing' && (
        <div id="tab-content-pricing" className="space-y-6">
          {/* Revenue Split Configuration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-600 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Platform Commission & Financial Revenue Split
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure how consultation revenue is split between the consultant and the PockettClinic platform.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Consultant Share (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={localConfig.pricing?.consultantSharePercent ?? 70}
                    onChange={(e) => {
                      const share = Number(e.target.value);
                      setLocalConfig({
                        ...localConfig,
                        pricing: {
                          ...localConfig.pricing,
                          consultantSharePercent: share,
                          platformCommissionPercent: Math.max(0, 100 - share)
                        }
                      });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-lg"
                  />
                  <span className="text-slate-500 font-bold text-lg">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Default: 70% paid directly to consultant wallet.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Platform Margin (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={localConfig.pricing?.platformCommissionPercent ?? 30}
                    onChange={(e) => {
                      const cut = Number(e.target.value);
                      setLocalConfig({
                        ...localConfig,
                        pricing: {
                          ...localConfig.pricing,
                          platformCommissionPercent: cut,
                          consultantSharePercent: Math.max(0, 100 - cut)
                        }
                      });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-lg"
                  />
                  <span className="text-slate-500 font-bold text-lg">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Auto-balances to equal 100% total revenue.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Min. Payout Withdrawal (GHS)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold text-lg">GHS</span>
                  <input
                    type="number"
                    min="1"
                    value={localConfig.pricing?.minWithdrawalGHS ?? 20}
                    onChange={(e) => {
                      setLocalConfig({
                        ...localConfig,
                        pricing: {
                          ...localConfig.pricing,
                          minWithdrawalGHS: Number(e.target.value)
                        }
                      });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-lg"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Minimum wallet balance required to cash out to MoMo.</p>
              </div>
            </div>
          </div>

          {/* Cadre Tier Pricing Matrix */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-600 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-slate-600" />
              Live Consultation Fees by Cadre (GHS)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Set standard rates for chat, video, duration, and extensions for all professional cadres.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {[
                { cadre: 'DOCTOR', title: 'Doctor', subtitle: 'General diagnosis, POM prescriptions, vitals analysis' },
                { cadre: 'SPECIALIST', title: 'Specialist', subtitle: 'Cardiology, Pediatrics, GYN, Dermatology, etc.' },
                { cadre: 'PHARMACIST', title: 'Pharmacist', subtitle: 'Comprehensive medication reviews & interactions' },
                { cadre: 'PHARM_TECH', title: 'Pharmacy Technician', subtitle: 'OTC triage, OTC medication inquiries & refills' },
              ].map((item) => {
                const tier = localConfig.pricing?.tiers?.[item.cadre] || { chatFeeGHS: 40, voiceVideoFeeGHS: 60, durationMins: 15, extensionFeeGHS: 20 };
                return (
                  <div key={item.cadre} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-600 text-base">{item.title}</h3>
                        <p className="text-xs text-slate-500">{item.subtitle}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-600/20 text-emerald-800 border border-slate-300/30 rounded text-xs font-mono font-bold">
                        {item.cadre}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Chat Fee (GHS)</label>
                        <input
                          type="number"
                          value={tier.chatFeeGHS}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLocalConfig({
                              ...localConfig,
                              pricing: {
                                ...localConfig.pricing,
                                tiers: {
                                  ...(localConfig.pricing?.tiers || {}),
                                  [item.cadre]: { ...tier, chatFeeGHS: val }
                                }
                              }
                            });
                          }}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Video / Call Fee (GHS)</label>
                        <input
                          type="number"
                          value={tier.voiceVideoFeeGHS}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLocalConfig({
                              ...localConfig,
                              pricing: {
                                ...localConfig.pricing,
                                tiers: {
                                  ...(localConfig.pricing?.tiers || {}),
                                  [item.cadre]: { ...tier, voiceVideoFeeGHS: val }
                                }
                              }
                            });
                          }}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Duration (Mins)</label>
                        <input
                          type="number"
                          value={tier.durationMins}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLocalConfig({
                              ...localConfig,
                              pricing: {
                                ...localConfig.pricing,
                                tiers: {
                                  ...(localConfig.pricing?.tiers || {}),
                                  [item.cadre]: { ...tier, durationMins: val }
                                }
                              }
                            });
                          }}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase">10m Extension Fee (GHS)</label>
                        <input
                          type="number"
                          value={tier.extensionFeeGHS}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLocalConfig({
                              ...localConfig,
                              pricing: {
                                ...localConfig.pricing,
                                tiers: {
                                  ...(localConfig.pricing?.tiers || {}),
                                  [item.cadre]: { ...tier, extensionFeeGHS: val }
                                }
                              }
                            });
                          }}
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPERATIONAL TIMERS */}
      {activeTab === 'operations' && (
        <div id="tab-content-operations" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-600 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Clinical Governance & Dispatch Operational Timers
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure dispatch response timeouts, prescription validity windows, and safety limits.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Ringing Timeout (Seconds)
                </label>
                <input
                  type="number"
                  value={localConfig.operations?.ringingTimeoutSeconds ?? 45}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      operations: {
                        ...localConfig.operations,
                        ringingTimeoutSeconds: Number(e.target.value)
                      }
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-lg"
                />
                <p className="text-[11px] text-slate-500 mt-2">Duration an incoming consultation rings on a consultant device.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Auto-Escalation Delay (Seconds)
                </label>
                <input
                  type="number"
                  value={localConfig.operations?.escalationTimeoutSeconds ?? 60}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      operations: {
                        ...localConfig.operations,
                        escalationTimeoutSeconds: Number(e.target.value)
                      }
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-lg"
                />
                <p className="text-[11px] text-slate-500 mt-2">Time before unaccepted ringing session is broadcast to entire cadre.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Rx Validity Window (Days)
                </label>
                <input
                  type="number"
                  value={localConfig.operations?.prescriptionValidityDays ?? 30}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      operations: {
                        ...localConfig.operations,
                        prescriptionValidityDays: Number(e.target.value)
                      }
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-lg"
                />
                <p className="text-[11px] text-slate-500 mt-2">Ghana Pharmacy Council validity period before digital prescription expires.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Max Daily Consultations / Doctor
                </label>
                <input
                  type="number"
                  value={localConfig.operations?.maxDailyConsultationsPerDoctor ?? 25}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      operations: {
                        ...localConfig.operations,
                        maxDailyConsultationsPerDoctor: Number(e.target.value)
                      }
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-lg"
                />
                <p className="text-[11px] text-slate-500 mt-2">Physician fatigue prevention limit.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Default Clinical Guidelines Standard
                </label>
                <input
                  type="text"
                  value={localConfig.operations?.defaultSTGLevel ?? ''}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      operations: {
                        ...localConfig.operations,
                        defaultSTGLevel: e.target.value
                      }
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-2">Clinical standard referenced during automated triage and prescribing.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EMERGENCY HOTLINES */}
      {activeTab === 'emergency' && (
        <div id="tab-content-emergency" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-600 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-rose-400" />
              Emergency Hotlines & Medical Escalation Directory
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              National emergency numbers and clinical supervision contacts displayed to patients during severe triage triggers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">
                  National Ambulance Service (NAS)
                </label>
                <input
                  type="text"
                  value={localConfig.emergencyAmbulanceNumber ?? '193 / 112'}
                  onChange={(e) => setLocalConfig({ ...localConfig, emergencyAmbulanceNumber: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-base"
                />
                <p className="text-[11px] text-slate-500 mt-2">Primary national emergency triage number in Ghana (193 / 112).</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Ghana Police Service Emergency
                </label>
                <input
                  type="text"
                  value={localConfig.emergencyPoliceNumber ?? '191 / 18555'}
                  onChange={(e) => setLocalConfig({ ...localConfig, emergencyPoliceNumber: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-base"
                />
                <p className="text-[11px] text-slate-500 mt-2">Emergency police and rescue hotline (191 / 18555).</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  Medical Director Clinical Escalation
                </label>
                <input
                  type="text"
                  value={localConfig.medicalDirectorContact ?? ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, medicalDirectorContact: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-base"
                />
                <p className="text-[11px] text-slate-500 mt-2">Supervising medical consultant license identifier and contact.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  PockettClinic Support Email & Phone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={localConfig.supportEmail ?? ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, supportEmail: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-xs"
                    placeholder="Email"
                  />
                  <input
                    type="text"
                    value={localConfig.supportPhone ?? ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, supportPhone: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-bold text-xs"
                    placeholder="Phone"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Customer care and support desk lines.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: UNIVERSAL LIVE DATABASE & RECORD EDITOR */}
      {activeTab === 'database' && (
        <div id="tab-content-database" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-600 flex items-center gap-2">
                  <Database className="w-5 h-5 text-slate-600" />
                  Universal Live Database & Document Editor
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Inspect, search, and manually update any document across all Firestore collections in real time.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="admin-import-gazette-btn"
                  onClick={() => setIsImportOpen(!isImportOpen)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  <Server className="w-4 h-4 animate-pulse" />
                  <span>IMPORT GAZETTE (CSV/JSON)</span>
                </button>
                <button
                  id="admin-create-record-btn"
                  onClick={openCreateRecord}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>NEW RECORD</span>
                </button>
              </div>
            </div>

            {/* GAZETTE BULK IMPORT CONTROLLER PANEL */}
            {isImportOpen && (
              <div className="mt-6 p-6 bg-white border border-slate-200 rounded-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                      Bulk Professional Gazette Importer (Up to 2026)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Upload your official Pharmacy Council & Medical Council Gazette CSV or JSON spreadsheet files to securely update verification records.
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsImportOpen(false)} 
                    className="text-slate-600 hover:text-slate-600 p-1 rounded-full hover:bg-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-500 space-y-3 leading-relaxed">
                  <p className="font-bold text-slate-500">📋 Expected Columns / Properties for CSV/JSON:</p>
                  <div className="font-mono text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong className="text-emerald-400">councilPin</strong> (Mandatory - e.g. MDC/RN/1029)</span>
                    <span><strong className="text-slate-600">fullName</strong> (Consultant Name)</span>
                    <span><strong className="text-slate-600">prefix</strong> (Dr. / Pharm. / Mr.)</span>
                    <span><strong className="text-pink-400">cadre</strong> (Doctor / Pharmacist / Pharmacy Technician)</span>
                    <span><strong className="text-amber-400">registrationYear</strong> (e.g. 2024)</span>
                    <span><strong className="text-sky-400">specialty</strong> (General Practice, Cardiology, etc.)</span>
                    <span><strong className="text-rose-400">isGoodStanding</strong> (true / false)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>💡 Tip: If you have a PDF, copy its tables into Excel or Google Sheets, export as **CSV**, and paste or drop it here.</span>
                    <button
                      onClick={() => setImportingText(
`councilPin,fullName,prefix,cadre,registrationYear,specialty,isGoodStanding
MDC/RN/4821,Dr. Emmanuel Kojo Sarpong,Dr.,DOCTOR,2024,General Practice,true
PC/PH/6082,Pharm. Akua Adobea Mensah,Pharm.,PHARMACIST,2025,Pharmacy,true
PC/PT/1093,James Kofi Appiah,Mr.,Pharmacy Technician,2026,Community Pharmacy,true
MDC/RN/8839,Dr. Yaw Osei-Tutu,Dr.,DOCTOR,2023,Cardiology,false`
                      )}
                      className="text-slate-600 hover:text-slate-600 font-bold underline cursor-pointer"
                    >
                      Load Sample Verification Data
                    </button>
                  </div>
                </div>

                {/* Drag & Drop File Upload Field & Paste Box */}
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                    Paste CSV Rows / JSON Array or Select File
                  </label>
                  <div className="relative">
                    <textarea
                      value={importingText}
                      onChange={(e) => setImportingText(e.target.value)}
                      placeholder="Paste your CSV contents here (with header row)...&#10;Or browse/drag-and-drop your .csv or .json file below."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 font-mono h-44 focus:outline-none focus:border-emerald-500 placeholder-slate-600 leading-relaxed"
                      disabled={isImporting}
                    />
                    
                    {/* Native File Pick Trigger */}
                    <div className="absolute right-3 bottom-3">
                      <input
                        type="file"
                        id="gazette-file-picker"
                        accept=".csv,.json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            if (evt.target?.result) {
                              setImportingText(evt.target.result as string);
                              showToast(`Loaded "${file.name}" successfully! Click 'Start Verification Import'.`, "success");
                            }
                          };
                          reader.readAsText(file);
                        }}
                      />
                      <label
                        htmlFor="gazette-file-picker"
                        className="bg-white hover:bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition border border-slate-200 active:scale-95 flex items-center gap-1"
                      >
                        <FileText size={12} />
                        <span>Browse File (.csv/.json)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Live Progress Bar indicator */}
                {isImporting && (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        Writing Consultants to cloud Firestore...
                      </span>
                      <span className="font-mono text-emerald-400">{importProgress}% ({importedRowsCount} imported)</span>
                    </div>
                    <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-slate-200/60">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-150 animate-pulse"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Import Error Banner */}
                {importError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2.5">
                  <button
                    onClick={() => {
                      setImportingText('');
                      setImportError(null);
                    }}
                    disabled={isImporting || !importingText}
                    className="px-4 py-2 bg-white hover:bg-white text-slate-500 hover:text-slate-500 font-bold text-xs rounded-xl border border-slate-200 transition disabled:opacity-40"
                  >
                    Clear Input
                  </button>
                  <button
                    onClick={() => handleBulkImport(importingText)}
                    disabled={isImporting || !importingText.trim()}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/20 transition active:scale-95 disabled:opacity-40"
                  >
                    {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>START VERIFICATION IMPORT</span>
                  </button>
                </div>
              </div>
            )}

            {/* Collection Selector & Search Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Firestore Collection
                </label>
                <select
                  id="admin-collection-select"
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-600 font-bold text-sm focus:outline-none focus:border-slate-300"
                >
                  <option value="users">users (Patients, Consultants, Admins)</option>
                  <option value="deletion_requests">deletion_requests (Account Deletion Approvals)</option>
                  <option value="deletion_audit_logs">deletion_audit_logs (Compliance Purge Audit Trail)</option>
                  <option value="consultations">consultations (Sessions & Notes)</option>
                  <option value="prescriptions">prescriptions (Digital Rx Slips)</option>
                  <option value="council_registry">council_registry (MDC / Pharmacy PINs)</option>
                  <option value="system_broadcasts">system_broadcasts (Announcements)</option>
                  <option value="medications">medications (Drug Interaction Database)</option>
                  <option value="app_settings">app_settings (Global Configuration)</option>
                  <option value="payout_requests">payout_requests (Consultant Withdrawals)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Search Records in `{selectedCollection}`
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    id="admin-db-search-input"
                    type="text"
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    placeholder={`Filter by ID, name, email, status, or any field in ${selectedCollection}...`}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-600 text-sm focus:outline-none focus:border-slate-300"
                  />
                  {recordSearch && (
                    <button
                      onClick={() => setRecordSearch('')}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Records List / Table */}
            <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span>{filteredRecords.length} Documents Found</span>
                <span className="font-mono text-[11px] text-slate-600">/{selectedCollection}/[docId]</span>
              </div>

              {isLoadingRecords ? (
                <div className="p-12 text-center text-slate-600 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-600" />
                  <span className="text-xs uppercase tracking-widest font-bold">Querying Firestore...</span>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="p-12 text-center text-slate-600">
                  <p className="text-sm font-bold">No documents match the filter in "{selectedCollection}".</p>
                  <button
                    onClick={openCreateRecord}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-slate-600 font-bold hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create the first document
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 max-h-[480px] overflow-y-auto">
                  {filteredRecords.map((record) => (
                    <div
                      key={record.id}
                      id={`record-row-${record.id}`}
                      className="p-4 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-600 bg-emerald-600/10 px-2 py-0.5 rounded border border-slate-300/20">
                            {record.id}
                          </span>
                          {record.data.role && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
                              {record.data.role}
                            </span>
                          )}
                          {record.data.status && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {record.data.status}
                            </span>
                          )}
                          {record.data.cadre && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600/10 text-emerald-800 border border-slate-300/20">
                              {record.data.cadre}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-slate-600 truncate">
                          {record.data.fullName || record.data.patientName || record.data.title || record.data.displayName || record.data.name || 'Unnamed Document'}
                        </p>

                        <div className="text-xs text-slate-500 font-mono flex items-center gap-4 flex-wrap">
                          {record.data.email && <span>{record.data.email}</span>}
                          {record.data.phone && <span>{record.data.phone}</span>}
                          {record.data.amountGHS && <span className="text-emerald-400 font-bold">GHS {record.data.amountGHS}</span>}
                          {record.data.amountPaidGHS && <span className="text-emerald-400 font-bold">GHS {record.data.amountPaidGHS}</span>}
                          {record.data.councilPin && <span className="text-amber-400">PIN: {record.data.councilPin}</span>}
                          {record.data.createdAt && (
                            <span className="text-slate-600">
                              {new Date(record.data.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                          id={`edit-btn-${record.id}`}
                          onClick={() => openEditRecord(record)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-white hover:text-slate-600 border border-slate-300/30 rounded-lg text-xs font-bold transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>EDIT</span>
                        </button>

                        {deleteConfirmId === record.id ? (
                          <div className="flex items-center gap-1 animate-fadeIn">
                            <button
                              onClick={() => handleDeleteRecord(record.id)}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                            >
                              CONFIRM
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1.5 bg-white text-slate-500 hover:text-slate-600 rounded-lg text-xs"
                            >
                              CANCEL
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(record.id)}
                            className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: UI, ANNOUNCEMENT BANNERS & NOTICES */}
      {activeTab === 'announcements' && (
        <div id="tab-content-announcements" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-600 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              Live Header Announcement Banner & Patient Care Notice
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Customize the emergency banner, disclaimer notices, and platform title displayed across the app.
            </p>

            <div className="space-y-6 mt-6">
              {/* Header Banner Settings */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-600 text-sm">Top Global Announcement Banner</h3>
                    <p className="text-xs text-slate-500">Renders at the top of the header for all visiting patients and consultants.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalConfig({
                        ...localConfig,
                        announcements: {
                          ...localConfig.announcements,
                          headerBannerActive: !localConfig.announcements?.headerBannerActive
                        }
                      });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      localConfig.announcements?.headerBannerActive ? 'bg-amber-600' : 'bg-slate-100'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        localConfig.announcements?.headerBannerActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 uppercase">Banner Message Text</label>
                    <input
                      type="text"
                      value={localConfig.announcements?.headerBannerText ?? ''}
                      onChange={(e) => {
                        setLocalConfig({
                          ...localConfig,
                          announcements: {
                            ...localConfig.announcements,
                            headerBannerText: e.target.value
                          }
                        });
                      }}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Alert Type</label>
                    <select
                      value={localConfig.announcements?.headerBannerType ?? 'info'}
                      onChange={(e) => {
                        setLocalConfig({
                          ...localConfig,
                          announcements: {
                            ...localConfig.announcements,
                            headerBannerType: e.target.value as any
                          }
                        });
                      }}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 text-sm font-bold"
                    >
                      <option value="info">Info (Blue)</option>
                      <option value="warning">Warning (Amber)</option>
                      <option value="emergency">Emergency (Red)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Patient Care Disclaimer */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  Patient Care & Emergency Triage Disclaimer Notice
                </label>
                <textarea
                  rows={3}
                  value={localConfig.announcements?.careDisclaimerNotice ?? ''}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      announcements: {
                        ...localConfig.announcements,
                        careDisclaimerNotice: e.target.value
                      }
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-600 text-sm"
                />
                <p className="text-[11px] text-slate-500">Displayed in booking consent modal and medical footer.</p>
              </div>

              {/* Maintenance Notice */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  System Maintenance Mode Message
                </label>
                <input
                  type="text"
                  value={localConfig.announcements?.maintenanceMessage ?? ''}
                  onChange={(e) => {
                    setLocalConfig({
                      ...localConfig,
                      announcements: {
                        ...localConfig.announcements,
                        maintenanceMessage: e.target.value
                      }
                    });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 text-sm font-medium"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL RECORD EDITOR MODAL */}
      {(editingRecord || isCreatingNew) && (
        <div id="admin-record-editor-modal" className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-emerald-600/10 px-2 py-0.5 rounded border border-slate-300/20">
                  {selectedCollection}
                </span>
                <h3 className="text-lg font-black text-slate-600 mt-1">
                  {isCreatingNew ? 'Create New Document' : `Editing: ${editingRecord?.id}`}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200">
                  <button
                    onClick={() => {
                      setEditorMode('form');
                      setJsonError(null);
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      editorMode === 'form' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-600'
                    }`}
                  >
                    Form Mode
                  </button>
                  <button
                    onClick={() => {
                      setEditorMode('json');
                      setJsonText(JSON.stringify(formFields, null, 2));
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${
                      editorMode === 'json' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-600'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditingRecord(null);
                    setIsCreatingNew(false);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-600 rounded-lg hover:bg-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isCreatingNew && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Document ID (Unique Key)
                  </label>
                  <input
                    type="text"
                    value={newRecordId}
                    onChange={(e) => setNewRecordId(e.target.value)}
                    placeholder="e.g. user_123 or doc_abc"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-600 font-mono text-sm focus:outline-none focus:border-slate-300"
                  />
                </div>
              )}

              {jsonError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono">
                  {jsonError}
                </div>
              )}

              {editorMode === 'form' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(formFields).map((key) => {
                      const value = formFields[key];
                      const isBoolean = typeof value === 'boolean';
                      const isNumber = typeof value === 'number';
                      const isArrayOrObject = typeof value === 'object' && value !== null;

                      return (
                        <div key={key} className={isArrayOrObject ? 'md:col-span-2' : ''}>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {key}
                          </label>

                          {isBoolean ? (
                            <button
                              type="button"
                              onClick={() => setFormFields({ ...formFields, [key]: !value })}
                              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border ${
                                value
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {value ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              <span>{value ? 'TRUE (ENABLED)' : 'FALSE (DISABLED)'}</span>
                            </button>
                          ) : isArrayOrObject ? (
                            <textarea
                              rows={3}
                              value={JSON.stringify(value, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  setFormFields({ ...formFields, [key]: parsed });
                                } catch (err) {
                                  // keep raw string if typing
                                }
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-emerald-400 font-mono text-xs focus:outline-none focus:border-slate-300"
                            />
                          ) : (
                            <input
                              type={isNumber ? 'number' : 'text'}
                              value={value ?? ''}
                              onChange={(e) => {
                                const val = isNumber ? Number(e.target.value) : e.target.value;
                                setFormFields({ ...formFields, [key]: val });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-600 text-sm focus:outline-none focus:border-slate-300"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add New Key-Value Field to Record */}
                  <div className="pt-4 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newKey = prompt("Enter new field key name (e.g., customStatus, verifiedBy):");
                        if (newKey && newKey.trim()) {
                          setFormFields({ ...formFields, [newKey.trim()]: "" });
                        }
                      }}
                      className="text-xs text-slate-600 hover:text-slate-600 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom Field</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Raw JSON Document Structure
                  </label>
                  <textarea
                    rows={16}
                    value={jsonText}
                    onChange={(e) => {
                      setJsonText(e.target.value);
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setFormFields(parsed);
                        setJsonError(null);
                      } catch (err: any) {
                        setJsonError(`Syntax Error: ${err.message}`);
                      }
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl p-4 text-emerald-400 font-mono text-xs focus:outline-none focus:border-slate-300"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setIsCreatingNew(false);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-500 text-xs font-bold rounded-xl"
              >
                CANCEL
              </button>
              <button
                type="button"
                id="admin-save-record-confirm-btn"
                onClick={handleSaveRecord}
                disabled={isSavingRecord}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-900/40 disabled:opacity-50 transition active:scale-95"
              >
                {isSavingRecord ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isCreatingNew ? 'CREATE RECORD' : 'SAVE CHANGES TO BACKEND'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
