export type Role = 'patient' | 'consultant' | 'public' | 'admin' | 'super_admin' | 'unassigned';

export const isConsultantRole = (role: string | undefined): boolean => {
  const r = (role || '').toLowerCase();
  return r === 'consultant';
};

export type PatientSubscriptionTier = 'pay_as_you_go' | 'care_plus';
export type ConsultantSubscriptionTier = 'verified_consultant' | 'pro_partner';
export type SubscriptionTier = PatientSubscriptionTier | ConsultantSubscriptionTier;

export interface ReschedulingTicket {
  ticketId: string;
  patientId: string;
  patientName: string;
  originalSessionId: string;
  consultantId?: string;
  consultantName?: string;
  reason: 'failed_session' | 'manual_issue';
  status: 'active' | 'used' | 'revoked';
  valueGHS: number;
  remainingGHS: number;
  issuedAt: string;
  revokedAt?: string;
  usedAt?: string;
  expiresAt: string;
  notes?: string;
}

export interface UserProfile {
  uid: string;
  id?: string;
  memberId?: string;
  displayId?: string;
  memberNumber?: number;
  role: Role;
  email: string;
  displayName: string;
  name?: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  photoURL?: string;
  createdAt: string;
  isOnline?: boolean;
  activeSessionId?: string | null;
  lastActiveAt?: string;
  ghanaCardNo?: string;
  ghanaCardNumber?: string;
  licenseNo?: string;
  indemnityPolicyNo?: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  indemnityAgreed?: boolean;
  preferredLanguage?: string;
  walletBalanceGHS?: number;
  payoutBank?: string;
  payoutAccount?: string;
  availabilityDays?: string[] | string;
  availabilityHours?: string;
  pharmacistDegreeTrack?: string | null;
  degreeVerified?: boolean;

  // Legal Disclaimers & Status Affirmations
  hasAcceptedCareTerms?: boolean;
  independentContractorAffirmed?: boolean;
  contractorAffirmedAt?: string;
  indemnityStatus?: 'PENDING_UPLOAD' | 'PERSONAL_LIABILITY_ACCEPTED' | 'VERIFIED' | 'deferred_pending' | 'provided';
  legalSignature?: string;
  
  verificationStatus?: 'verified' | 'pending' | 'unverified' | 'deferred_pending' | 'all';
  hasAcceptedGlobalTerms?: boolean;
  indemnityDocUrl?: string; // For manual review document
  profilePhotoUrl?: string; // For professional identification
  
  // Profile properties
  councilPin?: string;
  cadre?: 'DOCTOR' | 'PHARMACIST' | 'PHYSICIAN_ASSISTANT' | 'PHARM_TECH' | 'SPECIALIST' | 'UNASSIGNED' | string;
  specialty?: string;
  indemnityInsuranceProvider?: string;
  indemnityExpiryDate?: string;
  bio?: string;
  isVerified?: boolean;
  verificationPendingReview?: boolean;
  pendingProfileChanges?: {
    displayName?: string;
    prefix?: string;
    qualification?: string;
    councilPin?: string;
    manualReviewFile?: string;
    [key: string]: any;
  };
  
  // Face-to-Face Review
  reviewScheduledAt?: string;
  reviewLink?: string;
  notificationSent?: boolean;
  reviewTermsAcceptedAt?: string;

  // Account Status & Deletion Workflow
  accountStatus?: 'active' | 'pending_deletion' | 'suspended' | 'purged';
  deletionRequestedAt?: string;
  deletionReason?: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  settings?: any;
  tickets?: any[];
  prefix?: string;
  qualification?: string;

  // Subscription Tiers & Credits
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: 'active' | 'cancelled' | 'expired' | 'free';
  subscriptionExpiresAt?: string;
  subscriptionAutoRenew?: boolean;
  autoRenew?: boolean;
  videoChatTickets?: number;
  paystackAuthorizationCode?: string;
  pushNotificationsEnabled?: boolean;
}

