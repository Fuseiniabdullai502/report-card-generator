// src/lib/firebase.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Hardcoded Firebase configuration to ensure client-side consistency
// and resolve CORS/auth-domain issues on deployment.
const firebaseConfig = {
    apiKey: "AIzaSyCRe24-c5OnazQ2jbs84eiLnQheopbiIno",
    authDomain: "report-card-generator-e3zkv.firebaseapp.com",
    projectId: "report-card-generator-e3zkv",
    storageBucket: "report-card-generator-e3zkv.appspot.com",
    messagingSenderId: "58253188544",
    appId: "1:58253188544:web:8219329731ad18c94625f3",
};

// Basic validation to ensure the config is loaded
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      "Firebase config is not set. The hardcoded configuration in src/lib/firebase.ts is missing."
    );
}

// Initialize Firebase
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { app, db, auth, storage };
