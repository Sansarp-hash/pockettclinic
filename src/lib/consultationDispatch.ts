import { auth, db } from '../firebase';
import { doc, getDoc, getDocs, collection, updateDoc, arrayUnion, query, where, serverTimestamp, runTransaction } from 'firebase/firestore';
import { ConsultationSession, ConsultantProfile } from '../types';
import { handleFirestoreError, OperationType } from './firestore-errors';
import { normalizeCadre } from '../config/consultantCadreConfig';

/**
 * Re-routes a consultation request to the next available online consultant in the same role.
 * If no available consultant is found, marks dispatchStatus as "escalated" (shared pool).
 */
export async function rerouteConsultation(consultationId: string): Promise<boolean> {
  try {
    const consRef = doc(db, 'consultations', consultationId);
    let consSnap;
    try {
      consSnap = await getDoc(consRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `consultations/${consultationId}`);
      return false;
    }

    if (!consSnap.exists()) return false;

    const data = consSnap.data() as ConsultationSession;
    const declinedList = data.declinedBy || [];
    const targetCadre = data.cadreNeeded || 'UNASSIGNED';

    // Fetch only online users to filter for consultant cadres
    let usersSnap;
    try {
      usersSnap = await getDocs(query(collection(db, 'users'), where('isOnline', '==', true)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
      return false;
    }

    const onlineCandidates: ConsultantProfile[] = [];

    usersSnap.forEach((uDoc) => {
      const uData = uDoc.data();
      const roleLower = (uData.role || '').toLowerCase();
      const isConsultant = 
        roleLower === 'consultant' || 
        Boolean(uData.cadre);
      
      const isOnline = uData.isOnline === true;
      const userCadreNorm = normalizeCadre(uData.cadre);
      const targetCadreNorm = normalizeCadre(targetCadre);
      const notDeclined = !declinedList.includes(uDoc.id);
      
      let cadreMatch = false;
      if (userCadreNorm === 'UNASSIGNED') {
        if (targetCadreNorm === 'DOCTOR') {
          cadreMatch = true;
        }
      } else {
        if (targetCadreNorm === 'DOCTOR') {
          cadreMatch = (userCadreNorm === 'DOCTOR' || userCadreNorm === 'SPECIALIST' || userCadreNorm === 'PHYSICIAN_ASSISTANT');
        } else if (targetCadreNorm === 'SPECIALIST') {
          cadreMatch = (userCadreNorm === 'SPECIALIST' || userCadreNorm === 'DOCTOR');
        } else if (targetCadreNorm === 'PHYSICIAN_ASSISTANT') {
          cadreMatch = (userCadreNorm === 'PHYSICIAN_ASSISTANT' || userCadreNorm === 'DOCTOR');
        } else if (targetCadreNorm === 'PHARMACIST') {
          cadreMatch = (userCadreNorm === 'PHARMACIST' || userCadreNorm === 'PHARM_TECH');
        } else if (targetCadreNorm === 'PHARM_TECH') {
          cadreMatch = (userCadreNorm === 'PHARM_TECH' || userCadreNorm === 'PHARMACIST');
        } else {
          cadreMatch = (userCadreNorm as string) === targetCadreNorm;
        }
      }

      if (isConsultant && isOnline && notDeclined && cadreMatch) {
        onlineCandidates.push({
          ...uData,
          uid: uDoc.id,
          id: uDoc.id
        } as ConsultantProfile);
      }
    });

    if (onlineCandidates.length > 0) {
      // Prioritize specialty match if requested
      const requestedSpecialty = (data as any).specialtyNeeded || (data as any).specialty;
      let selectedCandidate = onlineCandidates[0];

      if (requestedSpecialty && typeof requestedSpecialty === 'string' && requestedSpecialty.trim() !== '') {
        const specMatch = onlineCandidates.find(c => 
          c.specialty && c.specialty.toLowerCase().includes(requestedSpecialty.trim().toLowerCase())
        );
        if (specMatch) {
          selectedCandidate = specMatch;
        }
      } else {
        // Prioritize language match if preferredLanguage is set
        const prefLang = data.preferredLanguage;
        if (prefLang && prefLang.trim() !== '') {
          const langMatch = onlineCandidates.find(c => 
            c.languages && c.languages.some(l => (l?.toLowerCase() || '').includes(prefLang.toLowerCase()))
          );
          if (langMatch) {
            selectedCandidate = langMatch;
          }
        }
      }

      const ringingExpiresAt = Date.now() + 180000; // 180 seconds countdown (3 minutes)

      try {
        await updateDoc(consRef, {
          assignedConsultantId: selectedCandidate.uid,
          consultantId: selectedCandidate.uid,
          consultantName: selectedCandidate.displayName || selectedCandidate.fullName || 'Duty Consultant',
          dispatchStatus: 'ringing',
          ringingExpiresAt: ringingExpiresAt
        });

        // Notify the newly assigned consultant
        try {
          const idToken = await auth.currentUser?.getIdToken();
          fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              targetUid: selectedCandidate.uid,
              title: 'New consultation request',
              body: 'You have a new consultation request waiting for your acceptance.',
              actionType: 'new_consultation',
              targetPath: '/consultant-dashboard'
            })
          }).then(async res => {
            if (!res.ok) {
              const errorText = await res.text();
              console.warn(`[Notification Error] Status: ${res.status}, Body: ${errorText}`);
            }
          }).catch(err => console.warn('Failed to notify consultant on re-route:', err));
        } catch (notifErr) {
          console.warn('Consultant notification trigger error (re-route):', notifErr);
        }

      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `consultations/${consultationId}`);
        return false;
      }
      return true;
    } else {
      // No available online consultant found
      if (data.dispatchStatus === 'escalated') {
        // If already escalated and still no one found, expire and refund
        await cancelAndRefundConsultation(consultationId, "No consultant available in shared pool");
        return false;
      }

      // First time no one found -> Escalate to shared pool
      try {
        await updateDoc(consRef, {
          assignedConsultantId: null,
          dispatchStatus: 'escalated',
          ringingExpiresAt: Date.now() + 120000 // 2 minute timeout for shared pool
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `consultations/${consultationId}`);
        return false;
      }
      return false;
    }
  } catch (err) {
    console.error("Error in rerouteConsultation:", err);
    return false;
  }
}