export type User = UserProfile;

export interface AccountDeletionRequest {
  requestId: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: Role;
  userRole?: Role;
  cadre?: string;
  reason: string;
  details?: string;
  feedback?: string;
  status: 'pending_admin_approval' | 'approved_and_purged' | 'rejected' | 'pending' | 'approved';
  requestedAt: string;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByEmail?: string;
  rejectionReason?: string;
  reviewNotes?: string;
  statsSummary?: {
    totalConsultations?: number;
    totalPrescriptions?: number;
    walletBalanceGHS?: number;
  };
}

export interface MedicalDocument {
  docId: string;
  patientId: string;
  name: string;
  type: string;
  size: number;
  url: string; // base64 or storage url
  uploadedAt: string;
}

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

// 1. Council Consultant Directory (Pre-loaded for auto-fill)
export interface CouncilRegistryEntry {
  registryId: string;
  councilPin: string;             // e.g., "PA 4821", "MDC/RN/1029", "PT 0912"
  fullName: string;
  cadre: 'DOCTOR' | 'PHARMACIST' | 'PHYSICIAN_ASSISTANT' | 'PHARM_TECH' | 'SPECIALIST' | string;
  specialty?: string;
  isGoodStanding: boolean;
  registrationYear?: number;
}

// 2. Consultant Account
export interface ConsultantProfile extends UserProfile {
  councilPin: string;
  cadre: 'DOCTOR' | 'PHARMACIST' | 'PHYSICIAN_ASSISTANT' | 'PHARM_TECH' | 'SPECIALIST' | 'UNASSIGNED' | string;
  ghanaCardId: string;
  indemnityPolicyNo?: string;
  payoutMomoNumber: string;
  paystackSubaccountCode: string; // Enables automated fee splitting
  consultationFeeGHS: number;
  isOnline: boolean;
  termsAccepted: boolean;
  termsAcceptedAt: string;        // ISO Timestamp
  indemnityAgreed: boolean;
  signatureDataUrl: string;
  languages?: string[];
  
  // Professional Portfolio & Trust Builder
  degrees?: string[];
  educationHistory?: string;
  pastWorkHistory?: string;
  professionalBio?: string;
  
  // UI Helpers (can be moved or kept optional if not strictly from DB)
  rating?: number;
  reviews?: number;
  availability?: string;
  availabilitySchedule?: { day: string; isAvailable: boolean; slots: string[] }[];
}

// 3. Consultation Session
export interface ConsultationSession {
  sessionId: string;
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  consultantId: string;
  consultantName: string;
  consultantPrefix?: string;
  assignedConsultantId?: string | null;
  declinedBy?: string[];
  dispatchStatus?: 'ringing' | 'accepted' | 're-routing' | 'escalated' | 'scheduled';
  bookingType?: 'INSTANT' | 'SCHEDULED';
  ringingStartedAt?: number | string | null;
  ringingExpiresAt?: number | string | null;
  connectionStartedAt?: any;
  acceptedAt?: string;
  startedAt?: string;
  tierDurationMinutes?: number;
  cadreNeeded?: 'DOCTOR' | 'PHARMACIST' | 'PHYSICIAN_ASSISTANT' | 'PHARM_TECH' | 'SPECIALIST' | string;
  specialtyNeeded?: string;
  sessionType?: 'AUDIO_ONLY' | 'VIDEO' | 'CHAT_ONLY';
  type?: 'chat' | 'video';
  status: 'PENDING' | 'ACCEPTED' | 'PAID' | 'IN_PROGRESS' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'CANCELLED_BY_USER' | 'CANCELLED_BY_CONSULTANT' | 'INCONCLUSIVE' | 'CLINICAL_ESCALATION' | 'TERMINATED_SYSTEM_FAILURE' | 'TICKET_ISSUED' | 'MISSED' | 'FAILED';
  roomId: string;                 // WebRTC / Daily.co / Agora Channel
  scheduledAt: string;
  paystackReference?: string;
  amountPaidGHS: number;
  platformCutGHS?: number;
  payoutAmountGHS?: number;
  paymentStatus?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';
  priorityMatching?: boolean;
  chiefComplaints?: string;
  symptoms?: string[];
  clinicalNotes?: string;
  visitSummary?: string;
  escalationReason?: string;
  escalationNotes?: string;
  inconclusiveReason?: string;
  inconclusiveContext?: string;
  advisoryTags?: string[];
  isReferralToDoctor?: boolean;
  isReferralToPharmacist?: boolean;
  consultantCadre?: 'DOCTOR' | 'PHARMACIST' | 'PHYSICIAN_ASSISTANT' | 'PHARM_TECH' | 'SPECIALIST' | string;
  adminPresent?: boolean;
  
