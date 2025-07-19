# Firebase Studio - Report Card Generator

This is a Next.js application built in Firebase Studio that allows educators to easily create, customize, rank, and print student terminal reports, enhanced with AI-powered insights. This version includes an admin-only user invitation system.

## Getting Started

To get started with development, you first need to set up your environment variables. This app requires keys for Google AI (for AI features) and Firebase (for database, user management, and secure admin actions).

### Environment Setup

1.  **Copy the example environment file:**
    ```bash
    cp .env.example .env
    ```
2.  Open the newly created `.env` file and add the required values for the variables listed there.

#### Admin User Setup

To give yourself admin privileges, you need to specify your email address. This will grant you access to the Admin Panel to invite other users.

In your `.env` file, set the `NEXT_PUBLIC_ADMIN_EMAIL` variable:
```
NEXT_PUBLIC_ADMIN_EMAIL="your-admin-email@example.com"
```
**Important:** The first time you log in with this email, the application will automatically assign you the 'super-admin' role.

#### Google AI (Genkit) Setup

The AI features in this application are powered by Google's Gemini models through Genkit. To use them, you need a Google AI API key.

1.  [**Get an API key from Google AI Studio**](https://aistudio.google.com/app/apikey).
2.  In your `.env` file, set the `GOOGLE_API_KEY` variable:
    ```
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```

#### Firebase Setup

The application uses Firebase for authentication and Firestore. You need to connect it to a Firebase project and provide two sets of credentials: one for the client-side app (browser) and one for the Admin SDK (server).

##### Step 1: Client SDK Credentials (for the browser)

1.  If you don't have one, [**create a Firebase project**](https://firebase.google.com/docs/web/setup#create-project).
2.  In your project's dashboard, go to **Project Settings** (the gear icon) > **General** tab.
3.  Scroll down to the "Your apps" section and click on the **Web** icon (`</>`) to register a new web app. If you already have a web app, you can use its configuration.
4.  After registering, Firebase will show you a configuration object. Copy the values from this object into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables in your `.env` file.

##### Step 2: Admin SDK Credentials (for the server)

The Admin SDK is required for secure server actions like deactivating users and deleting invites. This setup supports two methods: a local file for development and a secret for production.

**For Local Development:**

1.  In the Firebase console, go to **Project Settings** > **Service accounts** tab.
2.  Click the **"Generate new private key"** button. A JSON file will be downloaded.
3.  **Rename this file to `firebase-service-account.json` and place it in the root directory of your project.**
4.  In your `.env` file, uncomment the following line:
    ```
    # GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
    ```
    becomes:
    ```
    GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
    ```
5.  The `.gitignore` file is already configured to prevent this sensitive file from being committed to your repository.

**For Production (Firebase App Hosting):**

You will not use the JSON file directly for App Hosting. Instead, you will upload its contents to a secret environment variable. This is covered in the deployment guide below.

### Running the Development Server

Once your environment is set up, you can run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Hosting with Firebase App Hosting

Firebase App Hosting is the recommended way to deploy this Next.js application, as it's designed for full-stack web frameworks and integrates seamlessly with Firebase.

### Recommended Method: Using the Firebase CLI

This is the standard way to set up your hosting environment.

1.  **Install Firebase CLI:** If you don't have it, install it globally by running:
    ```bash
    npm install -g firebase-tools
    ```
2.  **Log in to Firebase:**
    ```bash
    firebase login
    ```
3.  **Push to GitHub:** Your code must be in a GitHub repository. If you haven't already, create a new repository on GitHub and push your project to it.

4.  **Run the init command** in your project's root directory:
    ```bash
    firebase init hosting
    ```
5.  **Select a Firebase Project:** Choose the Firebase project you want to use from the list.
6.  **IMPORTANT: Configure Hosting:** When prompted to select a hosting option, use the arrow keys to choose **"App Hosting: for web frameworks (Next.js, Angular, etc)"**. This is the most important step.
7.  **Set Backend Region:** Choose a region for your backend server (e.g., `us-central1`).
8.  **Connect to GitHub:** The CLI will guide you to connect to
 your GitHub account and select the repository for this project. This will set up a GitHub Action to enable automatic deployments whenever you push to your main branch.
9.  **Configure Environment Variables:** Finally, follow the instructions in **Step 5** of the "Manual App Hosting Setup" guide below to add your secrets and environment variables.

### Alternative Method: Manual App Hosting Setup

If you have issues with the Firebase CLI, you can set up everything manually in the Firebase Console.

#### Step 1: Go to the Firebase Console

- Open your browser and navigate to the [Firebase Console](https://console.firebase.google.com/).
- Select the Firebase project you are using for this application.

#### Step 2: Create a New Backend

- In the left-hand menu, under the "Build" section, click on **App Hosting**.
- Click the **"Create backend"** button.

#### Step 3: Connect to GitHub

- Click the **"Connect to GitHub"** button. A pop-up window will appear.
- Authorize Firebase to access your GitHub account. You may need to install the Firebase GitHub App on your account or a specific organization.
- Once connected, select the **GitHub repository** where your application code is stored.
- For the **"Root directory"**, leave it as the default (`/`) unless your app is in a subfolder within the repository.
- Click **"Next"**.

#### Step 4: Configure Deployment Settings

- Firebase will automatically detect that you're using Next.js.
- Set a **Backend ID** (e.g., `report-card-app`) and choose a **Region** for your server (e.g., `us-central1`).
- Click **"Create backend"**. Firebase will now set up the necessary infrastructure and a GitHub Action in your repository.

#### Step 5: Configure Secrets (CRITICAL)

Your application will not work without these settings. This is the most important step.

1.  After your backend is created, you will be taken to its dashboard. Click on the **"Settings"** tab.
2.  Go to the **Secrets** section.
3.  You must add a secret for **each** variable from your `.env` file. Click the **"Add secret"** button for each one.
4.  **Example:** For `GOOGLE_API_KEY`, enter `GOOGLE_API_KEY` in the Name field, paste your actual API key in the Value field, and click "Save".
5.  Add all of the following variables as secrets:
    *   `GOOGLE_API_KEY`
    *   `NEXT_PUBLIC_ADMIN_EMAIL`
    *   `NEXT_PUBLIC_FIREBASE_API_KEY`
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`
6.  **To add the Admin SDK Service Account:**
    *   In the **Secrets** section, click **"Add secret"**.
    *   For the secret **Name**, enter `FIREBASE_SERVICE_ACCOUNT`.
    *   For the **Value**, open the `firebase-service-account.json` file you downloaded earlier.
    *   Copy the **entire JSON content** and paste it into the secret **Value** field.
    *   Click **"Save"**.
7.  **Save** all your variables. Your `apphosting.yaml` file tells App Hosting to use these secrets.

#### Step 6: Deploy Your App

1.  Your first deployment may have already started automatically. You can monitor its progress in the "Logs" tab of your App Hosting backend dashboard.
2.  To trigger a new deployment, simply `git push` a change to your main branch on GitHub. The GitHub Action will automatically build and deploy the new version of your app.

### Alternative: Deploying with Environment Variables via Terminal

If you prefer using the terminal, you can use the Firebase CLI to manage your secrets.

1.  **Enable Required API:** You must first enable the Secret Manager API for your Firebase project. Visit this URL, select your project, and click "Enable":
    ```
    https://console.cloud.google.com/apis/library/secretmanager.googleapis.com
    ```
2.  **Set Secrets:** Run `firebase secrets:set SECRET_NAME` for each secret.
    *   For simple keys:
        ```bash
        firebase secrets:set GOOGLE_API_KEY
        # When prompted, paste your key and press Enter.
        ```
    *   For the service account file:
        ```bash
        firebase functions:secrets:set FIREBASE_SERVICE_ACCOUNT --from-file=firebase-service-account.json
        ```
3.  **Repeat for all secrets** listed in the `.env.example` file.
4.  **Deploy the Application:** Trigger a new deployment by pushing to your `main` branch on GitHub.

Congratulations! Your Report Card Generator is now securely live on the web, fully integrated with Firebase.

## Troubleshooting

### "Admin features are disabled..." or "PERMISSION_DENIED" Error

If you see an error message that says **`Admin features are disabled. The Firebase Admin SDK failed to initialize...`** when you try to use an admin feature on your live site, it means your **`FIREBASE_SERVICE_ACCOUNT` secret is not set up correctly** on App Hosting.

**To fix this on App Hosting:**

1.  Follow the instructions in **"Step 5: Configure Secrets"** in the manual setup guide above.
2.  Go to your App Hosting backend's **Settings** tab in the Firebase Console.
3.  Find the `FIREBASE_SERVICE_ACCOUNT` secret and click to edit it.
4.  Double-check that you have copied the **entire contents** of the `firebase-service-account.json` file.
5.  Paste the full JSON content into the **value** field for the secret.
6.  After saving the variable, trigger a new deployment by pushing a small change to your `main` branch on GitHub.

### Why is `firebase init hosting` asking for a "public directory"?

If the CLI asks you "What do you want to use as your public directory?", it means you have selected the wrong hosting option. You must choose **App Hosting** for this project.

**To fix this:**
1.  Cancel the current command (`Ctrl + C`).
2.  Run `firebase init hosting` again.
3.  At the very first prompt, use the arrow keys to highlight and select the option: **`App Hosting: for web frameworks (Next.js, Angular, etc)`**.
4.  The CLI will then correctly identify your Next.js app and will **not** ask for a public directory.

## How to Use the Invite & User Management System

1.  Log in using the email you designated as the admin email.
2.  You will see an "Admin Panel" button in the header. Click it to go to `/admin`.
3.  On the admin page, you can authorize new users by entering their email address.
4.  Once authorized, the user can go to the `/register` page and create an account. Users who have not been authorized will not be able to register.
5.  You can also activate or deactivate existing user accounts directly from the admin panel. Deactivated users will not be able to log in.
