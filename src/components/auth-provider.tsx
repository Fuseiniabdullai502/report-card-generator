
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export interface CustomUser extends User {
  role: 'admin' | 'user' | null;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            const isAdminEmail = firebaseUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

            if (userDoc.exists()) {
                const userData = userDoc.data();
                let userRole = userData.role || 'user';

                // Self-healing check: If the user has the admin email but their role isn't 'admin' in the DB, fix it.
                if (isAdminEmail && userRole !== 'admin') {
                    await setDoc(userDocRef, { role: 'admin' }, { merge: true });
                    userRole = 'admin';
                }
                setUser({ ...firebaseUser, role: userRole });
            } else {
                // This is an edge case: an auth user exists without a DB record.
                // This can happen if registration failed midway, or for an admin's very first sign-in.
                if (isAdminEmail) {
                    // Create the admin document on the fly if it doesn't exist.
                    console.log(`Admin user document for ${firebaseUser.email} not found. Creating it now.`);
                    await setDoc(userDocRef, {
                        email: firebaseUser.email,
                        role: 'admin',
                        createdAt: serverTimestamp()
                    });
                    setUser({ ...firebaseUser, role: 'admin' });
                } else {
                    // For a non-admin, this is an invalid state. Log them out to prevent access.
                    console.warn(`User ${firebaseUser.uid} exists in Auth but not in Firestore. Logging out.`);
                    await auth.signOut();
                    setUser(null);
                }
            }
        } else {
            // User is not logged in.
            setUser(null);
        }
      } catch (error) {
          console.error("Error in onAuthStateChanged listener:", error);
          setUser(null);
          // Don't leave the app in a hanging state.
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
