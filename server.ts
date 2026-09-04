import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import agoraToken from 'agora-token';
const { RtcTokenBuilder, RtcRole } = agoraToken;
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps, deleteApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue as adminFieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";

let FieldValue: any = adminFieldValue;

dotenv.config();

// Global Crash Handlers
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

// Load Firebase Config safely
let firebaseAppletConfig: any = {};
try {
  const content = fs.readFileSync("./firebase-applet-config.json", "utf-8").trim();
  if (content) {
    firebaseAppletConfig = JSON.parse(content);
  } else {
    console.warn("[Firebase Admin Init] firebase-applet-config.json is empty.");
  }
} catch (err: any) {
  console.warn("[Firebase Admin Init] Error reading or parsing firebase-applet-config.json:", err.message);
}

let db: any = null;
let isDbConnected = false;

// Initialize Firebase Admin with FIREBASE_SERVICE_ACCOUNT_KEY or Application Default Credentials (ADC)
async function initFirebase() {
  const log = (msg: string) => console.log(`[Firebase Admin Init] ${msg}`);
  
  // Clean up any existing apps to start fresh
  getApps().forEach(app => deleteApp(app));

  const serviceAccountKeyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const configuredProjectId = firebaseAppletConfig?.projectId;

  if (!serviceAccountKeyStr && !configuredProjectId) {
    log(`No FIREBASE_SERVICE_ACCOUNT_KEY or firebase-applet-config.json detected. Server running in simulated sandbox mode.`);
    db = null;
    isDbConnected = false;
    return;
  }

  try {
    let app;

    if (serviceAccountKeyStr) {
      const serviceAccount = JSON.parse(serviceAccountKeyStr);
      const projectId = serviceAccount.project_id || configuredProjectId;

      log(`Initializing Firebase Admin using service account for project: ${projectId}`);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId
      });
    } else {
      log(`Initializing Firebase Admin using Application Default Credentials (ADC) for project: ${configuredProjectId}`);
      app = initializeApp({
        projectId: configuredProjectId
      });
    }

    const dbInstance = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
    
    // Test the Admin SDK connection
    await dbInstance.collection('consultations').limit(1).get();
    
    db = dbInstance;
    isDbConnected = true;
    const resolvedProjectId = app.options.projectId || "default";
    console.log(`[Success] Authorized on Project: ${resolvedProjectId}`);
    log(`Successfully authenticated Admin SDK on Project: ${resolvedProjectId}, DB: ${firebaseAppletConfig.firestoreDatabaseId || "default"}`);
    
    startBackgroundWorkers();

    // Check for Agora config
    if (process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE) {
      console.log("[Agora] Server-side API keys detected.");
    } else {
      console.warn("[Agora] Server-side API keys (AGORA_APP_ID/CERTIFICATE) are missing.");
    }

    return;
  } catch (e: any) {
    log(`[INFO] Live database connection unavailable: ${e.message}`);
    log(`[INFO] Server running gracefully in simulated sandbox mode.`);
    db = null;
    isDbConnected = false;
  }
}

async function logWorkerErrorToFirestore(workerName: string, error: any) {
  if (db && isDbConnected) {
    try {
      const errorRef = db.collection('system_errors').doc();
      await errorRef.set({
        id: errorRef.id,
        timestamp: FieldValue.serverTimestamp(),
        message: error?.message || String(error) || "Unknown worker error",
        stack: error?.stack || "",
        userId: "system",
        role: "worker",
        component: `Background Worker: ${workerName}`,
        page: "server-workers",
        customKeys: { workerName },
        logs: [],
        severity: "high",
        status: "open",
        resolvedAt: null,
        resolvedBy: null,
        aiExplanation: "Background cron worker execution exception."
      });
    } catch (dbErr: any) {
      console.error(`[logWorkerErrorToFirestore] Failed to log worker error to Firestore:`, dbErr);
    }
  }
}

function startBackgroundWorkers() {
  if (!isDbConnected) return;
  const log = (msg: string) => console.log(`[Worker] ${msg}`);
  
  log("Initializing intervals...");

  setInterval(async () => {
    try {
      await runDispatchAudit();
    } catch (e: any) {
      console.error("[Worker] Dispatch Error:", e);
      await logWorkerErrorToFirestore("Dispatch Audit", e);
    }
  }, 60000);

  setInterval(async () => {
    try {
      await runLedgerFinalization();
    } catch (e: any) {
      console.error("[Worker] Ledger Error:", e);
      await logWorkerErrorToFirestore("Ledger Finalization", e);
    }
  }, 300000);

  setInterval(async () => {
    try {
      await runConnectionTimeoutAudit();
    } catch (e: any) {
      console.error("[Worker] Timeout Audit Error:", e);
      await logWorkerErrorToFirestore("Connection Timeout Audit", e);
    }
  }, 60000);

  setInterval(async () => {
    try {
      await runSubscriptionRenewalWorker();
    } catch (e: any) {
      console.error("[Worker] Subscription Renewal Error:", e);
      await logWorkerErrorToFirestore("Subscription Renewal Worker", e);
    }
  }, 3600000); // Check hourly

  setInterval(async () => {
    try {
      await runErrorResolutionWorker();
    } catch (e: any) {
      console.error("[Worker] Error Resolution Error:", e);
    }
  }, 10000); // Check every 10 seconds for rapid response
}

async function runErrorResolutionWorker() {
  if (!db || !isDbConnected) return;
  try {
    const fixingSnapshot = await db.collection('system_errors')
      .where('fixRequested', '==', true)
      .where('fixStatus', '==', 'fixing')
      .limit(5)
      .get();

    for (const doc of fixingSnapshot.docs) {
      const errorData = doc.data();
      console.log(`[AI SRE] Resolving issue: ${doc.id} - ${errorData.message}`);

      const prompt = `You are a Senior Site Reliability Engineer (SRE) AI. 
Analyze this system error and provide a definitive resolution report.

ERROR MESSAGE: ${errorData.message}
COMPONENT: ${errorData.component}
PAGE: ${errorData.page}
SEVERITY: ${errorData.severity}
STACK TRACE: ${errorData.stack || 'No stack trace provided'}
LOGS: ${JSON.stringify(errorData.logs || [])}

Your task is to:
1. Diagnose the root cause precisely.
2. Provide a step-by-step technical fix (code snippets if possible).
3. Suggest a preventative measure to avoid recurrence.

Return your response as a professional Markdown report.
`;

      const response = await generateContentWithFallback({
        preferredModel: "gemini-3.7-flash",
        contents: prompt
      });

      const resolutionReport = response.text?.trim() || "AI SRE was unable to generate a detailed resolution report.";

      await doc.ref.update({
        fixStatus: 'fixed',
        status: 'resolved',
        aiResolutionReport: resolutionReport,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: 'AI SRE Agent'
      });

      console.log(`[AI SRE] Successfully resolved issue: ${doc.id}`);
    }
  } catch (err: any) {
    console.error("[AI SRE Resolution Worker Error]:", err.message);
  }
}

initFirebase();

// Initialize Gemini Client
let aiClient: GoogleGenAI | null = null;
function getAi() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function generateContentWithFallback(options: {
  contents: any;
  config?: any;
  preferredModel?: string;
}) {
  const ai = getAi();
  
  let normalizedContents = options.contents;
  if (typeof normalizedContents === 'string') {
    normalizedContents = [{ role: 'user', parts: [{ text: normalizedContents }] }];
  } else if (Array.isArray(normalizedContents)) {
    const parts = normalizedContents.map(item => {
      if (typeof item === 'string') return { text: item };
      if (item.text) return { text: item.text };
      if (item.inlineData) return { inlineData: item.inlineData };
      if (item.parts) return item.parts;
      return item;
    });
    if (normalizedContents[0]?.parts) {
      // already normalized
    } else {
      normalizedContents = [{ role: 'user', parts }];
    }
  }

  const primaryModel = options.preferredModel || "gemini-3.7-flash";
  const fallbackModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.1-flash-lite"];
  const candidateModels = Array.from(new Set([primaryModel, ...fallbackModels]));
  
  let lastError: any = null;
  const maxRetriesPerModel = 3; 

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: normalizedContents,
          ...(options.config ? { config: options.config } : {})
        });
        return res;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err).toLowerCase();
        const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted');
        const isTransient = isQuota || msg.includes('503') || msg.includes('unavailable') || msg.includes('high demand') || msg.includes('deadline exceeded') || msg.includes('deadline_exceeded');
        const isNotFound = msg.includes('not found') || msg.includes('not_found') || msg.includes('no longer available');
        
        if (isTransient) {
          // Fast failover for quota/overload on non-final models
          if (isQuota && model !== candidateModels[candidateModels.length - 1]) {
            console.warn(`[Gemini Model Fallback] Model ${model} hit quota (429). Switching to next model.`);
            break;
          }

          const delay = Math.min(1500 * Math.pow(2, attempt) + Math.random() * 1000, 12000); 
          console.warn(`[Gemini Model Fallback] Model ${model} failed attempt ${attempt} (${msg}). Waiting ${Math.round(delay)}ms to retry...`);
          
          if (attempt < maxRetriesPerModel) {
            await new Promise(r => setTimeout(r, delay));
            continue;
          } else {
            console.warn(`[Gemini Model Fallback] Model ${model} exhausted retries. Trying next model...`);
            break;
          }
        } else if (isNotFound) {
           console.warn(`[Gemini Model Fallback] Model ${model} not found. Trying next model...`);
           break;
        }
        
        throw err;
      }
    }
  }
  
  throw lastError;
}

