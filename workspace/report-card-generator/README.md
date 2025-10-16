# Firebase Studio - Report Card Generator

This is a Next.js application built in Firebase Studio that allows educators to easily create, customize, rank, and print student terminal reports, enhanced with AI-powered insights. This version includes an admin-only user invitation system.

## Getting Started

To get started with development, you first need to set up your environment variables. This app requires keys for Google AI (for AI features) and Firebase (for database, user management, and secure admin actions).

### Environment Setup

1.  **Create a `.env.local` file:** In the root of your project, create a new file and name it `.env.local`.
2.  **Copy the template:** Open the `.env.example` file, copy its entire contents, and paste them into your new `.env.local` file.
3.  **Fill in your values:** Follow the instructions below to get your API keys and fill in the placeholder values in your `.env.local` file.

#### Admin User Setup

To give yourself admin privileges, you need to specify your email address. This will grant you access to the Admin Panel to invite other users.

In your `.env.local` file, set the `NEXT_PUBLIC_ADMIN_EMAIL` variable:
```
NEXT_PUBLIC_ADMIN_EMAIL="your-admin-email@example.com"
```
**Important:** The first time you log in with this email, the application will automatically assign you the 'super-admin' role.

#### Google AI (Genkit) Setup

The AI features in this application are powered by Google's Gemini models through Genkit. To use them, you need a Google AI API key.

1.  [**Get an API key from Google AI Studio**](https://aistudio.google.com/app/apikey).
2.  In your `.env.local` file, set the `GOOGLE_API_KEY` variable:
    ```
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```

#### Firebase Setup

The application uses Firebase for authentication and Firestore. You need to connect it to a Firebase project and provide two sets of credentials: one for the client-side app (browser) and one for the Admin SDK (server).

##### Step 1: Client SDK Credentials (for the browser)

1.  If you don't have one, [**create a Firebase project**](https://firebase.google.com/docs/web/setup#create-project).
2.  In your project's dashboard, go to **Project Settings** (the gear icon) > **General** tab.
3.  Scroll down to the "Your apps" section and click on the **Web** icon (`</>`) to register a new web app. If you already have a web app, you can use its configuration.
4.  After registering, Firebase will show you a configuration object. Copy the values from this object into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables in your `.env.local` file.

##### Step 2: Admin SDK Credentials (for the server)

The Admin SDK is required for secure server actions like deactivating users and deleting invites. This setup supports two methods: a local file for development and an environment variable for production.

**For Local Development:**

1.  In the Firebase console, go to **Project Settings** > **Service accounts** tab.
2.  Click the **"Generate new private key"** button. A JSON file will be downloaded.
3.  **Rename this file to `firebase-service-account.json` and place it in the root directory of your project.**
4.  In your `.env.local` file, ensure the following line is present:
    ```
    GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
    ```
5.  The `.gitignore` file is already configured to prevent this sensitive file from being committed to your repository.

**For Production (Vercel, Firebase App Hosting, etc.):**

1.  In your hosting provider's settings, create a new environment variable named `FIREBASE_SERVICE_ACCOUNT`.
2.  Open the service account JSON file you downloaded.
3.  Copy the **entire content** of the JSON file and paste it as the value for the `FIREBASE_SERVICE_ACCOUNT` variable. The value should be a single-line JSON string. Most hosting providers handle this automatically, but if you're pasting it into a text file, ensure any newlines within the private key are escaped (e.g., `\\n`).

### Troubleshooting

#### "Admin features are disabled..." or "PERMISSION_DENIED" Error

If you see an error message that says **`Admin features are disabled. The Firebase Admin SDK failed to initialize...`** when you try to use an admin feature, it means your **Admin SDK Credentials are not set up correctly** for your environment. This is a configuration issue, not a code bug. To fix it, you must provide the server with secure credentials.

**To fix this for local development:**

1.  Follow the instructions in **"Step 2: Admin SDK Credentials"** above.
2.  Make sure you have downloaded the `firebase-service-account.json` file from your Firebase project.
3.  Make sure you have placed this file in the **root directory** of this project.
4.  Make sure the line `GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json` is present in your `.env.local` file.

Once you have correctly configured the local file, restart your development server. The error will be resolved.

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
