/**
 * PockettClinic Member Identification Utility
 * Generates and formats clean, human-readable PockettClinic IDs
 * Format: PC-[CADRE/ROLE]-[ORDER_NUMBER]
 * Examples:
 * - Patient: PC-PAT-001, PC-PAT-002, PC-PAT-045
 * - General Doctor: PC-DOC-001, PC-DOC-002
 * - Specialist: PC-SPEC-001, PC-SPEC-002
 * - Pharmacist: PC-PHARM-001, PC-PHARM-002
 * - Pharmacy Technician: PC-PTECH-001, PC-PTECH-002
 * - Administrator: PC-ADM-001
 */

import { Role } from '../types';

export function getCadrePrefix(role?: Role | string, cadre?: string): string {
  const normRole = (role || '').toLowerCase().trim();
  const normCadre = (cadre || '').toUpperCase().trim();

  if (normRole === 'admin') {
    return 'PC-ADM-';
  }

  if (normRole === 'patient') {
    return 'PC-PAT-';
  }

  // Consultants
  if (normCadre === 'UNASSIGNED') {
    return 'PC-UNAS-';
  }
  if (normCadre === 'SPECIALIST' || normCadre === 'DOCTOR_SPECIALIST') {
    return 'PC-SPEC-';
  }
  if (normCadre === 'PHYSICIAN_ASSISTANT' || normCadre === 'PHYSICIAN_ASSIST' || normCadre === 'PA') {
    return 'PC-PA-';
  }
  if (normCadre === 'PHARMACIST') {
    return 'PC-PHARM-';
  }
  if (normCadre === 'PHARM_TECH' || normCadre === 'PHARMACY_TECHNICIAN') {
    return 'PC-PTECH-';
  }
  if (normCadre === 'DOCTOR' || normCadre === 'DOCTOR_GENERAL' || normCadre === 'GENERAL_DOCTOR' || normCadre === 'MEDICAL_OFFICER') {
    return 'PC-DOC-';
  }

  // Fallback for consultants without explicit cadre
  if (normRole === 'consultant') {
    return 'PC-UNAS-';
  }

  return 'PC-PAT-';
}

/**
 * Derives a consistent, sequential-looking numeric code from a user profile or UID
 * If a custom memberId / displayId is stored in the profile, returns it directly.
 */
export function formatMemberId(user?: {
  uid?: string;
  id?: string;
  memberId?: string;
  displayId?: string;
  role?: Role | string;
  cadre?: string;
  createdAt?: string | number;
  memberNumber?: number;
} | null): string {
  if (!user) return 'PC-PAT-001';

  // If the user already has a saved readable memberId/displayId, prioritize it
  if (user.memberId && user.memberId.startsWith('PC-')) {
    return user.memberId;
  }
  if (user.displayId && user.displayId.startsWith('PC-')) {
    return user.displayId;
  }

  const prefix = getCadrePrefix(user.role, user.cadre);

  if (user.memberNumber && typeof user.memberNumber === 'number') {
    return `${prefix}${String(user.memberNumber).padStart(3, '0')}`;
  }

  // Deterministically compute a clean 3-digit order index from UID hash
  const rawId = user.uid || user.id || '';
  if (!rawId) return `${prefix}001`;

  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    hash = (hash << 5) - hash + rawId.charCodeAt(i);
    hash |= 0;
  }
  const positiveNum = Math.abs(hash);
  const orderNum = (positiveNum % 899) + 1; // Produces neat numbers between 1 and 900
  return `${prefix}${String(orderNum).padStart(3, '0')}`;
}

export function formatPrescriptionPrescriberId(prescription?: {
  consultantId?: string;
  consultantCadre?: string;
  consultantPin?: string;
} | null): string {
  if (!prescription) return 'PC-DOC-001';
  return formatMemberId({
    uid: prescription.consultantId,
    role: 'consultant',
    cadre: prescription.consultantCadre
  });
}