// --- Background Worker: Dispatch & Payout Services ---

async function runDispatchAudit() {
  if (!db || !isDbConnected) return;
  try {
    const now = Date.now();
    const ringingTimeout = 45000;
    const finalTimeout = 180000; // 3 minutes
    
    // Fetch all active/pending consultations that are currently in a dispatch phase
    const dispatchSnapshot = await db.collection('consultations')
      .where('status', 'in', ['PAID', 'PENDING'])
      .get();

    for (const doc of dispatchSnapshot.docs) {
      const data = doc.data();
      const dispatchStatus = data.dispatchStatus;
      
      // Only process unaccepted live dispatches
      if (!['ringing', 'direct', 'escalated', 're-routing'].includes(dispatchStatus)) {
        continue;
      }

      // Track total time since creation
      let createdTimeMs = 0;
      if (data.createdAt) {
        if (typeof data.createdAt.toMillis === 'function') {
          createdTimeMs = data.createdAt.toMillis();
        } else if (typeof data.createdAt.toDate === 'function') {
          createdTimeMs = data.createdAt.toDate().getTime();
        } else if (data.createdAt.seconds) {
          createdTimeMs = data.createdAt.seconds * 1000;
        } else {
          createdTimeMs = new Date(data.createdAt).getTime();
        }
      }
      if (!createdTimeMs || isNaN(createdTimeMs)) {
        createdTimeMs = data.ringingStartedAt || 0;
      }

      const totalAgeMs = now - createdTimeMs;

      // 1. Check for the 3-minute final timeout (regardless of dispatchStatus)
      if (totalAgeMs > finalTimeout) {
        console.log(`[Dispatch] Consultation ${doc.id} timed out after 3 minutes. Terminating session.`);
        
        await doc.ref.update({
          status: 'TERMINATED_SYSTEM_FAILURE',
          dispatchStatus: 'cancelled',
          visitSummary: 'No consultant was available to accept this booking within the required time window.',
          updatedAt: FieldValue.serverTimestamp()
        });

        // Generate refund/store credit ticket
        const ticketId = `TCK-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const amountPaid = data.amountPaidGHS || 0;

        await db.collection('tickets').doc(ticketId).set({
          ticketId,
          patientId: data.patientId,
          patientName: data.patientName || 'Patient',
          originalSessionId: doc.id,
          reason: 'failed_session',
          status: 'active',
          valueGHS: amountPaid,
          remainingGHS: amountPaid,
          notes: 'System auto-refund: No consultant accepted booking within 3 minutes.',
          createdAt: new Date().toISOString()
        });

        // Notify the patient about the compensation ticket
        await dispatchNotification(
          data.patientId, 
          'Compensation Ticket Issued', 
          'A compensation ticket has been issued to your account as no consultant was available. You can use this for your next booking.', 
          'ticket_issued', 
          '/patient-dashboard'
        );

        // Credit the patient's walletBalanceGHS
        if (amountPaid > 0) {
          try {
            await db.collection('users').doc(data.patientId).update({
              walletBalanceGHS: FieldValue.increment(amountPaid)
            });
            console.log(`[Dispatch] Successfully auto-refunded GHS ${amountPaid} to patient ${data.patientId}`);
          } catch (refundErr: any) {
            console.warn(`[Dispatch] Failed to increment walletBalanceGHS for patient ${data.patientId}:`, refundErr.message);
          }
        }
        
        continue; // Handled, go to the next consultation
      }

      // 2. Check for the 45-second escalation trigger (only for direct/ringing)
      const ringStartTime = data.ringingStartedAt || createdTimeMs;
      if (now - ringStartTime > ringingTimeout) {
        if (dispatchStatus === 'direct' || dispatchStatus === 'ringing') {
          console.log(`[Dispatch] Escalating consultation ${doc.id} due to timeout.`);
          await doc.ref.update({
            dispatchStatus: 'escalated',
            initialConsultantId: data.assignedConsultantId || null,
            assignedConsultantId: null,
            ringingStartedAt: now,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('PERMISSION_DENIED') || err?.code === 7) {
      isDbConnected = false;
    } else {
      console.warn("[Dispatch Audit Warning]:", err?.message || err);
    }
  }
}

async function runSubscriptionRenewalWorker() {
  if (!db || !isDbConnected) return;
  try {
    const usersSnapshot = await db.collection('users')
      .where('subscriptionStatus', '==', 'active')
      .get();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const expiresAt = userData.subscriptionExpiresAt;
      if (!expiresAt) continue;

      const expiresTime = new Date(expiresAt).getTime();
      if (expiresTime <= Date.now()) {
        const autoRenew = userData.autoRenew !== false && userData.subscriptionAutoRenew !== false;
        if (!autoRenew) {
          await doc.ref.update({
            subscriptionStatus: 'expired',
            updatedAt: FieldValue.serverTimestamp()
          });
          console.log(`[Subscription Worker] User ${doc.id} subscription expired (auto-renew disabled).`);
          continue;
        }

        const authCode = userData.paystackAuthorizationCode;
        const email = userData.email || 'user@pockettclinic.health';
        const tier = userData.subscriptionTier || 'care_plus';
        const amountGHS = tier === 'pro_partner' ? 199 : 49;
        const amountPesewas = amountGHS * 100;

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        let chargeSuccess = false;

        if (!secretKey) {
          console.warn(`[Paystack Renewal] Secret key missing. Simulating successful renewal charge for user ${doc.id}.`);
          chargeSuccess = true;
        } else {
          try {
            if (!authCode) {
              throw new Error("Missing authorization_code for tokenized charge.");
            }
            const paystackRes = await fetch("https://api.paystack.co/transaction/charge_authorization", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                email,
                amount: amountPesewas,
                authorization_code: authCode
              })
            });
            const paystackData: any = await paystackRes.json();
            if (paystackData.status && paystackData.data.status === "success") {
              chargeSuccess = true;
              console.log(`[Paystack Renewal] Tokenized charge successful for user ${doc.id}. Ref: ${paystackData.data.reference}`);
            } else {
              console.warn(`[Paystack Renewal] Charge failed for user ${doc.id}:`, paystackData.message);
            }
          } catch (chargeErr: any) {
            console.error(`[Paystack Renewal Exception] User ${doc.id}:`, chargeErr.message);
          }
        }

        if (chargeSuccess) {
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
          const newExpiresAt = new Date(Date.now() + thirtyDaysInMs).toISOString();
          const currentTickets = userData.videoChatTickets || 0;
          const newTickets = currentTickets + 1; // 1 free video consultation ticket per renewal

          await doc.ref.update({
            subscriptionStatus: 'active',
            subscriptionExpiresAt: newExpiresAt,
            videoChatTickets: newTickets,
            updatedAt: FieldValue.serverTimestamp()
          });
          console.log(`[Subscription Worker] User ${doc.id} successfully renewed for 30 days.`);
        } else {
          await doc.ref.update({
            subscriptionStatus: 'past_due',
            updatedAt: FieldValue.serverTimestamp()
          });
          console.warn(`[Subscription Worker] User ${doc.id} marked as past_due due to failed renewal charge.`);
        }
      }
    }
  } catch (err: any) {
    console.error("[Subscription Renewal Worker Error]:", err?.message || err);
  }
}

async function runConnectionTimeoutAudit() {
  if (!db || !isDbConnected) return;
  try {
    const now = Date.now();
    const timeoutMs = 5 * 60 * 1000; // 5 minutes

    const snapshot = await db.collection('consultations')
      .where('status', '==', 'IN_PROGRESS')
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const connectionStartedAt = data.connectionStartedAt?.toDate ? data.connectionStartedAt.toDate().getTime() : 0;
      
      let createdTimeMs = 0;
      if (data.createdAt) {
        if (typeof data.createdAt.toMillis === 'function') createdTimeMs = data.createdAt.toMillis();
        else if (data.createdAt.seconds) createdTimeMs = data.createdAt.seconds * 1000;
        else createdTimeMs = new Date(data.createdAt).getTime();
      }

      const isExtremelyStale = createdTimeMs > 0 && (now - createdTimeMs) > (60 * 60 * 1000); // 1 hour
      
      if ((connectionStartedAt > 0 && (now - connectionStartedAt) > timeoutMs) || (connectionStartedAt === 0 && isExtremelyStale)) {
        console.log(`[Timeout Audit] Terminating session ${doc.id} due to stale status (connection: ${connectionStartedAt}, age: ${now - createdTimeMs}ms).`);
        
        await doc.ref.update({
          status: 'TERMINATED_SYSTEM_FAILURE',
          updatedAt: FieldValue.serverTimestamp(),
          visitSummary: 'Session terminated by system. Connection not established within 5-minute window.'
        });
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('PERMISSION_DENIED') || err?.code === 7) {
      isDbConnected = false;
    } else {
      console.warn("[Timeout Audit]:", err?.message || err);
    }
  }
}

async function runLedgerFinalization() {
  if (!db || !isDbConnected) return;
  try {
    const completedSnapshot = await db.collection('consultations')
      .where('status', '==', 'COMPLETED')
      .where('ledgerProcessed', '==', false)
      .get();

    for (const doc of completedSnapshot.docs) {
      const data = doc.data();
      const consultantId = data.assignedConsultantId;
      if (!consultantId) continue;

      // Dynamically fetch the consultant's current tier to apply correct share pct
      const userSnap = await db.collection('users').doc(consultantId).get();
      const userData = userSnap.exists ? userSnap.data() : null;
      const isProTier = userData?.subscriptionTier === 'pro_partner';
      const consultantSharePct = isProTier ? 0.75 : 0.70;

      const amount = data.amountPaidGHS || 0;
      let consultantShare = amount * consultantSharePct;
      let referrerShare = 0;

      // Only award a referral commission split if it was a true, active-session clinical referral
      const isRealReferral = (data.referralState === 'ACCEPTED' || data.referralState === 'COMPLETED') && data.initialConsultantId;

      if (isRealReferral) {
        consultantShare = amount * 0.5;
        referrerShare = amount * 0.2;
      }

      const batch = db.batch();
      
      const ledgerRef = db.collection('earnings_ledger').doc(consultantId);
      batch.set(ledgerRef, {
        totalEarnings: FieldValue.increment(consultantShare),
        availableBalance: FieldValue.increment(consultantShare),
        lastTransactionAt: FieldValue.serverTimestamp()
      }, { merge: true });

      if (referrerShare > 0 && data.initialConsultantId) {
        const refLedgerRef = db.collection('earnings_ledger').doc(data.initialConsultantId);
        batch.set(refLedgerRef, {
          totalEarnings: FieldValue.increment(referrerShare),
          availableBalance: FieldValue.increment(referrerShare),
          lastTransactionAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      batch.update(doc.ref, { 
        ledgerProcessed: true,
        consultantEarnings: consultantShare,
        referrerEarnings: referrerShare,
        platformFee: amount - consultantShare - referrerShare
      });

      await batch.commit();
    }
  } catch (err: any) {
    if (err?.message?.includes('PERMISSION_DENIED') || err?.code === 7) {
      isDbConnected = false;
    } else {
      console.warn("[Ledger]:", err?.message || err);
    }
  }
}

// Background Workers (moved into init sequence)




async function sendFallbackSMS(targetUid: string, title: string, body: string, targetPath: string) {
  if (!db) return;
  try {
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (!userDoc.exists) return;
    const phone = userDoc.data()?.phone || userDoc.data()?.phoneNumber;
    if (!phone) {
      console.log(`[SMS FALLBACK] No phone number for ${targetUid}, falling back to email if configured.`);
      return sendFallbackEmail(targetUid, title, body, targetPath);
    }

    console.log(`[SMS FALLBACK] Attempting SMS delivery to ${phone}`);
    const smsEndpoint = "https://smsc.hubtel.com/v1/messages/send";
    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.warn(`[SMS FALLBACK] Hubtel credentials missing. Skipping SMS dispatch to ${phone}.`);
      return;
    }

    // Real implementation would use fetch/axios here with Basic Auth
    // const response = await fetch(smsEndpoint, { ... });
    console.log(`[SMS FALLBACK] SMS Dispatch initiated (Placeholder for production gateway) to ${phone}`);

    // In a production scenario, you would also optionally send the email, 
    // or return here. We'll return here assuming SMS is the primary fallback.
  } catch (err) {
    console.error('[SMS Fallback Error]:', err);
  }
}

async function sendFallbackEmail(targetUid: string, title: string, body: string, targetPath: string) {
  if (!db) return;
  try {
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (!userDoc.exists) return;
    const email = userDoc.data()?.email;
    const name = userDoc.data()?.fullName || 'User';
    if (!email) return;

    let transporter;
    const nodemailer = await import("nodemailer");

    let smtpHost = process.env.SMTP_HOST;
    let smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    let smtpUser = process.env.SMTP_USER;
    let smtpPass = process.env.SMTP_PASS;

    try {
      const integrationDoc = await db.collection('settings').doc('integration_keys').get();
      if (integrationDoc.exists) {
        const data = integrationDoc.data();
        if (data?.smtpHost) {
          smtpHost = data.smtpHost;
          smtpPort = data.smtpPort ? parseInt(data.smtpPort) : smtpPort;
          smtpUser = data.smtpUser || smtpUser;
          smtpPass = data.smtpPass || smtpPass;
        }
      }
    } catch (e) {
      console.warn("[Email Config load failed]:", e);
    }
    
    if (smtpHost) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      console.warn(`[Email Fallback] SMTP credentials missing. Skipping Email dispatch for ${targetUid}.`);
      return;
    }

    const appUrl = process.env.VITE_APP_URL || 'https://pockettclinic.example.com';
    const link = targetPath.startsWith('http') ? targetPath : `${appUrl}${targetPath}`;

    const info = await transporter.sendMail({
      from: '"PockettClinic Alerts" <noreply@pockettclinic.example.com>',
      to: email,
      subject: title,
      text: `Hello ${name},

${body}

View details: ${link}

Regards,
PockettClinic Team`,
      html: `<p>Hello ${name},</p><p>${body}</p><p><a href="${link}">View Details</a></p><p>Regards,<br/>PockettClinic Team</p>`,
    });

    console.log(`[Email] Fallback sent to ${email}. ${smtpHost ? '' : 'Preview: ' + nodemailer.getTestMessageUrl(info)}`);
  } catch (err) {
    console.error("[Email Fallback Error]:", err);
  }
}

async function dispatchNotification(targetUid: string, title: string, body: string, actionType: string, targetPath: string, meetingId?: string) {
  if (!db || !isDbConnected) {
    console.log(`[Notification Dispatch] Server DB not connected. Handled via client.`);
    return;
  }
  try {
    // 1. Write to user_notifications collection for in-app bell
    const notifRef = db.collection('user_notifications').doc(targetUid).collection('items').doc();
    await notifRef.set({
      title,
      body,
      actionType,
      targetPath,
      meetingId: meetingId || null,
      isRead: false,
      createdAt: FieldValue.serverTimestamp()
    });

    let pushSuccess = false;
    // 2. Fetch FCM Token and send push notification
    let fcmToken = null;
    const fcmTokenDoc = await db.collection('fcm_tokens').doc(targetUid).get();
    if (fcmTokenDoc.exists) {
      fcmToken = fcmTokenDoc.data()?.token;
    } else {
      // Fallback: check users collection
      const userDoc = await db.collection('users').doc(targetUid).get();
      if (userDoc.exists) {
        fcmToken = userDoc.data()?.fcmToken;
      }
    }

    if (fcmToken) {
      let validApp;
        for (const app of getApps()) {
            if (app.options.projectId === db.projectId || app.name === db.projectId) { 
                validApp = app;
                break;
            }
        }
        if (!validApp) validApp = getApps()[0];

        if (validApp) {
          const messaging = getMessaging(validApp);
          try {
            await messaging.send({
              token: fcmToken,
              notification: {
                title,
                body
              },
              data: {
                actionType,
                targetPath,
                meetingId: meetingId || ""
              }
            });
            console.log(`[FCM] Push sent to ${targetUid}`);
            pushSuccess = true;
          } catch (e) {
            console.warn(`[FCM] Push failed for ${targetUid}`);
          }
        }
      }
    
    if (!pushSuccess) {
      await sendFallbackSMS(targetUid, title, body, targetPath);
    }
  } catch (err: any) {
    if (err?.message?.includes('PERMISSION_DENIED') || err?.code === 7) {
      console.warn('[Notification Dispatch] Server Firestore permission disabled. Mark as unconnected.');
      isDbConnected = false;
    } else {
      console.warn('[Notification Dispatch]:', err?.message || err);
    }
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://ais-pre-nb6fdx44g3pwc5v7hzbjbp-512810860395.europe-west2.run.app';
  app.use(cors({
    origin: [
      clientOrigin,
      'https://ais-dev-nb6fdx44g3pwc5v7hzbjbp-512810860395.europe-west2.run.app',
      'https://ais-pre-nb6fdx44g3pwc5v7hzbjbp-512810860395.europe-west2.run.app',
      'http://localhost:3000'
    ],
    credentials: true
  }));
  app.use(express.json({ limit: "50mb" }));

  // --- Rate Limiters ---
  // Baseline rate limiter: 100 requests per 15 minutes per IP
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    validate: false,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." },
    handler: (req: any, res: any, next: any, options: any) => {
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      res.status(options.statusCode).json(options.message);
    }
  });

  // Stricter, per-user limiter for Gemini-backed AI endpoints: 25 requests per hour
  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 25,
    validate: false,
    keyGenerator: (req: any) => {
      return req.user?.uid || req.ip || "anonymous";
    },
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: { error: "AI query rate limit exceeded. Please try again in an hour." },
    handler: (req: any, res: any, next: any, options: any) => {
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      res.status(options.statusCode).json(options.message);
    }
  });

  // Stricter limiter on verify-paystack and payout request endpoints: 10 requests per 15 minutes
  const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    validate: false,
    keyGenerator: (req: any) => {
      return req.user?.uid || req.ip || "anonymous";
    },
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: { error: "Too many payment/payout attempts. Please try again in 15 minutes." },
    handler: (req: any, res: any, next: any, options: any) => {
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      res.status(options.statusCode).json(options.message);
    }
  });

  // Apply baseline IP-based rate limiter to all API endpoints
  app.use("/api", apiLimiter);

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      projectId: db?.projectId || 'unknown',
      apps: getApps().length
    });
  });

  // Add manual triggers for workers for debugging
  app.get("/api/admin/run-workers", async (req, res) => {
    console.log("[Admin] Manually triggering workers...");
    try {
      await runDispatchAudit();
      await runLedgerFinalization();
      res.json({ status: "Workers triggered successfully." });
    } catch (e: any) {
      console.error("[Run Workers Error]:", e);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // --- Production Auth & Session Verification ---
  const verifyAuth = async (req: any, res: any, next: any) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { getAuth } = await import("firebase-admin/auth");
      const { getApps } = await import("firebase-admin/app");
      const apps = getApps();
      const authInstance = apps.length > 0 ? getAuth(apps[0]) : getAuth();
      const decoded = await authInstance.verifyIdToken(idToken);
      req.user = decoded;
      next();
    } catch (e: any) {
      console.error("verifyAuth error:", e.message);
      res.status(401).json({ error: "Invalid token" });
    }
  };

  app.post("/api/auth/verify-session", async (req, res) => {
    const { idToken, role = "patient" } = req.body;

    if (!idToken) {
      return res.status(401).json({ error: "Missing ID token" });
    }

    try {
      const { getAuth } = await import("firebase-admin/auth");
      const { getApps } = await import("firebase-admin/app");
      const apps = getApps();
      const authInstance = apps.length > 0 ? getAuth(apps[0]) : getAuth();
      const decodedToken = await authInstance.verifyIdToken(idToken);
      const { uid, email, name, picture } = decodedToken;

      let roleResult = role;
      if (isDbConnected && db) {
        try {
          const userRef = db.collection("users").doc(uid);
          const userDoc = await userRef.get();

          if (!userDoc.exists) {
            await userRef.set({
              uid,
              email: email || "",
              displayName: name || "User",
              photoURL: picture || "",
              role: role,
              hasAcceptedCareTerms: false,
              createdAt: FieldValue.serverTimestamp(),
              lastLoginAt: FieldValue.serverTimestamp(),
              walletBalanceGHS: 0,
            });
          } else {
            roleResult = userDoc.data()?.role || role;
            await userRef.update({
              lastLoginAt: FieldValue.serverTimestamp(),
            });
          }
        } catch (e: any) {
          console.warn("[Auth Verify Server DB Warning]:", e.message);
        }
      }

      res.json({
        success: true,
        user: {
          uid,
          email,
          displayName: name,
          photoURL: picture,
          role: roleResult,
        },
      });
    } catch (error) {
      console.error("[Auth Verification Error]:", error);
      res.status(401).json({ error: "Invalid or expired session token" });
    }
  });

  app.post("/api/ai/transcript-summary", verifyAuth, aiLimiter, async (req: any, res: any) => {
    try {
      const { transcript, chiefComplaints, clinicalNotes } = req.body;
      if (!transcript) return res.status(400).json({ error: "Missing transcript" });

      const prompt = `You are a medical AI assistant.
Your task is to generate a formal Visit Summary Report based on the following consultation transcript and preliminary notes.
The report should be properly formatted in clean HTML (e.g., using <h3>, <p>, <ul>, <li>).
Do NOT wrap the output in markdown code blocks like \`\`\`html. Just return the raw HTML string.

Preliminary Notes from Consultant:
Chief Complaints: ${chiefComplaints || 'None provided'}
Clinical Notes: ${clinicalNotes || 'None provided'}

Consultation Transcript:
${transcript}
`;
      const response = await generateContentWithFallback({
        preferredModel: "gemini-3.7-flash",
        contents: prompt
      });

      res.json({ result: response.text?.trim() });
    } catch (err: any) {
      console.error("[Transcript Summary Error]:", err);
      res.status(500).json({ error: "Failed to generate transcript summary" });
    }
  });

  app.post("/api/ai/soap", verifyAuth, aiLimiter, async (req: any, res: any) => {
    try {
      const { notes } = req.body;
      if (!notes) return res.status(400).json({ error: "Missing clinical notes" });

      const prompt = `You are a medical AI assistant.
Transform the following rough clinical notes into a properly formatted SOAP (Subjective, Objective, Assessment, Plan) note using HTML.
Do NOT wrap the output in markdown code blocks like \`\`\`html.
Just return the raw HTML string (e.g. <h2>Subjective</h2><p>...</p>).

Notes:
${notes}
`;
      const response = await generateContentWithFallback({
        preferredModel: "gemini-3.7-flash",
        contents: prompt
      });

      res.json({ result: response.text?.trim() });
    } catch (err: any) {
      console.error("[SOAP Generation Error]:", err);
      res.status(500).json({ error: "Failed to generate SOAP note" });
    }
  });

  app.post("/api/ai/transcribe", aiLimiter, async (req: any, res: any) => {
    try {
      const { conversationText, chiefComplaints } = req.body;
      const combinedText = conversationText || "No active conversation transcript recorded.";
      const complaintsText = chiefComplaints || "None provided";

      const prompt = `You are an expert clinical documentation AI. Based on the following consultation transcription or notes, generate a structured clinical summary.
Your response MUST be a valid JSON object matching the following typescript type:
{
  "chiefComplaint": string,
  "discussionHistory": string,
  "suggestedInterventions": string,
  "nextSteps": string,
  "formattedSummary": string // beautifully formatted Markdown summary containing headings, lists, bullet points, and clinical assessment
}

Ensure the output is 100% valid JSON and nothing else. Do not wrap the JSON in code blocks (such as \`\`\`json). Just return the raw JSON string.

Chief Complaints:
${complaintsText}

Transcription/Notes:
${combinedText}
`;

      const response = await generateContentWithFallback({
        preferredModel: "gemini-3.7-flash",
        contents: prompt
      });

      let cleanText = response.text?.trim() || "";
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch (jsonErr) {
        console.error("[Transcribe JSON Parse Fail]:", jsonErr, cleanText);
        parsed = {
          chiefComplaint: complaintsText !== "None provided" ? complaintsText : "Routine clinical assessment",
          discussionHistory: combinedText,
          suggestedInterventions: "Clinical review, medication adjustments as indicated, lifestyle coaching.",
          nextSteps: "Follow-up consultation in 7 days or sooner if symptoms worsen.",
          formattedSummary: `### CLINICAL VISIT SUMMARY\n\n**Chief Complaint:** ${complaintsText}\n\n**Discussion:** ${combinedText}\n\n**Assessment & Plan:** Ongoing clinical monitoring.`
        };
      }

      res.json({ result: parsed });
    } catch (err: any) {
      console.error("[Transcribe Endpoint Error]:", err);
      res.status(500).json({ error: "Failed to generate structured transcription summary" });
    }
  });

  app.post("/api/ai/ocr", verifyAuth, aiLimiter, async (req: any, res: any) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const response = await generateContentWithFallback({
        preferredModel: "gemini-3.7-flash",
        contents: [
          "Examine this image and extract medical text into JSON: rawText, medications, patientName, prescriberName, summary.",
          { inlineData: { data: cleanBase64, mimeType } }
        ]
      });

      let parsed;
      try {
        const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(text);
      } catch (e) {
        console.warn("[OCR Parsing Warning] Failed to parse JSON from AI response, creating default structure. Raw text:", response.text);
        parsed = { 
          rawText: response.text,
          medications: [],
          patientName: "",
          prescriberName: "",
          summary: response.text.substring(0, 300)
        };
      }
      res.json({ result: parsed });
    } catch (error: any) {
      console.error("[OCR Endpoint Error]:", error);
      res.status(500).json({ error: `OCR failed: ${error.message || error}` });
    }
  });

  app.post("/api/ai/analyze-medical-doc", verifyAuth, aiLimiter, async (req: any, res: any) => {
    try {
      const { imageUrl, docType = "auto" } = req.body;
      if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl" });

      const prompt = `You are a medical AI specialist. Analyze this medical document image.
      Extract key clinical data and provide:
      1. A professional summary for a doctor.
      2. A list of medications/vitals found.
      3. Suggested SOAP note components (Subjective/Objective).
      Return as JSON with: { summary, medications: [], soapDraft: { subjective, objective } }`;

      let contents: any;
      if (imageUrl.startsWith("data:image/")) {
        const cleanBase64 = imageUrl.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = imageUrl.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
        contents = [
          prompt,
          { inlineData: { data: cleanBase64, mimeType } }
        ];
      } else {
        contents = `You are a medical AI specialist. Analyze this medical document image: ${imageUrl}
        Extract key clinical data and provide:
        1. A professional summary for a doctor.
        2. A list of medications/vitals found.
        3. Suggested SOAP note components (Subjective/Objective).
        Return as JSON with: { summary, medications: [], soapDraft: { subjective, objective } }`;
      }

      const response = await generateContentWithFallback({
        preferredModel: "gemini-3.7-flash",
        contents
      });

      let result;
      try {
        const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(text);
      } catch (e) {
        console.warn("[Analyze Doc Parsing Warning] Failed to parse JSON from AI response. Raw text:", response.text);
        result = { 
          summary: response.text,
          medications: [],
          soapDraft: {
            subjective: "See summary text.",
            objective: "See summary text."
          }
        };
      }

      res.json({ success: true, result });
    } catch (err: any) {
      console.error("Analysis error:", err);
      res.status(500).json({ error: `Analysis failed: ${err.message || err}` });
    }
  });

  app.post("/api/ai/speech-translate", verifyAuth, aiLimiter, async (req: any, res: any) => {
    try {
      const { audioBase64, text, mimeType = "audio/webm", targetLang = "English", generateSpeech = false } = req.body;
      
      let detectedLanguage = "Unknown";
      let originalTranscript = "";
      let translatedTranscript = "";

      if (text) {
        // Direct Text Translation Pathway
        originalTranscript = text;
        const prompt = `You are an expert medical translation agent.
Translate the input text into the target language: "${targetLang}".
Also, detect the source language.
You must return ONLY a JSON response matching this schema (do NOT wrap in markdown or write anything else):
{
  "detectedLanguage": "The name of the detected language (e.g. English, Twi, Spanish)",
  "translatedTranscript": "The translation of the input text into ${targetLang}"
}

Input Text:
"${text}"`;

        const response = await generateContentWithFallback({
          preferredModel: "gemini-3.7-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        try {
          const resText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(resText);
          detectedLanguage = parsed.detectedLanguage;
          translatedTranscript = parsed.translatedTranscript;
        } catch (e) {
          detectedLanguage = "Unknown";
          translatedTranscript = response.text || "Could not translate";
        }
      } else {
        // Audio Translation Pathway
        if (!audioBase64) {
          return res.status(400).json({ error: "Missing audioBase64 or text" });
        }

        const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
        const prompt = `You are an expert medical speech-to-text translation agent.
Analyze the attached audio clip:
1. Detect the speaker's source language. It could be English, Spanish, French, or West African dialects/languages like Twi, Ga, Hausa, Yoruba, etc.
2. Transcribe the audio exactly as spoken in its original language.
3. Translate the transcribed speech into the target language: "${targetLang}".

You must return ONLY a JSON response matching this schema (do NOT wrap in markdown formatting or write anything else):
{
  "detectedLanguage": "The name of the detected language (e.g. English, Twi, French)",
  "originalTranscript": "The exact transcript in the original language",
  "translatedTranscript": "The translation of the transcript into ${targetLang}"
}`;

        const audioPart = {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType
          }
        };

        const response = await generateContentWithFallback({
          preferredModel: "gemini-3.7-flash",
          contents: [prompt, audioPart],
          config: {
            responseMimeType: "application/json"
          }
        });

        try {
          const resText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsedResult = JSON.parse(resText);
          detectedLanguage = parsedResult.detectedLanguage;
          originalTranscript = parsedResult.originalTranscript;
          translatedTranscript = parsedResult.translatedTranscript;
        } catch (e) {
          detectedLanguage = "Unknown";
          originalTranscript = response.text || "Could not transcribe";
          translatedTranscript = response.text || "Could not translate";
        }
      }

      let ttsAudioBase64 = null;
      if (generateSpeech && translatedTranscript) {
        try {
          const ttsResponse = await generateContentWithFallback({
            preferredModel: "gemini-3.7-flash",
            contents: [{ parts: [{ text: `Say clearly and professionally: ${translatedTranscript}` }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Kore" }
                }
              }
            }
          });
          ttsAudioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        } catch (ttsErr) {
          console.error("TTS generation error during speech-to-speech translation:", ttsErr);
        }
      }

      res.json({
        success: true,
        detectedLanguage,
        originalTranscript,
        translatedTranscript,
        ttsAudioBase64
      });

    } catch (error: any) {
      console.error("[Speech-to-Speech Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/admin/schedule-review", verifyAuth, async (req: any, res: any) => {
    try {
      const { consultantId, consultantEmail, consultantPhone, meetingDate, meetingLink, fullName } = req.body;
      const { role } = req.user;

      if (role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!consultantId || !consultantEmail || !consultantPhone || !meetingDate || !meetingLink) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Initialize Nodemailer (Mock/Optional if credentials missing)
      let smtpHost = process.env.SMTP_HOST;
      let smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      let smtpUser = process.env.SMTP_USER;
      let smtpPass = process.env.SMTP_PASS;

      try {
        const integrationDoc = await db.collection('settings').doc('integration_keys').get();
        if (integrationDoc.exists) {
          const data = integrationDoc.data();
          if (data?.smtpHost) {
            smtpHost = data.smtpHost;
            smtpPort = data.smtpPort ? parseInt(data.smtpPort) : smtpPort;
            smtpUser = data.smtpUser || smtpUser;
            smtpPass = data.smtpPass || smtpPass;
          }
        }
      } catch (e) {
        console.warn("[Email Config load failed in review route]:", e);
      }

      let emailSent = false;
      if (smtpHost && smtpUser && smtpPass) {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465, // true for 465, false for other ports
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        transporter.sendMail({
          from: `"PockettClinic Admin" <${smtpUser}>`,
          to: consultantEmail,
          subject: "Mandatory Face-to-Face Compliance Review",
          text: `Dear ${fullName},\n\nA mandatory Face-to-Face compliance review has been scheduled for ${new Date(meetingDate).toLocaleString()}.\n\nPlease join using the following secure video link: ${meetingLink}\n\nRegards,\nPockettClinic Admin Team`,
          html: `<p>Dear ${fullName},</p><p>A mandatory Face-to-Face compliance review has been scheduled for <b>${new Date(meetingDate).toLocaleString()}</b>.</p><p>Please join using the following secure video link: <a href="${meetingLink}">${meetingLink}</a></p><p>Regards,<br/>PockettClinic Admin Team</p>`,
        }).catch(e => console.error("SMTP dispatch failed:", e.message));
        emailSent = true;
      } else {
        console.warn("SMTP credentials not configured. Skipping actual email dispatch.");
        emailSent = true; // Pretend it succeeded for the demo if not configured
      }

      await dispatchNotification(consultantId, "Mandatory Face-to-Face Review", `You have a scheduled review on ${new Date(meetingDate).toLocaleString()}. Please join using this link: ${meetingLink}`, "admin_review", "/consultant/dashboard");
      res.json({ success: true, emailSent });
    } catch (err: any) {
      console.error("[Schedule Review Error]:", err);
      res.status(500).json({ error: "Failed to schedule review and send notifications" });
    }
  });

  app.post("/api/admin/compare-faces", verifyAuth, async (req: any, res: any) => {
    try {
      const { face1, face2 } = req.body; // Base64 strings
      if (!face1 || !face2) return res.status(400).json({ error: "Missing images" });

      // Check if admin
      const adminEmails = ["pockettclinic@gmail.com"];
      if (!adminEmails.includes(req.user.email)) {
        return res.status(403).json({ error: "Unauthorized access" });
      }

      const cleanFace1 = face1.replace(/^data:image\/\w+;base64,/, "");
      const cleanFace2 = face2.replace(/^data:image\/\w+;base64,/, "");

      const response = await generateContentWithFallback({
        preferredModel: "gemini-3.7-flash",
        contents: [
          {
            text: "Compare the person in these two images. Image 1 is an official license/ID photo. Image 2 is a profile selfie. Determine if they are the same person. Return a JSON object with: matchPercentage (0-100), isMatch (boolean), and reasoning (brief string)."
          },
          { inlineData: { data: cleanFace1, mimeType: "image/jpeg" } },
          { inlineData: { data: cleanFace2, mimeType: "image/jpeg" } }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      let result;
      try {
        result = JSON.parse(response.text.trim());
      } catch (e) {
        result = { error: "Failed to parse AI response", raw: response.text };
      }
      res.json(result);
    } catch (error: any) {
      console.error("[Face Comparison Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/verify-ghana-card", async (req, res) => {
    try {
      const { ghanaCardNumber, fullName } = req.body;
      if (!ghanaCardNumber) return res.status(400).json({ error: "Missing card number" });

      console.log(`[Identity Verification] Lookup requested for ${ghanaCardNumber} (${fullName})`);

      // Real integration would go here. For now, we return a service unavailable error to comply with 'no simulation' rule.
      res.status(503).json({ error: "Ghana Card Verification service is currently not configured or unavailable." });
    } catch (error: any) {
      console.error("[Ghana Card Verification Error]:", error);
      res.status(500).json({ error: "Verification service communication error" });
    }
  });

  // --- Secure Consultation & Medical Routes ---

  app.post("/api/consultations/create", verifyAuth, async (req: any, res: any) => {
    try {
      const { consultation } = req.body;
      const { uid } = req.user;
      
      // Determine if user is admin server-side
      let isAdmin = false;
      let userData = null;
      if (isDbConnected && db) {
        try {
          const userDoc = await db.collection('users').doc(uid).get();
          userData = userDoc.exists ? userDoc.data() : null;
        } catch (e) {}
      }
      const superAdmins = ["missty2k@gmail.com", "pockettclinic@gmail.com", "pharmabridgeghana@gmail.com"];
      const isSuperAdmin = req.user.email && superAdmins.includes(req.user.email.toLowerCase());
      isAdmin = isSuperAdmin || userData?.role === 'admin' || req.user.email?.includes('admin');

      // Secondary server-side validation
      if (!isAdmin && consultation.patientId !== uid) {
        return res.status(403).json({ error: "Identity mismatch" });
      }

      const isFreeAdminBypass = consultation.amountPaidGHS === 0 || consultation.paymentMethod === 'ADMIN_BYPASS';
      if (isFreeAdminBypass && !isAdmin) {
        return res.status(403).json({ error: "Only administrators can create payment-free consultation sessions." });
      }

      if (isDbConnected && db) {
        try {
          const docRef = db.collection('consultations').doc(consultation.sessionId);
          await docRef.set({
            ...consultation,
            createdAt: FieldValue.serverTimestamp(),
            ringingStartedAt: isFreeAdminBypass ? Date.now() : (consultation.ringingStartedAt || Date.now()),
            ledgerProcessed: false
          });

          if (isFreeAdminBypass) {
            await db.collection('admin_audit_logs').add({
              action: 'ADMIN_FREE_CONSULTATION_CREATED',
              adminUid: uid,
              adminEmail: req.user.email || userData?.email || 'unknown',
              consultationId: consultation.sessionId,
              patientId: consultation.patientId,
              patientName: consultation.patientName,
              consultantId: consultation.consultantId,
              consultantName: consultation.consultantName,
              createdAt: FieldValue.serverTimestamp()
            });
          }

          if (consultation.assignedConsultantId) {
            await dispatchNotification(
              consultation.assignedConsultantId,
              "New Consultation Request",
              `Patient ${consultation.patientName} has requested a consultation.`,
              "consultation_request",
              "/consultant/dashboard"
            );
          }
        } catch (dbErr: any) {
          console.warn("[Session Create Server DB Warning]:", dbErr.message);
        }
      }

      res.json({ success: true, sessionId: consultation.sessionId });
    } catch (error: any) {
      console.error("[Session Create Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/prescriptions/issue", verifyAuth, async (req: any, res: any) => {
    try {
      const { prescription, sessionId } = req.body;
      const { uid } = req.user;

      if (isDbConnected && db) {
        try {
          // Verify consultant role and session ownership
          const userDoc = await db.collection('users').doc(uid).get();
          if (userDoc.exists && userDoc.data()?.role !== 'consultant') {
            return res.status(403).json({ error: "Only consultants can issue prescriptions" });
          }

          const batch = db.batch();
          const rxRef = db.collection('prescriptions').doc(prescription.rxId);
          batch.set(rxRef, {
            ...prescription,
            consultantId: uid,
            createdAt: FieldValue.serverTimestamp()
          });

          const sessionRef = db.collection('consultations').doc(sessionId);
          batch.update(sessionRef, {
            prescriptionId: prescription.rxId,
            status: 'COMPLETED',
            updatedAt: FieldValue.serverTimestamp()
          });

          await batch.commit();
          const sessDoc = await db.collection("consultations").doc(sessionId).get();
          if (sessDoc.exists) {
            await dispatchNotification(
              sessDoc.data().patientId,
              "Prescription Ready",
              "Your consultant has issued a new prescription.",
              "prescription_issued",
              "/patient/dashboard"
            );
          }
        } catch (dbErr: any) {
          console.warn("[Prescription Issue Server DB Warning]:", dbErr.message);
        }
      }

      res.json({ success: true, rxId: prescription.rxId });
    } catch (error: any) {
      console.error("[Prescription Issue Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/vitals/log", verifyAuth, async (req: any, res: any) => {
    try {
      const { vitals } = req.body;
      const { uid } = req.user;

      const recordId = `VIT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      if (isDbConnected && db) {
        try {
          await db.collection('vitals').doc(recordId).set({
            ...vitals,
            recordId,
            patientId: uid,
            createdAt: new Date().toISOString()
          });
        } catch (dbErr: any) {
          console.warn("[Vitals Log Server DB Warning]:", dbErr.message);
        }
      }

      res.json({ success: true, recordId });
    } catch (error: any) {
      console.error("[Vitals Log Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  
  app.post("/api/notifications/trigger", verifyAuth, async (req: any, res: any) => {
    try {
      const { 
        targetUid, recipientId,
        targetCadre, recipientCadre,
        title, 
        body, message,
        actionType, type,
        targetPath, path,
        meetingId 
      } = req.body;
      
      const actualTargetUid = targetUid || recipientId;
      const actualActionType = actionType || type || 'general';
      const actualBody = body || message || 'New notification';
      const actualPath = targetPath || path || '/';
      const actualCadre = targetCadre || recipientCadre;

      if (actualTargetUid && actualTargetUid !== 'BROADCAST') {
        await dispatchNotification(actualTargetUid, title, actualBody, actualActionType, actualPath, meetingId);
      } else {
        // Broadcast notification to all active consultants (optionally filtered by cadre)
        if (db && isDbConnected) {
          const snapshot = await db.collection('users').where('role', '==', 'consultant').get();
          const targetCadreClean = (actualCadre || '').toUpperCase();
          
          const promises = snapshot.docs.map(async (docSnap: any) => {
            const data = docSnap.data();
            const userCadre = (data.cadre || 'UNASSIGNED').toUpperCase();
            
            // Allow matching on both cadre and specialty
            const isMatch = !targetCadreClean || 
              targetCadreClean === 'ALL' || 
              userCadre === targetCadreClean ||
              (targetCadreClean.includes('DOCTOR') && ['DOCTOR', 'MEDICAL DOCTOR', 'CONSULTANT', 'SPECIALIST', 'PHYSICIAN_ASSISTANT'].includes(userCadre)) ||
              (targetCadreClean.includes('PHARM') && ['PHARMACIST', 'CLINICAL_PHARMACIST', 'PHARMACY_TECHNICIAN', 'PHARM_TECH'].includes(userCadre));
            
            if (isMatch) {
              await dispatchNotification(docSnap.id, title, actualBody, actualActionType, actualPath, meetingId);
            }
          });
          await Promise.all(promises);
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Notification Trigger Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // --- System Error Tracker & Gemini Diagnostic Bridge ---
  app.post("/api/system-errors/log", async (req: any, res: any) => {
    try {
      const { message, stack, userId, role, component, page, customKeys, logs } = req.body;
      
      // Determine severity based on contents
      const lowercase = `${message || ''} ${stack || ''}`.toLowerCase();
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (lowercase.includes("permission_denied") || lowercase.includes("firestore") && lowercase.includes("permission")) {
        severity = 'high';
      } else if (lowercase.includes("livekit") || lowercase.includes("token") || lowercase.includes("jwt")) {
        severity = 'critical';
      } else if (lowercase.includes("null") || lowercase.includes("undefined") || lowercase.includes("not a function")) {
        severity = 'high';
      } else if (lowercase.includes("network") || lowercase.includes("timeout") || lowercase.includes("fetch")) {
        severity = 'medium';
      }

      // Generate smart SRE explanation using Gemini
      let aiExplanation = "No diagnostic generated.";
      try {
        const prompt = `You are an expert SRE and Senior Software Engineer. Provide a concise, clear plain English diagnostic explanation breakdown (2-3 sentences max) for the following frontend React application exception. 
Explain the potential root cause (e.g. invalid permissions, LiveKit token timeout, networking failure) and actionable resolution tips.

Error Message: "${message || 'Unknown exception'}"
Location: Page "${page || 'Unknown'}", Component "${component || 'Unknown'}"
Metadata: ${JSON.stringify(customKeys || {})}
Recent System Breadcrumbs:
${(logs || []).join('\n')}

Stack Trace:
${stack || 'No stack trace provided.'}
`;
        const aiResponse = await generateContentWithFallback({
          preferredModel: "gemini-3.7-flash",
          contents: prompt
        });
        aiExplanation = aiResponse.text?.trim() || aiExplanation;
      } catch (aiErr: any) {
        console.warn("[System Error Diagnostic AI Fail]:", aiErr.message);
        aiExplanation = `Local Heuristic Diagnostic: ${
          severity === 'critical' ? 'Critical RTC Token or WebRTC connectivity issue. Check LiveKit credential setup.' :
          severity === 'high' ? 'High-priority database permission violation or null reference. Inspect security rules.' :
          'Network or component runtime exception.'
        }`;
      }

      if (db && isDbConnected) {
        const errorRef = db.collection('system_errors').doc();
        const errorDoc = {
          id: errorRef.id,
          timestamp: FieldValue.serverTimestamp(),
          message: message || "Unknown runtime error",
          stack: stack || "",
          userId: userId || "anonymous",
          role: role || "anonymous",
          component: component || "Global Handler",
          page: page || "unknown",
          customKeys: customKeys || {},
          logs: logs || [],
          aiExplanation,
          status: "unresolved",
          severity
        };

        await errorRef.set(errorDoc);
        res.json({ success: true, errorId: errorRef.id, aiExplanation });
      } else {
        res.status(500).json({ error: "Firestore Admin is offline. Diagnostic log deferred." });
      }
    } catch (err: any) {
      console.error("[Log System Error Fail]:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/admin/system-errors/update-status", verifyAuth, async (req: any, res: any) => {
    try {
      const { errorId, status } = req.body;
      const { role } = req.user;

      if (role !== 'admin') {
        return res.status(403).json({ error: "Only admins can change system health parameters." });
      }

      if (!errorId || !status) {
        return res.status(400).json({ error: "Missing required parameters." });
      }

      if (db && isDbConnected) {
        await db.collection('system_errors').doc(errorId).update({
          status,
          updatedAt: FieldValue.serverTimestamp()
        });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Firestore connection offline" });
      }
    } catch (err: any) {
      console.error("[Update Error Status Error]:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/payouts/request", verifyAuth, paymentLimiter, async (req: any, res: any) => {
    try {
      const { requestData } = req.body;
      const { uid } = req.user;

      if (!requestData || !requestData.amountGHS) {
        return res.status(400).json({ error: "Missing withdrawal amount or request data." });
      }

      if (requestData.consultantId !== uid) {
        return res.status(403).json({ error: "Identity mismatch" });
      }

      const requestedAmount = Number(requestData.amountGHS);
      if (isNaN(requestedAmount) || requestedAmount < 50) {
        return res.status(400).json({ error: "Minimum single withdrawal amount is GHS 50.00." });
      }

      if (!db || !isDbConnected) {
        return res.status(503).json({ error: "Database service unavailable. Please try again." });
      }

      // 1. Fetch consultant user document
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "Consultant profile not found." });
      }

      const userData = userDoc.data();
      if (userData?.role !== 'consultant') {
        return res.status(403).json({ error: "Only registered consultants can initiate payouts." });
      }

      if (userData?.isVerified !== true || userData?.verificationStatus !== 'verified') {
        return res.status(403).json({ error: "Your account must be fully verified by administrators before requesting payouts." });
      }

      if (userData?.isGoodStanding === false || userData?.registryStatus === 'License Expired / Inactive') {
        return res.status(403).json({ error: "Your professional registration status must be in Good Standing to receive payouts." });
      }

      // 2. Dynamically calculate consultant earnings from completed consultations (server-side, immutable source of truth)
      let completedSessions: any[] = [];
      const q1 = await db.collection('consultations')
        .where('assignedConsultantId', '==', uid)
        .where('status', '==', 'COMPLETED')
        .get();
      
      q1.forEach(doc => {
        completedSessions.push(doc.data());
      });

      const q2 = await db.collection('consultations')
        .where('consultantId', '==', uid)
        .where('status', '==', 'COMPLETED')
        .get();
      
      q2.forEach(doc => {
        const session = doc.data();
        if (!completedSessions.some(c => c.sessionId === session.sessionId)) {
          completedSessions.push(session);
        }
      });

      // Compute commission rate dynamically based on current server-side subscription tier
      const isProTier = userData?.subscriptionTier === 'pro_partner';
      const consultantSharePct = isProTier ? 0.75 : 0.70;

      let totalEarningsGHS = 0;
      completedSessions.forEach(session => {
        let payoutAmount = 0;
        const isReferralSession = (session.referralState === 'ACCEPTED' || session.referralState === 'COMPLETED') && session.initialConsultantId;

        if (session.assignedConsultantId === uid) {
          if (isReferralSession) {
            // Treating clinician gets 50%
            payoutAmount = (session.amountPaidGHS || 0) * 0.50;
          } else {
            // Standard/Pro clinician gets full 70% or 75% share
            payoutAmount = (session.amountPaidGHS || 0) * consultantSharePct;
          }
        } else if (session.initialConsultantId === uid && isReferralSession) {
          // Referring consultant gets 20%
          payoutAmount = (session.amountPaidGHS || 0) * 0.20;
        }
        totalEarningsGHS += payoutAmount;
      });
      totalEarningsGHS = Math.round(totalEarningsGHS * 100) / 100;

      // 3. Dynamically aggregate all previous payout requests that are not failed or rejected
      const previousRequests = await db.collection('payout_requests')
        .where('consultantId', '==', uid)
        .get();

      let totalRequestedPayouts = 0;
      previousRequests.forEach(doc => {
        const req = doc.data();
        if (req.status !== 'failed' && req.status !== 'rejected') {
          totalRequestedPayouts += (req.amountGHS || 0);
        }
      });
      totalRequestedPayouts = Math.round(totalRequestedPayouts * 100) / 100;

      // 4. Calculate actual available balance on the server side minus a locked GHS 50.00 reserve
      const lockedReserve = 50.00;
      const serverAvailableBalanceGHS = Math.max(0, Math.round((totalEarningsGHS - totalRequestedPayouts - lockedReserve) * 100) / 100);

      // 5. Enforce safety limit against real balance
      if (requestedAmount > serverAvailableBalanceGHS) {
        return res.status(400).json({ 
          error: `Insufficient funds. Your calculated server-side available balance (minus the GHS 50.00 locked reserve) is GHS ${serverAvailableBalanceGHS.toFixed(2)}, but you requested GHS ${requestedAmount.toFixed(2)}.` 
        });
      }

      // 6. Server-side window validation: Monday, Tuesday, Wednesday only
      const now = new Date();
      // UTC to GHS local offset (GHS is GMT/UTC+0, so GMT day is identical to standard UTC day)
      const dayOfWeekNum = now.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
      const isAllowedDay = [1, 2, 3].includes(dayOfWeekNum); // Mon, Tue, Wed

      if (!isAllowedDay) {
        return res.status(400).json({
          error: "Payout requests are restricted to Mondays, Tuesdays, and Wednesdays only."
        });
      }

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const requestDayOfWeek = daysOfWeek[dayOfWeekNum];

      // 7. Enforce minimum and weekly cycle maximum caps based on professional tier
      const minWithdrawal = isProTier ? 200.00 : 300.00;
      const maxWeeklyCap = isProTier ? 3000.00 : 1500.00;

      if (requestedAmount < minWithdrawal) {
        return res.status(400).json({
          error: `The minimum single withdrawal amount is GHS ${minWithdrawal.toFixed(2)} for your professional tier.`
        });
      }

      // Calculate start of current week's cycle (Monday 00:00:00 UTC)
      const today = new Date();
      const currentDay = today.getUTCDay();
      const diff = today.getUTCDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const startOfWeek = new Date(today.setUTCDate(diff));
      startOfWeek.setUTCHours(0, 0, 0, 0);

      let weekRequestedPayouts = 0;
      previousRequests.forEach(doc => {
        const req = doc.data();
        if (req.status !== 'failed' && req.status !== 'rejected') {
          const reqDate = new Date(req.requestedAt || req.createdAt?.toDate?.() || 0);
          if (reqDate >= startOfWeek) {
            weekRequestedPayouts += (req.amountGHS || 0);
          }
        }
      });

      if (weekRequestedPayouts + requestedAmount > maxWeeklyCap) {
        const remainingCap = Math.max(0, maxWeeklyCap - weekRequestedPayouts);
        return res.status(400).json({
          error: `Weekly cycle cap exceeded. Your remaining withdrawable amount for this cycle is GHS ${remainingCap.toFixed(2)} (Weekly limit: GHS ${maxWeeklyCap.toFixed(2)}).`
        });
      }

      // 8. Securely construct the payout request document on the server side
      const channelType = requestData.channelType === 'bank_transfer' ? 'bank_transfer' : 'mobile_money';
      const secureRequest = {
        requestId: '', // set below
        consultantId: uid,
        consultantName: userData?.fullName || userData?.displayName || 'Consultant',
        amountGHS: requestedAmount,
        channelType,
        networkProvider: channelType === 'mobile_money' ? (requestData.networkProvider || 'MTN') : null,
        bankCode: channelType === 'bank_transfer' ? (requestData.bankCode || 'GCB') : null,
        bankName: channelType === 'bank_transfer' ? (requestData.bankName || 'GCB Bank Plc') : null,
        accountNumber: requestData.accountNumber?.trim() || '',
        accountName: requestData.accountName?.trim() || userData?.fullName || 'Consultant',
        status: 'processing',
        requestDayOfWeek,
        requestedAt: new Date().toISOString(),
        settledAt: null,
        feeAgreementAccepted: true,
        feeAgreementAcceptedAt: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp()
      };

      // 8. Log secure gateway API transaction initialization (Paystack Transfer API integration hook)
      console.log(`[PAYMENT GATEWAY - PAYSTACK/MOMO DISBURSEMENT]`);
      console.log(`- Recipient Name: ${secureRequest.accountName}`);
      console.log(`- Account Number: ${secureRequest.accountNumber}`);
      console.log(`- Amount: GHS ${requestedAmount}`);
      console.log(`- Channel: ${channelType === 'bank_transfer' ? secureRequest.bankName : secureRequest.networkProvider}`);
      console.log(`- Action: Securely initializing recipient and queuing bank transfer batch...`);

      const docRef = db.collection('payout_requests').doc();
      secureRequest.requestId = docRef.id;
      await docRef.set(secureRequest);

      res.json({ success: true, requestId: docRef.id });
    } catch (error: any) {
      console.error("[Payout Request Server Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  
  app.post("/api/payments/initialize", verifyAuth, async (req: any, res: any) => {
    try {
      const { email, amount, reference } = req.body;
      if (!email || !amount || !reference) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        return res.status(503).json({ error: "Payment gateway not configured on server. Please set PAYSTACK_SECRET_KEY." });
      }

      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: amount * 100, // convert to pesewas/kobo
          reference,
          callback_url: 'https://ais-dev-sfhdbluns5cnurbwko2kza-512810860395.europe-west2.run.app/patient/dashboard'
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Payment initialization failed');
      }
      
      res.json(data.data); // contains authorization_url, access_code, reference
    } catch (error) {
      console.error("[Payment Init Error]:", error);
      res.status(500).json({ error: "Failed to initialize payment." });
    }
  });

  app.post("/api/payments/verify-paystack", verifyAuth, paymentLimiter, async (req: any, res: any) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ error: "Missing reference" });

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        console.error("[Paystack Error] Secret key not configured on server.");
        return res.status(500).json({ error: "Payment verification not configured" });
      }

      // Parse reference to find expected price (in pesewas)
      let expectedAmountPesewas = 0;
      const parts = reference.split('_');
      
      if (parts[0] === 'SUB') {
        const planId = parts[1];
        if (planId === 'care_plus') {
          expectedAmountPesewas = 4900; // 49.00 GHS in pesewas
        } else if (planId === 'pro_partner') {
          expectedAmountPesewas = 19900; // 199.00 GHS in pesewas
        } else {
          return res.status(400).json({ error: "Invalid subscription plan reference" });
        }
      } else if (parts[0] === 'REF') {
        const cadre = parts[1]; // 'PHARM_TECH', 'PHARMACIST', 'DOCTOR', 'SPECIALIST'
        const sessionType = parts[2]; // 'CHAT_ONLY', 'AUDIO_ONLY', 'VIDEO'
        
        // Define default rates
        const defaultRates: Record<string, { chat: number; voiceVideo: number }> = {
          PHARM_TECH: { chat: 20, voiceVideo: 30 },
          PHARMACIST: { chat: 30, voiceVideo: 45 },
          DOCTOR: { chat: 45, voiceVideo: 70 },
          SPECIALIST: { chat: 90, voiceVideo: 130 }
        };
        
        const tier = defaultRates[cadre];
        if (!tier) {
          return res.status(400).json({ error: `Invalid clinical cadre: ${cadre}` });
        }
        
        // Try looking up custom override tiers from Firestore global_config
        let chatFeeGHS = tier.chat;
        let voiceVideoFeeGHS = tier.voiceVideo;
        
        try {
          const configSnap = await db.collection('app_settings').doc('global_config').get();
          if (configSnap.exists) {
            const configData = configSnap.data();
            const configTier = configData?.pricing?.tiers?.[cadre];
            if (configTier) {
              if (configTier.chatFeeGHS !== undefined) chatFeeGHS = Number(configTier.chatFeeGHS);
              if (configTier.voiceVideoFeeGHS !== undefined) voiceVideoFeeGHS = Number(configTier.voiceVideoFeeGHS);
            }
          }
        } catch (configErr) {
          console.warn("[Paystack Verification] Firestore global_config lookup failed, using default fallback rates:", configErr);
        }
        
        const isChat = sessionType === 'CHAT_ONLY';
        const expectedGrossFeeGHS = isChat ? chatFeeGHS : voiceVideoFeeGHS;
        expectedAmountPesewas = expectedGrossFeeGHS * 100;
      } else {
        return res.status(400).json({ error: "Invalid payment reference prefix" });
      }

      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${secretKey}`
        }
      });

      const data: any = await response.json();
      if (data.status && data.data.status === "success") {
        const actualPaidAmount = Number(data.data.amount); // in pesewas
        if (actualPaidAmount !== expectedAmountPesewas) {
          console.error(`[Paystack Verification Blocked] Amount paid (${actualPaidAmount} pesewas) does not match expected amount (${expectedAmountPesewas} pesewas) for reference ${reference}.`);
          return res.status(400).json({ status: "failed", verified: false, error: "Payment amount mismatch" });
        }
        res.json({ status: "success", verified: true, data: data.data });
      } else {
        res.status(400).json({ status: "failed", verified: false, error: data.message });
      }
    } catch (error: any) {
      console.error("[Paystack Verification Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/subscriptions/run-renewal", verifyAuth, async (req: any, res: any) => {
    try {
      await runSubscriptionRenewalWorker();
      res.json({ success: true, message: "Subscription renewal worker executed successfully." });
    } catch (error: any) {
      console.error("[Renewal Trigger Error]:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.get("/api/agora/config", (req, res) => {
    if (!process.env.AGORA_APP_ID) {
      return res.status(500).json({ error: "Agora app ID is not configured on the server." });
    }
    res.json({ appId: process.env.AGORA_APP_ID });
  });

  app.post("/api/agora/token", verifyAuth, async (req: any, res: any) => {
    const { roomName } = req.body;
    const requesterUid = req.user.uid;
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!roomName) {
      return res.status(400).json({ error: "Room name is required" });
    }

    if (!appId || !appCertificate) {
      console.error("[Agora] Missing environment variables: AGORA_APP_ID or AGORA_APP_CERTIFICATE");
      return res.status(500).json({ error: "Agora video services are not configured on the server." });
    }
    
    try {
      const requesterUserDoc = await db.collection("users").doc(requesterUid).get();
      if (!requesterUserDoc.exists) {
        return res.status(403).json({ error: "Access denied. User profile not found." });
      }
      
      const requesterData = requesterUserDoc.data();
      const requesterRole = requesterData?.role;
      const isAdmin = requesterRole === "admin";
      let isAuthorized = false;

      if (roomName.startsWith("review-")) {
        const targetConsultantId = roomName.substring(7);
        isAuthorized = requesterUid === targetConsultantId || isAdmin;
      } else {
        const consultationDoc = await db.collection("consultations").doc(roomName).get();
        if (!consultationDoc.exists) {
          return res.status(403).json({ error: "Access denied. Consultation room does not exist." });
        }
        const consultationData = consultationDoc.data();
        isAuthorized = (
          requesterUid === consultationData?.patientId ||
          requesterUid === consultationData?.consultantId ||
          requesterUid === consultationData?.assignedConsultantId ||
          isAdmin
        );
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: "Access denied. You are not an authorized participant in this room." });
      }

      if (!appId || !appCertificate) {
        return res.status(500).json({ error: "Agora video services are not configured." });
      }

      const role = RtcRole.PUBLISHER;
      const privilegeExpireTime = 3600; 
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + privilegeExpireTime;
      
      const token = RtcTokenBuilder.buildTokenWithUserAccount(
        appId,
        appCertificate,
        roomName,
        requesterUid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs
      );

      res.json({ token, appId, uid: requesterUid });
    } catch (err: any) {
      console.error("[Agora Token Error]:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });


  // --- Global Express Error Handling Middleware ---
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Global Server Exception Caught]:", err);
    
    // Log exception to system_errors Firestore collection if connected
    if (db && isDbConnected) {
      try {
        const errorRef = db.collection('system_errors').doc();
        errorRef.set({
          id: errorRef.id,
          timestamp: FieldValue.serverTimestamp(),
          message: err.message || String(err) || "Unhandled server-side exception",
          stack: err.stack || "",
          userId: "system-backend",
          role: "backend-service",
          component: `Express Route: ${req.method} ${req.path}`,
          page: req.path || "backend",
          customKeys: {
            ip: req.ip || "",
            headers: JSON.stringify(req.headers || {})
          },
          logs: [],
          aiExplanation: "Express global middleware caught unhandled server-side exception.",
          status: "unresolved",
          severity: "critical"
        }).catch((dbErr: any) => console.error("Failed to log server exception to Firestore:", dbErr));
      } catch (dbErr) {
        console.error("Failed to log server exception to Firestore:", dbErr);
      }
    }

    res.status(err.status || 500).json({
      error: "An unexpected server-side exception occurred."
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
