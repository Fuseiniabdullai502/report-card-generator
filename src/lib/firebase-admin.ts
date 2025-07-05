// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

let adminDb: admin.firestore.Firestore;
let adminAuth: admin.auth.Auth;
let adminApp: admin.app.App | undefined;

try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  const serviceAccount: admin.ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw new Error('Firebase Admin SDK credentials are not fully configured in environment variables. Admin-level server actions (like deactivating users) will fail. See README.md for setup instructions.');
  }

  if (!admin.apps.length) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } else {
    adminApp = admin.app();
  }
  
  adminDb = admin.firestore();
  adminAuth = admin.auth();

} catch (error: any) {
  console.warn(
    'Firebase Admin SDK initialization failed. Admin-level server actions (like deactivating users) will fail. This is likely due to missing or invalid service account credentials in your .env file.',
  );

  const errorMessage =
    'Admin features are disabled. The Firebase Admin SDK failed to initialize. This is commonly caused by missing or invalid service account credentials in your .env file. Please check your setup, server logs, and README.md for instructions.';

  const createProxy = <T extends object>(): T => {
    return new Proxy({} as T, {
      get() {
        // Throw a clear error for any property access
        throw new Error(errorMessage);
      }
    });
  };

  adminDb = createProxy<admin.firestore.Firestore>();
  adminAuth = createProxy<admin.auth.Auth>();
  // `adminApp` will be undefined, but direct usage of it is not expected in this failure path.
}

export { adminApp, adminDb, adminAuth };
