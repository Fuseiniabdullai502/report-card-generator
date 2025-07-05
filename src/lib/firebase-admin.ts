// lib/firebase-admin.ts
import * as admin from 'firebase-admin';

let adminInstance: typeof admin;

// This logic ensures that the admin app is initialized only once.
if (admin.apps.length) {
    adminInstance = admin;
} else {
    try {
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (credentialsPath) {
            // Use service account from file path (for local development)
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
            console.log("Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS environment variable.");
        } else {
            // No configuration is present, so we'll set up the proxy.
            throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
        }
        adminInstance = admin;

    } catch (error) {
        console.warn("Firebase Admin SDK initialization failed. Admin features will be disabled. This is likely due to missing or invalid service account credentials. See README.md.");
        const errorMessage = `Admin features are disabled. The Firebase Admin SDK failed to initialize. This is commonly caused by a missing GOOGLE_APPLICATION_CREDENTIALS variable in your .env file. Please check your setup, server logs, and README.md for instructions. Details: ${error instanceof Error ? error.message : String(error)}`;
        
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
    }
}

// Export the initialized admin instance.
export default adminInstance;
