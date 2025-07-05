'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export interface CustomUser extends User {
  role: 'admin' | 'user' | null;
  status: 'active' | 'inactive' | null;
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
        // User is logged in via Firebase Auth. Now check Firestore.
        console.log('👤 Authenticated user:', firebaseUser.email);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
          const userEmail = firebaseUser.email?.toLowerCase();
          
          let role: 'admin' | 'user' | null = 'user'; // Default role
          let status: 'active' | 'inactive' | null = 'active'; // Default status

          if (adminEmail && userEmail === adminEmail) {
            // This is the designated admin user.
            role = 'admin';
            status = 'active'; // Admins are always active
            // Self-heal: Ensure their Firestore document exists and has the correct role and status.
            if (!userDocSnap.exists() || userDocSnap.data().role !== 'admin' || userDocSnap.data().status !== 'active') {
              await setDoc(userDocRef, {
                email: firebaseUser.email,
                role: 'admin',
                status: 'active',
                createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : serverTimestamp(),
              }, { merge: true });
            }
          } else {
            // This is a regular user.
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              role = userData.role ?? 'user';
              status = userData.status ?? 'active';
            } else {
              // This can happen if a user was created in Auth but not in Firestore.
              console.warn(`User document for ${userEmail} not found. Creating one with 'user' role and 'active' status.`);
              await setDoc(userDocRef, {
                  email: firebaseUser.email,
                  role: 'user',
                  status: 'active',
                  createdAt: serverTimestamp(),
              }, { merge: true });
              role = 'user';
              status = 'active';
            }
          }
          
          console.log('📄 Firestore role:', role, 'Status:', status);
          setUser({ ...firebaseUser, role, status });

        } catch (error) {
          console.error('Error in AuthProvider while fetching/setting user role:', error);
          setUser({ ...firebaseUser, role: null, status: null }); // Fallback on error
        }
      } else {
        // User is not logged in.
        setUser(null);
      }
      // Set loading to false after all async operations are done.
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once on mount.

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
