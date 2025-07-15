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

The Admin SDK is required for secure server actions like deactivating users and deleting invites. This setup supports two methods: a local file for development and an environment variable for production.

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

**For Production (Vercel, Firebase App Hosting, etc.):**

1.  In your hosting provider's settings, create a new environment variable named `FIREBASE_SERVICE_ACCOUNT`.
2.  Open the service account JSON file you downloaded.
3.  Copy the **entire content** of the JSON file and paste it as the value for the `FIREBASE_SERVICE_ACCOUNT` variable. The value should be a single-line JSON string. Most hosting providers handle this automatically, but if you're pasting it into a text file, ensure any newlines within the private key are escaped (e.g., `\\n`).

### Running the Development Server

Once your environment is set up, you can run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Hosting the Application

The recommended way to host a Next.js application is with **Vercel**, the creators of Next.js. Here is a step-by-step guide to deploying your app.

### Step 1: Push Your Code to a Git Repository

1.  **Initialize Git:** If you haven't already, open a terminal in your project's root directory and run `git init`.
2.  **Create a GitHub Repository:** Go to [GitHub](https://github.com/new) and create a new repository. Do not initialize it with a README or .gitignore file, as your project already has these.
3.  **Commit and Push:** In your terminal, run the following commands, replacing the URL with your new repository's URL:
    ```bash
    git add .
    git commit -m "Initial commit of report card generator"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
    git push -u origin main
    ```

### Step 2: Deploy to Vercel

1.  **Sign Up for Vercel:** Go to [Vercel](https://vercel.com) and sign up for a free account. It's best to sign up using your GitHub account.
2.  **Import Your Project:** From your Vercel dashboard, click **"Add New..."** > **"Project"**.
3.  **Import Git Repository:** Find and import the GitHub repository you just created.
4.  **Configure Project:** Vercel will automatically detect that you're using Next.js and configure the build settings for you. You do not need to change these defaults.

### Step 3: Configure Environment Variables

This is the most important step for the deployed app to work correctly.

1.  In your Vercel project's settings, navigate to the **"Environment Variables"** section.
2.  You will need to add all the variables from your local `.env` file here. Vercel automatically handles the distinction between server-side and client-side (NEXT_PUBLIC_) variables.
3.  Add the following variables, getting the values as described in the "Environment Setup" section above:
    *   `NEXT_PUBLIC_ADMIN_EMAIL`: Your designated admin email address.
    *   `GOOGLE_API_KEY`: Your API key for Google AI Studio.
    *   `NEXT_PUBLIC_FIREBASE_API_KEY`: From your Firebase project's web app config.
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: From your Firebase project's web app config.
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: From your Firebase project's web app config.
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: From your Firebase project's web app config.
    *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: From your Firebase project's web app config.
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`: From your Firebase project's web app config.
    *   `FIREBASE_SERVICE_ACCOUNT`: This is for the Admin SDK. Follow the "For Production" instructions in **Step 2** of the Firebase setup section above. Open your downloaded service account JSON file, copy the **entire content**, and paste it as the value for this variable.

4.  **Save** the environment variables.

### Step 4: Deploy

1.  Once the environment variables are configured, click the **"Deploy"** button.
2.  Vercel will build and deploy your application. Once it's finished, you'll be given a public URL where you can access your live app.

Congratulations! Your Report Card Generator is now live on the web. Any future pushes to your `main` branch on GitHub will automatically trigger a new deployment on Vercel.

## Troubleshooting

### "Admin features are disabled..." or "PERMISSION_DENIED" Error

If you see an error message that says **`Admin features are disabled. The Firebase Admin SDK failed to initialize...`** when you try to use an admin feature on your live site, it means your **`FIREBASE_SERVICE_ACCOUNT` environment variable is not set up correctly** on Vercel.

**To fix this on Vercel:**

1.  Follow the instructions in **"Step 3: Configure Environment Variables"** above.
2.  Double-check that you have copied the **entire contents** of the `firebase-service-account.json` file.
3.  Paste the full JSON content into the **value** field for the `FIREBASE_SERVICE_ACCOUNT` variable in your Vercel project settings.
4.  After saving the variable, go to the "Deployments" tab in Vercel and **re-deploy** your latest commit to apply the changes.

## How to Use the Invite & User Management System

1.  Log in using the email you designated as the admin email.
2.  You will see an "Admin Panel" button in the header. Click it to go to `/admin`.
3.  On the admin page, you can authorize new users by entering their email address.
4.  Once authorized, the user can go to the `/register` page and create an account. Users who have not been authorized will not be able to register.
5.  You can also activate or deactivate existing user accounts directly from the admin panel. Deactivated users will not be able to log in.
