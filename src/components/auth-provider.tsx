
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
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const isAdminByEmail = firebaseUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
            // Ensure the role is correctly set, especially for the admin
            const role = (isAdminByEmail && userData.role !== 'admin') ? 'admin' : userData.role || 'user';
            
            setUser({ ...firebaseUser, role });
          } else {
            // This is an invalid state if a non-admin is in Auth but not Firestore.
            // The registration flow handles creating the document, so this case implies an issue.
            // For the admin, their document might be created on first login via the self-healing logic.
            // But with the simplified provider, we will just log out any user without a DB record for safety.
            console.warn(`User ${firebaseUser.uid} exists in Auth but not Firestore. Logging out.`);
            await auth.signOut();
            setUser(null);
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
