
'use client';

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button, buttonVariants } from '@/components/ui/button';
import { Loader2, UserPlus, CheckCircle, Trash2, Users, Hourglass, Edit, ChevronDown, ShieldCheck, ShieldX, UserCheck, UserX, Building, AlertCircle, BarChart, FileSearch, TrendingUp, Trophy as TrophyIcon, BookMarked, Calendar, Home, School } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    deleteInviteAction, 
    deleteUserAction,
    updateUserStatusAction, 
    updateUserRoleAndScopeAction, 
    createInviteAction,
    updateInviteAction,
    getDistrictClassRankingAction,
    getSchoolProgramRankingAction,
    type PlainUser,
} from '@/app/actions';
import { ghanaRegions, ghanaRegionsAndDistricts, ghanaDistrictsAndCircuits } from '@/lib/ghana-regions-districts';
import type { CustomUser } from './auth-provider';
import type { SchoolRankingData, StudentRankingData } from '@/app/actions';
import DistrictClassRankingDialog from '@/components/district-class-ranking';
import SchoolProgramRankingDialog from '@/components/school-program-ranking';
import { ReportData, SubjectEntry } from '@/lib/schemas';
import { calculateOverallAverage, calculateSubjectFinalMark } from '@/lib/calculations';
import { shsProgramOptions } from '@/lib/curriculum';

const DistrictPerformanceDashboard = lazy(() => import('@/components/district-dashboard'));

const classLevels = ["KG1", "KG2", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "JHS1", "JHS2", "JHS3", "SHS1", "SHS2", "SHS3", "Level 100", "Level 200", "Level 300", "Level 400", "Level 500", "Level 600", "Level 700"];
const academicTermOptions = ["First Term", "Second Term", "Third Term", "First Semester", "Second Semester"];
const academicYearOptions = ["2024/2025", "2025/2026", "2026/2027", "2027/2028", "2028/2029", "2029/2030"];
const schoolLevels = ['Nursery', 'KG', 'Primary', 'JHS', 'SHS'];
const schoolCategories = [{ value: 'public', label: 'Public School' }, { value: 'private', label: 'Private School' }];

interface UserData {
  id: string;
  email: string;
  name?: string | null;
  telephone?: string | null;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user';
  status: 'active' | 'inactive';
  region?: string | null;
  district?: string | null;
  circuit?: string | null;
  schoolName?: string | null;
  classNames?: string[] | null;
  schoolLevels?: string[] | null;
  schoolCategory?: 'public' | 'private' | null;
  createdAt: Date | null;
}

interface InviteData {
  id: string;
  email: string;
  status: 'pending' | 'completed';
  role?: 'big-admin' | 'admin' | 'user' | null;
  region?: string | null;
  district?: string | null;
  circuit?: string | null;
  schoolName?: string | null;
  classNames?: string[] | null;
  schoolLevels?: string[] | null;
  schoolCategory?: 'public' | 'private' | null;
  createdAt: Date | null;
}

interface PopulationStats {
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
  schoolCount: number;
  publicSchoolCount: number;
  privateSchoolCount: number;
  schoolLevelCounts: Record<string, number>;
}

interface SchoolStats {
  classCount: number;
  maleCount: number;
  femaleCount: number;
  totalStudents: number;
}

interface SubjectPerformanceData {
  subjectName: string;
  averageScore: number | null;
}

interface UserManagementProps {
    user: CustomUser;
    users: UserData[];
    invites: InviteData[];
    populationStats: PopulationStats | null;
    schoolStats: SchoolStats | null;
    isLoading: boolean;
    onDataRefresh: () => void;
    allReports: ReportData[];
}

