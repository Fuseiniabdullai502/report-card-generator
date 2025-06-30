'use client';

import React from 'react';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import UserManagement from '@/components/user-management';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }
  
  if (user.role !== 'admin') {
     router.replace('/');
     return (
        <div className="flex flex-col justify-center items-center h-screen w-screen bg-background text-destructive">
            <Shield className="h-16 w-16 mb-4" />
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-lg">Redirecting you to the home page...</p>
        </div>
     );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Shield className="h-8 w-8" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-2">Manage user access and review application data.</p>
      </header>
      <UserManagement />
    </main>
  );
}
