// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

const serviceAccount: admin.ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey,
};

// Check if all necessary environment variables are loaded for the admin SDK
if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'Firebase Admin SDK credentials are not fully configured in environment variables. Admin-level server actions (like deactivating users) will fail. See README.md for setup instructions.'
    );
  } else {
    // In production, this is a critical error.
    console.error(
      'CRITICAL: Firebase Admin SDK credentials are not configured. Admin functionalities will not work.'
    );
  }
}

let adminApp: admin.app.App;
if (!admin.apps.length) {
  try {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization error:", error.message);
    // Create a dummy app to avoid crashing the server on subsequent calls
    // in case of a partial or invalid configuration.
    if (!admin.apps.length) {
       adminApp = admin.initializeApp();
    }
  }
} else {
  adminApp = admin.app();
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminApp, adminDb, adminAuth };
