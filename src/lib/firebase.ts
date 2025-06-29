// src/lib/firebase.ts
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Function to validate the config
const validateFirebaseConfig = (config: typeof firebaseConfig) => {
    const requiredKeys: (keyof typeof firebaseConfig)[] = [
        'apiKey', 
        'authDomain', 
        'projectId', 
    ];
    const missingKeys = requiredKeys.filter(key => !config[key]);

    if (missingKeys.length > 0) {
        throw new Error(
            `Firebase configuration is missing required keys: ${missingKeys.join(', ')}. ` +
            `Please ensure your .env.local file is in the project root and contains all NEXT_PUBLIC_FIREBASE_* variables. ` +
            `You must restart the development server after creating or editing this file.`
        );
    }
};


// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
    validateFirebaseConfig(firebaseConfig); // Validate before initializing
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("CRITICAL: Failed to initialize Firebase. App will not work correctly.", error);
    // Create a proxy to throw an error if auth or db are used
    const errorMessage = error instanceof Error ? error.message : "Firebase failed to initialize. Check server logs.";
    const thrower = () => { throw new Error(errorMessage); };
    
    // We create dummy objects that will throw if used.
    // This prevents the app from crashing on load but provides clear errors when auth/db are accessed.
    app = {} as FirebaseApp;
    db = new Proxy({}, { get: thrower }) as Firestore;
    auth = new Proxy({}, { get: thrower }) as Auth;
}


export { app, db, auth };
