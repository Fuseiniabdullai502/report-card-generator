# Report Card Generator - Deployment Guide

This guide will walk you through deploying your Next.js application using Firebase App Hosting, which is the recommended method for this project.

## Before You Begin

1.  **Code on GitHub:** Ensure your project code is pushed to a GitHub repository.
2.  **Firebase Project:** Make sure you have a Firebase project created and you are logged into the Firebase CLI. If not, run `firebase login`.
3.  **Environment Variables:** You will need the values from your local `.env` file to set up as secrets in your hosting environment.

---

## Step 1: Initialize App Hosting

In your project's root directory, run the following command:

```bash
firebase init hosting
```

Follow the prompts from the Firebase CLI:

1.  **Select a Firebase Project:** Choose the Firebase project you want to use.
2.  **IMPORTANT: Configure Hosting Option:**
    *   Use the arrow keys to select **`App Hosting: for web frameworks (Next.js, Angular, etc)`**. This is the most critical step. If you are asked for a "public directory," you have chosen the wrong option.
3.  **Set Backend Region:** Choose a region for your server (e.g., `us-central1`).
4.  **Connect to GitHub:** The CLI will guide you to connect your GitHub account and select the repository for this project. This sets up a GitHub Action for automatic deployments.

---

## Step 2: Configure Secrets (Critical)

Your live application needs access to the same keys you use for local development. For security, these are stored as "secrets" in Google Secret Manager, which Firebase helps you manage.

You must enable the **Secret Manager API** for your Firebase project first.
[**Click here to enable the API**](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)
(Select your project and click "Enable").

Now, run the following commands in your terminal to create a secret for **each** variable from your `.env` file.

```bash
# Set your API keys (the CLI will prompt you to paste the value)
firebase secrets:set GOOGLE_API_KEY
firebase secrets:set NEXT_PUBLIC_FIREBASE_API_KEY
# ... repeat for all NEXT_PUBLIC_FIREBASE_* keys

# Set your admin email
firebase secrets:set NEXT_PUBLIC_ADMIN_EMAIL

# Set the service account from your local JSON file
firebase secrets:set FIREBASE_SERVICE_ACCOUNT --from-file=firebase-service-account.json
```

**List of all secrets to set:**
*   `GOOGLE_API_KEY`
*   `NEXT_PUBLIC_ADMIN_EMAIL`
*   `NEXT_PUBLIC_FIREBASE_API_KEY`
*   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
*   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
*   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
*   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
*   `NEXT_PUBLIC_FIREBASE_APP_ID`
*   `FIREBASE_SERVICE_ACCOUNT` (from file)

---

## Step 3: Deploy

The GitHub Action you set up in Step 1 will automatically deploy your application whenever you push changes to your main branch.

To trigger your first deployment, commit the changes made by the `firebase init` command and push them to GitHub:

```bash
git add .
git commit -m "Configure Firebase App Hosting"
git push
```

You can monitor the deployment progress in the **"Logs"** tab of your App Hosting backend dashboard in the Firebase Console.

Congratulations! Your Report Card Generator is now live on the web, fully integrated with Firebase.
