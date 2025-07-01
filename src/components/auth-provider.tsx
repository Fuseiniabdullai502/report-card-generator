
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
      try {
        if (firebaseUser) {
          const isAdminByEmail = firebaseUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          
          if (isAdminByEmail) {
            // This is the admin user. Ensure their Firestore document is correct.
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists() || userDoc.data().role !== 'admin') {
              // Admin document is missing or role is wrong. Create/update it.
              await setDoc(userDocRef, {
                email: firebaseUser.email,
                role: 'admin',
                createdAt: userDoc.exists() ? userDoc.data().createdAt : serverTimestamp()
              }, { merge: true });
            }
            // Now set the user state with the guaranteed 'admin' role.
            setUser({ ...firebaseUser, role: 'admin' });
          } else {
            // This is a regular user. Just get their document.
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              setUser({ ...firebaseUser, role: userDoc.data().role || 'user' });
            } else {
              // Regular user exists in Auth but not Firestore. This is an invalid state. Log them out.
              console.warn(`User ${firebaseUser.uid} exists in Auth but not Firestore. Logging out.`);
              await auth.signOut();
              setUser(null);
            }
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error in AuthProvider:", error);
        setUser(null);
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
