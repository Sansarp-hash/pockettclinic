export type CadreType = 
  | 'DOCTOR' 
  | 'SPECIALIST' 
  | 'PHYSICIAN_ASSISTANT' 
  | 'PHARMACIST' 
  | 'PHARM_TECH'
  | 'UNASSIGNED';

export type PharmacistDegreeTrack = 'PHARM_D' | 'B_PHARM';

export interface CadreConfig {
  id: CadreType;
  label: string;
  governingCouncil: string;
  pinFormatExample: string;
  pinRegex: RegExp;
  qualificationOptions: string[];
  institutionLabel: string;
  scopeOfServices: string[];
  requiresSpecialty?: boolean;
  requiresSupervisingPhysician?: boolean;
  requiresSupervisingPharmacist?: boolean;
}

export const CADRE_CONFIGS: Record<CadreType, CadreConfig> = {
  DOCTOR: {
    id: 'DOCTOR',
    label: 'Doctor',
    governingCouncil: 'Medical & Dental Council (MDC Ghana)',
    pinFormatExample: 'MDC/RN/2026/xxxx',
    pinRegex: /^MDC\/RN\/\d{4}\/\d{3,6}$/i,
    qualificationOptions: ['MBChB', 'MD'],
    institutionLabel: 'Hospital / Clinic',
    scopeOfServices: [
      'Video/audio consultation',
      'SOAP notes',
      'e-Prescribing',
      'Specialist referral'
    ]
  },
  SPECIALIST: {
    id: 'SPECIALIST',
    label: 'Specialist',
    governingCouncil: 'Medical & Dental Council (MDC Ghana)',
    pinFormatExample: 'MDC/SP/2026/xxxx',
    pinRegex: /^MDC\/SP\/\d{4}\/\d{3,6}$/i,
    qualificationOptions: ['MBChB + Specialist Fellowship/Residency', 'MD + Specialist Fellowship/Residency'],
    institutionLabel: 'Hospital / Specialist Center',
    scopeOfServices: [
      'Video/audio consultation',
      'SOAP notes',
      'e-Prescribing',
      'Specialist referral'
    ],
    requiresSpecialty: true
  },
  PHYSICIAN_ASSISTANT: {
    id: 'PHYSICIAN_ASSISTANT',
    label: 'Physician Assistant (PA)',
    governingCouncil: 'Medical & Dental Council (MDC Ghana)',
    pinFormatExample: 'MDC/PA/2026/xxxx',
    pinRegex: /^MDC\/PA\/\d{4}\/\d{3,6}$/i,
    qualificationOptions: ['BSc Physician Assistantship', 'MSc Physician Assistant Studies'],
    institutionLabel: 'Hospital / Clinic',
    scopeOfServices: [
      'Video/audio consultation',
      'SOAP notes',
      'e-Prescribing (within supervising scope)'
    ],
    requiresSupervisingPhysician: true
  },
  PHARMACIST: {
    id: 'PHARMACIST',
    label: 'Pharmacist',
    governingCouncil: 'Pharmacy Council Ghana',
    pinFormatExample: 'PCG/PH/2026/xxxx',
    pinRegex: /^PCG\/PH\/\d{4}\/\d{3,6}$/i,
    qualificationOptions: ['Doctor of Pharmacy (PharmD)', 'Bachelor of Pharmacy (BPharm)'],
    institutionLabel: 'Pharmacy / Dispensary',
    scopeOfServices: [
      'Prescription verification',
      'Patient counseling',
      'Drug safety review',
      'Dispensing team oversight'
    ]
  },
  PHARM_TECH: {
    id: 'PHARM_TECH',
    label: 'Pharmacy Technician',
    governingCouncil: 'Pharmacy Council Ghana',
    pinFormatExample: 'PCG/PT/2026/xxxx',
    pinRegex: /^PCG\/PT\/\d{4}\/\d{3,6}$/i,
    qualificationOptions: ['Diploma in Pharmacy Technology', 'HND Pharmacy Technology'],
    institutionLabel: 'Pharmacy / Dispensary',
    scopeOfServices: [
      'OTC counseling',
      'Refill processing',
      'Dispensation logging',
      'Drug safety checks (non-verification)'
    ],
    requiresSupervisingPharmacist: true
  },
  UNASSIGNED: {
    id: 'UNASSIGNED',
    label: 'Unassigned Consultant',
    governingCouncil: 'Pending Selection',
    pinFormatExample: 'Pending Verification',
    pinRegex: /^.+$/i,
    qualificationOptions: ['Pending Selection'],
    institutionLabel: 'Hospital / Clinic',
    scopeOfServices: ['Pending Selection']
  }
};

