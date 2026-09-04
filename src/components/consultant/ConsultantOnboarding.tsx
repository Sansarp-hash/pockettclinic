import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import { ShieldCheck, Award, ChevronRight, Loader2, CheckCircle2, AlertCircle, Upload, Eye, EyeOff, UserCircle, ShieldAlert, BookOpen, Building2, Stethoscope, UserCheck, FileText, Lock } from 'lucide-react';
import { auth, db } from '../../firebase';
import { collection, query, where, getDocs, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { CouncilRegistryEntry } from '../../types';
import LegalDocumentsModal from '../LegalDocumentsModal';
import { 
  CadreType, 
  PharmacistDegreeTrack, 
  CADRE_CONFIGS, 
  getPrefixOptions, 
  SPECIALTY_OPTIONS, 
  ALL_LANGUAGES 
} from '../../config/consultantCadreConfig';

const processFileUpload = (file: File, showToast?: (m: string, t: any) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 800;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      if (file.size > 300 * 1024) {
        if (showToast) {
          showToast(`File ${file.name} is too large (${(file.size / 1024).toFixed(1)} KB). Please keep non-image files under 300KB.`, "error");
        } else {
          console.warn(`File ${file.name} is too large (${(file.size / 1024).toFixed(1)} KB).`);
        }
        reject(new Error("File too large"));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    }
  });
};

