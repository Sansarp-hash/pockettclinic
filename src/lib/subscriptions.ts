import { Role, PatientSubscriptionTier, ConsultantSubscriptionTier, SubscriptionTier } from '../types';

export interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  role: 'patient' | 'consultant';
  priceGHS: number;
  billingCycle: 'monthly' | 'free';
  tagline: string;
  badgeText?: string;
  popular?: boolean;
  features: PlanFeature[];
}

export const PATIENT_PLANS: Record<PatientSubscriptionTier, SubscriptionPlan> = {
  pay_as_you_go: {
    id: 'pay_as_you_go',
    name: 'Pay-As-You-Go',
    role: 'patient',
    priceGHS: 0,
    billingCycle: 'free',
    tagline: 'Standard access for flexible healthcare needs',
    features: [
      { text: 'Basic consultation booking (Instant & Scheduled)', included: true },
      { text: 'Standard audio, video & text chat access', included: true },
      { text: 'Basic digital prescription viewing & downloads', included: true },
      { text: 'Priority consultant matching', included: false },
      { text: 'Advanced health record & prescription tracking', included: false },
      { text: '2 free session extensions per month', included: false }
    ]
  },
  care_plus: {
    id: 'care_plus',
    name: 'Care Plus',
    role: 'patient',
    priceGHS: 49,
    billingCycle: 'monthly',
    tagline: 'Premium care for continuous health monitoring and session flexibility',
    badgeText: 'MOST POPULAR',
    popular: true,
    features: [
      { text: 'Priority matching with available doctors & pharmacists', included: true, highlight: true },
      { text: 'Advanced health record vault & prescription history tracking', included: true, highlight: true },
      { text: 'Priority digital prescription scanning & instant OCR processing', included: true, highlight: true },
      { text: '2 free session extensions per month', included: true, highlight: true },
      { text: '1 free video consultation ticket per month', included: true, highlight: true }
    ]
  }
};

export const CONSULTANT_PLANS: Record<ConsultantSubscriptionTier, SubscriptionPlan> = {
  verified_consultant: {
    id: 'verified_consultant',
    name: 'Verified Consultant',
    role: 'consultant',
    priceGHS: 0,
    billingCycle: 'free',
    tagline: 'Standard entry for licensed Ghanaian consultants',
    features: [
      { text: 'Standard profile listing in Find Care directory', included: true },
      { text: 'Basic consultation dispatch & video room access', included: true },
      { text: 'Standard 30% platform commission fee', included: true },
      { text: 'Up to 8 daily call pickups (Standard Limit)', included: true },
      { text: 'Priority directory placement', included: false },
      { text: 'Reduced platform commission (25% platform fee)', included: false },
      { text: 'Priority inter-consultant referral broadcasts', included: false }
    ]
  },
  pro_partner: {
    id: 'pro_partner',
    name: 'Pro Partner',
    role: 'consultant',
    priceGHS: 199,
    billingCycle: 'monthly',
    tagline: 'High-visibility tier for active healthcare consultants',
    badgeText: 'CONSULTANT PRO',
    popular: true,
    features: [
      { text: 'Priority placement at top of Find Care directory', included: true, highlight: true },
      { text: 'Lower platform commission fee (25% vs standard 30%)', included: true, highlight: true },
      { text: 'Enhanced daily call pickup limit (Up to 25 calls)', included: true, highlight: true },
      { text: 'Priority referral broadcast alerts from peer consultants', included: true, highlight: true },
      { text: 'Verified PRO badge on consultant profile', included: true },
      { text: 'Instant Mobile Money payout priority processing', included: true }
    ]
  }
};

export function getPlanForUser(role: Role, currentTier?: SubscriptionTier): SubscriptionPlan {
  if (role === 'consultant') {
    const tier = (currentTier as ConsultantSubscriptionTier) || 'verified_consultant';
    return CONSULTANT_PLANS[tier] || CONSULTANT_PLANS.verified_consultant;
  } else {
    const tier = (currentTier as PatientSubscriptionTier) || 'pay_as_you_go';
    return PATIENT_PLANS[tier] || PATIENT_PLANS.pay_as_you_go;
  }
}

export function isProPartner(user?: any): boolean {
  if (!user) return false;
  if (user.isProPartner === true) return true;
  if (user.role !== 'consultant') return false;
  return user.subscriptionTier === 'pro_partner' && (user.subscriptionStatus === 'active' || !user.subscriptionStatus);
}

export function isCarePlus(user?: any): boolean {
  if (!user) return false;
  if (user.isCarePlus === true) return true;
  if (user.role === 'consultant') return false;
  return user.subscriptionTier === 'care_plus' && (user.subscriptionStatus === 'active' || !user.subscriptionStatus);
}