  // Inter-Consultant Referral Workflow Fields
  referralState?: 'NONE' | 'PROPOSED' | 'BROADCASTING' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED';
  referralTargetCategory?: 'DOCTOR' | 'PHARMACIST';
  referralNote?: string;
  referralFeeGHS?: number;
  referralProposedByUid?: string;
  referralProposedByName?: string;
  referralProposedAt?: string;
  triageSlipId?: string;
  completedAt?: string;
  prescriptionId?: string;
  rating?: number;
  feedback?: string;
  recordingUrl?: string;
  ocrExtractedText?: string | null;
  ocrImageUrl?: string | null;
  audioRecordingUrl?: string | null;
  rawTranscript?: string | null;
  consultantSummary?: string | null;
  isConsultantSigned?: boolean;
  signedByConsultantUid?: string | null;
  signedAt?: string | null;
  preferredLanguage?: string;
  isOnHold?: boolean;
  holdReason?: string;
  extensionCount?: number;
  paymentMethod?: string;
  usedTicketToken?: string;

  // Post-consultation & Follow-up fields
  consultantVoiceNoteUrl?: string | null;
  consultantFinalNotes?: string | null;
  followUpWindowClosesAt?: string | null;
  followUpMessagesRemaining?: number;
  patientRating?: number | null;
  patientReviewText?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

export interface ConsultationChatMessage {
  messageId?: string;
  consultationId?: string;
  senderId: string;
  senderRole: 'patient' | 'consultant';
  senderName: string;
  text: string;
  attachmentUrl?: string;
  timestamp: string;
}

// 4. Digital Prescription
export interface DigitalPrescription {
  rxId: string;                   // Formatted e.g., "RX-GH-2026-XXXXX"
  sessionId: string;
  patientId?: string;
  patientMemberId?: string;
  patientName: string;
  patientAge: number;
  patientGender?: 'MALE' | 'FEMALE' | string;
  consultantId: string;
  consultantMemberId?: string;
  consultantName: string;
  consultantPin: string;
  consultantCadre: string;
  medications: Array<{
    drugName: string;
    name?: string;
    dosage: string;              // e.g., "500mg"
    frequency: string;           // e.g., "TDS (3x daily)"
    durationDays?: number;
    duration?: string;
    refills?: number;             // e.g., 0, 1, 2
    instructions: string;        // e.g., "Take after meals"
  }>;
  diagnosisNotes?: string;
  qrCodeVerificationUrl?: string; // https://yourapp.com/prescriptions/RX-GH-2026-XXXXX
  isFulfilled: boolean;
  fulfilledAtPharmacy?: string;
  fileUrl?: string;
  createdAt: string;
}

// 5. Inventory
export interface InventoryItem {
  itemId: string;
  name: string;
  category: string;
  stockQuantity: number;
  unitPrice: number;
  updatedAt: string;
}

export interface VitalsRecord {
  recordId: string;
  patientId: string;
  bloodPressureSys: number;
  bloodPressureDia: number;
  heartRate: number;
  weightKg: number;
  glucoseLevel: number; // mg/dL
  createdAt: string;
}

// 6. Orders
export interface Order {
  orderId: string;
  patientId: string;
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  deliveryStatus: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED';
  createdAt: string;
}

// 7. Payout Request
export interface PayoutRequest {
  requestId?: string;
  consultantId: string;
  consultantName?: string;
  consultantPrefix?: string;
  amountGHS: number;
  channelType: "mobile_money" | "bank_transfer";
  networkProvider: "MTN" | "TELECEL" | "AT" | null;
  bankCode: string | null;
  bankName: string | null;
  accountNumber: string;
  accountName: string;
  status: "processing" | "processed" | "completed" | "failed" | "rejected" | string;
  requestDayOfWeek?: "Monday" | "Tuesday" | "Wednesday" | string;
  requestedAt: string;
  settledAt: string | null;
  feeAgreementAccepted?: boolean;
  feeAgreementAcceptedAt?: string;
}

// 8. Medication Reminder & Pill Tracker (Patient)
export interface MedicationReminder {
  reminderId: string;
  patientId: string;
  dependentId?: string; // If for a family member
  medicationName: string;
  dosage: string;
  frequency: 'ONCE_DAILY' | 'TWICE_DAILY' | 'THRICE_DAILY' | 'FOUR_TIMES_DAILY' | 'AS_NEEDED';
  timeSlots: string[]; // e.g. ["08:00", "20:00"]
  instructions?: string;
  totalPills: number;
  remainingPills: number;
  refillThreshold: number; // e.g. 5 pills left
  startDate: string;
  endDate?: string;
  rxId?: string;
  consultantName?: string;
  consultantPrefix?: string;
  adherenceLogs?: {
    [dateStr: string]: {
      [timeSlot: string]: 'TAKEN' | 'MISSED' | 'SKIPPED';
    };
  };
  isActive: boolean;
  createdAt: string;
}

// 9. Family & Dependent Profiles (Patient)
export interface FamilyMember {
  memberId: string;
  patientId?: string;
  primaryPatientId?: string;
  fullName: string;
  relationship: 'CHILD' | 'PARENT' | 'SPOUSE' | 'SIBLING' | 'OTHER' | string;
  dateOfBirth?: string;
  age?: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContactPhone?: string;
  avatarUrl?: string;
  createdAt: string;
}

// 10. Specialist Referral Network (Consultant)
export interface SpecialistReferral {
  referralId: string;
  sessionId?: string;
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  referringConsultantId: string;
  referringConsultantName: string;
  referringConsultantCadre: string;
  targetSpecialty: string;
  targetConsultantId?: string;
  targetConsultantName?: string;
  targetConsultantPrefix?: string;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  reasonForReferral: string;
  consultantHandoverSummary: string;
  provisionalDiagnosis?: string;
  vitalsSummary?: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED';
  createdAt: string;
  acceptedAt?: string;
}

// 11. Follow-up & Continuity Scheduler (Consultant)
export interface ConsultantFollowUp {
  followUpId: string;
  consultationId: string;
  consultantId: string;
  consultantName: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  scheduledDate: string; // YYYY-MM-DD
  reason: string;
  intervalDays: number;
  smsReminderSent: boolean;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

// 12. Consultant SOAP Note (Consultant)
export interface SoapNote {
  noteId: string;
  sessionId: string;
  consultantId: string;
  patientId: string;
  patientName: string;
  subjective: string; // Chief complaint, HPI, Review of systems
  objective: string;  // Vitals, physical examination, lab findings
  assessment: string; // Working diagnosis, ICD-10 or clinical impression
  plan: string;       // Medications, labs ordered, lifestyle advice, follow-up
  createdAt: string;
  isSigned: boolean;
  signedAt?: string;
}

// 13. System Broadcast & Alerts (Admin)
export interface SystemBroadcast {
  broadcastId: string;
  title: string;
  message: string;
  priority: 'INFO' | 'WARNING' | 'CRITICAL' | 'NORMAL' | 'URGENT' | 'EMERGENCY';
  targetAudience: 'ALL' | 'CONSULTANTS' | 'PATIENTS' | 'INDIVIDUAL_PATIENT' | 'INDIVIDUAL_CONSULTANT';
  targetUserId?: string;
  targetUserName?: string;
  channel?: 'IN_APP' | 'SMS_IN_APP' | 'URGENT_POPUP';
  channels?: ('IN_APP_BANNER' | 'SMS_ALERT')[];
  authorName: string;
  sentAt?: string;
  createdAt?: string;
  expiresAt?: string | null;
  activeUntil?: string;
  recipientCount?: number;
  isActive?: boolean;
  acknowledgments?: string[]; // user UIDs
}

// 14. Master App & Live System Configuration (Admin Controlled)
export interface SystemAppConfig {
  // Platform Identity & Branding
  appName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  emergencyAmbulanceNumber: string;
  emergencyPoliceNumber: string;
  medicalDirectorContact: string;

