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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
          const userEmail = firebaseUser.email?.toLowerCase();
          
          let role: 'admin' | 'user' | null = 'user'; // Default role

          if (adminEmail && userEmail === adminEmail) {
            // This is the admin. Ensure their document is correct.
            role = 'admin';
            if (!userDocSnap.exists() || userDocSnap.data().role !== 'admin') {
              // Self-heal: Create or update the admin's Firestore document
              await setDoc(userDocRef, {
                email: firebaseUser.email,
                role: 'admin',
                createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : serverTimestamp(),
              }, { merge: true });
            }
          } else {
            // This is a regular user.
            if (userDocSnap.exists()) {
              role = userDocSnap.data().role ?? 'user';
            } else {
              // This can happen if a user is created in Auth but not in Firestore.
              // We'll create a basic record for them.
              await setDoc(userDocRef, {
                  email: firebaseUser.email,
                  role: 'user',
                  createdAt: serverTimestamp(),
              }, { merge: true });
              role = 'user';
            }
          }
          
          setUser({ ...firebaseUser, role });

        } catch (error) {
          console.error('Error in AuthProvider while fetching/setting user role:', error);
          setUser({ ...firebaseUser, role: null }); // Fallback on error
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {loading ? (
        <div className="flex justify-center items-center h-screen w-screen bg-background">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
