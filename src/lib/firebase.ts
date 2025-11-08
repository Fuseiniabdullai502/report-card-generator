// src/lib/firebase.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

type WebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

function getWebConfig(): WebConfig {
  const json = process.env.FIREBASE_WEBAPP_CONFIG; // auto-provided by App Hosting at BUILD
  if (json) {
    try {
      const parsed = JSON.parse(json);
      return parsed as WebConfig;
    } catch {
      // fall through to NEXT_PUBLIC_* if parse fails
    }
  }
  const cfg: WebConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Minimal validation (apiKey/authDomain/projectId are must-have)
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId) {
    throw new Error(
      'Firebase config is missing required environment variables.'
    );
  }
  return cfg;
}

const firebaseConfig = getWebConfig();

// Initialize Firebase
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { app, db, auth, storage };
