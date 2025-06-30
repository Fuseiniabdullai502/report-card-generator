'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import UserManagement from '@/components/user-management';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return; // Wait for auth state to resolve
    }
    if (!user) {
      router.replace('/login');
    } else if (user.role !== 'admin') {
      router.replace('/');
    }
  }, [user, loading, router]);


  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
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
