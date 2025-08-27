
// lib/firebase-admin.ts
import * as admin from 'firebase-admin';

let adminInstance: typeof admin;

if (admin.apps.length) {
    adminInstance = admin;
} else {
    try {
        const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        let serviceAccount: admin.ServiceAccount | undefined;

        if (serviceAccountEnv) {
            serviceAccount = JSON.parse(serviceAccountEnv);
        } else if (credentialsPath) {
            // This path is handled by the default credential logic,
            // no need to parse a file manually here.
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
            console.log("Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS.");
            adminInstance = admin;
        }

        if (serviceAccount && !adminInstance) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase Admin SDK initialized using FIREBASE_SERVICE_ACCOUNT environment variable.");
            adminInstance = admin;
        }

        if (!adminInstance) {
             throw new Error('No Firebase Admin credentials found. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS environment variable.');
        }

    } catch (error) {
        console.warn("Firebase Admin SDK initialization failed. Admin features will be disabled. This is likely due to missing or invalid service account credentials. See README.md for setup instructions.");
        const errorMessage = `Admin features are disabled. The Firebase Admin SDK failed to initialize. This is commonly caused by missing or invalid service account credentials. Please check your setup, server logs, and README.md for instructions. Details: ${error instanceof Error ? error.message : String(error)}`;
        
        adminInstance = new Proxy({} as typeof admin, {
            get(target, prop, receiver) {
                if (prop === 'apps') {
                    return [];
                }
                throw new Error(errorMessage);
            }
        });
        console.warn("Firebase Admin SDK has been set to a 'faulty' state. Any calls to admin functions will throw an explicit error.");
    }
}

export default adminInstance;