export interface PrefixOptionResult {
  options: string[];
  defaultPrefix: string | null;
  isFixed: boolean;
}

export function getPrefixOptions(
  cadre: CadreType | null | undefined,
  degreeTrack?: PharmacistDegreeTrack | null,
  degreeVerified?: boolean
): PrefixOptionResult {
  if (!cadre) {
    return { options: [], defaultPrefix: null, isFixed: false };
  }

  switch (cadre) {
    case 'DOCTOR':
    case 'SPECIALIST':
      return { options: ['Dr.', 'Prof.', 'None'], defaultPrefix: 'Dr.', isFixed: false };

    case 'PHYSICIAN_ASSISTANT':
      return { options: ['PA', 'None'], defaultPrefix: 'None', isFixed: false };

    case 'PHARM_TECH':
      return { options: ['Pharm. Tech.', 'None'], defaultPrefix: 'None', isFixed: false };

    case 'PHARMACIST': {
      if (degreeTrack === 'PHARM_D') {
        if (degreeVerified) {
          // Both options offered, none pre-selected
          return { options: ['Dr.', 'Pharm.', 'None'], defaultPrefix: null, isFixed: false };
        } else {
          // Pending verification or unverified: Pharm. only
          return { options: ['Pharm.', 'None'], defaultPrefix: 'Pharm.', isFixed: false };
        }
      }
      // B_PHARM or unselected degree track: Pharm. only
      return { options: ['Pharm.', 'None'], defaultPrefix: 'Pharm.', isFixed: false };
    }

    default:
      return { options: [], defaultPrefix: null, isFixed: false };
  }
}

export const SPECIALTY_OPTIONS = [
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Obstetrics & Gynaecology',
  'Psychiatry',
  'Neurology',
  'Orthopedics',
  'Endocrinology',
  'Gastroenterology',
  'Ophthalmology',
  'ENT (Ear, Nose, Throat)',
  'Urology',
  'Oncology'
];

export const ALL_LANGUAGES = [
  'English',
  'Twi (Akan)',
  'Ga',
  'Ewe',
  'Fante',
  'Dagbani',
  'Hausa',
  'French'
];

/**
 * Normalizes legacy cadre strings (e.g. 'DOCTOR_GENERAL', 'Doctor') to unified CadreType
 */
export function normalizeCadre(rawCadre?: string): CadreType {
  if (!rawCadre) return 'UNASSIGNED';
  const norm = rawCadre.toUpperCase().trim().replace(/[\s-]+/g, '_');
  
  if (norm === 'UNASSIGNED' || norm === 'NONE' || norm === 'PENDING') return 'UNASSIGNED';
  if (norm.includes('SPECIALIST')) return 'SPECIALIST';
  if (norm.includes('DOCTOR')) return 'DOCTOR';
  if (norm.includes('PHYSICIAN') || norm === 'PA') return 'PHYSICIAN_ASSISTANT';
  if (norm.includes('TECH')) return 'PHARM_TECH';
  if (norm.includes('PHARM')) return 'PHARMACIST';
  
  return 'UNASSIGNED';
}
