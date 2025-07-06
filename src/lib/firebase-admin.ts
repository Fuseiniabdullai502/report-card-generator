// lib/firebase-admin.ts
import * as admin from 'firebase-admin';

let adminInstance: typeof admin;

// This logic ensures that the admin app is initialized only once.
if (admin.apps.length) {
    adminInstance = admin;
} else {
    try {
        const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (serviceAccountEnv) {
            // Production: Use service account from environment variable
            const serviceAccount = JSON.parse(serviceAccountEnv);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase Admin SDK initialized using FIREBASE_SERVICE_ACCOUNT environment variable.");
        } else if (credentialsPath) {
            // Development: Use service account from file path
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
            console.log("Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS environment variable.");
        } else {
            // No configuration is present, so we'll set up the proxy.
            throw new Error('No Firebase Admin credentials found. Set either FIREBASE_SERVICE_ACCOUNT (for production) or GOOGLE_APPLICATION_CREDENTIALS (for local dev).');
        }
        adminInstance = admin;

    } catch (error) {
        console.warn("Firebase Admin SDK initialization failed. Admin features will be disabled. This is likely due to missing or invalid service account credentials. See README.md for setup instructions.");
        const errorMessage = `Admin features are disabled. The Firebase Admin SDK failed to initialize. This is commonly caused by missing or invalid service account credentials. Please check your setup, server logs, and README.md for instructions. Details: ${error instanceof Error ? error.message : String(error)}`;
        
        // Create a proxy that throws a clear error when any method is called.
        adminInstance = new Proxy({} as typeof admin, {
            get(target, prop, receiver) {
                if (prop === 'apps') {
                    // Allow the length check to pass to avoid re-initialization loops.
                    return [];
                }
                // For any other property access on the 'admin' object, throw the clear error.
                throw new Error(errorMessage);
            }
        });
        console.warn("Firebase Admin SDK has been set to a 'faulty' state. Any calls to admin functions will throw an explicit error.");
    }
}

// Export the initialized admin instance.
export default adminInstance;