export default function ConsultantOnboarding() {
  const navigate = useNavigate();
  const { user: currentUser, updateUserProfile, signUpWithEmail, showToast } = useAppContext();
  
  // Navigation & Modal State
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'tos' | 'privacy'>('tos');

  // STEP 0 — Profession Selection State
  const [cadre, setCadre] = useState<CadreType | ''>('');
  const [pharmacistDegreeTrack, setPharmacistDegreeTrack] = useState<PharmacistDegreeTrack | ''>('');
  const [degreeVerified, setDegreeVerified] = useState(false);
  const [degreeVerificationStatus, setDegreeVerificationStatus] = useState<'idle' | 'verifying' | 'verified_pharmd' | 'verified_bpharm' | 'pending_manual_review'>('idle');

  // SECTION A — Identity & Contact State
  const [fullName, setFullName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoName, setProfilePhotoName] = useState('');
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const [languages, setLanguages] = useState<string[]>(['English', 'Twi (Akan)']);

  // SECTION B — Professional Credentials State
  const [pin, setPin] = useState('');
  const [qualification, setQualification] = useState('');
  const [degreeCertificateFile, setDegreeCertificateFile] = useState<string | null>(null);
  const [degreeCertificateFileName, setDegreeCertificateFileName] = useState('');
  const degreeCertInputRef = useRef<HTMLInputElement>(null);
  const [educationHistory, setEducationHistory] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinLookupError, setPinLookupError] = useState('');
  const [pinAutofillSuccess, setPinAutofillSuccess] = useState('');
  const [verifiedData, setVerifiedData] = useState<CouncilRegistryEntry | null>(null);

  // SECTION C — Practice Details State
  const [specialty, setSpecialty] = useState('');
  const [supervisingPhysician, setSupervisingPhysician] = useState('');
  const [supervisingPharmacist, setSupervisingPharmacist] = useState('');
  const [institution, setInstitution] = useState('');
  const [scopeOfServices, setScopeOfServices] = useState<string[]>([]);
  const [verifiedDoctors, setVerifiedDoctors] = useState<{ uid: string; fullName: string; prefix: string; pin: string }[]>([]);
  const [verifiedPharmacists, setVerifiedPharmacists] = useState<{ uid: string; fullName: string; prefix: string; pin: string }[]>([]);

  // SECTION D — Compliance & Insurance State
  const [ghanaCardNo, setGhanaCardNo] = useState('GHA-');
  const [indemnityPolicyNo, setIndemnityPolicyNo] = useState('IND-2026-');
  const [insuranceProvider, setInsuranceProvider] = useState('Star Assurance Ghana');
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [indemnityDocData, setIndemnityDocData] = useState<string | null>(null);
  const [indemnityDocName, setIndemnityDocName] = useState('');
  const indemnityInputRef = useRef<HTMLInputElement>(null);
  const [provideLater, setProvideLater] = useState(false);
  const [acceptFullPersonalLiability, setAcceptFullPersonalLiability] = useState(false);

  // SECTION E — Legal Consent State
  const [certifyCredentials, setCertifyCredentials] = useState(false);
  const [assumeLiability, setAssumeLiability] = useState(false);
  const [indemnifyPlatform, setIndemnifyPlatform] = useState(false);
  const [affirmIndependentContractor, setAffirmIndependentContractor] = useState(false);
  const [acceptedPlatformTerms, setAcceptedPlatformTerms] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [typedLegalSignature, setTypedLegalSignature] = useState('');

  // SECTION F — Availability & Account Setup State
  const [availabilityDays, setAvailabilityDays] = useState('Monday - Friday');
  const [availabilityHours, setAvailabilityHours] = useState('9:00 AM - 5:00 PM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Check if already completed onboarding
  useEffect(() => {
    if (currentUser?.verificationStatus === 'verified' || currentUser?.isVerified) {
      navigate('/consultant/dashboard');
    }
  }, [currentUser, navigate]);

  // 2. Fetch Supervising Doctors & Pharmacists for Section C
  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const docsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'consultant')));
        const doctorsList: { uid: string; fullName: string; prefix: string; pin: string }[] = [];
        const pharmacistsList: { uid: string; fullName: string; prefix: string; pin: string }[] = [];

        docsSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const uCadre = (d.cadre || '').toUpperCase();
          const item = {
            uid: docSnap.id,
            fullName: d.fullName || d.displayName || 'Consultant',
            prefix: d.prefix || 'Dr.',
            pin: d.councilPin || d.mdcPin || 'MDC-REG'
          };
          if (uCadre.includes('DOCTOR') || uCadre.includes('SPECIALIST')) {
            doctorsList.push(item);
          } else if (uCadre.includes('PHARMACIST')) {
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

  // 3. Draft Auto-Recovery & Persistence
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('pockettclinic_universal_onboarding_draft');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.step !== undefined) setStep(data.step);
        if (data.cadre) setCadre(data.cadre);
        if (data.pharmacistDegreeTrack) setPharmacistDegreeTrack(data.pharmacistDegreeTrack);
        if (data.degreeVerified !== undefined) setDegreeVerified(data.degreeVerified);
        if (data.degreeVerificationStatus) setDegreeVerificationStatus(data.degreeVerificationStatus);
        if (data.fullName) setFullName(data.fullName);
        if (data.prefix) setPrefix(data.prefix);
        if (data.phone) setPhone(data.phone);
        if (data.email) setEmail(data.email);
        if (data.profilePhoto) setProfilePhoto(data.profilePhoto);
        if (data.profilePhotoName) setProfilePhotoName(data.profilePhotoName);
        if (data.languages) setLanguages(data.languages);
        if (data.pin) setPin(data.pin);
        if (data.qualification) setQualification(data.qualification);
        if (data.degreeCertificateFile) setDegreeCertificateFile(data.degreeCertificateFile);
        if (data.degreeCertificateFileName) setDegreeCertificateFileName(data.degreeCertificateFileName);
        if (data.educationHistory) setEducationHistory(data.educationHistory);
        if (data.verifiedData) setVerifiedData(data.verifiedData);
        if (data.specialty) setSpecialty(data.specialty);
        if (data.supervisingPhysician) setSupervisingPhysician(data.supervisingPhysician);
        if (data.supervisingPharmacist) setSupervisingPharmacist(data.supervisingPharmacist);
        if (data.institution) setInstitution(data.institution);
        if (data.scopeOfServices) setScopeOfServices(data.scopeOfServices);
        if (data.ghanaCardNo) setGhanaCardNo(data.ghanaCardNo);
        if (data.indemnityPolicyNo) setIndemnityPolicyNo(data.indemnityPolicyNo);
        if (data.insuranceProvider) setInsuranceProvider(data.insuranceProvider);
        if (data.expiryDate) setExpiryDate(data.expiryDate);
        if (data.indemnityDocData) setIndemnityDocData(data.indemnityDocData);
        if (data.indemnityDocName) setIndemnityDocName(data.indemnityDocName);
        if (data.provideLater !== undefined) setProvideLater(data.provideLater);
        if (data.acceptFullPersonalLiability !== undefined) setAcceptFullPersonalLiability(data.acceptFullPersonalLiability);
        if (data.certifyCredentials !== undefined) setCertifyCredentials(data.certifyCredentials);
        if (data.assumeLiability !== undefined) setAssumeLiability(data.assumeLiability);
        if (data.indemnifyPlatform !== undefined) setIndemnifyPlatform(data.indemnifyPlatform);
        if (data.affirmIndependentContractor !== undefined) setAffirmIndependentContractor(data.affirmIndependentContractor);
        if (data.acceptedPlatformTerms !== undefined) setAcceptedPlatformTerms(data.acceptedPlatformTerms);
        if (data.acceptedPrivacyPolicy !== undefined) setAcceptedPrivacyPolicy(data.acceptedPrivacyPolicy);
        if (data.typedLegalSignature) setTypedLegalSignature(data.typedLegalSignature);
        if (data.availabilityDays) setAvailabilityDays(data.availabilityDays);
        if (data.availabilityHours) setAvailabilityHours(data.availabilityHours);
      } catch (e) {
        console.warn("Could not parse draft:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const draft = {
      step, cadre, pharmacistDegreeTrack, degreeVerified, degreeVerificationStatus,
      fullName, prefix, phone, email, profilePhoto, profilePhotoName, languages,
      pin, qualification, degreeCertificateFile, degreeCertificateFileName, educationHistory, verifiedData,
      specialty, supervisingPhysician, supervisingPharmacist, institution, scopeOfServices,
      ghanaCardNo, indemnityPolicyNo, insuranceProvider, expiryDate, indemnityDocData, indemnityDocName,
      provideLater, acceptFullPersonalLiability, certifyCredentials, assumeLiability, indemnifyPlatform,
      affirmIndependentContractor, acceptedPlatformTerms, acceptedPrivacyPolicy, typedLegalSignature,
      availabilityDays, availabilityHours
    };
    try {
      localStorage.setItem('pockettclinic_universal_onboarding_draft', JSON.stringify(draft));
    } catch (e) {
      console.warn("Storage quota exceeded for draft saving.");
    }
  }, [
    isLoaded, step, cadre, pharmacistDegreeTrack, degreeVerified, degreeVerificationStatus,
    fullName, prefix, phone, email, profilePhoto, profilePhotoName, languages,
    pin, qualification, degreeCertificateFile, degreeCertificateFileName, educationHistory, verifiedData,
    specialty, supervisingPhysician, supervisingPharmacist, institution, scopeOfServices,
    ghanaCardNo, indemnityPolicyNo, insuranceProvider, expiryDate, indemnityDocData, indemnityDocName,
    provideLater, acceptFullPersonalLiability, certifyCredentials, assumeLiability, indemnifyPlatform,
    affirmIndependentContractor, acceptedPlatformTerms, acceptedPrivacyPolicy, typedLegalSignature,
    availabilityDays, availabilityHours
  ]);

  // 4. Update Cadre-Dependent Options & Title Rules
  useEffect(() => {
    if (!cadre) return;
    const cfg = CADRE_CONFIGS[cadre];
    if (cfg) {
      // Set default scope of services if empty
      if (scopeOfServices.length === 0) {
        setScopeOfServices(cfg.scopeOfServices);
      }
      // Set default qualification if empty
      if (!qualification && cfg.qualificationOptions.length > 0) {
        setQualification(cfg.qualificationOptions[0]);
      }
      // Evaluate prefix rules
      const prefixRule = getPrefixOptions(cadre, pharmacistDegreeTrack as PharmacistDegreeTrack, degreeVerified);
      if (prefixRule.isFixed && prefixRule.defaultPrefix) {
        setPrefix(prefixRule.defaultPrefix);
      } else if (!prefixRule.options.includes(prefix)) {
        setPrefix(prefixRule.defaultPrefix || '');
      }
    }
  }, [cadre, pharmacistDegreeTrack, degreeVerified]);

  // 5. Automatic Registry Lookup for Pharmacist Degree Verification
  const verifyPharmacistDegreeTrack = async (track: PharmacistDegreeTrack, currentPin: string) => {
    setDegreeVerificationStatus('verifying');
    setPinLookupError('');

    if (track === 'B_PHARM') {
      setDegreeVerified(false);
      setDegreeVerificationStatus('verified_bpharm');
      setPrefix('Pharm.');
      return;
    }

    // PharmD track verification against Pharmacy Council registry
    if (currentPin.trim()) {
      try {
        const q = query(collection(db, 'council_registry'), where('councilPin', '==', currentPin.trim()));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const match = snap.docs[0].data();
          const registryQual = (match.qualification || match.specialty || match.degree || '').toUpperCase();
          const isPharmD = registryQual.includes('PHARMD') || registryQual.includes('PHARM_D') || registryQual.includes('DOCTOR');

          if (isPharmD || match.isGoodStanding !== false) {
            setDegreeVerified(true);
            setDegreeVerificationStatus('verified_pharmd');
            setPinAutofillSuccess(`✓ Pharmacy Council Registry match confirmed PharmD degree for ${match.fullName}. Title "Dr." option unlocked.`);
            return;
          }
        }
      } catch (err) {
        console.warn("Automatic PharmD lookup failed:", err);
      }
    }

    // Fallback if no registry match yet: route to degree certificate upload for manual admin review
    setDegreeVerified(false);
    setDegreeVerificationStatus('pending_manual_review');
    setPrefix('Pharm.');
  };

  const handleCadreChange = (newCadre: CadreType) => {
    setCadre(newCadre);
    setPharmacistDegreeTrack('');
    setDegreeVerified(false);
    setDegreeVerificationStatus('idle');
    setPrefix('');

    const cfg = CADRE_CONFIGS[newCadre];
    if (cfg) {
      setScopeOfServices(cfg.scopeOfServices);
      setQualification(cfg.qualificationOptions[0] || '');
      const pRule = getPrefixOptions(newCadre, null, false);
      if (pRule.defaultPrefix) {
        setPrefix(pRule.defaultPrefix);
      }
    }
  };

  const handlePharmacistDegreeTrackChange = (track: PharmacistDegreeTrack) => {
    setPharmacistDegreeTrack(track);
    verifyPharmacistDegreeTrack(track, pin);
  };

  // 6. Manual & Automated Registry PIN Verification
  const triggerPinVerification = async () => {
    if (!pin.trim()) {
      setPinLookupError('Please enter a professional Council PIN first.');
      return;
    }
    if (!cadre) {
      setPinLookupError('Please select your profession cadre first.');
      return;
    }

    setIsVerifyingPin(true);
    setPinLookupError('');
    setPinAutofillSuccess('');

    try {
      const q = query(collection(db, 'council_registry'), where('councilPin', '==', pin.trim()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const match = snap.docs[0].data() as any;
        setFullName(match.fullName);

        const vData: CouncilRegistryEntry & { registrationYear?: number; legalTitle?: string } = {
          councilPin: match.councilPin,
          fullName: match.fullName,
          cadre: cadre,
          isGoodStanding: match.isGoodStanding !== false,
          registryId: match.registryId || snap.docs[0].id,
          registrationYear: match.registrationYear || 2026,
          legalTitle: match.legalTitle || match.prefix || prefix
        };
        setVerifiedData(vData);

        if (cadre === 'PHARMACIST' && pharmacistDegreeTrack === 'PHARM_D') {
          const registryQual = (match.qualification || match.specialty || match.degree || '').toUpperCase();
          const isPharmD = registryQual.includes('PHARMD') || registryQual.includes('PHARM_D') || registryQual.includes('DOCTOR');
          if (isPharmD) {
            setDegreeVerified(true);
            setDegreeVerificationStatus('verified_pharmd');
          }
        }

        const isGood = match.isGoodStanding !== false;
        setPinAutofillSuccess(
          `✓ Registry Match Found! Loaded: ${match.fullName} (${CADRE_CONFIGS[cadre].label}). Status: ${isGood ? 'IN GOOD STANDING' : 'LICENSE EXPIRED / INACTIVE'}`
        );

        if (!isGood) {
          setPinLookupError('License status indicates Expired/Inactive. Please attach your renewal status document.');
        }
      } else {
        setPinLookupError('PIN not found in pre-loaded Council Registry. Upload your license certificate for manual admin verification below.');
        if (cadre === 'PHARMACIST' && pharmacistDegreeTrack === 'PHARM_D') {
          setDegreeVerified(false);
          setDegreeVerificationStatus('pending_manual_review');
          setPrefix('Pharm.');
        }
      }
    } catch (err) {
      console.error(err);
      setPinLookupError('Registry verification error. Manual upload for admin review will be used.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // 7. Handlers for File Uploads
  const handleProfilePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await processFileUpload(file, showToast);
        setProfilePhotoName(file.name);
        setProfilePhoto(data);
      } catch (err) {
        if (e.target) e.target.value = '';
      }
    }
  };

  const handleDegreeCertificateSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await processFileUpload(file, showToast);
        setDegreeCertificateFileName(file.name);
        setDegreeCertificateFile(data);
      } catch (err) {
        if (e.target) e.target.value = '';
      }
    }
  };

  const handleIndemnityDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await processFileUpload(file, showToast);
        setIndemnityDocName(file.name);
        setIndemnityDocData(data);
      } catch (err) {
        if (e.target) e.target.value = '';
      }
    }
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      if (languages.length === 1) {
        showToast('Please select at least one language.', 'warning');
        return;
      }
      setLanguages(languages.filter(l => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const toggleScope = (scope: string) => {
    if (scopeOfServices.includes(scope)) {
      if (scopeOfServices.length === 1) {
        showToast('Please keep at least one service in your scope of practice.', 'warning');
        return;
      }
      setScopeOfServices(scopeOfServices.filter(s => s !== scope));
    } else {
      setScopeOfServices([...scopeOfServices, scope]);
    }
  };

  // 8. Step Validation Checks
  const canProceedStep0 = Boolean(
    cadre && (cadre !== 'PHARMACIST' || pharmacistDegreeTrack)
  );

  const canProceedStep1 = Boolean(
    fullName.trim() &&
    prefix &&
    phone.trim() &&
    email.trim() &&
    (currentUser || password.length >= 6) &&
    profilePhoto &&
    pin.trim() &&
    qualification &&
    degreeCertificateFile &&
    educationHistory.trim()
  );

  const canProceedStep2 = Boolean(
    institution.trim() &&
    scopeOfServices.length > 0 &&
    (cadre !== 'SPECIALIST' || specialty) &&
    (cadre !== 'PHYSICIAN_ASSISTANT' || supervisingPhysician) &&
    (cadre !== 'PHARM_TECH' || supervisingPharmacist) &&
    ghanaCardNo.trim() &&
    indemnityPolicyNo.trim() &&
    insuranceProvider.trim() &&
    expiryDate &&
    (indemnityDocData || (provideLater && acceptFullPersonalLiability))
  );

  const canSubmitFinalStep = Boolean(
    certifyCredentials &&
    assumeLiability &&
    indemnifyPlatform &&
    affirmIndependentContractor &&
    acceptedPlatformTerms &&
    acceptedPrivacyPolicy &&
    typedLegalSignature.trim().toLowerCase() === fullName.trim().toLowerCase()
  );

  // 9. Final Submission Handler
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmitFinalStep) {
      showToast('Please accept all required legal terms and type your exact legal signature matching your name.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      let targetUser: any = currentUser;

      // If user is not authenticated, sign up first
      if (!targetUser) {
        try {
          await signUpWithEmail(email.trim(), password, fullName.trim(), 'consultant');
          targetUser = auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email || email.trim() } : null;
        } catch (authErr: any) {
          showToast(`Account creation failed: ${authErr.message}`, 'error');
          setIsSubmitting(false);
          return;
        }
      }

      const uid = targetUser?.uid || auth.currentUser?.uid;
      if (!uid) {
        throw new Error("Could not determine user session ID.");
      }

      const cfg = CADRE_CONFIGS[cadre as CadreType];

      const profilePayload = {
        uid: uid,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        prefix: prefix,
        email: email.trim(),
        phone: phone.trim(),
        role: 'consultant' as const,
        cadre: cadre,
        pharmacistDegreeTrack: pharmacistDegreeTrack || null,
        degreeVerified: degreeVerified,
        councilPin: pin.trim(),
        governingCouncil: cfg.governingCouncil,
        qualification: qualification,
        degreeCertificateUrl: degreeCertificateFile,
        educationHistory: educationHistory.trim(),
        profilePhotoUrl: profilePhoto,
        photoURL: profilePhoto,
        languages: languages,
        institution: institution.trim(),
        specialty: cadre === 'SPECIALIST' ? specialty : null,
        supervisingPhysician: cadre === 'PHYSICIAN_ASSISTANT' ? supervisingPhysician : null,
        supervisingPharmacist: cadre === 'PHARM_TECH' ? supervisingPharmacist : null,
        scopeOfServices: scopeOfServices,
        ghanaCardNo: ghanaCardNo.trim(),
        indemnityPolicyNumber: indemnityPolicyNo.trim(),
        indemnityInsuranceProvider: insuranceProvider.trim(),
        indemnityExpiryDate: expiryDate,
        indemnityProofUrl: indemnityDocData || null,
        indemnityProvideLater: provideLater,
        legalSignature: typedLegalSignature.trim(),
        availabilityDays: availabilityDays,
        availabilityHours: availabilityHours,
        isVerified: false,
        verificationStatus: (degreeVerified ? 'verified' : 'pending') as 'verified' | 'pending',
        verificationPendingReview: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // Save to Firestore users collection
      await setDoc(doc(db, 'users', uid), profilePayload, { merge: true });

      // Clear local storage onboarding draft
      localStorage.removeItem('pockettclinic_universal_onboarding_draft');

      showToast("Professional Profile Submitted Successfully! Your profile is pending final Council/Admin sign-off.", "success");
      
      if (updateUserProfile) {
        await updateUserProfile(profilePayload);
      }

      navigate('/consultant/dashboard');
    } catch (err: any) {
      console.error("Submission error:", err);
      showToast(`Profile submission failed: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const prefixRule = getPrefixOptions(cadre as CadreType, pharmacistDegreeTrack as PharmacistDegreeTrack, degreeVerified);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="max-w-4xl mx-auto text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-400 text-xs font-black uppercase tracking-widest">
          <ShieldCheck size={14} /> Universal Consultant Onboarding Profile
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
          PockettClinic Professional Registration
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto font-medium">
          Complete your verified clinical credentials to offer consultations, e-prescriptions, and specialist care on the platform.
        </p>
      </div>

      {/* Progress Wizard Indicator */}
      <div className="max-w-4xl mx-auto mb-10">
        <div className="grid grid-cols-4 gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700/80">
          {[
            { stepNum: 0, label: '0. Profession Cadre' },
            { stepNum: 1, label: '1. Identity & Credentials' },
            { stepNum: 2, label: '2. Practice & Compliance' },
            { stepNum: 3, label: '3. Legal & Consent' }
          ].map((s) => (
            <button
              key={s.stepNum}
              type="button"
              disabled={s.stepNum > step}
              onClick={() => setStep(s.stepNum as any)}
              className={`py-3 px-2 rounded-xl text-center text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                step === s.stepNum
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                  : step > s.stepNum
                  ? 'bg-slate-700/60 text-emerald-400 hover:bg-slate-700'
                  : 'text-slate-500 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form Container */}
      <div className="max-w-4xl mx-auto bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-md">
        
        {/* STEP 0: PROFESSION SELECTION */}
        {step === 0 && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="border-b border-slate-700 pb-4">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Step 0 — Explicit Cadre Selection</span>
              <h2 className="text-xl font-bold text-white mt-1">Select Your Professional Practice Cadre</h2>
              <p className="text-xs text-slate-400 mt-1">
                This choice governs your licensing council verification, allowable credentials, title options, and scope of practice.
              </p>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                Primary Profession Cadre <span className="text-rose-400">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(Object.keys(CADRE_CONFIGS) as CadreType[]).filter((k) => k !== 'UNASSIGNED').map((cKey) => {
                  const cfg = CADRE_CONFIGS[cKey];
                  const isSelected = cadre === cKey;
                  return (
                    <button
                      key={cKey}
                      type="button"
                      onClick={() => handleCadreChange(cKey)}
                      className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-950/50'
                          : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-750 hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black uppercase tracking-wider ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {cfg.label}
                          </span>
                          {isSelected && <CheckCircle2 size={16} className="text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Council: {cfg.governingCouncil}
                        </p>
                      </div>

                      <div className="text-[9px] bg-slate-800/80 px-2.5 py-1 rounded-lg text-slate-400 border border-slate-700 font-mono">
                        PIN Format: {cfg.pinFormatExample}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PHARMACIST DEGREE TRACK FOLLOW-UP */}
            {cadre === 'PHARMACIST' && (
              <div className="bg-emerald-950/40 border border-emerald-800/50 p-6 rounded-2xl space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-emerald-400 border-b border-emerald-800/40 pb-3">
                  <Award size={18} />
                  <h3 className="text-sm font-black uppercase tracking-wider">Pharmacist Qualification & Degree Track Verification</h3>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Select Your Specific Pharmacy Degree Track <span className="text-rose-400">*</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handlePharmacistDegreeTrackChange('PHARM_D')}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        pharmacistDegreeTrack === 'PHARM_D'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xs font-black uppercase tracking-wider block">Doctor of Pharmacy (PharmD)</span>
                      <span className="text-[10px] opacity-80 mt-1 block">Requires Pharmacy Council verification or degree upload for "Dr." title entitlement.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePharmacistDegreeTrackChange('B_PHARM')}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        pharmacistDegreeTrack === 'B_PHARM'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xs font-black uppercase tracking-wider block">Bachelor of Pharmacy (BPharm)</span>
                      <span className="text-[10px] opacity-80 mt-1 block">Title entitlement: "Pharm."</span>
                    </button>
                  </div>
                </div>

                {/* DEGREE VERIFICATION STATUS NOTICE */}
                {pharmacistDegreeTrack === 'PHARM_D' && (
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex items-center gap-2">
                      {degreeVerificationStatus === 'verifying' && <Loader2 className="animate-spin text-emerald-400" size={16} />}
                      {degreeVerificationStatus === 'verified_pharmd' && <CheckCircle2 className="text-emerald-400" size={16} />}
                      {degreeVerificationStatus === 'pending_manual_review' && <AlertCircle className="text-amber-400" size={16} />}
                      <span className="text-xs font-black text-slate-200 uppercase tracking-wider">
                        {degreeVerificationStatus === 'verifying' && 'Checking Pharmacy Council Registry...'}
                        {degreeVerificationStatus === 'verified_pharmd' && 'PharmD Degree Verified via Council Registry'}
                        {degreeVerificationStatus === 'pending_manual_review' && 'PharmD Pending Manual Admin Degree Verification'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {degreeVerificationStatus === 'verified_pharmd' && (
                        'Your PharmD degree status is verified. In Section A, you may choose either "Dr." or "Pharm." as your professional title.'
                      )}
                      {degreeVerificationStatus === 'pending_manual_review' && (
                        'Automated registry match could not confirm PharmD. Please upload your degree certificate in Section B for manual admin review. Until verified, your prefix defaults safely to "Pharm."'
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-700">
              <button
                type="button"
                disabled={!canProceedStep0}
                onClick={() => setStep(1)}
                className={`px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  canProceedStep0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 cursor-pointer'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Proceed to Identity & Credentials <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: IDENTITY (SECTION A) & CREDENTIALS (SECTION B) */}
        {step === 1 && (
          <div className="space-y-10 animate-in fade-in duration-300">
            
            {/* SECTION A — Identity & Contact */}
            <div className="space-y-6">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Section A</span>
                  <h2 className="text-lg font-bold text-white">Identity & Contact Details</h2>
                </div>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-3 py-1 rounded-full font-mono">Universal Fields</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Full Legal Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Kwame Mensah Appiah"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Professional Title / Prefix <span className="text-rose-400">*</span>
                  </label>

                  {prefixRule.options.length > 1 ? (
                    <select
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- Select Preferred Title --</option>
                      {prefixRule.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-emerald-400 flex items-center justify-between">
                      <span>{prefix || prefixRule.defaultPrefix}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Fixed by Cadre</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400">
                    {cadre === 'PHARMACIST' && degreeVerified
                      ? 'Verified PharmD graduate: You may select either "Dr." or "Pharm." based on your personal preference.'
                      : 'Prefix option is strictly mapped to your verified cadre status.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Phone Number (WhatsApp Active) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. +233 24 123 4567"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="doctor@example.com"
                  />
                </div>

                {!currentUser && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                      Account Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none pr-10"
                        placeholder="Min 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Profile Photo <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 border border-slate-600">
                        <UserCircle size={28} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-black uppercase tracking-wider rounded-xl text-white transition-colors flex items-center gap-2"
                    >
                      <Upload size={14} /> Upload Photo
                    </button>
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Languages Spoken <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_LANGUAGES.map((lang) => {
                      const isSelected = languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION B — Professional Credentials */}
            <div className="space-y-6 pt-6 border-t border-slate-700">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Section B</span>
                  <h2 className="text-lg font-bold text-white">Professional Council Credentials</h2>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full font-mono">
                  {cadre ? CADRE_CONFIGS[cadre as CadreType].governingCouncil : 'Council Verification'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Regulatory PIN / Registration Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                      placeholder={cadre ? CADRE_CONFIGS[cadre as CadreType].pinFormatExample : 'e.g. MDC/RN/2026/001'}
                    />
                    <button
                      type="button"
                      disabled={isVerifyingPin}
                      onClick={triggerPinVerification}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      {isVerifyingPin ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                      Verify PIN
                    </button>
                  </div>

                  {pinAutofillSuccess && (
                    <p className="text-xs text-emerald-400 bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40 mt-2 font-medium">
                      {pinAutofillSuccess}
                    </p>
                  )}

                  {pinLookupError && (
                    <p className="text-xs text-amber-400 bg-amber-950/40 p-3 rounded-xl border border-amber-800/40 mt-2 font-medium">
                      {pinLookupError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Highest Qualification <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {cadre && CADRE_CONFIGS[cadre as CadreType].qualificationOptions.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Degree Certificate PDF / Scan <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => degreeCertInputRef.current?.click()}
                      className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-xs font-black uppercase tracking-wider rounded-xl text-white transition-colors flex items-center gap-2 w-full justify-center"
                    >
                      <Upload size={14} /> {degreeCertificateFileName || 'Upload Degree Certificate'}
                    </button>
                    <input
                      ref={degreeCertInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleDegreeCertificateSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Education & Professional Training History <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={educationHistory}
                    onChange={(e) => setEducationHistory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Provide your university, residency, or clinical attachment milestones..."
                  />
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Back to Cadre Selection
              </button>
              <button
                type="button"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className={`px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  canProceedStep1
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 cursor-pointer'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Proceed to Practice & Compliance <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PRACTICE DETAILS (SECTION C) & COMPLIANCE/INSURANCE (SECTION D) */}
        {step === 2 && (
          <div className="space-y-10 animate-in fade-in duration-300">
            
            {/* SECTION C — Practice Details */}
            <div className="space-y-6">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Section C</span>
                  <h2 className="text-lg font-bold text-white">Practice Details & Supervision</h2>
                </div>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-3 py-1 rounded-full font-mono">Cadre-Conditional Fields</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Specialty (SPECIALIST only) */}
                {cadre === 'SPECIALIST' && (
                  <div className="space-y-2 md:col-span-2 bg-emerald-950/40 p-4 rounded-xl border border-emerald-800/40">
                    <label className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                      Medical Specialty <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- Select Specialty --</option>
                      {SPECIALTY_OPTIONS.map((spec) => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Supervising Physician (PHYSICIAN_ASSISTANT only) */}
                {cadre === 'PHYSICIAN_ASSISTANT' && (
                  <div className="space-y-2 md:col-span-2 bg-emerald-950/40 p-4 rounded-xl border border-emerald-800/40">
                    <label className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                      Supervising Doctor <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={supervisingPhysician}
                      onChange={(e) => setSupervisingPhysician(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- Select Verified Supervising Physician --</option>
                      {verifiedDoctors.map((doc) => (
                        <option key={doc.uid} value={doc.fullName}>
                          {doc.prefix} {doc.fullName} ({doc.pin})
                        </option>
                      ))}
                      <option value="Direct Hospital Medical Board Supervision">Direct Hospital Medical Board Supervision</option>
                    </select>
                  </div>
                )}

                {/* Supervising Pharmacist (PHARM_TECH only) */}
                {cadre === 'PHARM_TECH' && (
                  <div className="space-y-2 md:col-span-2 bg-emerald-950/40 p-4 rounded-xl border border-emerald-800/40">
                    <label className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                      Supervising Pharmacist <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={supervisingPharmacist}
                      onChange={(e) => setSupervisingPharmacist(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- Select Verified Supervising Pharmacist --</option>
                      {verifiedPharmacists.map((pharm) => (
                        <option key={pharm.uid} value={pharm.fullName}>
                          {pharm.prefix} {pharm.fullName} ({pharm.pin})
                        </option>
                      ))}
                      <option value="Supervising Pharmacy Superintendent">Supervising Pharmacy Superintendent</option>
                    </select>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    {cadre ? CADRE_CONFIGS[cadre as CadreType].institutionLabel : 'Institution / Affiliation'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Korle-Bu Teaching Hospital / TopCare Pharmacy"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Scope of Services Offered <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cadre && CADRE_CONFIGS[cadre as CadreType].scopeOfServices.map((scope) => {
                      const isSelected = scopeOfServices.includes(scope);
                      return (
                        <button
                          key={scope}
                          type="button"
                          onClick={() => toggleScope(scope)}
                          className={`p-3 rounded-xl border text-left text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <span>{scope}</span>
                          {isSelected && <CheckCircle2 size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION D — Compliance & Insurance */}
            <div className="space-y-6 pt-6 border-t border-slate-700">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Section D</span>
                  <h2 className="text-lg font-bold text-white">Compliance & Professional Indemnity Insurance</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Ghana Card Identification Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ghanaCardNo}
                    onChange={(e) => setGhanaCardNo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    placeholder="GHA-000000000-0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Indemnity Policy Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={indemnityPolicyNo}
                    onChange={(e) => setIndemnityPolicyNo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    placeholder="IND-2026-XXXX"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Insurance Provider <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Star Assurance Ghana"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Policy Expiry Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Indemnity Certificate Upload / Deferred Waiver
                  </label>
                  
                  {!provideLater ? (
                    <button
                      type="button"
                      onClick={() => indemnityInputRef.current?.click()}
                      className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-xs font-black uppercase tracking-wider rounded-xl text-white transition-colors flex items-center justify-center gap-2 w-full"
                    >
                      <Upload size={14} /> {indemnityDocName || 'Upload Indemnity Policy Certificate'}
                    </button>
                  ) : (
                    <div className="bg-amber-950/40 border border-amber-800/50 p-4 rounded-xl space-y-3">
                      <p className="text-xs text-amber-300 font-medium leading-relaxed">
                        You have chosen to provide your formal indemnity certificate later. To proceed, you must accept full personal legal liability for all clinical advice and e-prescriptions issued prior to document upload.
                      </p>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptFullPersonalLiability}
                          onChange={(e) => setAcceptFullPersonalLiability(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-bold text-slate-200">
                          I assume full personal legal liability until indemnity certificate is uploaded.
                        </span>
                      </label>
                    </div>
                  )}

                  <input
                    ref={indemnityInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleIndemnityDocSelect}
                    className="hidden"
                  />

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={provideLater}
                        onChange={(e) => setProvideLater(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-600"
                      />
                      <span>Provide indemnity certificate later (requires personal liability waiver above)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Back to Identity & Credentials
              </button>
              <button
                type="button"
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
                className={`px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  canProceedStep2
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 cursor-pointer'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Proceed to Legal & Consent <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LEGAL CONSENT (SECTION E) & AVAILABILITY (SECTION F) */}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit} className="space-y-10 animate-in fade-in duration-300">
            
            {/* SECTION E — Legal Consent */}
            <div className="space-y-6">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Section E</span>
                  <h2 className="text-lg font-bold text-white">Legal Consent & Affirmations</h2>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full font-mono">Mandatory Affirmations</span>
              </div>

              <div className="space-y-3 bg-slate-900/80 p-5 rounded-2xl border border-slate-700">
                {[
                  { state: certifyCredentials, setState: setCertifyCredentials, label: 'I certify that all professional credentials, PIN numbers, and uploaded certificates are complete, accurate, and valid.' },
                  { state: assumeLiability, setState: setAssumeLiability, label: 'I assume full professional and legal liability for all clinical evaluations, SOAP notes, and e-prescriptions generated under my profile.' },
                  { state: indemnifyPlatform, setState: setIndemnifyPlatform, label: 'I agree to indemnify and hold harmless PockettClinic and its operating entities from any claims arising out of clinical practice negligence.' },
                  { state: affirmIndependentContractor, setState: setAffirmIndependentContractor, label: 'I affirm my status as an independent consultant rendering professional services under council regulation.' },
                  { 
                    state: acceptedPlatformTerms, 
                    setState: setAcceptedPlatformTerms, 
                    label: 'I accept the PockettClinic Platform Terms of Service',
                    link: () => { setLegalModalTab('tos'); setLegalModalOpen(true); }
                  },
                  { 
                    state: acceptedPrivacyPolicy, 
                    setState: setAcceptedPrivacyPolicy, 
                    label: 'I accept the PockettClinic Professional Privacy Policy',
                    link: () => { setLegalModalTab('privacy'); setLegalModalOpen(true); }
                  }
                ].map((item, idx) => (
                  <label key={idx} className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-slate-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.setState(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-300 font-medium leading-relaxed">
                      {item.label}{' '}
                      {item.link && (
                        <button
                          type="button"
                          onClick={item.link}
                          className="text-emerald-400 hover:underline font-bold inline-block ml-1"
                        >
                          [Read Document]
                        </button>
                      )}
                    </span>
                  </label>
                ))}

                <div className="pt-4 border-t border-slate-700 space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Typed Legal Signature (Must match "{fullName || 'Full Legal Name'}") <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={typedLegalSignature}
                    onChange={(e) => setTypedLegalSignature(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder={`Type "${fullName || 'Full Legal Name'}" exactly`}
                  />
                </div>
              </div>
            </div>

            {/* SECTION F — Availability & Account Setup */}
            <div className="space-y-6 pt-6 border-t border-slate-700">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Section F</span>
                  <h2 className="text-lg font-bold text-white">Availability & Account Setup</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Standard Availability Days <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={availabilityDays}
                    onChange={(e) => setAvailabilityDays(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Monday - Friday, Weekends"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Standard Availability Hours <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={availabilityHours}
                    onChange={(e) => setAvailabilityHours(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. 9:00 AM - 5:00 PM GMT"
                  />
                </div>
              </div>
            </div>

            {/* Final Submission Button */}
            <div className="flex justify-between pt-6 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Back to Practice & Compliance
              </button>

              <button
                type="submit"
                disabled={!canSubmitFinalStep || isSubmitting}
                className={`px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${
                  canSubmitFinalStep && !isSubmitting
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/60 cursor-pointer'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                Submit Verified Profile
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Legal Documents Modal */}
      <LegalDocumentsModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        defaultTab={legalModalTab}
      />
    </div>
  );
}
