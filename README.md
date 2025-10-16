# Report Card Generator - Setup & Deployment Guide

This guide will walk you through setting up your development environment and deploying your Next.js application.

---

## 1. Local Development Setup (Required First)

Before you can run the app locally, you must authenticate to Google Cloud and set up your local environment variables.

### Step 1.1: Authenticate for Local Development

To run the server locally with Firebase Admin features, your machine needs to be authenticated.

1.  **Install the Google Cloud CLI:** If you haven't already, [install the gcloud CLI](https://cloud.google.com/sdk/docs/install).
2.  **Log in to your account:** Run the following command and follow the prompts in your browser.
    ```bash
    gcloud auth login
    ```
3.  **Set your project:** Tell gcloud which project you're working on.
    ```bash
    gcloud config set project report-card-generator-e3zkv
    ```
4.  **Set up Application Default Credentials:** This is the crucial step that allows your local server to act as the service account.
    ```bash
    gcloud auth application-default login
    ```

### Step 1.2: Create and Configure `.env.local`

1.  In the root of your project, create a new file named `.env.local`.
2.  Copy the contents of `.env.example` into your new `.env.local` file.
3.  **Get your Google AI API Key:**
    *   Go to [**Google AI Studio**](https://aistudio.google.com/app/apikey) and create an API key.
    *   Paste the key into `.env.local`: `GOOGLE_API_KEY="YOUR_API_KEY_HERE"`
4.  **Get your Firebase Web App Credentials:**
    *   In your [**Firebase project**](https://console.firebase.google.com/project/report-card-generator-e3zkv/overview), go to **Project Settings** (gear icon) > **General** tab.
    *   Scroll to "Your apps" and find your web app configuration object.
    *   Copy the values into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local`.
5.  **Set Your Admin Email:**
    *   In `.env.local`, set the `NEXT_PUBLIC_ADMIN_EMAIL` variable: `NEXT_PUBLIC_ADMIN_EMAIL="your-admin-email@example.com"`
    *   The first time you log in with this email, the app will automatically grant you the 'super-admin' role.

### Step 1.3: Run the App

```bash
npm run dev
```

---

## 2. Initial Deployment to Firebase App Hosting

This is the recommended method for deploying your project for the first time.

### Step 2.1: Initialize App Hosting

In your project's root directory, run: `firebase init hosting`.

1.  **Select a Firebase Project:** Choose `report-card-generator-e3zkv`.
2.  **Configure Hosting Option:** Select **`App Hosting: for web frameworks...`**.
3.  **Set Backend Region:** Choose a region (e.g., `us-central1`).
4.  **Connect to GitHub:** Follow the prompts to connect your GitHub account and repository.

### Step 2.2: Create Secrets in Google Secret Manager

Your live application needs secure keys. You will only store the most sensitive keys as secrets.

1.  [**Enable the Secret Manager API**](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com) for your Google Cloud project.
2.  **Generate a Service Account Key (if you don't have the file):**
    *   If you haven't done so for local setup, go to the [Google Cloud Console for Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts). Find the service account with an email like `firebase-adminsdk-....@...gserviceaccount.com`.
    *   Click on it, go to the **"Keys"** tab, click **"Add Key"** > **"Create new key"**, select **JSON**, and create it. A JSON file will be downloaded.
3.  **Run the following `gcloud` commands** in your terminal to create the secrets:

    ```bash
    # Create the Google API Key secret from the value in your .env.local
    echo "YOUR_API_KEY_HERE" | gcloud secrets create GOOGLE_API_KEY --data-file=-

    # Create the Admin Email secret from the value in your .env.local
    echo "your-admin-email@example.com" | gcloud secrets create NEXT_PUBLIC_ADMIN_EMAIL --data-file=-
    
    # Create the Service Account secret from your downloaded JSON file
    gcloud secrets create FIREBASE_SERVICE_ACCOUNT --data-file=./path/to/your/downloaded-service-account-file.json
    ```

### Step 2.3: Set Environment Variables in App Hosting

The public Firebase configuration does **not** need to be secret. Set these directly in App Hosting.

1.  Go to the [**Firebase Console**](https://console.firebase.google.com/project/report-card-generator-e3zkv) and navigate to the **App Hosting** section.
2.  Select your backend (e.g., `report-card-generator`).
3.  Go to the **"Settings"** tab.
4.  Under **"Environment variables"**, click **"Add variable"**.
5.  Add a variable for each `NEXT_PUBLIC_FIREBASE_*` key from your `.env.local` file and paste in its corresponding value.
    *   `NEXT_PUBLIC_FIREBASE_API_KEY`
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`

### Step 2.4: Deploy

Commit the `firebase.json` and `apphosting.yaml` files and push to your main branch.

```bash
git add .
git commit -m "Configure Firebase App Hosting"
git push
```

The GitHub Action will automatically build and deploy your application.

---

## 3. Updating Your Application

Once your application is live, follow these steps to deploy any new changes you've made.

### Step 3.1: Check for New Secrets or Variables

*   If you added any **new sensitive keys** (like another API key), add them to Google Secret Manager following **Step 2.2**.
*   If you added any **new public environment variables**, add them to your App Hosting backend settings following **Step 2.3**.

### Step 3.2: Commit and Push Your Changes

This is the standard process for deploying updates.

1.  **Add your changes:** Stage all the files you've modified.
    ```bash
    git add .
    ```

2.  **Commit the changes:** Give your update a descriptive message.
    ```bash
    git commit -m "feat: Add new feature for student ranking"
    ```

3.  **Push to your main branch:** This is the action that triggers the automatic deployment.
    ```bash
    git push origin main
    ```

### Step 3.3: Monitor the Deployment

After you push your changes, a new build and deployment will automatically start.

1.  Go to the **Firebase Console**.
2.  Navigate to the **App Hosting** section for your project.
3.  Select your backend.
4.  Go to the **"Logs"** tab to monitor the build and deployment process in real-time. Once it completes, your changes will be live.
