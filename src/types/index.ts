// src/types/index.ts

export interface UserData {
  id: string;
  email: string;
  name: string | null;
  telephone: string | null;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user';
  status: 'active' | 'inactive';
  region: string | null;
  district: string | null;
  circuit: string | null;
  schoolName: string | null;
  classNames: string[] | null;
  schoolLevels: string[] | null;
  schoolCategory: 'public' | 'private' | null;
  createdAt: string | null; // Keep as string for serializability
}

export interface InviteData {
  id: string;
  email: string;
  status: 'pending' | 'completed';
  role: 'big-admin' | 'admin' | 'user' | null;
  region: string | null;
  district: string | null;
  circuit: string | null;
  schoolName: string | null;
  classNames: string[] | null;
  schoolLevels: string[] | null;
  schoolCategory: 'public' | 'private' | null;
  createdAt: string | null; // Keep as string for serializability
}