/**
 * Cancels a consultation and triggers a simulated refund/credit.
 */
export async function cancelAndRefundConsultation(consultationId: string, reason: string): Promise<void> {
  try {
    const consRef = doc(db, 'consultations', consultationId);
    let consSnap;
    try {
      consSnap = await getDoc(consRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `consultations/${consultationId}`);
      return;
    }

    if (!consSnap.exists()) return;
    const data = consSnap.data() as ConsultationSession;

    try {
      await updateDoc(consRef, {
        status: 'CANCELLED',
        dispatchStatus: 'expired',
        cancelReason: reason,
        isOnHold: false,
        holdReason: "",
        refundedAt: new Date().toISOString(),
        refundReference: `RFD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `consultations/${consultationId}`);
      return;
    }

    // Simulated Wallet Credit
    if (data.patientId && typeof data.amountPaidGHS === 'number') {
      try {
        const userRef = doc(db, 'users', data.patientId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentBalance = userData.walletBalanceGHS || 0;
          await updateDoc(userRef, {
            walletBalanceGHS: currentBalance + (data.amountPaidGHS || 0)
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${data.patientId}`);
      }
    }

    console.log(`Consultation ${consultationId} cancelled and GHS ${data.amountPaidGHS || 0} refunded to patient.`);
  } catch (err) {
    console.error("Error in cancelAndRefundConsultation:", err);
  }
}

/**
 * Declines or forwards a consultation request on behalf of a consultant.
 */
export async function declineOrForwardConsultation(
  consultationId: string,
  consultantId: string
): Promise<void> {
  try {
    const consRef = doc(db, 'consultations', consultationId);
    
    // Add current consultant to declinedBy array and reset assignedConsultantId
    try {
      await updateDoc(consRef, {
        declinedBy: arrayUnion(consultantId),
        assignedConsultantId: null,
        dispatchStatus: 're-routing'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `consultations/${consultationId}`);
      return;
    }

    // Mark current consultant profile activeSessionId as null (free)
    try {
      const userRef = doc(db, 'users', consultantId);
      await updateDoc(userRef, {
        activeSessionId: null
      });
    } catch (err) {
      // Non-blocking catch
    }

    // Trigger re-routing
    await rerouteConsultation(consultationId);
  } catch (err) {
    console.error("Error in declineOrForwardConsultation:", err);
  }
}

/**
 * Accepts a consultation request by a consultant.
 */
export async function acceptConsultation(
  consultationId: string,
  consultantId: string,
  consultantName: string
): Promise<void> {
  try {
    const consRef = doc(db, 'consultations', consultationId);
    
    // Use a transaction for atomic check-and-set
    await runTransaction(db, async (transaction) => {
      const consSnap = await transaction.get(consRef);
      if (!consSnap.exists()) {
        throw new Error("Consultation does not exist.");
      }
      
      const data = consSnap.data() as ConsultationSession;
      // Strict check: only accept if not already in progress or accepted
      if (data.status === 'IN_PROGRESS' || data.status === 'ACTIVE' || data.dispatchStatus === 'accepted') {
        const assignedId = data.assignedConsultantId || data.consultantId;
        if (assignedId === consultantId) {
          return;
        }
        throw new Error("Consultation already accepted by someone else.");
      }
      
      const nowIso = new Date().toISOString();
      const updates: any = {
        assignedConsultantId: consultantId,
        consultantId: consultantId,
        consultantName: consultantName,
        dispatchStatus: 'accepted',
        status: 'IN_PROGRESS',
        acceptedAt: nowIso,
        startedAt: nowIso,
        connectionStartedAt: serverTimestamp(),
        isOnHold: false,
        holdReason: null,
        updatedAt: serverTimestamp()
      };

      if (data.referralState === 'BROADCASTING' || data.referralState === 'PROPOSED') {
        updates.referralState = 'ACCEPTED';
      }

      transaction.update(consRef, updates);
      
      const userRef = doc(db, 'users', consultantId);
      transaction.update(userRef, {
        activeSessionId: consultationId
      });
    });
  } catch (err) {
    console.error("Error in acceptConsultation:", err);
    throw err;
  }
}
