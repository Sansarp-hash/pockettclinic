import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { 
  CADRE_CONFIGS, 
  normalizeCadre, 
  ALL_LANGUAGES, 
  SPECIALTY_OPTIONS, 
  CadreType, 
  PharmacistDegreeTrack 
} from '../../config/consultantCadreConfig';
import { formatConsultantName } from '../../lib/formatters';
import { 
  UserCircle, ShieldCheck, Loader2, Award, BookOpen, Calendar, 
  FileCheck, Stethoscope, CheckCircle2, 
  AlertTriangle, Upload, Search, Building2,
  Plus, Trash2, FileUp
} from 'lucide-react';

interface EducationEntry {
  institution: string;
  degree: string;
  year: string;
  status: 'Complete' | 'Ongoing';
}

interface ConsultantProfileEditorProps {
  user: any;
  isEditingPortfolio: boolean;
  setIsEditingPortfolio: (val: boolean) => void;
  isSavingPortfolio?: boolean;
  onSave?: () => void;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const ConsultantProfileEditor: React.FC<ConsultantProfileEditorProps> = ({
  user,
  isEditingPortfolio,
  setIsEditingPortfolio,
  onSave
}) => {
  const { showToast, updateUserProfile } = useAppContext();

  // State initialization from user
  const initialCadre = normalizeCadre(user?.cadre);
  const [cadre, setCadre] = useState<CadreType>(initialCadre);
  const [pharmacistDegreeTrack, setPharmacistDegreeTrack] = useState<PharmacistDegreeTrack | ''>(user?.pharmacistDegreeTrack || '');
  const [degreeVerified, setDegreeVerified] = useState<boolean>(user?.degreeVerified || false);
  
  // Section A State
  const [fullName, setFullName] = useState<string>(user?.fullName || user?.displayName || '');
  const [prefix, setPrefix] = useState<string>(user?.prefix || 'Dr.');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.photoURL || user?.profilePhoto || null);
  const [languages, setLanguages] = useState<string[]>(Array.isArray(user?.languages) && user.languages.length > 0 ? user.languages : ['English', 'Twi (Akan)']);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  // Section B Credentials State
  const [pin, setPin] = useState<string>(user?.councilPin || user?.mdcPin || '');
  const [mdcExpiryDate, setMdcExpiryDate] = useState<string>(user?.mdcExpiryDate || '');
  const [qualification, setQualification] = useState<string>(
    user?.qualification || (Array.isArray(user?.degrees) ? user.degrees.join(', ') : user?.degrees || '')
  );
  const [degreeCertificateFile, setDegreeCertificateFile] = useState<string | null>(user?.mdcLicenseProofUrl || null);
  const degreeCertInputRef = useRef<HTMLInputElement>(null);
  const [educationHistory, setEducationHistory] = useState<string>(user?.educationHistory || '');
  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>(
    user?.educationEntries || [
      { institution: '', degree: '', year: '', status: 'Complete' }
    ]
  );
  const [bio, setBio] = useState<string>(user?.bio || '');
  const [customLanguage, setCustomLanguage] = useState('');
  const [customService, setCustomService] = useState('');
  const [isParsingCV, setIsParsingCV] = useState(false);
  const [cvFile, setCvFile] = useState<string | null>(user?.cvUrl || null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [pastWorkHistory, setPastWorkHistory] = useState<string>(user?.pastWorkHistory || '');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinLookupSuccess, setPinLookupSuccess] = useState('');

  // Section C Practice Details State
  const [specialty, setSpecialty] = useState<string>(user?.specialty || (user?.clinicalFocus?.[0] || ''));
  const [supervisingPhysician, setSupervisingPhysician] = useState<string>(user?.supervisingPhysician || '');
  const [supervisingPharmacist, setSupervisingPharmacist] = useState<string>(user?.supervisingPharmacist || '');
  const [institution, setInstitution] = useState<string>(user?.institution || user?.facility || '');
  const [scopeOfServices, setScopeOfServices] = useState<string[]>(user?.clinicalFocus || user?.scopeOfServices || []);
  const [verifiedDoctors, setVerifiedDoctors] = useState<{ uid: string; fullName: string; prefix: string; pin: string }[]>([]);
  const [verifiedPharmacists, setVerifiedPharmacists] = useState<{ uid: string; fullName: string; prefix: string; pin: string }[]>([]);

