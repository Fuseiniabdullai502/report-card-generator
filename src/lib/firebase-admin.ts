// lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// This logic ensures that the admin app is initialized only once.
if (!admin.apps.length) {
  try {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (serviceAccountEnv) {
      // Use service account from environment variable (for production/deployment)
      const serviceAccount = JSON.parse(serviceAccountEnv);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized using FIREBASE_SERVICE_ACCOUNT environment variable.");
    } else if (credentialsPath) {
      // Use service account from file path (for local development)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log("Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS environment variable.");
    } else {
      // Neither configuration is present, throw an error.
      throw new Error(
        'Firebase Admin SDK cannot be initialized. Set either the FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS environment variable. See README.md for details.'
      );
    }
  } catch (error) {
    console.error("Firebase Admin SDK initialization failed:", error);
    // Re-throw the error to ensure server startup fails if configuration is incorrect.
    // This prevents the application from running in a broken state.
    throw new Error(`Firebase Admin SDK initialization failed. Please check your service account configuration. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Export the initialized admin instance.
// In your actions, you can now use `admin.auth()`, `admin.firestore()`, etc.
export default admin;
