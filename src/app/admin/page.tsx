
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth, type CustomUser, type PlainUser } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { Loader2, Shield, ArrowLeft } from 'lucide-react';
import { getUsersAction, getInvitesAction, getDistrictStatsAction, getSchoolStatsAction, getSystemWideStatsAction, getReportsForAdminAction, type PopulationStats } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ReportData } from '@/lib/schemas';
import type { UserData, InviteData } from '@/types';

interface SchoolStats {
  classCount: number;
  maleCount: number;
  femaleCount: number;
  totalStudents: number;
}

const UserManagement = dynamic(() => import('@/components/user-management'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});


export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserData[]>([]);
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [populationStats, setPopulationStats] = useState<PopulationStats | null>(null);
  const [schoolStats, setSchoolStats] = useState<SchoolStats | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [allReports, setAllReports] = useState<ReportData[]>([]);

  const fetchData = useCallback(async (currentUser: CustomUser) => {
    if (!currentUser) return; // Wait for user object
    setIsLoadingData(true);
    setPopulationStats(null);
    setSchoolStats(null);
    
    // Create a plain, serializable object for the server action
    const plainUser: PlainUser = {
      uid: currentUser.uid,
      role: currentUser.role,
      district: currentUser.district,
      schoolName: currentUser.schoolName,
      region: currentUser.region,
      circuit: currentUser.circuit,
      schoolLevels: currentUser.schoolLevels,
      schoolCategory: currentUser.schoolCategory,
    };
    
    try {
      const usersPromise = getUsersAction(plainUser);
      const invitesPromise = getInvitesAction(plainUser);
      
      let reportsPromise: Promise<{ success: boolean; reports?: ReportData[]; error?: string; }> | null = null;
      if (currentUser.role === 'super-admin' || currentUser.role === 'big-admin') {
        reportsPromise = getReportsForAdminAction(plainUser);
      }

      const [usersResult, invitesResult, reportsResult] = await Promise.all([
        usersPromise, 
        invitesPromise,
        reportsPromise
      ]);

      if (usersResult.success && usersResult.users) {
        setUsers(usersResult.users);
      } else {
        toast({ title: 'Error Fetching Users', description: usersResult.error, variant: 'destructive' });
      }

      if (invitesResult.success && invitesResult.invites) {
        setInvites(invitesResult.invites);
      } else {
        toast({ title: 'Error Fetching Invites', description: invitesResult.error, variant: 'destructive' });
      }

      if (reportsResult) {
        if (reportsResult.success && reportsResult.reports) {
          setAllReports(reportsResult.reports);
        } else {
          toast({ title: 'Error Fetching Reports', description: reportsResult.error, variant: 'destructive' });
        }
      }

      if (currentUser.role === 'super-admin') {
          const systemStatsResult = await getSystemWideStatsAction();
          if (systemStatsResult.success && systemStatsResult.stats) {
              setPopulationStats(systemStatsResult.stats);
          } else {
              toast({ title: 'Error Fetching System Stats', description: systemStatsResult.error, variant: 'destructive' });
          }
      } else if (currentUser.role === 'big-admin' && currentUser.district) {
          const districtStatsResult = await getDistrictStatsAction(currentUser.district);
          if (districtStatsResult.success && districtStatsResult.stats) {
              setPopulationStats(districtStatsResult.stats);
          } else {
              toast({ title: 'Error Fetching District Stats', description: districtStatsResult.error, variant: 'destructive' });
          }
      } else if (currentUser.role === 'admin' && currentUser.schoolName) {
          const schoolStatsResult = await getSchoolStatsAction(currentUser.schoolName);
          if (schoolStatsResult.success && schoolStatsResult.stats) {
              setSchoolStats(schoolStatsResult.stats);
          } else {
              toast({ title: 'Error Fetching School Stats', description: schoolStatsResult.error, variant: 'destructive' });
          }
      }

    } catch (error: any) {
      toast({ title: 'Failed to load management data', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
        fetchData(user);
    }
  }, [user, fetchData]);


  // Redirect logic
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
    } else if (!user.role || !['super-admin', 'big-admin', 'admin'].includes(user.role)) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const getPageTitle = () => {
    switch (user?.role) {
      case 'super-admin':
        return 'Super Admin Panel';
      case 'big-admin':
        return 'District Admin Panel';
      case 'admin':
        return 'School Admin Panel';
      default:
        return 'Admin Panel';
    }
  };

  const getPageDescription = () => {
    switch (user?.role) {
      case 'super-admin':
        return 'Manage all users, roles, and system-wide settings.';
      case 'big-admin':
        return `Manage users and invites for the ${user.district || 'district'}.`;
      case 'admin':
        return `Manage users and invites for ${user.schoolName || 'your school'}.`;
      default:
        return 'Manage users and invites.';
    }
  }

  // Show loader while waiting for auth or data, or while redirecting unauthorized access
  if (authLoading || isLoadingData || !user || !user.role || !['super-admin', 'big-admin', 'admin'].includes(user.role)) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // Render admin dashboard
  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8 no-print relative text-center">
         <Link href="/" passHref>
          <Button variant="outline" size="sm" className="absolute top-0 left-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
          <Shield className="h-8 w-8" />
          {getPageTitle()}
        </h1>
        <p className="text-muted-foreground mt-2">
          {getPageDescription()}
        </p>
      </header>
      <div className="no-print">
        <UserManagement 
            user={user} 
            users={users}
            invites={invites}
            populationStats={populationStats}
            schoolStats={schoolStats}
            isLoading={isLoadingData}
            onDataRefresh={() => fetchData(user)}
            allReports={allReports}
        />
      </div>
    </main>
  );
}
