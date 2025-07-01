'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
      if (firebaseUser) {
        // User is logged in, now get their custom data (role)
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          // User document exists, add role to user object
          setUser({ ...firebaseUser, role: userDoc.data().role || 'user' });
        } else {
          // This case should be handled by login/register pages.
          // For safety, we treat them as a regular user without a role,
          // which might restrict access until login/register fixes the doc.
           console.warn(`User document for ${firebaseUser.uid} not found in Firestore.`);
           setUser({ ...firebaseUser, role: null });
        }
      } else {
        // User is not logged in
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
