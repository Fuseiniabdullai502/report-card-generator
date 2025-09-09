// lib/firebase-admin.ts
import * as admin from 'firebase-admin';

function initializeFirebaseAdmin(): typeof admin {
    if (admin.apps.length) {
        return admin;
    }

    try {
        const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
        
        if (serviceAccountEnv) {
            // Used in production (Firebase App Hosting) where the secret is passed as an env var.
            const serviceAccount = JSON.parse(serviceAccountEnv);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase Admin SDK initialized using FIREBASE_SERVICE_ACCOUNT environment variable.");
            return admin;
        } else {
            // Used for local development via `gcloud auth application-default login`.
            // This command sets up credentials that the SDK automatically finds.
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
            console.log("Firebase Admin SDK initialized using Application Default Credentials.");
            return admin;
        }

    } catch (error) {
        console.warn("Firebase Admin SDK initialization failed. Admin features will be disabled.");
        console.error("This is likely due to missing credentials. For local development, run `gcloud auth application-default login`. For production, ensure the FIREBASE_SERVICE_ACCOUNT secret is set. See README.md for setup instructions.");

        const errorMessage = `Admin features are disabled. The Firebase Admin SDK failed to initialize. This is commonly caused by missing or invalid service account credentials. Please check your setup, server logs, and README.md for instructions. Details: ${error instanceof Error ? error.message : String(error)}`;
        
        const faultyAdmin = new Proxy({} as typeof admin, {
            get(target, prop, receiver) {
                if (prop === 'apps') {
                    return [];
                }
                throw new Error(errorMessage);
            }
        });
        console.warn("Firebase Admin SDK has been set to a 'faulty' state. Any calls to admin functions will throw an explicit error.");
        return faultyAdmin;
    }
}

const adminInstance = initializeFirebaseAdmin();

export default adminInstance;
