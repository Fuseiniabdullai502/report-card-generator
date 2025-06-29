'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import UserManagement from '@/components/user-management';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (role !== 'admin')) {
      router.push('/'); // Redirect non-admins to home
    }
  }, [user, role, loading, router]);

  if (loading || !user || role !== 'admin') {
    return (
      <div className="flex flex-col justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 mt-4 text-muted-foreground">Verifying admin credentials...</p>
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold text-primary">Admin Panel</h1>
          </div>
          <Button asChild variant="outline">
              <Link href="/">Back to App</Link>
          </Button>
      </div>
      <UserManagement />
    </main>
  );
}
