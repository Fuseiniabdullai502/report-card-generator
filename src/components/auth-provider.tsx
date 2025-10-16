
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export interface CustomUser extends User {
  id: string;
  name?: string | null;
  telephone?: string | null;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user' | 'public_user';
  status: 'active' | 'inactive';
  country?: string | null;
  region?: string | null;
  district?: string | null;
  circuit?: string | null;
  schoolName?: string | null;
  classNames?: string[] | null;
  schoolLevels?: string[] | null;
  schoolCategory?: 'public' | 'private' | null;
}

// A serializable, plain object for the user
export interface PlainUser {
  uid: string;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user' | 'public_user';
  name?: string | null;
  email?: string | null;
  country?: string | null;
  district?: string | null;
  schoolName?: string | null;
  region?: string | null;
  circuit?: string | null;
  schoolLevels?: string[] | null;
  schoolCategory?: 'public' | 'private' | null;
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
          let country: CustomUser['country'] = null;
          let region: CustomUser['region'] = null;
          let district: CustomUser['district'] = null;
          let circuit: CustomUser['circuit'] = null;
          let schoolName: CustomUser['schoolName'] = null;
          let classNames: CustomUser['classNames'] = null;
          let schoolLevels: CustomUser['schoolLevels'] = null;
          let schoolCategory: CustomUser['schoolCategory'] = null;

          if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              name = userData.name ?? null;
              telephone = userData.telephone ?? null;
              role = userData.role ?? 'user';
              status = userData.status ?? 'active';
              country = userData.country ?? null;
              region = userData.region ?? null;
              district = userData.district ?? null;
              circuit = userData.circuit ?? null;
              schoolName = userData.schoolName ?? null;
              const rawClassNames = userData.classNames ?? null;
              classNames = Array.isArray(rawClassNames) ? rawClassNames : (rawClassNames ? [rawClassNames] : null);
              schoolLevels = userData.schoolLevels ?? null;
              schoolCategory = userData.schoolCategory ?? null;

              // Override role if the user is the designated super admin
              if (superAdminEmail && userEmail === superAdminEmail) {
                  role = 'super-admin';
                  if(userData.role !== 'super-admin') {
                       await setDoc(userDocRef, { role: 'super-admin' }, { merge: true });
                  }
              }

          } else {
              // This can happen if a user was created in Auth but not in Firestore.
              // Or if it's the super admin logging in for the first time.
              console.warn(`User document for ${userEmail} not found. A document should have been created on registration. Creating a fallback/initial document now.`);
              
              const isSuperAdmin = superAdminEmail && userEmail === superAdminEmail;
              role = isSuperAdmin ? 'super-admin' : 'public_user'; // Default to public_user for new sign-ups
              status = 'active';

              await setDoc(userDocRef, {
                  email: firebaseUser.email,
                  name: firebaseUser.displayName || (isSuperAdmin ? 'Super Admin' : 'New User'),
                  telephone: firebaseUser.phoneNumber || null,
                  role: role,
                  status: status,
                  country: null,
                  region: null,
                  district: null,
                  circuit: null,
                  schoolName: null,
                  classNames: null,
                  schoolLevels: null,
                  schoolCategory: null,
                  createdAt: serverTimestamp(),
              }, { merge: true });
          }
          
          console.log(`📄 Firestore data: Name: ${name}, Tel: ${telephone}, Role: ${role}, Status: ${status}, Country: ${country}, Region: ${region}, District: ${district}, Circuit: ${circuit}, School: ${schoolName}, Classes: ${classNames?.join(', ')}`);
          setUser({ ...firebaseUser, id: firebaseUser.uid, name, telephone, role, status, country, region, district, circuit, schoolName, classNames, schoolLevels, schoolCategory });

        } catch (error) {
          console.error('Error in AuthProvider while fetching/setting user role:', error);
          setUser({ ...firebaseUser, id: firebaseUser.uid, role: 'public_user', status: 'active', name: null, telephone: null, country: null, region: null, district: null, circuit: null, schoolName: null, classNames: null, schoolLevels: null, schoolCategory: null }); // Fallback on error
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

    

    