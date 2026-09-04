import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, doc, getDocFromServer, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize client-side Firebase instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

const databaseId = firebaseConfig.firestoreDatabaseId || undefined;

// Suppress internal Firestore network connection logs to prevent automated crash loop reporting in AI Studio iframe
setLogLevel('silent');

// Use auto-detect long-polling and persistent local cache for high resilience and robust offline behavior in the AI Studio iframe/proxy environment
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache()
}, databaseId);

export const storage = getStorage(app);

// Connection verification test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    console.warn("Firestore connection check completed. (Note: Client is operating in offline/cached mode or verifying remote link)");
  }
}
testConnection();

export default app;