  // Section D Compliance & Insurance State
  const [ghanaCardNo, setGhanaCardNo] = useState<string>(user?.ghanaCardNo || 'GHA-');
  const [indemnityPolicyNo, setIndemnityPolicyNo] = useState<string>(user?.indemnityPolicyNumber || 'IND-2026-');
  const [insuranceProvider, setInsuranceProvider] = useState<string>(user?.indemnityProvider || 'Star Assurance Ghana');
  const [expiryDate, setExpiryDate] = useState<string>(user?.indemnityExpiryDate || user?.expiryDate || '2027-12-31');
  const [indemnityDocData, setIndemnityDocData] = useState<string | null>(user?.indemnityProofUrl || null);
  const indemnityInputRef = useRef<HTMLInputElement>(null);
  const [provideLater, setProvideLater] = useState<boolean>(user?.indemnityProvideLater || false);
  const [acceptFullPersonalLiability, setAcceptFullPersonalLiability] = useState<boolean>(user?.acceptFullPersonalLiability || false);

  // Section E Legal State
  const [certifyCredentials, setCertifyCredentials] = useState<boolean>(user?.certifyCredentials || true);
  const [assumeLiability, setAssumeLiability] = useState<boolean>(user?.assumeLiability || true);
  const [indemnifyPlatform, setIndemnifyPlatform] = useState<boolean>(user?.indemnifyPlatform || true);
  const [affirmIndependentContractor, setAffirmIndependentContractor] = useState<boolean>(user?.affirmIndependentContractor || true);
  const [typedLegalSignature, setTypedLegalSignature] = useState<string>(user?.typedLegalSignature || fullName);