  // Feature Toggles (True/False)
  features: {
    videoConsultationsEnabled?: boolean;
    audioConsultationsEnabled?: boolean;
    chatConsultationsEnabled?: boolean;
    instantMomoPayoutsEnabled?: boolean;
    aiTriageEnabled?: boolean;
    drugSafetyCheckerEnabled?: boolean;
    familyProfilesEnabled?: boolean;
    medicationRemindersEnabled?: boolean;
    smsGatewayAlertsEnabled?: boolean;
    strictCouncilPinVerification?: boolean;
    emergencyAutoEscalation?: boolean;
    maintenanceMode?: boolean;
    offlineFallbackAllowed?: boolean;
    allowDirectPatientRegistration?: boolean;
    allowSelfConsultantRegistration?: boolean;
    [key: string]: any;
  };

  // Pricing & Financial Split
  pricing: {
    platformCommissionPercent: number; // e.g. 30
    consultantSharePercent: number; // e.g. 70
    minWithdrawalGHS: number; // e.g. 50
    momoTransactionBufferPercent: number; // e.g. 1.0
    tiers: {
      PHARM_TECH?: {
        chatFeeGHS: number;
        voiceVideoFeeGHS: number;
        durationMins: number;
        extensionFeeGHS: number;
        title?: string;
        focus?: string;
        [key: string]: any;
      };
      PHARMACIST?: {
        chatFeeGHS: number;
        voiceVideoFeeGHS: number;
        durationMins: number;
        extensionFeeGHS: number;
        title?: string;
        focus?: string;
        [key: string]: any;
      };
      DOCTOR?: {
        chatFeeGHS: number;
        voiceVideoFeeGHS: number;
        durationMins: number;
        extensionFeeGHS: number;
        title?: string;
        focus?: string;
        [key: string]: any;
      };
      SPECIALIST?: {
        chatFeeGHS: number;
        voiceVideoFeeGHS: number;
        durationMins: number;
        extensionFeeGHS: number;
        title?: string;
        focus?: string;
        [key: string]: any;
      };
      [key: string]: any;
    };
  };

