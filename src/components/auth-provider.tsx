
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged, getAdditionalUserInfo } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { completeInviteAction } from '@/app/actions';

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
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            // Check if the current user's email matches the admin email from environment variables.
            const isAdmin = firebaseUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const currentRole = userData.role || 'user';

                // If the user is the designated admin but their role in the DB is not 'admin', update it.
                // This corrects the role for an admin who may have logged in before the role system was in place.
                if (isAdmin && currentRole !== 'admin') {
                    await setDoc(userDocRef, { role: 'admin' }, { merge: true });
                    setUser({ ...firebaseUser, role: 'admin' });
                } else {
                    setUser({ ...firebaseUser, role: currentRole });
                }
            } else {
                // This is a new user (first time login/registration).
                const role = isAdmin ? 'admin' : 'user';

                // For a regular new user, complete the server-side invite process.
                if (!isAdmin) {
                    await completeInviteAction(firebaseUser.email!, firebaseUser.uid);
                }

                // Create their user document in Firestore with the correct role.
                await setDoc(userDocRef, {
                    email: firebaseUser.email,
                    role: role,
                    createdAt: serverTimestamp(),
                });
                setUser({ ...firebaseUser, role: role });
            }
        } else {
            // User is not logged in.
            setUser(null);
        }
        setLoading(false);
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