  // Section F Availability State
  const [availabilityDays, setAvailabilityDays] = useState<string>(
    typeof user?.availabilityDays === 'string' 
      ? user.availabilityDays 
      : Array.isArray(user?.availabilityDays) 
        ? user.availabilityDays.join(', ') 
        : 'Monday - Friday'
  );
  const [availabilityHours, setAvailabilityHours] = useState<string>(user?.availabilityHours || '9:00 AM - 5:00 PM');
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize state when user prop changes from external source (e.g. Firestore update)
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || user.displayName || '');
      setPrefix(user.prefix || (cadre === 'PHYSICIAN_ASSISTANT' ? 'PA' : cadre === 'PHARM_TECH' ? 'Pharm. Tech.' : cadre === 'PHARMACIST' ? 'Pharm.' : 'Dr.'));
      setPhone(user.phone || '');
      setEmail(user.email || '');
      setProfilePhoto(user.photoURL || user.profilePhoto || null);
      setLanguages(Array.isArray(user.languages) && user.languages.length > 0 ? user.languages : ['English', 'Twi (Akan)']);
      
      setPin(user.councilPin || user.mdcPin || '');
      setMdcExpiryDate(user.mdcExpiryDate || '');
      setQualification(user.qualification || (Array.isArray(user.degrees) ? user.degrees.join(', ') : user.degrees || ''));
      setDegreeCertificateFile(user.mdcLicenseProofUrl || null);
      setEducationHistory(user.educationHistory || '');
      setEducationEntries(user.educationEntries || [
        { institution: '', degree: '', year: '', status: 'Complete' }
      ]);
      setBio(user.bio || '');
      setPastWorkHistory(user.pastWorkHistory || '');
      
      setSpecialty(user.specialty || (user.clinicalFocus?.[0] || ''));
      setInstitution(user.institution || user.facility || '');
      setScopeOfServices(user.clinicalFocus || user.scopeOfServices || []);
      
      setGhanaCardNo(user.ghanaCardNo || 'GHA-');
      setIndemnityPolicyNo(user.indemnityPolicyNumber || 'IND-2026-');
      setInsuranceProvider(user.indemnityProvider || 'Star Assurance Ghana');
      setExpiryDate(user.indemnityExpiryDate || user.expiryDate || '2027-12-31');
      setIndemnityDocData(user.indemnityProofUrl || null);
      setTypedLegalSignature(user.typedLegalSignature || (user.fullName || user.displayName || ''));
    }
  }, [user]);

  const cadreConfig = CADRE_CONFIGS[cadre] || CADRE_CONFIGS.DOCTOR;

  // Load Supervising Consultants
  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const docsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'consultant')));
        const doctorsList: { uid: string; fullName: string; prefix: string; pin: string }[] = [];
        const pharmacistsList: { uid: string; fullName: string; prefix: string; pin: string }[] = [];

        docsSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const uCadre = normalizeCadre(d.cadre || '');
          const item = {
            uid: docSnap.id,
            fullName: d.fullName || d.displayName || 'Consultant',
            prefix: d.prefix || 'Dr.',
            pin: d.councilPin || d.mdcPin || 'MDC-REG'
          };
          if (uCadre === 'DOCTOR' || uCadre === 'SPECIALIST') {
            doctorsList.push(item);
          } else if (uCadre === 'PHARMACIST') {
            pharmacistsList.push(item);
          }
        });

        setVerifiedDoctors(doctorsList);
        setVerifiedPharmacists(pharmacistsList);
      } catch (err) {
        console.warn("Could not load supervising consultants:", err);
      }
    };
    fetchSupervisors();
  }, []);

  // Sync Prefix options when Cadre or PharmD verification changes
  useEffect(() => {
    if (user?.prefix) return; // Do not forcefully override if they already have a prefix set

    if (cadre === 'DOCTOR' || cadre === 'SPECIALIST') {
      setPrefix('Dr.');
    } else if (cadre === 'PHYSICIAN_ASSISTANT') {
      setPrefix('PA');
    } else if (cadre === 'PHARM_TECH') {
      setPrefix('None');
    } else if (cadre === 'PHARMACIST') {
      if (pharmacistDegreeTrack === 'PHARM_D' && degreeVerified) {
        if (prefix !== 'Dr.' && prefix !== 'Pharm.') {
          setPrefix('Pharm.');
        }
      } else {
        setPrefix('Pharm.');
      }
    }
  }, [cadre, pharmacistDegreeTrack, degreeVerified, user?.prefix]);

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setProfilePhoto(compressed);
      showToast("Profile picture uploaded successfully!", "success");
    } catch (err) {
      showToast("Failed to process image.", "error");
    }
  };

  // Handle Degree Cert Upload
  const handleDegreeCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setDegreeCertificateFile(compressed);
      showToast("Degree certificate document attached!", "success");
    } catch (err) {
      showToast("Failed to attach document.", "error");
    }
  };

  // Handle Indemnity Doc Upload
  const handleIndemnityUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setIndemnityDocData(compressed);
      setProvideLater(false);
      showToast("Indemnity policy document attached!", "success");
    } catch (err) {
      showToast("Failed to attach indemnity document.", "error");
    }
  };

  // PIN Registry Lookup Trigger
  const handlePinLookup = async () => {
    if (!pin || pin.trim().length < 3) {
      showToast("Please enter a valid Council PIN first.", "error");
      return;
    }
    setIsVerifyingPin(true);
    setPinLookupSuccess('');
    try {
      const q = query(collection(db, 'council_registry'), where('councilPin', '==', pin.trim()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const match = snap.docs[0].data() as any;
        setFullName(match.fullName || fullName);
        if (match.qualification) setQualification(match.qualification);
        if (match.expiryDate) setMdcExpiryDate(match.expiryDate);
        setPinLookupSuccess(`✓ Registry Verified: ${match.fullName || 'Matched Consultant'} (Good Standing)`);
        showToast("Council PIN verified in official council registry!", "success");
      } else {
        setPinLookupSuccess(`PIN logged: ${pin.trim().toUpperCase()} (Scheduled for manual council check)`);
        showToast("PIN recorded for admin face-to-face review.", "info");
      }
    } catch (err) {
      setPinLookupSuccess(`PIN logged: ${pin.trim().toUpperCase()} (Pending verification)`);
      showToast("PIN recorded for review.", "info");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Toggle Language
  const toggleLanguage = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };

  // Toggle Scope
  const toggleScope = (service: string) => {
    setScopeOfServices(prev => prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]);
  };

  // Missing document check
  const isDegreeMissing = !degreeCertificateFile;
  const isIndemnityMissing = !indemnityDocData && !provideLater;
  const isPinMissing = !pin || pin.trim().length < 3;
  const isGhanaCardMissing = !ghanaCardNo || ghanaCardNo === 'GHA-';
  const hasMissingDocs = isDegreeMissing || isIndemnityMissing || isPinMissing || isGhanaCardMissing;

  // Save Complete Portfolio Handler
  const handleAddCustomLanguage = () => {
    if (customLanguage.trim()) {
      if (!languages.includes(customLanguage.trim())) {
        setLanguages([...languages, customLanguage.trim()]);
      }
      setCustomLanguage('');
    }
  };

  const handleAddEducation = () => {
    setEducationEntries([
      ...educationEntries,
      { institution: '', degree: '', year: '', status: 'Complete' }
    ]);
  };

  const handleRemoveEducation = (index: number) => {
    const updated = [...educationEntries];
    updated.splice(index, 1);
    setEducationEntries(updated);
  };

  const handleEducationChange = (index: number, field: keyof EducationEntry, value: string) => {
    const updated = [...educationEntries];
    updated[index] = { ...updated[index], [field]: value };
    setEducationEntries(updated);
  };

  const handleAddCustomService = () => {
    if (customService.trim()) {
      if (!scopeOfServices.includes(customService.trim())) {
        setScopeOfServices([...scopeOfServices, customService.trim()]);
      }
      setCustomService('');
    }
  };

  const handleCVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCvFile(base64);
        parseCV(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const parseCV = async (base64: string, mimeType: string) => {
    setIsParsingCV(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai/parse-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ cvBase64: base64, mimeType })
      });
      const data = await response.json();
      if (data.result) {
        setBio(data.result);
      }
    } catch (err) {
      console.error("Error parsing CV:", err);
    } finally {
      setIsParsingCV(false);
    }
  };

  const handleSaveCompletePortfolio = async () => {
    setIsSaving(true);
    try {
      const degreesArray = qualification.split(',').map(s => s.trim()).filter(Boolean);
      
      const updatedProfile = {
        cadre,
        pharmacistDegreeTrack: pharmacistDegreeTrack || null,
        degreeVerified,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        prefix,
        phone: phone.trim(),
        email: email.trim(),
        photoURL: profilePhoto,
        profilePhoto,
        languages,
        
        councilPin: pin.trim(),
        mdcPin: pin.trim(),
        mdcExpiryDate,
        qualification,
        degrees: degreesArray,
        mdcLicenseProofUrl: degreeCertificateFile,
        cvUrl: cvFile,
        educationHistory,
        educationEntries,
        bio,
        pastWorkHistory,

        specialty: cadre === 'SPECIALIST' ? specialty : null,
        supervisingPhysician: cadre === 'PHYSICIAN_ASSISTANT' ? supervisingPhysician : null,
        supervisingPharmacist: cadre === 'PHARM_TECH' ? supervisingPharmacist : null,
        institution,
        facility: institution,
        clinicalFocus: scopeOfServices,
        scopeOfServices,

        ghanaCardNo,
        indemnityPolicyNumber: indemnityPolicyNo,
        indemnityProvider: insuranceProvider,
        indemnityExpiryDate: expiryDate,
        indemnityProofUrl: indemnityDocData,
        indemnityProvideLater: provideLater,
        acceptFullPersonalLiability: provideLater ? acceptFullPersonalLiability : false,

        certifyCredentials,
        assumeLiability,
        indemnifyPlatform,
        affirmIndependentContractor,
        typedLegalSignature,

        availabilityDays,
        availabilityHours,
        updatedAt: new Date().toISOString()
      };

      const uid = user?.uid || user?.id;
      if (uid) {
        await setDoc(doc(db, 'users', uid), updatedProfile, { merge: true });
        await setDoc(doc(db, 'consultants', uid), updatedProfile, { merge: true });
      }

      updateUserProfile(updatedProfile);
      if (onSave) onSave();

      setIsEditingPortfolio(false);
      showToast("Professional Portfolio updated successfully!", "success");
    } catch (err: any) {
      console.error("Failed to save complete portfolio:", err);
      showToast("Error saving portfolio: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`bg-white md:rounded-[2.5rem] border border-slate-100 md:shadow-2xl md:shadow-slate-200/40 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 ${isEditingPortfolio ? 'fixed inset-0 z-[100] md:relative md:inset-auto md:z-auto overflow-y-auto' : 'relative'}`}>
      
      {/* Dashboard Section Header */}
      <div className="sticky top-0 z-30 p-6 md:p-10 border-b border-slate-50 bg-white/95 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[24px] bg-slate-900 text-white flex items-center justify-center shadow-2xl shadow-slate-900/20 shrink-0">
            <UserCircle size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tight">Professional Portfolio</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">
              Credentialing & Specialty Scope
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsEditingPortfolio(!isEditingPortfolio)}
          className={`w-full sm:w-auto px-8 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all active:scale-95 shadow-xl ${
            isEditingPortfolio 
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 shadow-rose-600/10' 
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
          }`}
        >
          {isEditingPortfolio ? 'Exit Editor' : 'Edit Portfolio'}
        </button>
      </div>

      {/* Missing Documents Alert Box */}
      {hasMissingDocs && !isEditingPortfolio && (
        <div className="m-6 md:m-10 p-8 rounded-[2rem] bg-amber-50 border border-amber-100 text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0 mt-0.5">
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.15em] text-amber-950">Pending Credentials</h4>
              <p className="text-[11px] md:text-xs text-amber-800/80 mt-1.5 leading-relaxed font-bold uppercase tracking-tight">
                Missing compliance files:
                <span className="text-amber-600 ml-1">
                  {isDegreeMissing ? '[Degree Certificate] ' : ''}
                  {isIndemnityMissing ? '[Indemnity Proof] ' : ''}
                  {isPinMissing ? '[Council PIN] ' : ''}
                  {isGhanaCardMissing ? '[Ghana Card] ' : ''}
                </span> 
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditingPortfolio(true)}
            className="w-full md:w-auto px-6 py-3 bg-amber-600 text-white font-black text-[10px] rounded-xl hover:bg-amber-700 transition-all shrink-0 cursor-pointer shadow-lg shadow-amber-600/20 uppercase tracking-widest"
          >
            Update Now
          </button>
        </div>
      )}

      <div className={`p-6 md:p-12 ${isEditingPortfolio ? 'pb-24 md:pb-12' : ''}`}>
        {!isEditingPortfolio ? (
          /* ================= VIEW PORTFOLIO MODE ================= */
          <div className="space-y-10 md:space-y-12">
            {/* Master Cadre Header Card */}
            <div className="bg-slate-50 p-8 md:p-12 rounded-[3rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                {profilePhoto ? (
                  <img 
                    src={profilePhoto} 
                    alt={fullName} 
                    onError={() => setProfilePhoto(null)} 
                    className="w-24 h-24 rounded-[32px] object-cover border-4 border-white shadow-2xl" 
                  />
                ) : (
                  <div className="w-24 h-24 rounded-[32px] bg-slate-900 text-white flex items-center justify-center font-black text-3xl shadow-2xl">
                    {prefix.replace('.', '')}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tight">{formatConsultantName(fullName, prefix)}</h3>
                    <div className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em] border border-emerald-100 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-emerald-500" />
                      {cadreConfig.label}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.1em] flex items-center gap-2">
                    <Building2 size={14} className="text-slate-400" />
                    {institution || 'Facility Not Documented'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-2">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{cadreConfig.governingCouncil}</span>
                <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN</span>
                  <span className="text-xs font-black text-slate-950 uppercase tracking-widest">{pin || 'UNVERIFIED'}</span>
                </div>
              </div>
            </div>

            {/* Section I: Bio & Qualifications */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <BookOpen size={16} className="text-slate-900" />
                  Professional Summary
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm leading-relaxed text-slate-600 text-[13px] font-bold italic">
                  "{bio || 'Clinical profile summary pending update.'}"
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <Award size={16} className="text-slate-900" />
                  Credentials
                </div>
                <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl shadow-slate-900/10 border border-slate-950 space-y-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Academic Rank</span>
                    <p className="text-xs font-black text-white uppercase tracking-wider">{qualification || 'Generalist'}</p>
                  </div>
                  {cadre === 'PHARMACIST' && (
                    <div className="pt-4 border-t border-slate-800">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">PharmD Track</span>
                      <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">
                        {pharmacistDegreeTrack || 'B_PHARM'} {degreeVerified ? '• Registry Match' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section II: Compliance & Insurance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 border-t border-slate-50">
              <div className="group p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-500">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Ghana Card</span>
                <p className="text-[11px] font-black text-slate-950 uppercase tracking-widest">{ghanaCardNo || 'PENDING'}</p>
              </div>

              <div className="group p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-500">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Indemnity Policy</span>
                <p className="text-[11px] font-black text-slate-950 uppercase tracking-widest mb-1">{indemnityPolicyNo || 'NONE'}</p>
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">{insuranceProvider}</span>
              </div>

              <div className="group p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-500">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Insurance Expiry</span>
                <p className="text-[11px] font-black text-slate-950 uppercase tracking-widest">{expiryDate || 'N/A'}</p>
                {provideLater && (
                  <span className="mt-2 text-[8px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-amber-100 inline-block">
                    Liability Waiver Active
                  </span>
                )}
              </div>

              <div className="group p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-500">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Availability</span>
                <p className="text-[11px] font-black text-slate-950 uppercase tracking-widest mb-1">{availabilityDays}</p>
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">{availabilityHours}</span>
              </div>
            </div>

            {/* Section III: Document Certificates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
              <div className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:bg-slate-950 group-hover:text-white transition-all">
                    <FileCheck size={24} />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-slate-950 uppercase tracking-widest">Degree Certificate</h5>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{degreeCertificateFile ? 'Verified on File' : 'Missing File'}</p>
                  </div>
                </div>
                {degreeCertificateFile && (
                  <a href={degreeCertificateFile} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all">
                    <Search size={16} />
                  </a>
                )}
              </div>

              <div className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:bg-slate-950 group-hover:text-white transition-all">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-slate-950 uppercase tracking-widest">Indemnity Insurance</h5>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{indemnityDocData ? 'Policy Verified' : provideLater ? 'Waiver Documented' : 'Action Required'}</p>
                  </div>
                </div>
                {indemnityDocData && (
                  <a href={indemnityDocData} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all">
                    <Search size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* Section IV: Languages & Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-10 border-t border-slate-50">
              <div className="space-y-6">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Spoken Languages</h5>
                <div className="flex flex-wrap gap-2.5">
                  {languages.map((l, i) => (
                    <span key={i} className="px-5 py-2 rounded-xl bg-slate-50 text-slate-950 text-[10px] font-black uppercase tracking-widest border border-slate-100">
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Clinical Scope</h5>
                <div className="flex flex-wrap gap-2.5">
                  {scopeOfServices.length > 0 ? (
                    scopeOfServices.map((s, i) => (
                      <span key={i} className="px-5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Full Medical Capacity</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section V: Legal Affirmations */}
            <div className="p-8 rounded-[2.5rem] bg-slate-950 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-slate-900/40">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                  <CheckCircle2 className="text-emerald-400" size={24} />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase tracking-widest">Affirmed Contractor Status</h5>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Legal Liability & Indemnity Agreement Signed</p>
                </div>
              </div>
              <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em]">
                Digital Signature: <span className="text-emerald-400 ml-2">{typedLegalSignature || fullName}</span>
              </div>
            </div>
          </div>
        ) : (
          /* ================= EDIT PORTFOLIO MODE ================= */
          <div className="space-y-6 md:space-y-8 max-w-4xl">
            {/* Prominent Profile Picture Uploader */}
            <div className="bg-slate-50/80 p-6 md:p-8 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-4">
              <div className="relative group cursor-pointer" onClick={() => profilePhotoInputRef.current?.click()}>
                {profilePhoto ? (
                  <img 
                    src={profilePhoto} 
                    alt="Profile preview" 
                    onError={() => setProfilePhoto(null)} 
                    className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-emerald-600 shadow-md group-hover:opacity-80 transition-opacity" 
                  />
                ) : (
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#0A3B24] text-white flex items-center justify-center font-black text-3xl md:text-5xl shadow-md group-hover:bg-emerald-900 transition-colors">
                    {prefix.replace('.', '')}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="text-white" size={24} />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-sm border border-slate-200 text-emerald-600">
                  <Upload size={16} />
                </div>
              </div>
              <input 
                type="file" 
                ref={profilePhotoInputRef}
                onChange={handlePhotoUpload}
                accept="image/*" 
                className="hidden" 
              />
              <div>
                <h4 className="text-sm font-black text-slate-800">Public Profile Photo</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">This photo will appear on your public consultant card for patients.</p>
              </div>
            </div>

            {/* Step 0 Cadre Selection */}
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-[#0A3B24] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                <Stethoscope size={16} />
                Cadre & Title Identity
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Professional Cadre</label>
                  <select
                    value={cadre}
                    onChange={(e) => setCadre(e.target.value as CadreType)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    <option value="UNASSIGNED" disabled>Unassigned (Please select a profession)</option>
                    {Object.entries(CADRE_CONFIGS).map(([key, config]) => (
                      key !== 'UNASSIGNED' && (
                        <option key={key} value={key}>{config.label}</option>
                      )
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Title / Prefix</label>
                  <select
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    <option value="None">None (Name Only)</option>
                    {cadre === 'PHARMACIST' && pharmacistDegreeTrack === 'PHARM_D' && degreeVerified ? (
                      <>
                        <option value="Dr.">Dr.</option>
                        <option value="Pharm.">Pharm.</option>
                      </>
                    ) : cadre === 'PHARMACIST' ? (
                      <option value="Pharm.">Pharm.</option>
                    ) : cadre === 'PHYSICIAN_ASSISTANT' ? (
                      <option value="PA">PA</option>
                    ) : cadre === 'PHARM_TECH' ? (
                      <option value="Pharm. Tech.">Pharm. Tech.</option>
                    ) : (
                      <>
                        <option value="Dr.">Dr.</option>
                        <option value="Prof.">Prof.</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {cadre === 'PHARMACIST' && (
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <span className="text-xs font-black text-blue-900 uppercase tracking-wider block">Pharmacist Degree Track Verification</span>
                  <div className="flex flex-wrap gap-4 text-xs font-bold">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="pharmTrack" 
                        checked={pharmacistDegreeTrack === 'PHARM_D'}
                        onChange={() => setPharmacistDegreeTrack('PHARM_D')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Doctor of Pharmacy (PharmD)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="pharmTrack" 
                        checked={pharmacistDegreeTrack === 'B_PHARM'}
                        onChange={() => setPharmacistDegreeTrack('B_PHARM')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Bachelor of Pharmacy (B.Pharm)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Section A: Identity & Contact */}
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-[#0A3B24] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                <UserCircle size={16} />
                Section A — Identity & Contact Info
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Legal Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="Full Name as on Council License"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="+233 XX XXX XXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* Languages Spoken */}
              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Languages Spoken with Patients</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_LANGUAGES.map((lang, idx) => {
                    const selected = languages.includes(lang);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          selected 
                            ? 'bg-[#0A3B24] text-white border-[#0A3B24]' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                  {languages.filter(l => !ALL_LANGUAGES.includes(l)).map((lang, idx) => (
                    <button
                      key={`custom-${idx}`}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border bg-[#0A3B24] text-white border-[#0A3B24]"
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    placeholder="Add other language..."
                    className="flex-1 p-2 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomLanguage())}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomLanguage}
                    className="p-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Section B: Regulatory Credentials */}
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-[#0A3B24] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                <Award size={16} />
                Section B — Regulatory Credentials & Education
              </h4>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Governing Body: <span className="text-[#0A3B24] font-black">{cadreConfig.governingCouncil}</span></span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase font-mono">Format: {cadreConfig.pinFormatExample}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Council License PIN</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="flex-1 p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none uppercase"
                      placeholder={cadreConfig.pinFormatExample}
                    />
                    <button
                      type="button"
                      onClick={handlePinLookup}
                      disabled={isVerifyingPin}
                      className="px-4 py-3.5 bg-emerald-700 text-white rounded-xl font-bold text-xs hover:bg-emerald-800 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      {isVerifyingPin ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                      Verify PIN
                    </button>
                  </div>
                  {pinLookupSuccess && (
                    <p className="text-[11px] text-emerald-700 font-bold mt-1">{pinLookupSuccess}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Highest Qualification</label>
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    <option value="">Select Qualification</option>
                    {cadreConfig.qualificationOptions.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Degree & CV Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Degree Certificate Document</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      ref={degreeCertInputRef}
                      onChange={handleDegreeCertUpload}
                      accept="image/*,application/pdf"
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => degreeCertInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Upload size={14} />
                      {degreeCertificateFile ? 'Replace Degree Document' : 'Upload Degree Certificate'}
                    </button>
                    {degreeCertificateFile && (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 size={14} /> Attached
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Curriculum Vitae (CV)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      ref={cvInputRef}
                      onChange={handleCVUpload}
                      accept="image/*,application/pdf"
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => cvInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <FileUp size={14} />
                      {cvFile ? 'Replace CV' : 'Upload CV'}
                    </button>
                    {cvFile && (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 size={14} /> Attached
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400">Upload your CV to automatically generate your professional bio using AI.</p>
                </div>
              </div>

              {/* Professional Bio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Professional Bio</label>
                  {isParsingCV && (
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Analyzing CV...
                    </span>
                  )}
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-600 outline-none"
                  placeholder="Describe your clinical expertise and patient care philosophy..."
                />
              </div>

              {/* Education History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Education History</label>
                  <button
                    type="button"
                    onClick={handleAddEducation}
                    className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-800"
                  >
                    <Plus size={14} /> Add Education
                  </button>
                </div>
                
                <div className="space-y-3">
                  {educationEntries.map((entry, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 relative group">
                      <button
                        type="button"
                        onClick={() => handleRemoveEducation(idx)}
                        className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Institution</label>
                          <input
                            type="text"
                            value={entry.institution}
                            onChange={(e) => handleEducationChange(idx, 'institution', e.target.value)}
                            className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                            placeholder="e.g. University of Ghana"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Degree / Qualification</label>
                          <input
                            type="text"
                            value={entry.degree}
                            onChange={(e) => handleEducationChange(idx, 'degree', e.target.value)}
                            className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                            placeholder="e.g. MBChB Medicine"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Year</label>
                          <input
                            type="text"
                            value={entry.year}
                            onChange={(e) => handleEducationChange(idx, 'year', e.target.value)}
                            className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                            placeholder="e.g. 2018 - 2024"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Status</label>
                          <select
                            value={entry.status}
                            onChange={(e) => handleEducationChange(idx, 'status', e.target.value as any)}
                            className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                          >
                            <option value="Complete">Complete</option>
                            <option value="Ongoing">Ongoing</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  {educationEntries.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4 italic">No education history added yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section C: Practice Details */}
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-[#0A3B24] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                <Building2 size={16} />
                Section C — Practice Details & Affiliation
              </h4>

              {cadre === 'SPECIALIST' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Medical Specialty</label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    <option value="">Select Specialty</option>
                    {SPECIALTY_OPTIONS.map((spec, idx) => (
                      <option key={idx} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              )}

              {cadre === 'PHYSICIAN_ASSISTANT' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Supervising Physician</label>
                  <select
                    value={supervisingPhysician}
                    onChange={(e) => setSupervisingPhysician(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    <option value="">Select Supervising Doctor</option>
                    {verifiedDoctors.map((docItem) => (
                      <option key={docItem.uid} value={docItem.fullName}>
                        {docItem.prefix} {docItem.fullName} (PIN: {docItem.pin})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {cadre === 'PHARM_TECH' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Supervising Pharmacist</label>
                  <select
                    value={supervisingPharmacist}
                    onChange={(e) => setSupervisingPharmacist(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    <option value="">Select Supervising Pharmacist</option>
                    {verifiedPharmacists.map((pharmItem) => (
                      <option key={pharmItem.uid} value={pharmItem.fullName}>
                        {pharmItem.prefix} {pharmItem.fullName} (PIN: {pharmItem.pin})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{cadreConfig.institutionLabel}</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  placeholder="e.g. Korle-Bu Teaching Hospital / Community Pharmacy"
                />
              </div>

              {/* Scope of Practice */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Scope of Clinical Services</label>
                <div className="flex flex-wrap gap-2">
                  {cadreConfig.scopeOfServices.map((service, idx) => {
                    const selected = scopeOfServices.includes(service);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleScope(service)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          selected 
                            ? 'bg-emerald-700 text-white border-emerald-700' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {service}
                      </button>
                    );
                  })}
                  {scopeOfServices.filter(s => !cadreConfig.scopeOfServices.includes(s)).map((service, idx) => (
                    <button
                      key={`custom-${idx}`}
                      type="button"
                      onClick={() => toggleScope(service)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border bg-emerald-700 text-white border-emerald-700"
                    >
                      {service}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    placeholder="Add other clinical service..."
                    className="flex-1 p-2 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomService())}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomService}
                    className="p-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Section D: Compliance & Insurance */}
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-[#0A3B24] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                <ShieldCheck size={16} />
                Section D — Compliance & Indemnity Insurance
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ghana Card Number</label>
                  <input
                    type="text"
                    value={ghanaCardNo}
                    onChange={(e) => setGhanaCardNo(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none uppercase"
                    placeholder="GHA-123456789-0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Indemnity Insurance Policy No.</label>
                  <input
                    type="text"
                    value={indemnityPolicyNo}
                    onChange={(e) => setIndemnityPolicyNo(e.target.value)}
                    disabled={provideLater}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none disabled:bg-slate-100"
                    placeholder="IND-2026-908"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Insurance Provider</label>
                  <input
                    type="text"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    disabled={provideLater}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Policy Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={provideLater}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Upload or Provide Later */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    ref={indemnityInputRef}
                    onChange={handleIndemnityUpload}
                    accept="image/*,application/pdf"
                    className="hidden" 
                  />
                  <button
                    type="button"
                    onClick={() => indemnityInputRef.current?.click()}
                    disabled={provideLater}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Upload size={14} />
                    {indemnityDocData ? 'Replace Indemnity Document' : 'Upload Indemnity Certificate'}
                  </button>
                  {indemnityDocData && (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={14} /> Document Attached
                    </span>
                  )}
                </div>

                {/* Provide Later Waiver Checkbox */}
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={provideLater}
                      onChange={(e) => {
                        setProvideLater(e.target.checked);
                        if (!e.target.checked) setAcceptFullPersonalLiability(false);
                      }}
                      className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-950">Provide Indemnity Insurance Document Later</span>
                  </label>

                  {provideLater && (
                    <div className="mt-2 pt-2 border-t border-amber-200 space-y-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={acceptFullPersonalLiability}
                          onChange={(e) => setAcceptFullPersonalLiability(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                        />
                        <span className="text-[11px] font-bold text-amber-900 leading-normal">
                          I explicitly affirm that I assume full personal and professional liability for all clinical advice and services provided on PockettClinic during this interim period until my official indemnity document is uploaded and verified.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section E: Legal Affirmations & Signature */}
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-[#0A3B24] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                <FileCheck size={16} />
                Section E — Legal Affirmation & Digital Signature
              </h4>

              <div className="space-y-3 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={certifyCredentials} 
                    onChange={(e) => setCertifyCredentials(e.target.checked)} 
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>I certify that all licensing and qualification credentials provided are authentic and active.</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={assumeLiability} 
                    onChange={(e) => setAssumeLiability(e.target.checked)} 
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>I assume full professional liability for clinical decisions rendered.</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={affirmIndependentContractor} 
                    onChange={(e) => setAffirmIndependentContractor(e.target.checked)} 
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>I affirm my status as an Independent Healthcare Consultant.</span>
                </label>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Typed Legal Signature</label>
                <input
                  type="text"
                  value={typedLegalSignature}
                  onChange={(e) => setTypedLegalSignature(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                  placeholder="Type Full Name to Sign"
                />
              </div>
            </div>

            {/* Section F: Availability */}
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-[#0A3B24] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                <Calendar size={16} />
                Section F — Clinical Availability
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Availability Days</label>
                  <input
                    type="text"
                    value={availabilityDays}
                    onChange={(e) => setAvailabilityDays(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="e.g. Monday - Friday"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Availability Hours</label>
                  <input
                    type="text"
                    value={availabilityHours}
                    onChange={(e) => setAvailabilityHours(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="e.g. 9:00 AM - 5:00 PM"
                  />
                </div>
              </div>
            </div>

            {/* Submit Save */}
            <button
              onClick={handleSaveCompletePortfolio}
              disabled={isSaving}
              className="w-full bg-[#0A3B24] hover:bg-[#0A3B24]/90 text-white font-black uppercase tracking-widest py-4.5 rounded-2xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3 cursor-pointer"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Save Complete Professional Portfolio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
