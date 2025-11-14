// lib/firebase-admin.ts
import * as admin from 'firebase-admin';

function initializeFirebaseAdmin(): typeof admin {
    if (admin.apps.length) {
        return admin;
    }

    try {
        const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
        // CORRECT: Use standard Google Cloud environment variables for server-side code.
        const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

        if (!projectId) {
            // Updated error message to be more specific to the server environment.
            throw new Error("Google Cloud Project ID is not set in the server environment. This is required for the Admin SDK.");
        }

        const config: admin.AppOptions = {
            projectId,
            databaseURL: `https://${projectId}.firebaseio.com`,
        };
        
        if (serviceAccountEnv) {
            // Used in production (Firebase App Hosting) where the secret is passed as an env var.
            console.log(`Initializing Admin SDK for production project: ${projectId}`);
            const serviceAccount = JSON.parse(serviceAccountEnv);
            config.credential = admin.credential.cert(serviceAccount);
        } else {
            // Used for local development via `gcloud auth application-default login`.
            // This command sets up credentials that the SDK automatically finds.
            console.log(`Initializing Admin SDK for local development against project: ${projectId}`);
            config.credential = admin.credential.applicationDefault();
        }

        admin.initializeApp(config);
        console.log("Firebase Admin SDK initialized successfully.");
        return admin;

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