export default function UserManagement({ user, users, invites, populationStats, schoolStats, isLoading, onDataRefresh, allReports }: UserManagementProps) {
  const { toast } = useToast();
  
  const [isCreateInviteDialogOpen, setIsCreateInviteDialogOpen] = useState(false);
  const [isDistrictDashboardOpen, setIsDistrictDashboardOpen] = useState(false);
  
  const [inviteToDelete, setInviteToDelete] = useState<InviteData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editingInvite, setEditingInvite] = useState<InviteData | null>(null);

  const [selectedRankingClass, setSelectedRankingClass] = useState<string>('');
  const [selectedRankingYear, setSelectedRankingYear] = useState<string>('all_years');
  const [selectedRankingTerm, setSelectedRankingTerm] = useState<string>('all_terms');
  const [selectedRankingSubject, setSelectedRankingSubject] = useState<string>('overall');
  const [selectedRankingCategory, setSelectedRankingCategory] = useState<'public' | 'private' | 'all'>('all');
  const [isFetchingRanking, setIsFetchingRanking] = useState(false);
  const [rankingData, setRankingData] = useState<SchoolRankingData[] | null>(null);
  const [isRankingDialogOpen, setIsRankingDialogOpen] = useState(false);

  const [subjectAnalysisClass, setSubjectAnalysisClass] = useState<string>('');

  // State for school program ranking
  const [isSchoolProgramRankingDialogOpen, setIsSchoolProgramRankingDialogOpen] = useState(false);
  const [schoolProgramRankingData, setSchoolProgramRankingData] = useState<StudentRankingData[] | null>(null);
  const [isFetchingSchoolProgramRanking, setIsFetchingSchoolProgramRanking] = useState(false);
  const [selectedSchoolRankingClass, setSelectedSchoolRankingClass] = useState<string>('');
  const [selectedSchoolRankingProgram, setSelectedSchoolRankingProgram] = useState<string>('');

  const allAvailableClasses = useMemo(() => {
    return [...new Set(allReports.map(r => r.className).filter(Boolean))].sort();
  }, [allReports]);

  const allAvailableYears = useMemo(() => {
    return [...new Set(allReports.map(r => r.academicYear).filter(Boolean) as string[])].sort();
  }, [allReports]);

  const allAvailableTerms = useMemo(() => {
    return [...new Set(allReports.map(r => r.academicTerm).filter(Boolean) as string[])].sort();
  }, [allReports]);

  const classPerformanceRanking = useMemo(() => {
    const classAverages = new Map<string, { scores: number[], studentCount: number }>();
    allReports.forEach(report => {
      if (report.className && report.overallAverage !== null && report.overallAverage !== undefined) {
        if (!classAverages.has(report.className)) {
          classAverages.set(report.className, { scores: [], studentCount: 0 });
        }
        const classData = classAverages.get(report.className)!;
        classData.scores.push(report.overallAverage);
        classData.studentCount++;
      }
    });

    return Array.from(classAverages.entries()).map(([className, data]) => ({
      className,
      studentCount: data.studentCount,
      average: data.scores.reduce((a, b) => a + b, 0) / data.scores.length
    })).sort((a, b) => b.average - a.average);
  }, [allReports]);


  const subjectPerformanceForClass = useMemo(() => {
    if (!subjectAnalysisClass) return [];

    const subjectMap = new Map<string, number[]>();
    allReports.forEach(report => {
      if (report.className === subjectAnalysisClass) {
        report.subjects.forEach(subject => {
          if (subject.subjectName) {
            const finalMark = calculateSubjectFinalMark(subject);
            if (finalMark !== null) {
              if (!subjectMap.has(subject.subjectName)) {
                subjectMap.set(subject.subjectName, []);
              }
              subjectMap.get(subject.subjectName)!.push(finalMark);
            }
          }
        });
      }
    });

    return Array.from(subjectMap.entries()).map(([subjectName, scores]) => ({
      subjectName,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    })).sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
  }, [allReports, subjectAnalysisClass]);


  const availableSubjectsForClass = useMemo(() => {
    if (!selectedRankingClass) return [];
    const subjects = new Set<string>();
    allReports.forEach(report => {
      if (report.className === selectedRankingClass) {
        report.subjects.forEach(subject => {
          if(subject.subjectName) subjects.add(subject.subjectName);
        });
      }
    });
    return Array.from(subjects).sort();
  }, [selectedRankingClass, allReports]);

  useEffect(() => {
    setSelectedRankingSubject('overall');
  }, [selectedRankingClass]);
  
  useEffect(() => {
    if (allAvailableClasses.length > 0) {
        setSubjectAnalysisClass(allAvailableClasses[0]);
    }
  }, [allAvailableClasses]);


  const handleGenerateRanking = async () => {
    if (!selectedRankingClass || !user.district) {
      toast({ title: 'Selection Missing', description: 'Please select a class to generate the report.', variant: 'destructive' });
      return;
    }
    setIsFetchingRanking(true);
    setRankingData(null);
    const result = await getDistrictClassRankingAction({ 
        district: user.district, 
        className: selectedRankingClass,
        academicYear: selectedRankingYear === 'all_years' ? null : selectedRankingYear,
        academicTerm: selectedRankingTerm === 'all_terms' ? null : selectedRankingTerm,
        subjectName: selectedRankingSubject === 'overall' ? null : selectedRankingSubject, 
        schoolCategory: selectedRankingCategory === 'all' ? null : selectedRankingCategory,
    });
    if (result.success && result.ranking) {
      setRankingData(result.ranking);
      setIsRankingDialogOpen(true);
    } else {
      toast({ title: 'Error Generating Report', description: result.error, variant: 'destructive' });
    }
    setIsFetchingRanking(false);
  };
  
  const handleGenerateSchoolProgramRanking = async () => {
    if (!selectedSchoolRankingClass || !selectedSchoolRankingProgram) {
      toast({ title: 'Selection Missing', description: 'Please select a class and SHS program.', variant: 'destructive' });
      return;
    }
    if (!user.schoolName) {
      toast({ title: 'Configuration Error', description: 'Your admin account is not assigned to a school.', variant: 'destructive' });
      return;
    }
    setIsFetchingSchoolProgramRanking(true);
    setSchoolProgramRankingData(null);
    const result = await getSchoolProgramRankingAction({
      schoolName: user.schoolName,
      className: selectedSchoolRankingClass,
      shsProgram: selectedSchoolRankingProgram,
    });
    if (result.success && result.ranking) {
      setSchoolProgramRankingData(result.ranking);
      setIsSchoolProgramRankingDialogOpen(true);
    } else {
      toast({ title: 'Error Generating Ranking', description: result.error, variant: 'destructive' });
    }
    setIsFetchingSchoolProgramRanking(false);
  };

  const roleCounts = useMemo(() => {
    if (user.role !== 'super-admin') return null;
    const counts = {
      bigAdmin: { active: 0, inactive: 0 },
      admin: { active: 0, inactive: 0 },
      user: { active: 0, inactive: 0 },
    };
    users.forEach(u => {
      if (u.role === 'big-admin') u.status === 'active' ? counts.bigAdmin.active++ : counts.bigAdmin.inactive++;
      else if (u.role === 'admin') u.status === 'active' ? counts.admin.active++ : counts.admin.inactive++;
      else if (u.role === 'user') u.status === 'active' ? counts.user.active++ : counts.user.inactive++;
    });
    return counts;
  }, [users, user.role]);

  const bigAdminRoleCounts = useMemo(() => {
    if (user.role !== 'big-admin') return null;
    const counts = {
      admin: { active: 0, inactive: 0 },
      user: { active: 0, inactive: 0 },
    };
    users.forEach(u => {
      if (u.role === 'admin') u.status === 'active' ? counts.admin.active++ : counts.admin.inactive++;
      else if (u.role === 'user') u.status === 'active' ? counts.user.active++ : counts.user.inactive++;
    });
    return counts;
  }, [users, user.role]);

  const handleDeleteInvite = async () => {
    if (!inviteToDelete) return;
    setIsDeleting(true);
    const result = await deleteInviteAction({ inviteId: inviteToDelete.id });
    if (result.success) {
      toast({ title: 'Invite Deleted', description: `The invite for ${inviteToDelete.email} has been removed.` });
      onDataRefresh();
    } else {
      toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    setIsDeleting(false);
    setInviteToDelete(null);
  };
  
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    
    // Create plain user object for server action
    const plainUser: PlainUser = {
      uid: user.uid,
      role: user.role,
      region: user.region,
      district: user.district,
      schoolName: user.schoolName,
      circuit: user.circuit,
    };
    
    const result = await deleteUserAction({ userId: userToDelete.id }, plainUser);
    if (result.success) {
      toast({ title: 'User Deleted', description: `The user ${userToDelete.email} has been permanently removed.` });
      onDataRefresh();
    } else {
      toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    setIsDeletingUser(false);
    setUserToDelete(null);
  };

  const handleStatusChange = async (userId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const result = await updateUserStatusAction({ userId, status: newStatus });
    if (result.success) {
        toast({ title: 'Status Updated', description: `User has been set to ${newStatus}.` });
        onDataRefresh();
    } else {
      toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
    }
  };

  const totalUsers = users.length;
  const pendingInvitesCount = invites.filter(i => i.status === 'pending').length;

  return (
    <>
        <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/50 shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Total Managed Users</CardTitle><Users className="h-5 w-5 text-primary" /></CardHeader>
            <CardContent><div className="text-4xl font-bold text-foreground">{isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : totalUsers}</div><p className="text-xs text-muted-foreground">All users within your management scope.</p></CardContent>
        </Card>
        <Card className="border-amber-500/50 shadow-lg hover:shadow-amber-500/20 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-amber-600">Pending Invites</CardTitle><Hourglass className="h-5 w-5 text-amber-600" /></CardHeader>
            <CardContent><div className="text-4xl font-bold text-foreground">{isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : pendingInvitesCount}</div><p className="text-xs text-muted-foreground">Users authorized but not yet registered.</p></CardContent>
        </Card>
        </div>
        
        {user.role === 'super-admin' && !isLoading && (
        <div className="space-y-8">
            <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">System Role Overview</h3>
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-base font-medium">Big Admins (District)</CardTitle></CardHeader><CardContent className="flex items-center justify-around"><div className="text-center"><p className="flex items-center gap-2 text-2xl font-bold text-green-600"><ShieldCheck /> {roleCounts?.bigAdmin.active}</p><p className="text-xs text-muted-foreground">Active</p></div><div className="text-center"><p className="flex items-center gap-2 text-2xl font-bold text-destructive"><ShieldX /> {roleCounts?.bigAdmin.inactive}</p><p className="text-xs text-muted-foreground">Inactive</p></div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-base font-medium">Admins (School)</CardTitle></CardHeader><CardContent className="flex items-center justify-around"><div className="text-center"><p className="flex items-center gap-2 text-2xl font-bold text-green-600"><ShieldCheck /> {roleCounts?.admin.active}</p><p className="text-xs text-muted-foreground">Active</p></div><div className="text-center"><p className="flex items-center gap-2 text-2xl font-bold text-destructive"><ShieldX /> {roleCounts?.admin.inactive}</p><p className="text-xs text-muted-foreground">Inactive</p></div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-base font-medium">Users (Instructors)</CardTitle></CardHeader><CardContent className="flex items-center justify-around"><div className="text-center"><p className="flex items-center gap-2 text-2xl font-bold text-green-600"><UserCheck /> {roleCounts?.user.active}</p><p className="text-xs text-muted-foreground">Active</p></div><div className="text-center"><p className="flex items-center gap-2 text-2xl font-bold text-destructive"><UserX /> {roleCounts?.user.inactive}</p><p className="text-xs text-muted-foreground">Inactive</p></div></CardContent></Card>
            </div>
            </div>
            {populationStats && (
                <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">System-Wide Educational Data</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Schools</CardTitle><Building className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{populationStats.schoolCount}</div>
                        <div className="text-xs text-muted-foreground flex justify-around mt-1">
                            <span className='flex items-center gap-1'><Home className="h-3 w-3"/> Public: <b>{populationStats.publicSchoolCount}</b> ({populationStats.schoolCount > 0 ? (populationStats.publicSchoolCount / populationStats.schoolCount * 100).toFixed(0) : 0}%)</span>
                            <span className='flex items-center gap-1'><School className="h-3 w-3"/> Private: <b>{populationStats.privateSchoolCount}</b> ({populationStats.schoolCount > 0 ? (populationStats.privateSchoolCount / populationStats.schoolCount * 100).toFixed(0) : 0}%)</span>
                        </div>
                        </CardContent></Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Students</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{populationStats.totalStudents}</div>
                                {populationStats.totalStudents > 0 && (
                                    <div className="text-xs text-muted-foreground flex justify-around mt-1">
                                        <span>Male: <b>{populationStats.maleCount}</b> ({(populationStats.maleCount / populationStats.totalStudents * 100).toFixed(1)}%)</span>
                                        <span>Female: <b>{populationStats.femaleCount}</b> ({(populationStats.femaleCount / populationStats.totalStudents * 100).toFixed(1)}%)</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <Card className="mt-4">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">School Levels Breakdown</CardTitle></CardHeader>
                        <CardContent className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                            {Object.entries(populationStats.schoolLevelCounts).map(([level, count]) => (
                                <div key={level} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="font-semibold">{level}:</span>
                                    <span className="text-primary font-bold">{count}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
        )}

        {user.role === 'big-admin' && !isLoading && (
        <div className="space-y-8">
             {populationStats && (
                <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">District Data Overview: {user.district}</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                         <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Schools</CardTitle><Building className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{populationStats.schoolCount}</div>
                        <div className="text-xs text-muted-foreground flex justify-around mt-1">
                            <span className='flex items-center gap-1'><Home className="h-3 w-3"/> Public: <b>{populationStats.publicSchoolCount}</b> ({populationStats.schoolCount > 0 ? (populationStats.publicSchoolCount / populationStats.schoolCount * 100).toFixed(0) : 0}%)</span>
                            <span className='flex items-center gap-1'><School className="h-3 w-3"/> Private: <b>{populationStats.privateSchoolCount}</b> ({populationStats.schoolCount > 0 ? (populationStats.privateSchoolCount / populationStats.schoolCount * 100).toFixed(0) : 0}%)</span>
                        </div>
                        </CardContent></Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Students</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{populationStats.totalStudents}</div>
                                 {populationStats.totalStudents > 0 && (
                                    <div className="text-xs text-muted-foreground flex justify-around mt-1">
                                        <span>Male: <b>{populationStats.maleCount}</b> ({(populationStats.maleCount / populationStats.totalStudents * 100).toFixed(1)}%)</span>
                                        <span>Female: <b>{populationStats.femaleCount}</b> ({(populationStats.femaleCount / populationStats.totalStudents * 100).toFixed(1)}%)</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                     <Card className="mt-4">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">District School Levels</CardTitle></CardHeader>
                        <CardContent className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                             {Object.entries(populationStats.schoolLevelCounts).map(([level, count]) => (
                                <div key={level} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="font-semibold">{level}:</span>
                                    <span className="text-primary font-bold">{count}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart /> District Performance Dashboard</CardTitle>
                    <CardDescription>Get a high-level overview of your district's performance with AI-powered analysis.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => setIsDistrictDashboardOpen(true)} disabled={allReports.length === 0}>
                        <TrendingUp className="mr-2 h-4 w-4" /> Open District Dashboard
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart /> District-Wide Class & Subject Analysis</CardTitle>
                <CardDescription>Compare the performance of a class (and optionally, a specific subject) across all schools in your district.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-5 gap-4 flex-grow">
                    <div className="w-full">
                        <Label htmlFor="class-ranking-select">Class Level</Label>
                        <Select value={selectedRankingClass} onValueChange={setSelectedRankingClass}>
                        <SelectTrigger id="class-ranking-select">
                            <SelectValue placeholder="Select a class..." />
                        </SelectTrigger>
                        <SelectContent>
                            {classLevels.map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full">
                        <Label htmlFor="year-ranking-select">Academic Year</Label>
                        <Select value={selectedRankingYear} onValueChange={setSelectedRankingYear}>
                        <SelectTrigger id="year-ranking-select">
                            <SelectValue placeholder="Select a year..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_years">All Years</SelectItem>
                            {allAvailableYears.map(year => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full">
                        <Label htmlFor="term-ranking-select">Term</Label>
                        <Select value={selectedRankingTerm} onValueChange={setSelectedRankingTerm}>
                        <SelectTrigger id="term-ranking-select">
                            <SelectValue placeholder="Select a term..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_terms">All Terms</SelectItem>
                            {allAvailableTerms.map(term => (
                              <SelectItem key={term} value={term}>{term}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full">
                        <Label htmlFor="subject-ranking-select">Subject</Label>
                        <Select value={selectedRankingSubject} onValueChange={setSelectedRankingSubject} disabled={!selectedRankingClass}>
                        <SelectTrigger id="subject-ranking-select">
                            <SelectValue placeholder="Overall / Select Subject" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="overall">Overall Performance</SelectItem>
                            {availableSubjectsForClass.length > 0 ? (
                                availableSubjectsForClass.map(subject => (
                                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                                ))
                            ) : (
                                <SelectItem value="no_subjects" disabled>No subjects for this class</SelectItem>
                            )}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full">
                      <Label htmlFor="category-ranking-select">School Category</Label>
                        <Select value={selectedRankingCategory} onValueChange={(value) => setSelectedRankingCategory(value as any)}>
                        <SelectTrigger id="category-ranking-select">
                            <SelectValue placeholder="All Schools" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Schools</SelectItem>
                            <SelectItem value="public">Public Schools</SelectItem>
                            <SelectItem value="private">Private Schools</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                  </div>
                  <Button onClick={handleGenerateRanking} disabled={isFetchingRanking || !selectedRankingClass}>
                      {isFetchingRanking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                      Generate Report
                  </Button>
                </CardContent>
            </Card>
        </div>
        )}

        {user.role === 'admin' && !isLoading && (
            <div className="space-y-8">
                {schoolStats && (
                <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">School Data Overview</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{schoolStats.classCount}</div>
                                <p className="text-xs text-muted-foreground">Classes with student reports</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{schoolStats.totalStudents}</div>
                                 {schoolStats.totalStudents > 0 && (
                                    <div className="text-xs text-muted-foreground flex justify-around mt-1">
                                        <span>Male: <b>{schoolStats.maleCount}</b> ({(schoolStats.maleCount / schoolStats.totalStudents * 100).toFixed(1)}%)</span>
                                        <span>Female: <b>{schoolStats.femaleCount}</b> ({(schoolStats.femaleCount / schoolStats.totalStudents * 100).toFixed(1)}%)</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Male Students</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{schoolStats.maleCount}</div>
                                <p className="text-xs text-muted-foreground">Male population</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Female Students</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{schoolStats.femaleCount}</div>
                                <p className="text-xs text-muted-foreground">Female population</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                )}
                {user.schoolLevels?.includes('SHS') && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><TrophyIcon /> SHS Program Performance Ranking</CardTitle>
                            <CardDescription>Rank students within a specific SHS program and class.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
                                <div className="space-y-1">
                                    <Label htmlFor="school-class-ranking-select">Class Level</Label>
                                    <Select value={selectedSchoolRankingClass} onValueChange={setSelectedSchoolRankingClass}>
                                        <SelectTrigger id="school-class-ranking-select"><SelectValue placeholder="Select SHS class..." /></SelectTrigger>
                                        <SelectContent>{['SHS1', 'SHS2', 'SHS3'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="school-program-ranking-select">SHS Program</Label>
                                    <Select value={selectedSchoolRankingProgram} onValueChange={setSelectedSchoolRankingProgram}>
                                        <SelectTrigger id="school-program-ranking-select"><SelectValue placeholder="Select program..." /></SelectTrigger>
                                        <SelectContent>{shsProgramOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={handleGenerateSchoolProgramRanking} disabled={isFetchingSchoolProgramRanking || !selectedSchoolRankingClass || !selectedSchoolRankingProgram}>
                                {isFetchingSchoolProgramRanking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                                Rank Program
                            </Button>
                        </CardContent>
                    </Card>
                )}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrophyIcon /> Class Performance Ranking</CardTitle>
                        <CardDescription>Rank classes in your school by their overall average performance.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {classPerformanceRanking.length > 0 ? (
                            <Table>
                                <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Class Name</TableHead><TableHead># Students</TableHead><TableHead className="text-right">Average (%)</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {classPerformanceRanking.map((c, index) => (
                                        <TableRow key={c.className}><TableCell className="font-semibold">{index + 1}</TableCell><TableCell>{c.className}</TableCell><TableCell>{c.studentCount}</TableCell><TableCell className="text-right font-medium">{c.average.toFixed(2)}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (<p className="text-sm text-muted-foreground">No class data available to generate ranking.</p>)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp /> Subject Performance Analysis</CardTitle>
                        <CardDescription>Rank subjects within a selected class to see where students are excelling or struggling.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 max-w-xs">
                        <Label htmlFor="subject-analysis-class">Select a Class</Label>
                        <Select value={subjectAnalysisClass} onValueChange={setSubjectAnalysisClass}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{allAvailableClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                        </div>
                        {subjectPerformanceForClass.length > 0 ? (
                            <Table>
                                <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Subject Name</TableHead><TableHead className="text-right">Average Score (%)</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {subjectPerformanceForClass.map((s, index) => (
                                        <TableRow key={s.subjectName}><TableCell className="font-semibold">{index + 1}</TableCell><TableCell>{s.subjectName}</TableCell><TableCell className="text-right font-medium">{s.averageScore?.toFixed(2) || 'N/A'}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (<p className="text-sm text-muted-foreground">No subject data available for the selected class.</p>)}
                    </CardContent>
                </Card>
            </div>
        )}
        
        <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus /> Authorize New User</CardTitle><CardDescription>Create an invite by email. You can optionally pre-assign a role and scope, or assign them later by editing the pending invite.</CardDescription></CardHeader>
        <CardContent><Button onClick={() => setIsCreateInviteDialogOpen(true)}><CheckCircle className="mr-2" />Create New Invite</Button></CardContent>
        </Card>

        <Card>
        <CardHeader><CardTitle>User & Invite Management</CardTitle><CardDescription>Manage roles, status, and pending invites for all system users.</CardDescription></CardHeader>
        <CardContent>
            {isLoading ? <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                    {users.map((u) => (
                    <TableRow key={u.id}>
                        <TableCell>
                        <div className="font-medium">{u.name || u.email}</div>
                        <div className="text-xs text-muted-foreground">
                            {u.name && <div>{u.email}</div>}
                            {u.telephone && <div>{u.telephone}</div>}
                        </div>
                        </TableCell>
                        <TableCell>
                        <div className="flex flex-col text-xs">
                            <span className={`capitalize font-semibold ${u.role === 'super-admin' ? 'text-red-500' : u.role === 'big-admin' ? 'text-purple-600' : u.role === 'admin' ? 'text-blue-600' : 'text-green-600'}`}>Role: {u.role}</span>
                            <span className={`capitalize font-semibold ${u.status === 'active' ? 'text-green-500' : 'text-destructive'}`}>Status: {u.status}</span>
                            {u.role === 'big-admin' && u.district && <span className="text-xs text-muted-foreground">District: {u.district} ({u.region})</span>}
                            {u.role === 'admin' && (
                              <>
                                <span className="text-xs text-muted-foreground">School: {u.schoolName} ({u.region} / {u.district})</span>
                                {u.schoolLevels && <span className="text-xs text-muted-foreground">Levels: {u.schoolLevels.join(', ')} ({u.schoolCategory})</span>}
                              </>
                            )}
                            {u.role === 'user' && <span className="text-xs text-muted-foreground">Scope: {[u.region, u.district, u.circuit, u.schoolName, u.classNames?.join(', ')].filter(Boolean).join(' / ')}</span>}
                        </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                        {u.role !== 'super-admin' && <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingUser(u)}><Edit className="h-4 w-4" /></Button>}
                        {u.role !== 'super-admin' && <Switch id={`switch-${u.id}`} checked={u.status === 'active'} onCheckedChange={() => handleStatusChange(u.id, u.status)} aria-label={`Toggle status for ${u.email}`} />}
                        {user.role === 'super-admin' && u.role !== 'super-admin' && u.status === 'inactive' && (<Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setUserToDelete(u)} title={`Delete user ${u.email}`}><Trash2 className="h-4 w-4" /></Button>)}
                        </TableCell>
                    </TableRow>
                    ))}
                    {invites.filter((i) => i.status === 'pending').map((invite) => (
                        <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>
                            <div className="flex flex-col text-xs">
                            <span className="italic font-semibold text-yellow-600">Status: Pending Invite</span>
                            {invite.role ? (
                                <span className={`capitalize font-semibold ${invite.role === 'big-admin' ? 'text-purple-600' : invite.role === 'admin' ? 'text-blue-600' : 'text-green-600'}`}>Role: {invite.role}</span>
                            ) : (
                                <span className="flex items-center gap-1 font-semibold text-destructive"><AlertCircle className="h-3 w-3" />Role Not Assigned</span>
                            )}
                             {invite.role === 'admin' && invite.schoolLevels && (
                                <span className="text-xs text-muted-foreground">{invite.schoolLevels.join(', ')} ({invite.schoolCategory})</span>
                             )}
                            </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingInvite(invite)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => setInviteToDelete(invite)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    {(users.length === 0 && pendingInvitesCount === 0) && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No users or pending authorizations found.</TableCell></TableRow>}
                </TableBody>
                </Table>
            </div>
            )}
        </CardContent>
        </Card>
        </div>
      
      <AlertDialog open={!!inviteToDelete} onOpenChange={(open) => !open && setInviteToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the invite for <strong>{inviteToDelete?.email}</strong> and they will not be able to register.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setInviteToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteInvite} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete User Permanently?</AlertDialogTitle><AlertDialogDescription>This action is irreversible and will permanently delete the user <strong>{userToDelete?.email}</strong> from both authentication and the database. Any data associated with this user might be orphaned.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isDeletingUser}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} disabled={isDeletingUser} className={buttonVariants({ variant: "destructive" })}>{isDeletingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete User</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {isCreateInviteDialogOpen && <CreateInviteDialog currentUser={user} onOpenChange={setIsCreateInviteDialogOpen} onInviteCreated={onDataRefresh} />}
      {editingUser && <EditUserDialog currentUser={user} user={editingUser} onOpenChange={() => setEditingUser(null)} onUserUpdated={onDataRefresh} />}
      {editingInvite && <EditInviteDialog currentUser={user} invite={editingInvite} onOpenChange={() => setEditingInvite(null)} onInviteUpdated={onDataRefresh} />}
      {isRankingDialogOpen && rankingData && (
        <DistrictClassRankingDialog
          isOpen={isRankingDialogOpen}
          onOpenChange={setIsRankingDialogOpen}
          rankingData={rankingData}
          districtName={user.district || ''}
          className={selectedRankingClass}
          academicYear={selectedRankingYear === 'all_years' ? null : selectedRankingYear}
          academicTerm={selectedRankingTerm === 'all_terms' ? null : selectedRankingTerm}
          subjectName={selectedRankingSubject === 'overall' ? null : selectedRankingSubject}
        />
      )}
      {isSchoolProgramRankingDialogOpen && schoolProgramRankingData && (
        <SchoolProgramRankingDialog
          isOpen={isSchoolProgramRankingDialogOpen}
          onOpenChange={setIsSchoolProgramRankingDialogOpen}
          rankingData={schoolProgramRankingData}
          schoolName={user.schoolName || ''}
          className={selectedSchoolRankingClass}
          programName={shsProgramOptions.find(p => p.value === selectedSchoolRankingProgram)?.label || selectedSchoolRankingProgram}
        />
      )}
       <Suspense fallback={<div className="flex justify-center items-center h-screen w-screen bg-background"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>}>
        {isDistrictDashboardOpen && (
            <DistrictPerformanceDashboard
                isOpen={isDistrictDashboardOpen}
                onOpenChange={setIsDistrictDashboardOpen}
                allReports={allReports}
                user={user}
            />
        )}
      </Suspense>
    </>
  );
}

const inviteFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  role: z.enum(['big-admin', 'admin', 'user']).optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  circuit: z.string().optional(),
  schoolName: z.string().optional(),
  classNames: z.array(z.string()).optional(),
  schoolLevels: z.array(z.string()).optional(),
  schoolCategory: z.enum(['public', 'private']).optional(),
});
type InviteFormValues = z.infer<typeof inviteFormSchema>;


function CreateInviteDialog({ currentUser, onOpenChange, onInviteCreated }: { currentUser: CustomUser, onOpenChange: (open: boolean) => void, onInviteCreated: () => void }) {
    const { toast } = useToast();
    const { register, handleSubmit, control, watch, setValue, formState: { isSubmitting, errors } } = useForm<InviteFormValues>({
        resolver: zodResolver(inviteFormSchema),
        defaultValues: {
            email: '',
            role: undefined,
            region: '',
            district: '',
            circuit: '',
            schoolName: '',
            classNames: [],
            schoolLevels: [],
            schoolCategory: undefined,
        }
    });

    const isSuperAdmin = currentUser.role === 'super-admin';
    const isBigAdmin = currentUser.role === 'big-admin';
    const isAdmin = currentUser.role === 'admin';

    const role = watch('role');
    const region = watch('region');
    const district = watch('district');

    const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
    const [availableCircuits, setAvailableCircuits] = useState<string[]>([]);
    
    useEffect(() => {
        if (isBigAdmin) {
            setValue('region', currentUser.region || '');
            setValue('district', currentUser.district || '');
        } else if (isAdmin) {
            setValue('region', currentUser.region || '');
            setValue('district', currentUser.district || '');
            setValue('circuit', currentUser.circuit || '');
            setValue('schoolName', currentUser.schoolName || '');
        }
    }, [isBigAdmin, isAdmin, currentUser, setValue]);

    useEffect(() => {
        if (region) setAvailableDistricts(ghanaRegionsAndDistricts[region]?.sort() || []);
        else setAvailableDistricts([]);
    }, [region]);

    useEffect(() => {
        if (district) setAvailableCircuits(ghanaDistrictsAndCircuits[district]?.sort() || []);
        else setAvailableCircuits([]);
    }, [district]);

    useEffect(() => {
        if (role === 'big-admin') { setValue('schoolName', ''); setValue('circuit', ''); setValue('classNames', []); setValue('schoolLevels', []); setValue('schoolCategory', undefined); }
        else if (role === 'admin') { setValue('classNames', []); }
        else if (role === 'user') { setValue('schoolLevels', []); setValue('schoolCategory', undefined); }
    }, [role, setValue]);

    const handleMultiSelectChange = (item: string, checked: boolean, field: 'classNames' | 'schoolLevels', currentValues: string[] = []) => {
        const newValues = checked ? [...currentValues, item] : currentValues.filter(c => c !== item);
        setValue(field, newValues, { shouldValidate: true });
    };

    const onSubmit = async (data: InviteFormValues) => {
        const plainUser: PlainUser = {
            uid: currentUser.uid,
            role: currentUser.role,
            region: currentUser.region,
            district: currentUser.district,
            schoolName: currentUser.schoolName,
            circuit: currentUser.circuit,
            schoolLevels: currentUser.schoolLevels,
            schoolCategory: currentUser.schoolCategory,
        };

        const result = await createInviteAction({
            ...data,
            role: data.role || undefined,
        }, plainUser);

        if(result.success) {
            toast({ title: "Invite Created", description: result.message });
            onInviteCreated();
            onOpenChange(false);
        } else {
            toast({ title: "Creation Failed", description: result.message, variant: 'destructive' });
        }
    };
    
    const availableRoles = useMemo(() => {
      if (currentUser.role === 'super-admin') return [{ value: 'user', label: 'User (Instructor)'}, { value: 'admin', label: 'Admin (School-level)'}, { value: 'big-admin', label: 'Big Admin (District-level)'}];
      if (currentUser.role === 'big-admin') return [{ value: 'user', label: 'User (Instructor)'}, { value: 'admin', label: 'Admin (School-level)'}];
      if (currentUser.role === 'admin') return [{ value: 'user', label: 'User (Instructor)'}];
      return [];
    }, [currentUser.role]);

    return (
        <Dialog open={true} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col max-h-[90dvh]">
              <DialogHeader className="shrink-0">
                  <DialogTitle>Create New Invite</DialogTitle>
                  <DialogDescription>Invite a new user by email. Role and permissions can be assigned now or later.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                  <div className="space-y-4 py-4">
                    {isBigAdmin && (<div className="p-2 bg-muted rounded-md text-sm"><p className="font-semibold">Inherited Scope:</p><p>Region: {currentUser.region}, District: {currentUser.district}</p></div>)}
                    {isAdmin && (<div className="p-2 bg-muted rounded-md text-sm"><p className="font-semibold">Inherited Scope:</p><p>School: {currentUser.schoolName}</p></div>)}
                    
                    <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" {...register('email')} placeholder="new.user@example.com"/><p className="text-xs text-destructive">{errors.email?.message}</p></div>
                    <div className="space-y-1"><Label htmlFor="role">Role (Optional)</Label><Controller name="role" control={control} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger id="role"><SelectValue placeholder="Select a role"/></SelectTrigger><SelectContent>{availableRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>)} /></div>

                    {isSuperAdmin && (role === 'big-admin' || role === 'admin' || role === 'user') && (
                      <>
                        <div className="space-y-1"><Label htmlFor="region">Region</Label><Controller name="region" control={control} render={({ field }) => (<Select onValueChange={(val) => { field.onChange(val); setValue('district', ''); setValue('circuit', ''); }} value={field.value || ''}><SelectTrigger id="region"><SelectValue placeholder="Select a region"/></SelectTrigger><SelectContent>{ghanaRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>)} /></div>
                        <div className="space-y-1"><Label htmlFor="district">District/Municipal</Label><Controller name="district" control={control} render={({ field }) => (<Select onValueChange={(val) => { field.onChange(val); setValue('circuit', ''); }} value={field.value || ''} disabled={!region}><SelectTrigger id="district"><SelectValue placeholder="Select a district"/></SelectTrigger><SelectContent>{availableDistricts.length > 0 ? availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>) : <SelectItem value="-" disabled>Select a region first</SelectItem>}</SelectContent></Select>)} /></div>
                      </>
                    )}
                    
                    {(isSuperAdmin || isBigAdmin) && (role === 'admin' || role === 'user') && (
                        <>
                          <div className="space-y-1"><Label htmlFor="circuit">Circuit</Label><Controller name="circuit" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || ''} disabled={!district}><SelectTrigger id="circuit"><SelectValue placeholder="Select a circuit"/></SelectTrigger><SelectContent>{availableCircuits.length > 0 ? availableCircuits.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>) : <SelectItem value="-" disabled>No circuits for this district</SelectItem>}</SelectContent></Select>)} /></div>
                          <div className="space-y-1"><Label htmlFor="schoolName">School Name</Label><Input id="schoolName" {...register('schoolName')} placeholder="Enter school name" /></div>
                        </>
                    )}

                    {role === 'admin' && (isSuperAdmin || isBigAdmin) && (
                        <>
                            <div className="space-y-1"><Label>School Levels</Label><Controller name="schoolLevels" control={control} render={({ field }) => (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between"><span className="truncate">{field.value && field.value.length > 0 ? field.value.join(', ') : 'Select school levels'}</span><ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><ScrollArea className="h-[200px]">{schoolLevels.map(c => (<DropdownMenuCheckboxItem key={c} checked={field.value?.includes(c)} onCheckedChange={checked => handleMultiSelectChange(c, Boolean(checked), 'schoolLevels', field.value)}>{c}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu>)} /></div>
                            <div className="space-y-1"><Label>School Category</Label><Controller name="schoolCategory" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || ''}><SelectTrigger><SelectValue placeholder="Select category..."/></SelectTrigger><SelectContent>{schoolCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>)} /></div>
                        </>
                    )}

                    {role === 'user' && (
                      <div className="space-y-1"><Label>Class Names</Label><Controller name="classNames" control={control} render={({ field }) => (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between"><span className="truncate">{field.value && field.value.length > 0 ? field.value.join(', ') : 'Select classes'}</span><ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><ScrollArea className="h-[200px]">{classLevels.map(c => (<DropdownMenuCheckboxItem key={c} checked={field.value?.includes(c)} onCheckedChange={checked => handleMultiSelectChange(c, Boolean(checked), 'classNames', field.value)}>{c}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu>)} /></div>
                    )}
                  </div>
                </div>
                <DialogFooter className="shrink-0 pt-4 border-t mt-4">
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send Invite</Button>
                </DialogFooter>
              </form>
            </DialogContent>
        </Dialog>
    );
}

// Dialog for editing existing USERS
function EditUserDialog({ currentUser, user, onOpenChange, onUserUpdated }: { currentUser: CustomUser, user: UserData, onOpenChange: (open: boolean) => void, onUserUpdated: () => void }) {
    const [role, setRole] = useState(user.role);
    const [region, setRegion] = useState(user.region || '');
    const [district, setDistrict] = useState(user.district || '');
    const [circuit, setCircuit] = useState(user.circuit || '');
    const [schoolName, setSchoolName] = useState(user.schoolName || '');
    const [classNames, setClassNames] = useState<string[]>(user.classNames || []);
    const [schoolLevels, setSchoolLevels] = useState<string[]>(user.schoolLevels || []);
    const [schoolCategory, setSchoolCategory] = useState<'public' | 'private' | undefined>(user.schoolCategory || undefined);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
    const [availableCircuits, setAvailableCircuits] = useState<string[]>([]);
    
    const isSuperAdmin = currentUser.role === 'super-admin';
    const isBigAdmin = currentUser.role === 'big-admin';

    useEffect(() => {
        if (region) setAvailableDistricts(ghanaRegionsAndDistricts[region]?.sort() || []);
        else setAvailableDistricts([]);
    }, [region]);

    useEffect(() => {
        if (district) setAvailableCircuits(ghanaDistrictsAndCircuits[district]?.sort() || []);
        else setAvailableCircuits([]);
    }, [district]);

    useEffect(() => {
        if (role === 'big-admin') { setSchoolName(''); setCircuit(''); setClassNames([]); setSchoolLevels([]); setSchoolCategory(undefined); }
        else if (role === 'admin') { setClassNames([]); }
        else if (role === 'user') { setSchoolLevels([]); setSchoolCategory(undefined); }
    }, [role]);
    
    const handleMultiSelectChange = (item: string, checked: boolean, field: 'classNames' | 'schoolLevels') => {
        const setFunction = field === 'classNames' ? setClassNames : setSchoolLevels;
        setFunction(prev => checked ? [...prev, item] : prev.filter(c => c !== item));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const plainUser: PlainUser = {
            uid: currentUser.uid,
            role: currentUser.role,
            region: currentUser.region,
            district: currentUser.district,
            schoolName: currentUser.schoolName,
            circuit: currentUser.circuit,
            schoolLevels: currentUser.schoolLevels,
            schoolCategory: currentUser.schoolCategory,
        };

        const result = await updateUserRoleAndScopeAction({
            userId: user.id,
            role: role as 'big-admin' | 'admin' | 'user',
            region,
            district,
            circuit,
            schoolName,
            classNames,
            schoolLevels,
            schoolCategory
        }, plainUser);

        if(result.success) {
            toast({ title: "User Updated", description: result.message });
            onUserUpdated();
            onOpenChange(false);
        } else {
            toast({ title: "Update Failed", description: result.message, variant: 'destructive' });
        }
        setIsSaving(false);
    };
    
    const availableRoles = useMemo(() => {
      if (currentUser.role === 'super-admin') return [{ value: 'user', label: 'User (Instructor)'}, { value: 'admin', label: 'Admin (School-level)'}, { value: 'big-admin', label: 'Big Admin (District-level)'}];
      if (currentUser.role === 'big-admin') return [{ value: 'user', label: 'User (Instructor)'}, { value: 'admin', label: 'Admin (School-level)'}];
      if (currentUser.role === 'admin') return [{ value: 'user', label: 'User (Instructor)'}];
      return [];
    }, [currentUser.role]);

    return (
        <Dialog open={!!user} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col max-h-[90dvh]">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Edit User: {user.email}</DialogTitle>
                  <DialogDescription>Update the role and permissions for this user.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                  <div className="space-y-4 py-4">
                    {isBigAdmin && (<div className="p-2 bg-muted rounded-md text-sm"><p className="font-semibold">Editing within your scope:</p><p>Region: {currentUser.region}, District: {currentUser.district}</p></div>)}
                    
                    <div className="space-y-2"><Label htmlFor="role">Role</Label><Select value={role} onValueChange={(value) => setRole(value as UserData['role'])}><SelectTrigger id="role"><SelectValue /></SelectTrigger><SelectContent>{availableRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
                    
                    {isSuperAdmin && (role === 'big-admin' || role === 'admin' || role === 'user') && (<><div className="space-y-2"><Label htmlFor="region">Region</Label><Select value={region} onValueChange={(val) => { setRegion(val); setDistrict(''); setCircuit(''); }}><SelectTrigger id="region"><SelectValue placeholder="Select a region"/></SelectTrigger><SelectContent>{ghanaRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="district">District/Municipal</Label><Select value={district} onValueChange={(val) => { setDistrict(val); setCircuit(''); }} disabled={!region}><SelectTrigger id="district"><SelectValue placeholder="Select a district"/></SelectTrigger><SelectContent>{availableDistricts.length > 0 ? availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>) : <SelectItem value="-" disabled>Select a region first</SelectItem>}</SelectContent></Select></div></>)}
                    
                    {(isSuperAdmin || isBigAdmin) && (role === 'admin' || role === 'user') && (
                        <>
                            <div className="space-y-2"><Label htmlFor="circuit">Circuit</Label><Select value={circuit} onValueChange={setCircuit} disabled={!district}><SelectTrigger id="circuit"><SelectValue placeholder="Select a circuit"/></SelectTrigger><SelectContent>{availableCircuits.length > 0 ? (availableCircuits.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)) : (<SelectItem value="-" disabled>Select a district first</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label htmlFor="schoolName">School Name</Label><Input id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter school name" /></div>
                        </>
                    )}
                     
                    {role === 'admin' && (isSuperAdmin || isBigAdmin) && (
                        <>
                            <div className="space-y-1"><Label>School Levels</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between"><span className="truncate">{schoolLevels.length > 0 ? schoolLevels.join(', ') : 'Select school levels'}</span><ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><ScrollArea className="h-[200px]">{schoolLevels.map(c => (<DropdownMenuCheckboxItem key={c} checked={schoolLevels.includes(c)} onCheckedChange={checked => handleMultiSelectChange(c, Boolean(checked), 'schoolLevels')}>{c}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu></div>
                            <div className="space-y-1"><Label>School Category</Label><Select value={schoolCategory || 'placeholder'} onValueChange={val => setSchoolCategory(val === 'placeholder' ? undefined : (val as 'public' | 'private'))}><SelectTrigger><SelectValue placeholder="Select category..."/></SelectTrigger><SelectContent><SelectItem value="placeholder" disabled>Select category...</SelectItem>{schoolCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                        </>
                    )}
                    
                    {role === 'user' && (<div className="space-y-2"><Label htmlFor="user-classNames">Class Names</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between"><span className="truncate">{classNames.length > 0 ? classNames.join(', ') : 'Select classes'}</span><ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><ScrollArea className="h-[200px]">{classLevels.map(c => (<DropdownMenuCheckboxItem key={c} checked={classNames.includes(c)} onCheckedChange={checked => handleMultiSelectChange(c, Boolean(checked), 'classNames')}>{c}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu></div>)}
                  </div>
                </div>
                <DialogFooter className="shrink-0 pt-4 border-t mt-4">
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Dialog for editing pending INVITES
function EditInviteDialog({ currentUser, invite, onOpenChange, onInviteUpdated }: { currentUser: CustomUser, invite: InviteData, onOpenChange: (open: boolean) => void, onInviteUpdated: () => void }) {
    const [role, setRole] = useState(invite.role || '');
    const [region, setRegion] = useState(invite.region || '');
    const [district, setDistrict] = useState(invite.district || '');
    const [circuit, setCircuit] = useState(invite.circuit || '');
    const [schoolName, setSchoolName] = useState(invite.schoolName || '');
    const [classNames, setClassNames] = useState<string[]>(invite.classNames || []);
    const [schoolLevels, setSchoolLevels] = useState<string[]>(invite.schoolLevels || []);
    const [schoolCategory, setSchoolCategory] = useState<'public' | 'private' | undefined>(invite.schoolCategory || undefined);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
    const [availableCircuits, setAvailableCircuits] = useState<string[]>([]);
    
    const isSuperAdmin = currentUser.role === 'super-admin';
    const isBigAdmin = currentUser.role === 'big-admin';

    useEffect(() => {
        if (region) setAvailableDistricts(ghanaRegionsAndDistricts[region]?.sort() || []);
        else setAvailableDistricts([]);
    }, [region]);

    useEffect(() => {
        if (district) setAvailableCircuits(ghanaDistrictsAndCircuits[district]?.sort() || []);
        else setAvailableCircuits([]);
    }, [district]);

    useEffect(() => {
        if (role === 'big-admin') { setSchoolName(''); setCircuit(''); setClassNames([]); setSchoolLevels([]); setSchoolCategory(undefined); }
        else if (role === 'admin') { setClassNames([]); }
        else if (role === 'user') { setSchoolLevels([]); setSchoolCategory(undefined); }
    }, [role]);

    const handleMultiSelectChange = (item: string, checked: boolean, field: 'classNames' | 'schoolLevels') => {
        const setFunction = field === 'classNames' ? setClassNames : setSchoolLevels;
        setFunction(prev => checked ? [...prev, item] : prev.filter(c => c !== item));
    };


    const handleSave = async () => {
        if (!role) {
            toast({ title: "Role Required", description: "You must assign a role to the invite.", variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        const plainUser: PlainUser = {
            uid: currentUser.uid,
            role: currentUser.role,
            region: currentUser.region,
            district: currentUser.district,
            schoolName: currentUser.schoolName,
            circuit: currentUser.circuit,
            schoolLevels: currentUser.schoolLevels,
            schoolCategory: currentUser.schoolCategory,
        };

        const result = await updateInviteAction({
            inviteId: invite.id,
            role: role as 'big-admin' | 'admin' | 'user',
            region,
            district,
            circuit,
            schoolName,
            classNames,
            schoolLevels,
            schoolCategory,
        }, plainUser);

        if(result.success) {
            toast({ title: "Invite Updated", description: result.message });
            onInviteUpdated();
            onOpenChange(false);
        } else {
            toast({ title: "Update Failed", description: result.message, variant: 'destructive' });
        }
        setIsSaving(false);
    };
    
    const availableRoles = useMemo(() => {
      if (currentUser.role === 'super-admin') return [{ value: 'user', label: 'User (Instructor)'}, { value: 'admin', label: 'Admin (School-level)'}, { value: 'big-admin', label: 'Big Admin (District-level)'}];
      if (currentUser.role === 'big-admin') return [{ value: 'user', label: 'User (Instructor)'}, { value: 'admin', label: 'Admin (School-level)'}];
      if (currentUser.role === 'admin') return [{ value: 'user', label: 'User (Instructor)'}];
      return [];
    }, [currentUser.role]);

    return (
        <Dialog open={!!invite} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col max-h-[90dvh]">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Edit Invite: {invite.email}</DialogTitle>
                  <DialogDescription>Assign or update the role and permissions for this pending invite.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                  <div className="space-y-4 py-4">
                    {isBigAdmin && (<div className="p-2 bg-muted rounded-md text-sm"><p className="font-semibold">Editing within your scope:</p><p>Region: {currentUser.region}, District: {currentUser.district}</p></div>)}
                    
                    <div className="space-y-2"><Label htmlFor="role">Role</Label><Select value={role} onValueChange={(value) => setRole(value as any)}><SelectTrigger id="role"><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{availableRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
                    
                    {isSuperAdmin && (role === 'big-admin' || role === 'admin' || role === 'user') && (<><div className="space-y-2"><Label htmlFor="region">Region</Label><Select value={region} onValueChange={(val) => { setRegion(val); setDistrict(''); setCircuit(''); }}><SelectTrigger id="region"><SelectValue placeholder="Select a region"/></SelectTrigger><SelectContent>{ghanaRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="district">District/Municipal</Label><Select value={district} onValueChange={(val) => { setDistrict(val); setCircuit(''); }} disabled={!region}><SelectTrigger id="district"><SelectValue placeholder="Select a district"/></SelectTrigger><SelectContent>{availableDistricts.length > 0 ? availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>) : <SelectItem value="-" disabled>Select a region first</SelectItem>}</SelectContent></Select></div></>)}
                    
                    {(isSuperAdmin || isBigAdmin) && (role === 'admin' || role === 'user') && (
                        <>
                            <div className="space-y-2"><Label htmlFor="circuit">Circuit</Label><Select value={circuit} onValueChange={setCircuit} disabled={!district}><SelectTrigger id="circuit"><SelectValue placeholder="Select a circuit"/></SelectTrigger><SelectContent>{availableCircuits.length > 0 ? (availableCircuits.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)) : (<SelectItem value="-" disabled>Select a district first</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label htmlFor="schoolName">School Name</Label><Input id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter school name" /></div>
                        </>
                    )}

                    {role === 'admin' && (isSuperAdmin || isBigAdmin) && (
                        <>
                            <div className="space-y-1"><Label>School Levels</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between"><span className="truncate">{schoolLevels.length > 0 ? schoolLevels.join(', ') : 'Select school levels'}</span><ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><ScrollArea className="h-[200px]">{schoolLevels.map(c => (<DropdownMenuCheckboxItem key={c} checked={schoolLevels.includes(c)} onCheckedChange={checked => handleMultiSelectChange(c, Boolean(checked), 'schoolLevels')}>{c}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu></div>
                            <div className="space-y-1"><Label>School Category</Label><Select value={schoolCategory || ''} onValueChange={val => setSchoolCategory(val as 'public' | 'private' | undefined)}><SelectTrigger><SelectValue placeholder="Select category..."/></SelectTrigger><SelectContent>{schoolCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                        </>
                    )}
                    
                    {role === 'user' && (<div className="space-y-2"><Label htmlFor="user-classNames">Class Names</Label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between"><span className="truncate">{classNames.length > 0 ? classNames.join(', ') : 'Select classes'}</span><ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><ScrollArea className="h-[200px]">{classLevels.map(c => (<DropdownMenuCheckboxItem key={c} checked={classNames.includes(c)} onCheckedChange={checked => handleMultiSelectChange(c, Boolean(checked), 'classNames')}>{c}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu></div>)}
                  </div>
                </div>
                <DialogFooter className="shrink-0 pt-4 border-t mt-4">
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={handleSave} disabled={isSaving || !role}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    