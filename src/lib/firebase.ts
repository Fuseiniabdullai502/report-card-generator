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
  const json = process.env.FIREBASE_WEBAPP_CONFIG; // auto-provided by App Hosting

  if (!json) {
    throw new Error(
      "Firebase config environment variable 'FIREBASE_WEBAPP_CONFIG' is not set. This is required for Firebase App Hosting."
    );
  }

  const parsedConfig = JSON.parse(json) as WebConfig;

  // Minimal validation
  if (!parsedConfig.apiKey || !parsedConfig.authDomain || !parsedConfig.projectId) {
    throw new Error(
      'Firebase config is missing required fields (apiKey, authDomain, projectId).'
    );
  }

  return parsedConfig;
}

const firebaseConfig = getWebConfig();

// Initialize Firebase
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { app, db, auth, storage };
