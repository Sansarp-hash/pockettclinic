import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

class CrashlyticsService {
  private logs: string[] = [];
  private customKeys: Record<string, string> = {};

  log(message: string): void {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.logs.push(entry);
    if (this.logs.length > 50) {
      this.logs.shift();
    }
  }

  setCustomKey(key: string, value: string): void {
    this.customKeys[key] = value;
  }

  async recordError(error: Error | string, severity: 'low' | 'medium' | 'high' | 'critical' = 'high'): Promise<void> {
    const errObj = typeof error === 'string' ? new Error(error) : error;
    const message = errObj.message || 'Unknown Exception';
    const stack = errObj.stack || '';

    let calculatedSeverity: 'low' | 'medium' | 'high' | 'critical' = severity;
    if (message.toLowerCase().includes('livekit') || message.toLowerCase().includes('critical')) {
      calculatedSeverity = 'critical';
    } else if (message.toLowerCase().includes('permission_denied') || message.toLowerCase().includes('security')) {
      calculatedSeverity = 'high';
    }

    const currentUser = auth.currentUser;
    let userId = 'anonymous';
    let role = 'anonymous';

    if (currentUser) {
      userId = currentUser.uid;
      if (currentUser.email === 'missty2k@gmail.com' || currentUser.email === 'pockettclinic@gmail.com') {
        role = 'ADMIN';
      } else {
        try {
          const cached = localStorage.getItem(`pockettclinic_user_cache_${currentUser.uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.role) {
              role = parsed.role.toUpperCase();
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    const payload = {
      message,
      stack,
      userId,
      role,
      component: 'TelemetryCore',
      page: window.location.pathname || '/admin',
      customKeys: { ...this.customKeys },
      logs: [...this.logs]
    };

    // Attempt backend API logging first to leverage server-side Gemini diagnosis and bypass client rules constraints
    try {
      const response = await fetch('/api/system-errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return;
      }
    } catch (apiErr) {
      console.warn("Telemetry API logging failed, falling back to direct Firestore:", apiErr);
    }

    // Local client-side Firestore fallback
    const aiExplanation = "Diagnostic pending analysis by AI SRE Engine...";

    try {
      await addDoc(collection(db, 'system_errors'), {
        message,
        stack,
        userId: userId === 'anonymous' ? 'anon_' + Math.random().toString(36).substring(2, 9) : userId,
        role,
        component: 'TelemetryCore',
        page: window.location.pathname || '/admin',
        customKeys: { ...this.customKeys },
        logs: [...this.logs],
        aiExplanation,
        status: 'unresolved',
        severity: calculatedSeverity,
        timestamp: serverTimestamp()
      });
    } catch (fsErr) {
      console.error("Failed to write error to Firestore system_errors:", fsErr);
    }
  }
}

const instance = new CrashlyticsService();

export function crashlytics(): CrashlyticsService {
  return instance;
}
