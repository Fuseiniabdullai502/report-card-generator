# Firebase Studio - Report Card Generator

This is a Next.js application built in Firebase Studio that allows educators to easily create, customize, rank, and print student terminal reports, enhanced with AI-powered insights. This version includes an admin-only user invitation system.

## Getting Started

To get started with development, you first need to set up your environment variables. This app requires keys for Google AI (for AI features) and Firebase (for database and user management).

### Environment Setup

1.  Create a `.env.local` file in the root of your project by copying the example `.env` file:
    ```bash
    cp .env .env.local
    ```
2.  Open your new `.env.local` file. You will need to add your keys and admin email here.

#### Admin User Setup

To give yourself admin privileges, you need to specify your email address. This will grant you access to the Admin Panel to invite other users.

1.  In your `.env.local` file, add your admin email:
    ```
    NEXT_PUBLIC_ADMIN_EMAIL="your-admin-email@example.com"
    ```
    **Important:** The first time you log in with this email, the application will automatically assign you the 'admin' role.

#### Google AI (Genkit) Setup

The AI features in this application are powered by Google's Gemini models through Genkit. To use them, you need a Google AI API key.

1.  [**Get an API key from Google AI Studio**](https://aistudio.google.com/app/apikey).
2.  In your `.env.local` file, add your API key:
    ```
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```

#### Firebase Setup

The application uses Firebase for authentication and Firestore to save all report card and user data. You need to connect it to a Firebase project.

1.  If you don't have one, [**create a Firebase project**](https://firebase.google.com/docs/web/setup#create-project).
2.  In your project's dashboard, go to **Project Settings** (the gear icon) > **General** tab.
3.  Scroll down to the "Your apps" section and click on the **Web** icon (`</>`) to register a new web app. If you already have a web app, you can use its configuration.
4.  After registering, Firebase will show you a configuration object. Copy the values from this object into your `.env.local` file.

    ```
    # Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_AUTH_DOMAIN"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
    NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_FIREBASE_MEASUREMENT_ID"
    ```
5. In the Firebase console, go to **Build > Firestore Database** and click **Create database**. Start in **test mode** for easy setup. This will create the necessary collections (`reports`, `users`, `invites`) automatically when the app is run.

### Running the Development Server

Once your environment is set up, you can run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### How to Use the Invite System

1.  Log in using the email you designated as the admin email.
2.  You will see an "Admin Panel" button in the header. Click it to go to `/admin`.
3.  On the admin page, enter the email address of a user you want to invite and click "Send Invite".
4.  The invited user can now go to the `/register` page and create an account using their email address.
5.  Users who have not been invited will not be able to register.
