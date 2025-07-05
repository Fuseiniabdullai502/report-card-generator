# Firebase Studio - Report Card Generator

This is a Next.js application built in Firebase Studio that allows educators to easily create, customize, rank, and print student terminal reports, enhanced with AI-powered insights. This version includes an admin-only user invitation system.

## Getting Started

To get started with development, you first need to set up your environment variables. This app requires keys for Google AI (for AI features) and Firebase (for database, user management, and secure admin actions).

### Environment Setup

Open the `.env` file in the root of your project and add the required values for the variables listed there.

#### Admin User Setup

To give yourself admin privileges, you need to specify your email address. This will grant you access to the Admin Panel to invite other users.

In your `.env` file, set the `NEXT_PUBLIC_ADMIN_EMAIL` variable:
```
NEXT_PUBLIC_ADMIN_EMAIL="your-admin-email@example.com"
```
**Important:** The first time you log in with this email, the application will automatically assign you the 'admin' role.

#### Google AI (Genkit) Setup

The AI features in this application are powered by Google's Gemini models through Genkit. To use them, you need a Google AI API key.

1.  [**Get an API key from Google AI Studio**](https://aistudio.google.com/app/apikey).
2.  In your `.env` file, set the `GOOGLE_API_KEY` variable:
    ```
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```

#### Firebase Setup (Client & Admin)

The application uses Firebase for authentication and Firestore. You need to connect it to a Firebase project and provide two sets of credentials: one for the client-side app (browser) and one for the Admin SDK (server).

1.  If you don't have one, [**create a Firebase project**](https://firebase.google.com/docs/web/setup#create-project).
2.  In the Firebase console, go to **Build > Firestore Database** and click **Create database**. Start in **test mode** for easy setup. This will create the necessary collections (`reports`, `users`, `invites`) automatically when the app is run.

##### Step 1: Client SDK Credentials (for the browser)

1.  In your project's dashboard, go to **Project Settings** (the gear icon) > **General** tab.
2.  Scroll down to the "Your apps" section and click on the **Web** icon (`</>`) to register a new web app. If you already have a web app, you can use its configuration.
3.  After registering, Firebase will show you a configuration object. Copy the values from this object into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables in your `.env` file. The keys you need from this object are `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, and `measurementId`.

##### Step 2: Admin SDK Credentials (for the server)

The Admin SDK is required for secure server actions like deactivating users.

1.  In the Firebase console, go to **Project Settings** > **Service accounts** tab.
2.  Click the **"Generate new private key"** button. A JSON file will be downloaded to your computer.
3.  Open this downloaded JSON file. You will need to copy three values from it into your `.env` file:
    *   Find the `"project_id"` line and copy its value to `FIREBASE_PROJECT_ID`.
    *   Find the `"client_email"` line and copy its value to `FIREBASE_CLIENT_EMAIL`. It will look like an email address.
    *   Find the `"private_key"` line and copy its value to `FIREBASE_PRIVATE_KEY`.
4.  **Important for `FIREBASE_PRIVATE_KEY`**: You must copy the entire key, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines, and wrap the whole thing in double quotes (`"`).

### Troubleshooting

#### "Admin features are disabled" or "PERMISSION_DENIED" Error

If you see an error message like `"Admin features are disabled. The Firebase Admin SDK failed to initialize..."` when trying to deactivate a user or delete an invite, it means your **Admin SDK Credentials are not set up correctly** in your `.env` file.

These powerful actions require a secure server environment. Please double-check that you have followed **Step 2: Admin SDK Credentials** above and that the `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` values in your `.env` file are present and correct.

**The most common mistake is with the `FIREBASE_PRIVATE_KEY`**. Make sure you copy the entire key, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` parts, and wrap the entire value in double quotes.

### Running the Development Server

Once your environment is set up, you can run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### How to Use the Invite & User Management System

1.  Log in using the email you designated as the admin email.
2.  You will see an "Admin Panel" button in the header. Click it to go to `/admin`.
3.  On the admin page, you can authorize new users by entering their email address.
4.  Once authorized, the user can go to the `/register` page and create an account. Users who have not been authorized will not be able to register.
5.  You can also activate or deactivate existing user accounts directly from the admin panel. Deactivated users will not be able to log in.
