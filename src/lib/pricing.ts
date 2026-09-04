import { SystemAppConfig, DEFAULT_SYSTEM_CONFIG } from '../types';

export interface TierRate {
  cadre: 'PHARM_TECH' | 'PHARMACIST' | 'DOCTOR' | 'SPECIALIST' | string;
  title: string;
  focus: string;
  chatFeeGHS: number;
  chatDurationMins: number;
  voiceVideoFeeGHS: number;
  voiceVideoDurationMins: number;
  extensionFeeGHS: number;
  extensionDurationMins: number;
}

export type ConsultantTierInfo = TierRate;

export const CONSULTANT_TIERS: Record<string, TierRate> = {
  PHARM_TECH: {
    cadre: 'PHARM_TECH',
    title: 'Pharmacy Technician',
    focus: 'OTC and minor triage',
    chatFeeGHS: 20,
    chatDurationMins: 15,
    voiceVideoFeeGHS: 30,
    voiceVideoDurationMins: 15,
    extensionFeeGHS: 15,
    extensionDurationMins: 10,
  },
  PHYSICIAN_ASSISTANT: {
    cadre: 'PHYSICIAN_ASSISTANT',
    title: 'Physician Assistant (PA)',
    focus: 'Primary healthcare assessment & triage',
    chatFeeGHS: 30,
    chatDurationMins: 15,
    voiceVideoFeeGHS: 45,
    voiceVideoDurationMins: 15,
    extensionFeeGHS: 20,
    extensionDurationMins: 10,
  },
  PHARMACIST: {
    cadre: 'PHARMACIST',
    title: 'Pharmacist',
    focus: 'Medication reviews and drug interactions',
    chatFeeGHS: 50,
    chatDurationMins: 15,
    voiceVideoFeeGHS: 70,
    voiceVideoDurationMins: 15,
    extensionFeeGHS: 35,
    extensionDurationMins: 10,
  },
  DOCTOR: {
    cadre: 'DOCTOR',
    title: 'Doctor',
    focus: 'Diagnosis and Prescription-Only Medications (POM)',
    chatFeeGHS: 70,
    chatDurationMins: 20,
    voiceVideoFeeGHS: 90,
    voiceVideoDurationMins: 20,
    extensionFeeGHS: 45,
    extensionDurationMins: 10,
  },
  SPECIALIST: {
    cadre: 'SPECIALIST',
    title: 'Specialist',
    focus: 'Specialized Medical Consultations & Advanced Diagnostics',
    chatFeeGHS: 90,
    chatDurationMins: 20,
    voiceVideoFeeGHS: 130,
    voiceVideoDurationMins: 20,
    extensionFeeGHS: 65,
    extensionDurationMins: 10,
  }
};

/**
 * Calculates consultant share and platform margin split dynamically.
 */
export function calculateRevenueSplit(grossFeeGHS: number, config?: SystemAppConfig) {
  const consultantPercent = (config?.pricing?.consultantSharePercent ?? DEFAULT_SYSTEM_CONFIG.pricing?.consultantSharePercent ?? 70) / 100;
  const platformPercent = (config?.pricing?.platformCommissionPercent ?? DEFAULT_SYSTEM_CONFIG.pricing?.platformCommissionPercent ?? 30) / 100;
  
  const consultantShareGHS = Math.round(grossFeeGHS * consultantPercent * 100) / 100;
  const platformCutGHS = Math.round(grossFeeGHS * platformPercent * 100) / 100;
  return { consultantShareGHS, platformCutGHS };
}

/**
 * Retrieves tier pricing details for a given cadre and session type, dynamically honoring systemConfig.
 */
export function getSessionTierPricing(
  cadre: string = 'UNASSIGNED',
  sessionType: 'CHAT_ONLY' | 'AUDIO_ONLY' | 'VIDEO' | string = 'VIDEO',
  config?: SystemAppConfig
) {
  let rawCadre = (cadre || 'UNASSIGNED').toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (rawCadre === 'DOCTOR_GENERAL') {
    rawCadre = 'DOCTOR';
  }
  if (rawCadre === 'DOCTOR_SPECIALIST') {
    rawCadre = 'SPECIALIST';
  }
  if (rawCadre === 'PA' || rawCadre === 'PHYSICIAN_ASSISTANT' || rawCadre === 'PHYSICIAN_ASSIST') {
    rawCadre = 'PHYSICIAN_ASSISTANT';
  }
  if (rawCadre === 'PHARM_TECH' || rawCadre === 'PHARMACY_TECHNICIAN' || rawCadre === 'PHARMACY_TECH') {
    rawCadre = 'PHARM_TECH';
  }
  const normCadre = rawCadre;
  const baseTier = CONSULTANT_TIERS[normCadre] || CONSULTANT_TIERS.DOCTOR;
  const configuredTier = config?.pricing?.tiers?.[normCadre];

  const chatFeeGHS = configuredTier?.chatFeeGHS ?? baseTier.chatFeeGHS;
  const voiceVideoFeeGHS = configuredTier?.voiceVideoFeeGHS ?? baseTier.voiceVideoFeeGHS;
  const durationMins = configuredTier?.durationMins ?? baseTier.chatDurationMins;
  const extensionFeeGHS = configuredTier?.extensionFeeGHS ?? baseTier.extensionFeeGHS;

  const isChat = sessionType === 'CHAT_ONLY' || sessionType === 'chat';
  const grossFee = isChat ? chatFeeGHS : voiceVideoFeeGHS;
  const { consultantShareGHS, platformCutGHS } = calculateRevenueSplit(grossFee, config);

  return {
    tier: {
      ...baseTier,
      chatFeeGHS,
      voiceVideoFeeGHS,
      chatDurationMins: durationMins,
      voiceVideoDurationMins: durationMins,
      extensionFeeGHS
    },
    grossFee,
    durationMins,
    consultantShareGHS,
    platformCutGHS,
    extensionFeeGHS,
    extensionDurationMins: baseTier.extensionDurationMins,
  };
}
