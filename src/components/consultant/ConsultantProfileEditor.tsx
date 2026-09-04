import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../../firebase';
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
  AlertTriangle, Upload, Search, Building2
} from 'lucide-react';

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
  const [bio, setBio] = useState<string>(user?.bio || '');
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
        educationHistory,
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
    <div className={`bg-white md:rounded-3xl border border-slate-200 md:shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 ${isEditingPortfolio ? 'fixed inset-0 z-[100] md:relative md:inset-auto md:z-auto overflow-y-auto' : 'relative'}`}>
      
      {/* Dashboard Section Header */}
      <div className="sticky top-0 z-30 p-4 md:p-6 border-b border-slate-100 bg-white/95 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0A3B24] flex items-center justify-center font-bold">
            <UserCircle size={24} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Professional Portfolio</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Council Compliance & Specialty Scope
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsEditingPortfolio(!isEditingPortfolio)}
          className={`w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            isEditingPortfolio 
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200' 
              : 'bg-emerald-50 text-[#0A3B24] hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          {isEditingPortfolio ? 'Cancel Editing' : 'Edit Full Portfolio'}
        </button>
      </div>

      {/* Missing Documents Alert Box */}
      {hasMissingDocs && !isEditingPortfolio && (
        <div className="m-4 md:m-6 p-4 md:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">Action Required: Complete Professional Portfolio</h4>
              <p className="text-[11px] md:text-xs text-amber-800 mt-1 leading-relaxed">
                Your profile is missing key compliance documents:
                <span className="font-bold block sm:inline mt-1 sm:mt-0">
                  {isDegreeMissing ? ' [Degree Certificate]' : ''}
                  {isIndemnityMissing ? ' [Indemnity Insurance]' : ''}
                  {isPinMissing ? ' [Council PIN]' : ''}
                  {isGhanaCardMissing ? ' [Ghana Card No.]' : ''}
                </span> 
                Upload them to accelerate your face-to-face admin verification.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditingPortfolio(true)}
            className="w-full md:w-auto px-4 py-3 md:py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-all shrink-0 cursor-pointer shadow-sm uppercase tracking-widest"
          >
            Upload Documents Now
          </button>
        </div>
      )}

      <div className={`p-4 md:p-8 ${isEditingPortfolio ? 'pb-24 md:pb-8' : ''}`}>
        {!isEditingPortfolio ? (
          /* ================= VIEW PORTFOLIO MODE ================= */
          <div className="space-y-6 md:space-y-8">
            {/* Master Cadre Header Card */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {profilePhoto ? (
                  <img 
                    src={profilePhoto} 
                    alt={fullName} 
                    onError={() => setProfilePhoto(null)} 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-600 shadow-sm" 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#0A3B24] text-white flex items-center justify-center font-black text-xl">
                    {prefix.replace('.', '')}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{formatConsultantName(fullName, prefix)}</h3>
                    <span className="text-[10px] bg-emerald-100 text-[#0A3B24] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                      {cadreConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-2">
                    <Building2 size={13} className="text-slate-400" />
                    {institution || 'Primary Clinical Facility Not Specified'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-1">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{cadreConfig.governingCouncil}</span>
                <span className="text-xs font-black text-slate-800 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-xs">
                  PIN: {pin || 'NOT DECLARED'}
                </span>
              </div>
            </div>

            {/* Section I: Bio & Qualifications */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <BookOpen size={16} className="text-[#0A3B24]" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Professional Bio</h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  {bio || 'No bio specified. Click "Edit Full Portfolio" to add your clinical summary.'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Award size={16} className="text-[#0A3B24]" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Highest Qualification</h4>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs font-black text-[#0A3B24] uppercase tracking-wider">{qualification || 'Not Specified'}</p>
                  {cadre === 'PHARMACIST' && (
                    <span className="text-[9px] bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded-md border border-blue-200 inline-block mt-2">
                      Track: {pharmacistDegreeTrack || 'B_PHARM'} {degreeVerified ? '(PharmD Registry Verified)' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section II: Compliance & Insurance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Ghana Card No.</span>
                <p className="text-xs font-bold text-slate-900">{ghanaCardNo || 'Not Entered'}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Indemnity Policy No.</span>
                <p className="text-xs font-bold text-slate-900">{indemnityPolicyNo || 'None'}</p>
                <span className="text-[9px] text-slate-500 font-semibold block">{insuranceProvider}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Indemnity Expiry</span>
                <p className="text-xs font-bold text-slate-900">{expiryDate || 'N/A'}</p>
                {provideLater && (
                  <span className="text-[8px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-black uppercase">
                    Provide Later Waiver Active
                  </span>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Availability Window</span>
                <p className="text-xs font-bold text-slate-900">{availabilityDays}</p>
                <span className="text-[9px] text-slate-500 font-semibold block">{availabilityHours}</span>
              </div>
            </div>

            {/* Section III: Document Certificates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCheck className="text-[#0A3B24]" size={20} />
                  <div>
                    <h5 className="text-xs font-black text-slate-900 uppercase">Degree Certificate</h5>
                    <p className="text-[10px] text-slate-500">{degreeCertificateFile ? 'Uploaded on file' : 'No document attached'}</p>
                  </div>
                </div>
                {degreeCertificateFile && (
                  <a href={degreeCertificateFile} target="_blank" rel="noreferrer" className="text-xs font-black text-[#0A3B24] hover:underline">
                    View Doc
                  </a>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-[#0A3B24]" size={20} />
                  <div>
                    <h5 className="text-xs font-black text-slate-900 uppercase">Indemnity Insurance Doc</h5>
                    <p className="text-[10px] text-slate-500">{indemnityDocData ? 'Uploaded on file' : provideLater ? 'Postponed (Waiver Accepted)' : 'Missing'}</p>
                  </div>
                </div>
                {indemnityDocData && (
                  <a href={indemnityDocData} target="_blank" rel="noreferrer" className="text-xs font-black text-[#0A3B24] hover:underline">
                    View Doc
                  </a>
                )}
              </div>
            </div>

            {/* Section IV: Languages & Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spoken Languages</h5>
                <div className="flex flex-wrap gap-2">
                  {languages.map((l, i) => (
                    <span key={i} className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope of Clinical Practice</h5>
                <div className="flex flex-wrap gap-2">
                  {scopeOfServices.length > 0 ? (
                    scopeOfServices.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg bg-emerald-100 text-[#0A3B24] text-xs font-bold border border-emerald-200">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">General Clinical Scope</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section V: Legal Affirmations */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={16} />
                <span>Legal Terms & Contractor Agreement Affirmed</span>
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                Signature: <span className="text-slate-900 font-bold">{typedLegalSignature || fullName}</span>
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

              {/* Degree Cert Upload */}
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
                      <CheckCircle2 size={14} /> Document Attached
                    </span>
                  )}
                </div>
              </div>

              {/* Education & Bio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Professional Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="Describe your active clinical interests..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Education History</label>
                  <textarea
                    value={educationHistory}
                    onChange={(e) => setEducationHistory(e.target.value)}
                    rows={3}
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="e.g. University of Ghana Medical School (MBChB)..."
                  />
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
