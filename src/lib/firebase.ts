// src/lib/firebase.ts
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// --- SECURITY WARNING ---
// The configuration keys below are hardcoded for immediate testing purposes only.
// This is NOT a secure practice for a real application.
// In a production environment, these keys should be stored in a .env.local file
// and accessed via process.env, as was the original intention of this file.
// Anyone with access to this code can see and use these keys.
const firebaseConfig = {
  apiKey: "AIzaSyCRe24-c5OnazQ2jbs84eiLnQheopbiIno",
  authDomain: "report-card-generator-e3zkv.firebaseapp.com",
  projectId: "report-card-generator-e3zkv",
  storageBucket: "report-card-generator-e3zkv.firebasestorage.app",
  messagingSenderId: "103786735519",
  appId: "1:103786735519:web:22922ed07e07c3dd817faa"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
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