  // Operational Timing & Thresholds
  operations: {
    ringingTimeoutSeconds: number; // e.g. 45
    escalationTimeoutSeconds: number; // e.g. 90
    prescriptionValidityDays: number; // e.g. 30
    autoSessionClosureMinutes: number; // e.g. 1
    maxDailyConsultationsPerDoctor: number; // e.g. 25
    maxDailyConsultationsFreeTier: number; // e.g. 8
    defaultSTGLevel: string; // "Level 1 Primary Care"
  };

  // UI Banners & Global Notices
  announcements: {
    headerBannerActive: boolean;
    headerBannerText: string;
    headerBannerType: 'info' | 'warning' | 'emergency';
    maintenanceMessage: string;
    careDisclaimerNotice: string;
    footerCopyright: string;
  };

  updatedAt?: string;
  updatedBy?: string;
  findCare?: {
    heroTitle: string;
    heroDescription: string;
    searchPlaceholder: string;
  };
}

export const DEFAULT_SYSTEM_CONFIG: SystemAppConfig = {
  appName: 'PockettClinic Ghana',
  tagline: 'Your Digital Hospital Anywhere',
  supportEmail: 'support@pockettclinic.health',
  supportPhone: '+233 30 200 0000',
  emergencyAmbulanceNumber: '193 / 112',
  emergencyPoliceNumber: '191 / 18555',
  medicalDirectorContact: 'Lead Director (MDC/DIR/001)',

  findCare: {
    heroTitle: 'Find Consultants',
    heroDescription: 'Consult with verified specialists, pharmacists, and consultants across Ghana.',
    searchPlaceholder: 'Search by name, PIN, or cadre...'
  },

  features: {
    videoConsultationsEnabled: true,
    audioConsultationsEnabled: true,
    chatConsultationsEnabled: true,
    instantMomoPayoutsEnabled: true,
    aiTriageEnabled: true,
    drugSafetyCheckerEnabled: true,
    familyProfilesEnabled: true,
    medicationRemindersEnabled: true,
    smsGatewayAlertsEnabled: true,
    strictCouncilPinVerification: true,
    emergencyAutoEscalation: true,
    maintenanceMode: false,
    offlineFallbackAllowed: true,
    allowDirectPatientRegistration: true,
    allowSelfConsultantRegistration: true,
  },

  pricing: {
    platformCommissionPercent: 30,
    consultantSharePercent: 70,
    minWithdrawalGHS: 50,
    momoTransactionBufferPercent: 1.0,
    tiers: {
      PHARM_TECH: {
        chatFeeGHS: 20,
        voiceVideoFeeGHS: 30,
        durationMins: 15,
        extensionFeeGHS: 15,
      },
      PHYSICIAN_ASSISTANT: {
        chatFeeGHS: 30,
        voiceVideoFeeGHS: 45,
        durationMins: 15,
        extensionFeeGHS: 20,
      },
      PHARMACIST: {
        chatFeeGHS: 50,
        voiceVideoFeeGHS: 70,
        durationMins: 15,
        extensionFeeGHS: 35,
      },
      DOCTOR: {
        chatFeeGHS: 70,
        voiceVideoFeeGHS: 90,
        durationMins: 20,
        extensionFeeGHS: 45,
      },
      SPECIALIST: {
        chatFeeGHS: 90,
        voiceVideoFeeGHS: 130,
        durationMins: 20,
        extensionFeeGHS: 65,
      }
    }
  },

  operations: {
    ringingTimeoutSeconds: 45,
    escalationTimeoutSeconds: 90,
    prescriptionValidityDays: 30,
    autoSessionClosureMinutes: 1,
    maxDailyConsultationsPerDoctor: 25,
    maxDailyConsultationsFreeTier: 8,
    defaultSTGLevel: 'Ghana STG Level 1 Primary Care'
  },

  announcements: {
    headerBannerActive: false,
    headerBannerText: 'Welcome to PockettClinic Telemedicine. All consultants are verified with Ghana MDC and Pharmacy Council.',
    headerBannerType: 'info',
    maintenanceMessage: 'PockettClinic is currently undergoing scheduled infrastructure updates. Emergency hotline: 193.',
    careDisclaimerNotice: 'PockettClinic provides regulated primary telemedicine triage. For severe emergencies (chest pain, severe hemorrhage, difficulty breathing), dial 193 or visit the nearest hospital emergency ward immediately.',
    footerCopyright: '© 2026 PockettClinic Ghana. Regulated by Ghana Medical and Dental Council & Pharmacy Council.'
  },

  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default'
};
