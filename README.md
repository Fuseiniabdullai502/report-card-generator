# Report Card Generator - Setup & Deployment Guide

This guide will walk you through setting up your development environment and deploying your Next.js application.

---

## 1. Local Development Setup (Required First)

Before you can run the app locally or deploy it, you must set up your environment variables.

### Step 1.1: Create `.env.local`

1.  In the root of your project, create a new file and name it `.env.local`.
2.  Copy the contents of `.env.example` into your new `.env.local` file. This will give you the template you need.

### Step 1.2: Get Google AI API Key

The AI features are powered by Google's Gemini models.

1.  Go to [**Google AI Studio**](https://aistudio.google.com/app/apikey) and create an API key.
2.  In your `.env.local` file, paste the key:
    ```
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```

### Step 1.3: Get Firebase Credentials

#### For the Client-Side App (Browser)

1.  If you don't have one, [**create a Firebase project**](https://firebase.google.com/docs/web/setup#create-project).
2.  In your project's dashboard, go to **Project Settings** (the gear icon) > **General** tab.
3.  Scroll to "Your apps" and click the **Web** icon (`</>`) to register a web app (or use an existing one).
4.  Firebase will show you a configuration object. Copy the values into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables in your `.env.local` file.

#### For the Admin SDK (Server-Side) - This is Crucial

The server needs secure credentials to manage users and perform admin tasks.

1.  In the Firebase console, go to **Project Settings** > **Service accounts** tab.
2.  Click the **"Generate new private key"** button. A JSON file will be downloaded.
3.  **Rename this file to `firebase-service-account.json`** and place it in the root directory of your project.
4.  In your `.env.local` file, set the `GOOGLE_APPLICATION_CREDENTIALS` variable to point to this file:
    ```
    # This tells the local server where to find your admin credentials
    GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
    ```
    *The `.gitignore` file is already configured to prevent this sensitive file from being committed to your repository.*

### Step 1.4: Set Your Admin Email

To access the Admin Panel, you must designate your email as the super admin.

1.  In `.env.local`, set the `NEXT_PUBLIC_ADMIN_EMAIL` variable:
    ```
    NEXT_PUBLIC_ADMIN_EMAIL="your-admin-email@example.com"
    ```
    *The first time you log in with this email, the app will automatically grant you the 'super-admin' role.*

### Step 1.5: Run the App

```bash
npm run dev
```

---

## 2. Deployment to Firebase App Hosting

This is the recommended method for deploying your project.

### Step 2.1: Initialize App Hosting

In your project's root directory, run: `firebase init hosting`.

1.  **Select a Firebase Project:** Choose your project.
2.  **Configure Hosting Option:** Use the arrow keys to select **`App Hosting: for web frameworks...`**.
3.  **Set Backend Region:** Choose a region (e.g., `us-central1`).
4.  **Connect to GitHub:** Follow the prompts to connect your GitHub account and repository.

### Step 2.2: Create Secrets in Google Secret Manager

Your live application needs the same keys you use locally, but stored securely.

1.  [**Enable the Secret Manager API**](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com) for your Google Cloud project.
2.  Run the following `gcloud` commands in your terminal. You will be prompted to paste the value for each one from your `.env.local` file.

    ```bash
    # Set your API keys and admin email
    echo "YOUR_API_KEY_HERE" | gcloud secrets create GOOGLE_API_KEY --data-file=-
    echo "your-admin-email@example.com" | gcloud secrets create NEXT_PUBLIC_ADMIN_EMAIL --data-file=-

    # Repeat for all your NEXT_PUBLIC_FIREBASE_* keys
    echo "YOUR_FIREBASE_API_KEY" | gcloud secrets create NEXT_PUBLIC_FIREBASE_API_KEY --data-file=-
    # ... (repeat for AUTH_DOMAIN, PROJECT_ID, etc.) ...

    # Set the FIREBASE_SERVICE_ACCOUNT from your local JSON file
    # This is the most important step for the backend
    gcloud secrets create FIREBASE_SERVICE_ACCOUNT --data-file=firebase-service-account.json
    ```

### Step 2.3: Deploy

Commit the `firebase.json` and `apphosting.yaml` files and push to your main branch.

```bash
git add .
git commit -m "Configure Firebase App Hosting"
git push
```

The GitHub Action will automatically build and deploy your application. You can monitor its progress in the "Logs" tab of your App Hosting backend in the Firebase Console.
