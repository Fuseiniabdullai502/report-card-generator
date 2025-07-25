
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export interface CustomUser extends User {
  id: string; // Add the 'id' property here
  name?: string | null;
  telephone?: string | null;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user';
  status: 'active' | 'inactive';
  region?: string | null;
  district?: string | null;
  circuit?: string | null;
  schoolName?: string | null;
  classNames?: string[] | null;
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
          
          const superAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
          const userEmail = firebaseUser.email?.toLowerCase();
          
          let name: CustomUser['name'] = null;
          let telephone: CustomUser['telephone'] = null;
          let role: CustomUser['role'] = 'user';
          let status: CustomUser['status'] = 'active';
          let region: CustomUser['region'] = null;
          let district: CustomUser['district'] = null;
          let circuit: CustomUser['circuit'] = null;
          let schoolName: CustomUser['schoolName'] = null;
          let classNames: CustomUser['classNames'] = null;

          if (superAdminEmail && userEmail === superAdminEmail) {
            // This is the designated super admin user.
            role = 'super-admin';
            status = 'active';
            // Self-heal: Ensure their Firestore document exists and has the correct role and status.
            if (!userDocSnap.exists() || userDocSnap.data().role !== 'super-admin') {
              await setDoc(userDocRef, {
                email: firebaseUser.email,
                name: firebaseUser.displayName || 'Super Admin',
                telephone: null,
                role: 'super-admin',
                status: 'active',
                region: null,
                district: null,
                circuit: null,
                schoolName: null,
                classNames: null,
                createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : serverTimestamp(),
              }, { merge: true });
            }
          } else {
            // This is a regular user.
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              name = userData.name ?? null;
              telephone = userData.telephone ?? null;
              role = userData.role ?? 'user';
              status = userData.status ?? 'active';
              region = userData.region ?? null;
              district = userData.district ?? null;
              circuit = userData.circuit ?? null;
              schoolName = userData.schoolName ?? null;
              
              const rawClassNames = userData.classNames ?? null;
              classNames = Array.isArray(rawClassNames) ? rawClassNames : (rawClassNames ? [rawClassNames] : null);

            } else {
              // This can happen if a user was created in Auth but not in Firestore.
              // This case is now less likely because registration action creates the doc.
              // But as a fallback, we can create a default document.
              console.warn(`User document for ${userEmail} not found. A document should have been created on registration. Creating a fallback document now.`);
              await setDoc(userDocRef, {
                  email: firebaseUser.email,
                  name: firebaseUser.displayName || 'New User',
                  telephone: firebaseUser.phoneNumber || null,
                  role: 'user',
                  status: 'active',
                  region: null,
                  district: null,
                  circuit: null,
                  schoolName: null,
                  classNames: null,
                  createdAt: serverTimestamp(),
              }, { merge: true });
              role = 'user';
              status = 'active';
            }
          }
          
          console.log(`📄 Firestore data: Name: ${name}, Tel: ${telephone}, Role: ${role}, Status: ${status}, Region: ${region}, District: ${district}, Circuit: ${circuit}, School: ${schoolName}, Classes: ${classNames?.join(', ')}`);
          setUser({ ...firebaseUser, id: firebaseUser.uid, name, telephone, role, status, region, district, circuit, schoolName, classNames });

        } catch (error) {
          console.error('Error in AuthProvider while fetching/setting user role:', error);
          setUser({ ...firebaseUser, id: firebaseUser.uid, role: 'user', status: 'active', name: null, telephone: null, region: null, district: null, circuit: null, schoolName: null, classNames: null }); // Fallback on error
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

    
