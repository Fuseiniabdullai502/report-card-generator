
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import NextImage from 'next/image';
import dynamic from 'next/dynamic';
import type { ReportData } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Printer, BookMarked, FileText, EyeOff, Trash2, BarChart3, Share2, Building, Upload, Loader2,
  AlertTriangle, Users, PlusCircle, CalendarDays, PenSquare, UploadCloud, ListTodo, Settings,
  Image as ImageIcon, ListChecks, LogOut, Shield, Edit, BarChartHorizontalBig
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { defaultReportData, STUDENT_PROFILES_STORAGE_KEY } from '@/lib/schemas';
import { db, auth, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { calculateOverallAverage } from '@/lib/calculations';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import type { CustomUser, PlainUser } from '@/components/auth-provider';
import Link from 'next/link';
import { ghanaRegions, ghanaRegionsAndDistricts, ghanaDistrictsAndCircuits } from '@/lib/ghana-regions-districts';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deleteReportAction, getReportsAction } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { DatePicker } from '@/components/ui/datepicker';
import { format } from 'date-fns';
import { getClassLevel, shsProgramOptions } from '@/lib/curriculum';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

// ⚡️ Dynamic imports (smaller initial JS)
const ReportForm = dynamic(() => import('@/components/report-form'), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading form…</div> });
const ReportPreview = dynamic(() => import('@/components/report-preview'), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading preview…</div> });
const ReportActions = dynamic(() => import('@/components/report-actions'), { ssr: false });
const SchoolPerformanceDashboard = dynamic(() => import('@/components/school-dashboard'), { ssr: false });
const ClassPerformanceDashboard = dynamic(() => import('@/components/class-dashboard'), { ssr: false });
const ImportStudentsDialog = dynamic(() => import('@/components/import-students-dialog'), { ssr: false });
const SignaturePad = dynamic(() => import('@/components/signature-pad'), { ssr: false });
const QuickEntry = dynamic(() => import('@/components/quick-entry').then(m => m.QuickEntry), { ssr: false });

const ADD_CUSTOM_CLASS_VALUE = "--add-custom-class--";
const classLevels = ["KG1", "KG2", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "JHS1", "JHS2", "JHS3", "SHS1", "SHS2", "SHS3", "Level 100", "Level 200", "Level 300", "Level 400", "Level 500", "Level 600", "Level 700"];
const academicTermOptions = ["First Term", "Second Term", "Third Term", "First Semester", "Second Semester"];
const academicYearOptions = ["2024/2025", "2025/2026", "2026/2027", "2027/2028", "2028/2029", "2029/2030", "2030/2031", "2031/2032", "2032/2033", "2033/2034", "2034/2035"];
const reportTemplateOptions = [
  { id: 'default', name: 'Default Template' },
  { id: 'professionalBlue', name: 'Professional Blue' },
  { id: 'elegantGreen', name: 'Elegant Green' },
  { id: 'minimalistGray', name: 'Minimalist Gray' },
  { id: 'academicRed', name: 'Academic Red' },
  { id: 'creativeTeal', name: 'Creative Teal' },
];
const schoolCategories = [{ value: 'public', label: 'Public School' }, { value: 'private', label: 'Private School' }];

// 🔒 image upload limits
const MAX_IMG_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

// 🕒 Firestore Timestamp → Date helper
function tsToDate(v: any): Date | undefined {
  if (!v) return undefined;
  if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return undefined;
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return (s as any)[(v - 20) % 10] || (s as any)[v] || s[0];
}

function formatRankString(rankNumber: number): string {
  if (rankNumber <= 0) return 'N/A';
  const suffix = getOrdinalSuffix(rankNumber);
  return `${rankNumber}${suffix}`;
}

function AppContent({ user }: { user: CustomUser }) {
  const [currentEditingReport, setCurrentEditingReport] = useState<ReportData>(() => {
    const base = structuredClone(defaultReportData) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId'>;
    return {
      ...base,
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: 1,
      createdAt: undefined,
      updatedAt: undefined,
      overallAverage: undefined,
      rank: undefined,
      teacherId: user.uid,
    };
  });
  const [allRankedReports, setAllRankedReports] = useState<ReportData[]>([]);
  const [nextStudentEntryNumber, setNextStudentEntryNumber] = useState<number>(1);
  const [sessionDefaults, setSessionDefaults] = useState<Partial<ReportData>>({});
  const { toast } = useToast();

  const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number>(0);
  const [isClassDashboardOpen, setIsClassDashboardOpen] = useState(false);
  const [isSchoolDashboardOpen, setIsSchoolDashboardOpen] = useState(false);
  const [isImportStudentsDialogOpen, setIsImportStudentsDialogOpen] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

  const [isSessionControlsVisible, setIsSessionControlsVisible] = useState(true);
  const [isReportFormVisible, setIsReportFormVisible] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  const [customClassNames, setCustomClassNames] = useState<string[]>([]);
  const [isCustomClassNameDialogOpen, setIsCustomClassNameDialogOpen] = useState(false);
  const [customClassNameInputValue, setCustomClassNameInputValue] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Filters
  const [adminFilters, setAdminFilters] = useState({
    schoolName: 'all',
    className: 'all',
    academicYear: 'all',
    academicTerm: 'all',
  });
  const [reportToDelete, setReportToDelete] = useState<ReportData | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);

  const router = useRouter();

  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [availableCircuits, setAvailableCircuits] = useState<string[]>([]);
  const [indexError, setIndexError] = useState<string | null>(null);

  // Appearance
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.1);
  const [isAppearanceSettingsVisible, setIsAppearanceSettingsVisible] = useState(false);

  const [subjectOrder, setSubjectOrder] = useState<string[]>([]);

  // User-specific localStorage keys
  const bgImageKey = `app-background-image-${user.uid}`;
  const bgOpacityKey = `app-bg-opacity-${user.uid}`;
  const sessionDefaultsKey = `sessionDefaults-report-card-app-${user.uid}`;

  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);
  const [selectedReportsForPrint, setSelectedReportsForPrint] = useState<Record<string, boolean>>({});
  const [isSelectForPrintDialogOpen, setIsSelectForPrintDialogOpen] = useState(false);

  // Roles
  const isSuperAdmin = user.role === 'super-admin';
  const isBigAdmin = user.role === 'big-admin';
  const isAdmin = user.role === 'admin';
  const isRegularUser = user.role === 'user';
  const isPublicUser = user.role === 'public_user';
  const isAdminRole = isSuperAdmin || isBigAdmin || isAdmin;

  // Load session defaults
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedDefaultsRaw = localStorage.getItem(sessionDefaultsKey);
        let savedDefaults: any = {};
        if (savedDefaultsRaw) {
          savedDefaults = JSON.parse(savedDefaultsRaw);
        }
        const userScopeDefaults: Partial<ReportData> = {};
        if (user.role === 'public_user' && user.country) {
          userScopeDefaults.country = user.country;
          userScopeDefaults.schoolCategory = user.schoolCategory;
        }
        if (user.region) userScopeDefaults.region = user.region;
        if (user.district) userScopeDefaults.district = user.district;
        if (user.circuit) userScopeDefaults.circuit = user.circuit;
        if (user.schoolName) userScopeDefaults.schoolName = user.schoolName;
        if (user.classNames && user.classNames.length > 0) userScopeDefaults.className = user.classNames[0];
        if (user.schoolCategory) userScopeDefaults.schoolCategory = user.schoolCategory;

        setSessionDefaults({ ...savedDefaults, ...userScopeDefaults });
        setCurrentEditingReport(prev => ({ ...prev, ...savedDefaults, ...userScopeDefaults }));
      } catch (e) {
        console.error("Failed to load session defaults from localStorage", e);
      }
    }
  }, [user, sessionDefaultsKey]);

  // Save session defaults
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(sessionDefaults).length > 0) {
      try {
        const defaultsToSave = { ...sessionDefaults };
        if (user.role !== 'super-admin') {
          delete (defaultsToSave as any).region;
          delete (defaultsToSave as any).district;
        }
        if (user.role !== 'super-admin' && user.role !== 'big-admin') {
          delete (defaultsToSave as any).circuit;
          delete (defaultsToSave as any).schoolName;
        }
        if (user.role === 'user' || user.role === 'public_user') {
          delete (defaultsToSave as any).className;
        }
        localStorage.setItem(sessionDefaultsKey, JSON.stringify(defaultsToSave));
      } catch (e) {
        console.error("Failed to save session defaults to localStorage", e);
      }
    }
  }, [sessionDefaults, sessionDefaultsKey, user.role]);

  // Background settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBg = localStorage.getItem(bgImageKey);
      const savedOpacity = localStorage.getItem(bgOpacityKey);
      if (savedBg) setBackgroundImage(savedBg);
      if (savedOpacity) setBackgroundOpacity(parseFloat(savedOpacity));
    }
  }, [user.uid, bgImageKey, bgOpacityKey]);

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMG_TYPES.includes(file.type) || file.size > MAX_IMG_BYTES) {
      toast({ title: 'Invalid image', description: 'Use PNG/JPEG/WebP/SVG under 1.5MB.', variant: 'destructive' });
      if (e.target) e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setBackgroundImage(dataUrl);
      localStorage.setItem(bgImageKey, dataUrl);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleBackgroundOpacityChange = (value: number[]) => {
    const opacity = value[0];
    setBackgroundOpacity(opacity);
    localStorage.setItem(bgOpacityKey, String(opacity));
  };

  // Region/District dependent lists
  useEffect(() => {
    if (sessionDefaults.region && typeof sessionDefaults.region === 'string') {
      const districts = ghanaRegionsAndDistricts[sessionDefaults.region] || [];
      setAvailableDistricts(districts.sort());
    } else {
      setAvailableDistricts([]);
    }
  }, [sessionDefaults.region]);

  useEffect(() => {
    if (sessionDefaults.district && typeof sessionDefaults.district === 'string') {
      const circuits = ghanaDistrictsAndCircuits[sessionDefaults.district] || [];
      setAvailableCircuits(circuits.sort());
    } else {
      setAvailableCircuits([]);
    }
  }, [sessionDefaults.district]);

  // Filter options
  const allFilterOptions = useMemo(() => {
    const schools = new Set<string>();
    const classes = new Set<string>();
    const years = new Set<string>();
    const terms = new Set<string>();

    allRankedReports.forEach(report => {
      if (report.schoolName) schools.add(report.schoolName);
      if (report.className) classes.add(report.className);
      if (report.academicYear) years.add(report.academicYear);
      if (report.academicTerm) terms.add(report.academicTerm);
    });

    let userVisibleClasses = Array.from(classes).filter(Boolean).sort();
    if (isRegularUser && user.classNames) {
      userVisibleClasses = user.classNames.filter(Boolean);
    }

    return {
      schools: ['all', ...Array.from(schools).filter(Boolean).sort()],
      classes: ['all', ...userVisibleClasses],
      years: ['all', ...Array.from(years).filter(Boolean).sort()],
      terms: ['all', ...Array.from(terms).filter(Boolean).sort()],
    };
  }, [allRankedReports, isRegularUser, user.classNames]);

  // Apply filters
  const filteredReports = useMemo(() => {
    let reports = allRankedReports;
    if (isAdminRole) {
      reports = reports.filter(report =>
        (adminFilters.schoolName === 'all' || report.schoolName === adminFilters.schoolName) &&
        (adminFilters.className === 'all' || report.className === adminFilters.className) &&
        (adminFilters.academicYear === 'all' || report.academicYear === adminFilters.academicYear) &&
        (adminFilters.academicTerm === 'all' || report.academicTerm === adminFilters.academicTerm)
      );
    } else {
      if (adminFilters.className !== 'all') {
        reports = reports.filter(report => report.className === adminFilters.className);
      }
    }
    return reports;
  }, [allRankedReports, isAdminRole, adminFilters]);

  useEffect(() => {
    setCurrentPreviewIndex(0);
    setSelectedReportsForPrint({});
  }, [adminFilters]);

  const calculateAndSetRanks = useCallback((listToProcess: ReportData[]) => {
    if (listToProcess.length === 0) {
      setAllRankedReports([]);
      return;
    }

    const reportsWithAverages = listToProcess.map(report => ({
      ...report,
      overallAverage: calculateOverallAverage(report.subjects) ?? undefined,
    }));

    const reportsByClass = new Map<string, ReportData[]>();
    reportsWithAverages.forEach(report => {
      const className = report.className || 'Unclassified';
      if (!reportsByClass.has(className)) {
        reportsByClass.set(className, []);
      }
      reportsByClass.get(className)!.push(report as ReportData);
    });

    const allClassRankedReports: ReportData[] = [];
    reportsByClass.forEach((classReports) => {
      const sortedReports = [...classReports].sort((a, b) => (b.overallAverage ?? -1) - (a.overallAverage ?? -1));
      let lastScore = -1;
      let lastRank = 0;

      const reportsWithRankNumbers = sortedReports.map((report, index) => {
        let currentRank = 0;
        if (report.overallAverage == null) {
          currentRank = -1;
        } else if (report.overallAverage === lastScore) {
          currentRank = lastRank;
        } else {
          currentRank = index + 1;
        }
        lastScore = report.overallAverage ?? -1;
        lastRank = currentRank;
        return { ...report, rankNumber: currentRank } as any;
      });

      const finalFormattedReports = reportsWithRankNumbers.map((report: any) => {
        if (report.rankNumber <= 0) {
          return { ...report, rank: 'N/A' };
        }
        return { ...report, rank: formatRankString(report.rankNumber) };
      });

      allClassRankedReports.push(...finalFormattedReports);
    });

    allClassRankedReports.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
    setAllRankedReports(allClassRankedReports);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user?.uid) {
      setIsLoadingReports(false);
      return;
    }
  
    setIsLoadingReports(true);
    setIndexError(null);
  
    const plainUser: PlainUser = {
      uid: user.uid,
      role: user.role,
      district: user.district,
      schoolName: user.schoolName,
    };
  
    const { success, reports, error } = await getReportsAction(plainUser);
  
    if (success && reports) {
      setIndexError(null);
      let maxEntryNum = 0;
      const classNamesFromDB = new Set<string>();
  
      const fetchedReports = reports.map((data: any) => {
        if (data.className) classNamesFromDB.add(data.className);
        if (data.studentEntryNumber && data.studentEntryNumber > maxEntryNum) {
          maxEntryNum = data.studentEntryNumber;
        }
        return {
          ...data,
          createdAt: tsToDate(data.createdAt),
          updatedAt: tsToDate(data.updatedAt),
        };
      }) as ReportData[];
  
      fetchedReports.sort((a: ReportData, b: ReportData) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  
      const newNextEntryNumber = maxEntryNum + 1;
      setNextStudentEntryNumber(newNextEntryNumber);
  
      const newSessionDefaults: Partial<ReportData> = {};
      if (fetchedReports.length > 0) {
        const lastReport = fetchedReports[fetchedReports.length - 1];
        newSessionDefaults.schoolName = lastReport.schoolName;
        newSessionDefaults.region = lastReport.region;
        newSessionDefaults.district = lastReport.district;
        newSessionDefaults.circuit = lastReport.circuit;
        newSessionDefaults.className = lastReport.className;
        newSessionDefaults.academicYear = lastReport.academicYear;
        newSessionDefaults.academicTerm = lastReport.academicTerm;
      }
  
      setSessionDefaults(prev => ({ ...prev, ...newSessionDefaults }));
      setCustomClassNames(prev => [...new Set([...prev, ...Array.from(classNamesFromDB)])]);
      calculateAndSetRanks(fetchedReports);
  
      if (fetchedReports.length === 0) {
        const baseReset = structuredClone(defaultReportData);
        setCurrentEditingReport(prev => ({
          ...baseReset, ...sessionDefaults, ...newSessionDefaults,
          studentEntryNumber: newNextEntryNumber, id: `unsaved-${Date.now()}`,
          createdAt: undefined, updatedAt: undefined, overallAverage: undefined, rank: undefined, teacherId: user.uid,
        } as any));
      }
    } else {
      const errorMessage = error || "An unknown error occurred while fetching reports.";
      setIndexError(errorMessage);
      toast({ title: "Error Fetching Reports", description: errorMessage, variant: "destructive", duration: 20000 });
    }
  
    setIsLoadingReports(false);
  }, [user, calculateAndSetRanks, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormUpdate = useCallback((data: ReportData) => {
    setCurrentEditingReport(prev => ({ ...prev, ...data }));
  }, []);

  const handleResetToBlankForm = useCallback((newDefaults?: Partial<ReportData>) => {
    const newNextStudentEntryNumber = nextStudentEntryNumber;
    const newStudentBase = structuredClone(defaultReportData);
    const defaultsToApply = newDefaults || sessionDefaults;

    const newStudentDataForForm: ReportData = {
      ...(newStudentBase as any),
      ...defaultsToApply,
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: newNextStudentEntryNumber,
      createdAt: undefined,
      updatedAt: undefined,
      overallAverage: undefined,
      rank: undefined,
      teacherId: user.uid,
    };

    setCurrentEditingReport(newStudentDataForForm);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    toast({ title: "Form Cleared", description: "Ready for a new student's report entry." });
  }, [nextStudentEntryNumber, sessionDefaults, toast, user.uid]);

  const handleClearAndReset = useCallback(() => {
    const newDefaults: Partial<ReportData> = {
      schoolName: currentEditingReport.schoolName,
      region: currentEditingReport.region,
      district: currentEditingReport.district,
      circuit: currentEditingReport.circuit,
      schoolLogoDataUri: currentEditingReport.schoolLogoDataUri,
      className: currentEditingReport.className,
      academicYear: currentEditingReport.academicYear,
      academicTerm: currentEditingReport.academicTerm,
      reopeningDate: currentEditingReport.reopeningDate,
      selectedTemplateId: currentEditingReport.selectedTemplateId,
      shsProgram: currentEditingReport.shsProgram,
      totalSchoolDays: currentEditingReport.totalSchoolDays,
      headMasterSignatureDataUri: currentEditingReport.headMasterSignatureDataUri,
      instructorContact: currentEditingReport.instructorContact,
      schoolCategory: currentEditingReport.schoolCategory,
    };
    handleResetToBlankForm(newDefaults);
    setSessionDefaults(newDefaults);
  }, [currentEditingReport, handleResetToBlankForm]);

  const handleSaveOrUpdateReport = async (formDataFromForm: ReportData) => {
    const isEditing = !formDataFromForm.id.startsWith('unsaved-');

    if (!isEditing) {
      const isDuplicate = allRankedReports.some(report =>
        report.studentName?.trim().toLowerCase() === formDataFromForm.studentName?.trim().toLowerCase() &&
        report.className === formDataFromForm.className &&
        report.academicTerm === formDataFromForm.academicTerm &&
        report.academicYear === formDataFromForm.academicYear
      );

      if (isDuplicate) {
        toast({
          title: "Report Already Exists",
          description: `A report for '${formDataFromForm.studentName}' in '${formDataFromForm.className}' for this academic term already exists.`,
          variant: "destructive",
        });
        return;
      }
    }

    const reportToSaveForFirestore = {
      teacherId: user.uid,
      studentEntryNumber: formDataFromForm.studentEntryNumber,
      studentName: formDataFromForm.studentName || '',
      className: formDataFromForm.className || '',
      shsProgram: formDataFromForm.shsProgram || undefined,
      gender: formDataFromForm.gender,
      country: formDataFromForm.country || 'Ghana',
      schoolName: formDataFromForm.schoolName || '',
      region: formDataFromForm.region || '',
      district: formDataFromForm.district || '',
      circuit: formDataFromForm.circuit || '',
      schoolCategory: formDataFromForm.schoolCategory || null,
      schoolLogoDataUri: formDataFromForm.schoolLogoDataUri || null,
      academicYear: formDataFromForm.academicYear || '',
      academicTerm: formDataFromForm.academicTerm || '',
      reopeningDate: formDataFromForm.reopeningDate || null,
      selectedTemplateId: formDataFromForm.selectedTemplateId ?? 'default',
      daysAttended: formDataFromForm.daysAttended == null ? null : Number(formDataFromForm.daysAttended),
      totalSchoolDays: formDataFromForm.totalSchoolDays == null ? null : Number(formDataFromForm.totalSchoolDays),
      parentEmail: formDataFromForm.parentEmail || "",
      parentPhoneNumber: formDataFromForm.parentPhoneNumber || "",
      performanceSummary: formDataFromForm.performanceSummary || '',
      strengths: formDataFromForm.strengths || '',
      areasForImprovement: formDataFromForm.areasForImprovement || '',
      hobbies: formDataFromForm.hobbies || [],
      teacherFeedback: formDataFromForm.teacherFeedback || "",
      instructorContact: formDataFromForm.instructorContact || "",
      subjects: formDataFromForm.subjects.map(s => ({
        subjectName: s.subjectName || '',
        continuousAssessment: s.continuousAssessment == null ? null : Number(s.continuousAssessment),
        examinationMark: s.examinationMark == null ? null : Number(s.examinationMark),
      })),
      promotionStatus: formDataFromForm.promotionStatus || null,
      studentPhotoUrl: formDataFromForm.studentPhotoUrl || null,
      headMasterSignatureDataUri: formDataFromForm.headMasterSignatureDataUri || null,
      clientSideId: formDataFromForm.id,
    };

    try {
      if (isEditing) {
        const reportRef = doc(db, 'reports', formDataFromForm.id);
        await setDoc(reportRef, { ...reportToSaveForFirestore, updatedAt: serverTimestamp() }, { merge: true });
        toast({ title: "Report Updated", description: `${reportToSaveForFirestore.studentName}'s report has been successfully updated.` });
      } else {
        await addDoc(collection(db, 'reports'), { ...reportToSaveForFirestore, createdAt: serverTimestamp() });
        toast({ title: "Report Submitted", description: `${reportToSaveForFirestore.studentName}'s report submitted to Firestore. List will update.` });
      }
      fetchData();
    } catch (error) {
      console.error("Detailed Firestore Save Error: ", error);
      toast({
        title: "Firestore Save Error",
        description: `Could not save report. ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
      return;
    }

    // save profile locally for First Term
    if (!isEditing && reportToSaveForFirestore.academicTerm === 'First Term' && reportToSaveForFirestore.studentName) {
      try {
        const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
        const profiles: Record<string, { studentName: string; studentPhotoUrl?: string; className?: string; gender?: string }> = storedProfilesRaw ? JSON.parse(storedProfilesRaw) : {};
        const profileKey = reportToSaveForFirestore.studentName;
        profiles[profileKey] = {
          studentName: reportToSaveForFirestore.studentName,
          studentPhotoUrl: reportToSaveForFirestore.studentPhotoUrl ?? undefined,
          className: reportToSaveForFirestore.className,
          gender: reportToSaveForFirestore.gender ?? undefined,
        };
        localStorage.setItem(STUDENT_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      } catch (e) {
        console.error("Error saving student profile to localStorage:", e);
      }
    }

    const newSessionDefaults: Partial<ReportData> = {
      schoolName: reportToSaveForFirestore.schoolName,
      region: reportToSaveForFirestore.region,
      district: reportToSaveForFirestore.district,
      circuit: reportToSaveForFirestore.circuit,
      schoolLogoDataUri: reportToSaveForFirestore.schoolLogoDataUri,
      className: reportToSaveForFirestore.className,
      shsProgram: reportToSaveForFirestore.shsProgram,
      academicYear: reportToSaveForFirestore.academicYear,
      academicTerm: reportToSaveForFirestore.academicTerm ?? '',
      reopeningDate: reportToSaveForFirestore.reopeningDate ?? null,
      selectedTemplateId: reportToSaveForFirestore.selectedTemplateId ?? 'default',
      totalSchoolDays: reportToSaveForFirestore.totalSchoolDays,
      headMasterSignatureDataUri: reportToSaveForFirestore.headMasterSignatureDataUri,
      instructorContact: reportToSaveForFirestore.instructorContact,
      schoolCategory: reportToSaveForFirestore.schoolCategory,
    };
    setSessionDefaults(newSessionDefaults);
    handleResetToBlankForm(newSessionDefaults);
  };

  const handleLoadReportForEditing = useCallback((reportToEdit: ReportData) => {
    setCurrentEditingReport(reportToEdit);

    const newDefaults: Partial<ReportData> = {
      schoolName: reportToEdit.schoolName,
      region: reportToEdit.region,
      district: reportToEdit.district,
      circuit: reportToEdit.circuit,
      schoolLogoDataUri: reportToEdit.schoolLogoDataUri,
      className: reportToEdit.className,
      shsProgram: (reportToEdit as any).shsProgram,
      academicYear: reportToEdit.academicYear,
      academicTerm: reportToEdit.academicTerm,
      reopeningDate: (reportToEdit as any).reopeningDate,
      selectedTemplateId: (reportToEdit as any).selectedTemplateId,
      totalSchoolDays: (reportToEdit as any).totalSchoolDays,
      headMasterSignatureDataUri: (reportToEdit as any).headMasterSignatureDataUri,
      instructorContact: (reportToEdit as any).instructorContact,
      schoolCategory: (reportToEdit as any).schoolCategory,
    };
    setSessionDefaults(newDefaults);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: `Editing Report for ${reportToEdit.studentName}`, description: "The report data has been loaded into the form." });
  }, [toast]);

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeletingReport(true);
    const result = await deleteReportAction({ reportId: reportToDelete.id });
    if (result.success) {
      toast({ title: 'Report Deleted', description: 'The student report has been permanently deleted.' });
      fetchData();
      setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
    } else {
      toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    setReportToDelete(null);
    setIsDeletingReport(false);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch {
      toast({ title: "Logout Error", description: "Failed to log out.", variant: "destructive" });
    }
  };

  const handleClearList = async () => {
    if (allRankedReports.length === 0) {
      toast({ title: "Local View Already Clear", description: "No reports in the local view to clear. Firestore data is unaffected." });
      return;
    }
    setAllRankedReports([]);
    setCurrentPreviewIndex(0);

    toast({
      title: "Local View Cleared & Form Reset",
      description: "Your local view of reports has been cleared. Data in Firestore is not affected. The list will repopulate from Firestore if data exists there. Form is reset for new entry.",
    });

    const newBase = structuredClone(defaultReportData) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId' | 'updatedAt'>;
    setCurrentEditingReport({
      ...(newBase as any),
      ...sessionDefaults,
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: nextStudentEntryNumber,
      teacherId: user.uid,
    });
  }

  const getReportsToPrint = () => {
    const selectedIds = Object.keys(selectedReportsForPrint).filter(id => selectedReportsForPrint[id]);
    if (selectedIds.length > 0) {
      return filteredReports.filter(report => selectedIds.includes(report.id));
    }
    return filteredReports;
  };

  const reportsToPrint = getReportsToPrint();
  const reportsCount = filteredReports.length;

  const handleInitiatePrint = () => {
    if (reportsToPrint.length === 0) {
      toast({ title: `Nothing to Print`, description: "Add, filter, or select reports to use this feature.", variant: "destructive" });
      return;
    }
    window.print();
  };

  const handleNextPreview = () => setCurrentPreviewIndex(prev => Math.min(prev + 1, reportsCount - 1));
  const handlePreviousPreview = () => setCurrentPreviewIndex(prev => Math.max(0, prev - 1));

  const handleSessionDefaultChange = (field: keyof typeof sessionDefaults, value: any) => {
    const newDefaults = { ...sessionDefaults, [field]: value };
    if (field === 'region') {
      const newRegion = value as string;
      const districts = newRegion ? (ghanaRegionsAndDistricts[newRegion] || []) : [];
      setAvailableDistricts(districts.sort());
      (newDefaults as any).district = '';
      (newDefaults as any).circuit = '';
    }
    if (field === 'district') {
      (newDefaults as any).circuit = '';
    }
    setSessionDefaults(newDefaults);
    setCurrentEditingReport(prev => ({ ...prev, ...newDefaults } as any));
  };

  const handleSessionImageUpload = (event: React.ChangeEvent<HTMLInputElement>, fieldName: 'schoolLogoDataUri') => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMG_TYPES.includes(file.type) || file.size > MAX_IMG_BYTES) {
      toast({ title: 'Invalid logo', description: 'Use PNG/JPEG/WebP/SVG under 1.5MB.', variant: 'destructive' });
      return;
    }

    // instant preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const dataUrl = e.target.result as string;
        handleSessionDefaultChange(fieldName, dataUrl);
        setCurrentEditingReport(prev => ({ ...prev, [fieldName]: dataUrl } as any));

        if (isAdminRole) {
          const storageRef = ref(storage, `school_logos/${user.uid}-${uuidv4()}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed', null,
            (error) => {
              console.error("Admin logo upload error:", error);
              toast({ title: "Logo Upload Failed", description: "Could not save logo to storage.", variant: "destructive" });
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              await setDoc(doc(db, 'users', user.uid), { schoolLogoDataUri: downloadURL }, { merge: true });
              handleSessionDefaultChange(fieldName, downloadURL);
              setCurrentEditingReport(prev => ({ ...prev, [fieldName]: downloadURL } as any));
              toast({ title: "School Logo Updated", description: `Logo has been saved to your admin profile.` });
            }
          );
        }
      }
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  };

  const handleSignatureSave = async (signatureDataUrl: string) => {
    handleSessionDefaultChange('headMasterSignatureDataUri', signatureDataUrl);
    setIsSignaturePadOpen(false);

    if (isAdminRole) {
      await setDoc(doc(db, 'users', user.uid), { headMasterSignatureDataUri: signatureDataUrl }, { merge: true });
      toast({ title: "Signature Saved", description: "Signature has been saved to your admin profile and will apply to all teachers in your scope." });
    } else {
      toast({ title: "Signature Set for Session", description: "The new signature will be used for reports in this session." });
    }
  };

  const handleAddCustomClassNameToListAndForm = () => {
    const newClassName = customClassNameInputValue.trim();
    if (newClassName === '') return;
    handleSessionDefaultChange('className', newClassName);
    if (!classLevels.includes(newClassName) && !customClassNames.includes(newClassName)) {
      setCustomClassNames(prev => [...new Set([...prev, newClassName])]);
    }
    setIsCustomClassNameDialogOpen(false);
    setCustomClassNameInputValue('');
  };

  const schoolNameForDashboard = useMemo(() => {
    if (user.role === 'admin' && user.schoolName) return user.schoolName;
    return (sessionDefaults.schoolName as any) || currentEditingReport.schoolName || "School";
  }, [user.role, user.schoolName, sessionDefaults.schoolName, currentEditingReport.schoolName]);

  const academicYearForDashboard = useMemo(() => {
    return (sessionDefaults.academicYear as any) ?? allRankedReports[0]?.academicYear ?? "All Years";
  }, [sessionDefaults.academicYear, allRankedReports]);

  const handleImportStudents = async (selectedStudentNames: string[], destinationClass: string) => {
    if (selectedStudentNames.length === 0 || !destinationClass) {
      toast({ title: "Import Error", description: "No students selected or destination class missing.", variant: "destructive" });
      return;
    }

    if (!sessionDefaults.schoolName || !sessionDefaults.region || !sessionDefaults.district || !sessionDefaults.academicYear || !sessionDefaults.academicTerm || !sessionDefaults.selectedTemplateId) {
      toast({
        title: "Missing Session Defaults",
        description: "Required session data is missing. Please review your session settings before importing.",
        variant: "destructive",
      });
      return;
    }

    try {
      const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
      const profiles: Record<string, { studentName: string; studentPhotoUrl?: string; className?: string; gender?: string }> = storedProfilesRaw ? JSON.parse(storedProfilesRaw) : {};

      let importedCount = 0;
      let currentImportEntryNumberBase = nextStudentEntryNumber;

      for (const studentName of selectedStudentNames) {
        const profile = Object.values(profiles).find(p => p.studentName === studentName);
        if (profile) {
          const importedReportForFirestore = {
            teacherId: user.uid,
            studentEntryNumber: currentImportEntryNumberBase + importedCount,
            createdAt: serverTimestamp(),
            studentName: profile.studentName,
            gender: profile.gender ?? '',
            studentPhotoUrl: profile.studentPhotoUrl ?? null,
            className: destinationClass,
            schoolName: sessionDefaults.schoolName,
            region: sessionDefaults.region,
            district: sessionDefaults.district,
            circuit: (sessionDefaults as any).circuit ?? '',
            schoolCategory: (sessionDefaults as any).schoolCategory ?? null,
            schoolLogoDataUri: (sessionDefaults as any).schoolLogoDataUri ?? null,
            academicYear: sessionDefaults.academicYear,
            academicTerm: sessionDefaults.academicTerm,
            reopeningDate: (sessionDefaults as any).reopeningDate ?? null,
            selectedTemplateId: sessionDefaults.selectedTemplateId,
            totalSchoolDays: (sessionDefaults as any).totalSchoolDays ?? null,
            headMasterSignatureDataUri: (sessionDefaults as any).headMasterSignatureDataUri ?? '',
            instructorContact: (sessionDefaults as any).instructorContact || "",
            daysAttended: null, parentEmail: '', parentPhoneNumber: '',
            performanceSummary: '', strengths: '', areasForImprovement: '',
            hobbies: [], teacherFeedback: '',
            subjects: [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
            promotionStatus: null,
            clientSideId: `imported-${Date.now()}-${importedCount}`,
          };

          await addDoc(collection(db, 'reports'), importedReportForFirestore);
          importedCount++;
        }
      }

      if (importedCount > 0) {
        toast({ title: "Students Imported", description: `${importedCount} student(s) imported to ${destinationClass} and saved to Firestore. List will update.` });
        fetchData();
      } else {
        toast({ title: "No Students Imported", description: "Could not find matching profiles for selected students.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Error during import student profiles:", e);
      toast({ title: "Import Failed", description: "An error occurred while preparing student data for import.", variant: "destructive" });
    }
    setIsImportStudentsDialogOpen(false);
  };

  const initialClassForDashboard = useMemo(() => {
    const currentClassFilter = adminFilters.className;
    if (currentClassFilter !== 'all') return currentClassFilter;
    const available = allFilterOptions.classes.filter(c => c !== 'all');
    return available.length > 0 ? available[0] : '';
  }, [adminFilters.className, allFilterOptions.classes]);

  const prettyFilterKey = (key: string) => {
    switch (key) {
      case 'schoolName': return 'School';
      case 'className': return 'Class';
      case 'academicYear': return 'Year';
      case 'academicTerm': return 'Term';
      default: return key;
    }
  };

  const filterDescription = useMemo(() => {
    const activeFilters = Object.entries(adminFilters)
      .filter(([, value]) => value !== 'all')
      .map(([key, value]) => `${prettyFilterKey(key)}: ${value}`)
      .join(', ');

    switch (user.role) {
      case 'super-admin':
        return activeFilters ? `Filtering by: ${activeFilters}` : 'Showing all reports in the system.';
      case 'big-admin':
        return `Viewing District: ${user.district || 'N/A'}. ${activeFilters ? `Filtering by: ${activeFilters}` : 'Showing all reports in your district.'}`;
      case 'admin':
        return `Viewing School: ${user.schoolName || 'N/A'}. ${activeFilters ? `Filtering by: ${activeFilters}` : 'Showing all reports in your school.'}`;
      case 'user':
        if (!user.classNames || (user.classNames as any).length === 0) {
          return 'You are not assigned to any classes. Please contact an administrator.';
        }
        return `Showing reports for: ${adminFilters.className === 'all' ? 'All My Classes' : adminFilters.className}.`;
      default:
        return '';
    }
  }, [user, adminFilters]);

  const noReportsFoundMessage = useMemo(() => {
    if (reportsCount === 0 && allRankedReports.length > 0) {
      return 'No reports match the selected filters. Try broadening your criteria.';
    }
    return `The report card preview will appear here as you fill out the form.`;
  }, [reportsCount, allRankedReports.length]);

  const headerTitle = useMemo(() => {
    if (user.role === 'admin' || user.role === 'user') {
      return user.schoolName || 'Report Card Generator';
    }
    if (user.role === 'big-admin') {
      return user.district ? user.district.replace('Municipal', '').replace('District', '').trim() : 'Report Card Generator';
    }
    return 'Report Card Generator';
  }, [user]);

  const headerIcon = useMemo(() => {
    if (user.role === 'admin' || user.role === 'user' || user.role === 'big-admin') {
      return <Building className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />;
    }
    return <BookMarked className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />;
  }, [user.role]);

  const schoolNameWatermark = useMemo(() => {
    if ((user.role === 'admin' || user.role === 'user') && user.schoolName) {
      return user.schoolName;
    }
    return null;
  }, [user]);

  const getClassTotal = (className: string) => allRankedReports.filter(r => r.className === className).length;
  const isShsClass = useMemo(() => !!sessionDefaults.className && getClassLevel(sessionDefaults.className as any) === 'SHS', [sessionDefaults.className]);

  // ✅ Accurate selected count for Select All
  const selectedCount = Object.values(selectedReportsForPrint).filter(Boolean).length;
  const allSelected = filteredReports.length > 0 && selectedCount === filteredReports.length;

  return (
    <>
      <div className="main-app-container">
        <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-body bg-background text-foreground relative">
          {backgroundImage && (
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: backgroundOpacity,
              }}
              aria-hidden="true"
            />
          )}
          {schoolNameWatermark && (
            <div
              className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
              style={{
                fontSize: 'clamp(2rem, 15vw, 10rem)',
                color: 'hsl(var(--foreground))',
                opacity: 0.05,
                fontWeight: 'bold',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
              aria-hidden="true"
            >
              {schoolNameWatermark}
            </div>
          )}

          <div className="relative z-10">
            {/* ✅ Responsive header: wraps gracefully on small screens */}
            <header className="mb-8 no-print">
              <div className="header-safe">
                {/* LEFT: admin link (wraps if it must) */}
                <div className="header-side justify-self-start">
                  {isAdminRole && (
                    <Link href="/admin" passHref className="inline-flex">
                      <Button variant="outline" size="sm">
                        <Shield className="mr-2 h-4 w-4 text-primary" />
                        Admin Panel
                      </Button>
                    </Link>
                  )}
                </div>

                {/* CENTER: title (min-w-0 + truncate) */}
                <div className="header-title-wrap">
                  <div className="mx-auto inline-flex items-center gap-3 max-w-full">
                    {headerIcon}
                    <div className="min-w-0">
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-bold text-primary truncate">
                        {headerTitle}
                      </h1>
                      <p className="text-muted-foreground mt-1 text-xs sm:text-sm truncate">
                        Welcome, {user.name || user.email} ({user.role})
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT: theme + logout (wraps if it must) */}
                <div className="header-side justify-self-end">
                  <ThemeToggleButton />
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4 text-destructive" />
                    Logout
                  </Button>
                </div>
              </div>
            </header>

            {indexError && (
              <Alert variant="destructive" className="mb-8 no-print">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Action Required: Firestore Index Needed</AlertTitle>
                <AlertDescription>
                  {indexError} Your data cannot be loaded until this is fixed in your Firebase project.
                </AlertDescription>
              </Alert>
            )}

            {/* Floating toggles */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 no-print">
              <Button variant="outline" size="icon" className="rounded-full shadow-lg h-14 w-14 bg-background/80 backdrop-blur-sm" onClick={() => setIsSessionControlsVisible(prev => !prev)} title="Toggle Session Controls">
                <Settings className={cn("h-7 w-7 transition-colors", isSessionControlsVisible ? "text-primary" : "text-muted-foreground")} />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full shadow-lg h-14 w-14 bg-background/80 backdrop-blur-sm" onClick={() => setIsAppearanceSettingsVisible(prev => !prev)} title="Toggle Appearance Settings">
                <ImageIcon className={cn("h-7 w-7 transition-colors", isAppearanceSettingsVisible ? "text-purple-500" : "text-muted-foreground")} />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full shadow-lg h-14 w-14 bg-background/80 backdrop-blur-sm" onClick={() => setIsReportFormVisible(prev => !prev)} title="Toggle Report Form">
                <Edit className={cn("h-7 w-7 transition-colors", isReportFormVisible ? "text-accent" : "text-muted-foreground")} />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full shadow-lg h-14 w-14 bg-background/80 backdrop-blur-sm" onClick={() => setIsPreviewVisible(prev => !prev)} title="Toggle Report Preview">
                <FileText className={cn("h-7 w-7 transition-colors", isPreviewVisible ? "text-blue-500" : "text-muted-foreground")} />
              </Button>
            </div>

            {/* Session Controls */}
            {isSessionControlsVisible && (
              <Card className="mb-8 p-4 no-print transition-all duration-300 animate-in fade-in-50">
                <CardHeader className="p-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" />Session Controls</CardTitle>
                    <CardDescription className="text-xs">These settings apply to the current report and are carried over for new entries.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSessionControlsVisible(false)}>
                    <EyeOff />
                  </Button>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="sessionRegion" className="text-sm font-medium">Region</Label>
                      <Select value={(sessionDefaults.region as any) || ''} onValueChange={value => handleSessionDefaultChange('region', value)} disabled={!isSuperAdmin}>
                        <SelectTrigger id="sessionRegion"><SelectValue placeholder="Select region" /></SelectTrigger>
                        <SelectContent>
                          {ghanaRegions.map(region => <SelectItem key={region} value={region}>{region}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sessionDistrict" className="text-sm font-medium">District/Municipal</Label>
                      <Select
                        value={(sessionDefaults.district as any) || ''}
                        onValueChange={value => handleSessionDefaultChange('district', value)}
                        disabled={!isSuperAdmin && !isBigAdmin}
                      >
                        <SelectTrigger id="sessionDistrict">
                          <SelectValue placeholder="Select district" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDistricts.length > 0 ? (
                            availableDistricts.map(district => <SelectItem key={district} value={district}>{district}</SelectItem>)
                          ) : (
                            <SelectItem value="-" disabled>Select a region first</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sessionCircuit" className="text-sm font-medium">Circuit</Label>
                      <Input
                        id="sessionCircuit"
                        value={(sessionDefaults.circuit as any) ?? ''}
                        onChange={e => handleSessionDefaultChange('circuit', e.target.value)}
                        placeholder="e.g., Kalpohin"
                        list="circuit-datalist"
                        disabled={!isSuperAdmin && !isBigAdmin}
                      />
                      <datalist id="circuit-datalist">
                        {availableCircuits.map(circuit => (
                          <option key={circuit} value={circuit} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="sessionSchoolName" className="text-sm font-medium">School Name</Label>
                      <Input id="sessionSchoolName" value={(sessionDefaults.schoolName as any) ?? ''} onChange={e => handleSessionDefaultChange('schoolName', e.target.value)} placeholder="e.g., Faacom Academy" disabled={isAdmin || isRegularUser} />
                    </div>
                    {(isSuperAdmin || isBigAdmin) && (
                      <div className="space-y-1">
                        <Label htmlFor="sessionSchoolCategory" className="text-sm font-medium">School Category</Label>
                        <Select value={(sessionDefaults.schoolCategory as any) || ''} onValueChange={value => handleSessionDefaultChange('schoolCategory', value)} disabled={isPublicUser}>
                          <SelectTrigger id="sessionSchoolCategory"><SelectValue placeholder="Select category..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="placeholder" disabled>Select category...</SelectItem>
                            {schoolCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor="sessionReopeningDate" className="text-sm font-medium">Reopening Date</Label>
                      <DatePicker
                        value={sessionDefaults.reopeningDate ? new Date(sessionDefaults.reopeningDate as any) : null}
                        onChange={(date) => handleSessionDefaultChange('reopeningDate', date ? format(date, 'yyyy-MM-dd') : null)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sessionAcademicYear" className="text-sm font-medium">Academic Year</Label>
                      <Select value={(sessionDefaults.academicYear as any) || ''} onValueChange={value => handleSessionDefaultChange('academicYear', value)}>
                        <SelectTrigger id="sessionAcademicYear"><SelectValue placeholder="Select academic year" /></SelectTrigger>
                        <SelectContent>
                          {academicYearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sessionClassName" className="text-sm font-medium">Current Class</Label>
                      <Select value={(sessionDefaults.className as any) || ''} onValueChange={value => value === ADD_CUSTOM_CLASS_VALUE ? setIsCustomClassNameDialogOpen(true) : handleSessionDefaultChange('className', value)} disabled={isRegularUser}>
                        <SelectTrigger id="sessionClassName"><SelectValue placeholder="Select or add class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ADD_CUSTOM_CLASS_VALUE} onSelect={() => setIsCustomClassNameDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4 text-accent" />Add New Class...</SelectItem>
                          <SelectSeparator />
                          {isRegularUser && (user.classNames as any)?.map((name: string) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                          {!isRegularUser && classLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                          {!isRegularUser && customClassNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {isShsClass && (
                      <div className="space-y-1">
                        <Label htmlFor="sessionShsProgram" className="text-sm font-medium">SHS Program</Label>
                        <Select value={(sessionDefaults as any).shsProgram || ''} onValueChange={value => handleSessionDefaultChange('shsProgram', value)}>
                          <SelectTrigger id="sessionShsProgram"><SelectValue placeholder="Select SHS program" /></SelectTrigger>
                          <SelectContent>
                            {shsProgramOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor="sessionAcademicTerm" className="text-sm font-medium">Academic Term</Label>
                      <Select value={(sessionDefaults.academicTerm as any) || ''} onValueChange={value => handleSessionDefaultChange('academicTerm', value)}>
                        <SelectTrigger id="sessionAcademicTerm"><SelectValue placeholder="Select term/semester" /></SelectTrigger>
                        <SelectContent>
                          {academicTermOptions.map(term => <SelectItem key={term} value={term}>{term}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sessionTemplate" className="text-sm font-medium">Report Template</Label>
                      <Select value={(sessionDefaults.selectedTemplateId as any) || 'default'} onValueChange={value => handleSessionDefaultChange('selectedTemplateId', value)}>
                        <SelectTrigger id="sessionTemplate"><SelectValue placeholder="Select a template" /></SelectTrigger>
                        <SelectContent>
                          {reportTemplateOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sessionTotalSchoolDays" className="text-sm font-medium">Total School Days</Label>
                      <Input id="sessionTotalSchoolDays" type="number" value={(sessionDefaults.totalSchoolDays as any) ?? ''} onChange={e => handleSessionDefaultChange('totalSchoolDays', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g., 90" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sessionInstructorContact" className="text-sm font-medium">Instructor's Contact</Label>
                      <Input id="sessionInstructorContact" value={(sessionDefaults.instructorContact as any) ?? ''} onChange={e => handleSessionDefaultChange('instructorContact', e.target.value)} placeholder="Phone or Email" />
                    </div>
                    <div className="space-y-1 flex items-center gap-2">
                      <input type="file" id="sessionSchoolLogoUpload" className="hidden" accept="image/*" onChange={e => handleSessionImageUpload(e, 'schoolLogoDataUri')} />
                      <Button asChild type="button" variant="outline" size="sm">
                        <span onClick={() => document.getElementById('sessionSchoolLogoUpload')?.click()} className="flex items-center gap-2 cursor-pointer">
                          <UploadCloud className="h-4 w-4 text-blue-500" />Logo
                        </span>
                      </Button>
                      {mounted && (sessionDefaults as any).schoolLogoDataUri && (((sessionDefaults as any).schoolLogoDataUri as string).startsWith('data:image') || ((sessionDefaults as any).schoolLogoDataUri as string).startsWith('http')) && (
                        <NextImage src={(sessionDefaults as any).schoolLogoDataUri} alt="logo" width={40} height={40} className="rounded border p-1 object-contain" />
                      )}
                    </div>
                    {isAdminRole && (
                      <div className="space-y-1 flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSignaturePadOpen(true)}>
                          <PenSquare className="mr-2 h-4 w-4 text-green-600" /> Signature
                        </Button>
                        {mounted && (sessionDefaults as any).headMasterSignatureDataUri && ((((sessionDefaults as any).headMasterSignatureDataUri as string).startsWith('data:image')) || (((sessionDefaults as any).headMasterSignatureDataUri as string).startsWith('http'))) && (
                          <NextImage src={(sessionDefaults as any).headMasterSignatureDataUri} alt="signature" width={80} height={40} className="rounded border p-1 object-contain" />
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Appearance */}
            {isAppearanceSettingsVisible && (
              <Card className="mb-8 p-4 no-print transition-all duration-300 animate-in fade-in-50">
                <CardHeader className="p-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center"><ImageIcon className="mr-2 h-5 w-5 text-purple-500" />Appearance</CardTitle>
                    <CardDescription className="text-xs">Customize the look of the application.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsAppearanceSettingsVisible(false)}>
                    <EyeOff />
                  </Button>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                      <Label htmlFor="bg-image-upload">Background Image</Label>
                      <Input id="bg-image-upload" type="file" accept="image/*" onChange={handleBackgroundImageUpload} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bg-opacity">Background Opacity</Label>
                      <Slider id="bg-opacity" min={0} max={1} step={0.05} value={[backgroundOpacity]} onValueChange={handleBackgroundOpacityChange} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main */}
            <main className={cn("flex-grow grid grid-cols-1 gap-8", (isReportFormVisible || isPreviewVisible) && "lg:grid-cols-5")}>
              {isReportFormVisible && (
                <div className={cn("space-y-4 no-print transition-all duration-300 animate-in fade-in-50",
                  isPreviewVisible ? "lg:col-span-2" : "lg:col-span-5"
                )}>
                  <Tabs defaultValue="detailed-entry" className="w-full">
                    <div className='flex justify-between items-center mb-2'>
                      <TabsList className="grid w-full grid-cols-2 max-w-sm">
                        <TabsTrigger value="detailed-entry"><Edit className="mr-2 h-4 w-4 text-accent" />Detailed Entry</TabsTrigger>
                        <TabsTrigger value="quick-entry"><ListTodo className="mr-2 h-4 w-4 text-primary" />Quick Entry</TabsTrigger>
                      </TabsList>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsReportFormVisible(false)}>
                        <EyeOff />
                      </Button>
                    </div>
                    <TabsContent value="detailed-entry" className="mt-4">
                      <ReportForm
                        onFormUpdate={handleFormUpdate}
                        initialData={currentEditingReport}
                        sessionDefaults={sessionDefaults}
                        isEditing={!currentEditingReport.id.startsWith('unsaved-')}
                        reportPrintListForHistory={allRankedReports}
                        onSaveReport={handleSaveOrUpdateReport}
                        onResetForm={handleClearAndReset}
                      />
                    </TabsContent>
                    <TabsContent value="quick-entry" className="mt-4">
                      <QuickEntry
                        allReports={allRankedReports}
                        user={user}
                        onDataRefresh={fetchData}
                        shsProgram={(sessionDefaults as any).shsProgram}
                        subjectOrder={subjectOrder}
                        setSubjectOrder={setSubjectOrder}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {isPreviewVisible && (
                <section className={cn("flex flex-col no-print transition-all duration-300 animate-in fade-in-50", isReportFormVisible ? "lg:col-span-3" : "lg:col-span-5")}>
                  <Card className="shadow-lg flex-grow flex flex-col bg-card/95 text-card-foreground">
                    <CardHeader>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="font-headline text-lg md:text-xl flex items-center gap-2">
                              <FileText className="h-6 w-6 text-blue-500" />
                              {reportsCount > 0 ? `Report ${currentPreviewIndex + 1} of ${reportsCount}` : `Report Print Preview`}
                            </CardTitle>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 items-stretch">
                          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                            {isAdminRole && (
                              <Select value={adminFilters.schoolName} onValueChange={value => setAdminFilters(prev => ({ ...prev, schoolName: value }))} disabled={user.role === 'admin'}>
                                <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by school">
                                  <div className="flex items-center gap-2"><Building className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by school..." /></div>
                                </SelectTrigger>
                                <SelectContent>{allFilterOptions.schools.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Schools' : s}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                            <Select value={adminFilters.className} onValueChange={value => setAdminFilters(prev => ({ ...prev, className: value }))}>
                              <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by class">
                                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by class..." /></div>
                              </SelectTrigger>
                              <SelectContent>{allFilterOptions.classes.map(c => <SelectItem key={c} value={c}>{c === 'all' ? 'All My Classes' : c}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={adminFilters.academicYear} onValueChange={value => setAdminFilters(prev => ({ ...prev, academicYear: value }))}>
                              <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by year">
                                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by year..." /></div>
                              </SelectTrigger>
                              <SelectContent>{allFilterOptions.years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : y}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={adminFilters.academicTerm} onValueChange={value => setAdminFilters(prev => ({ ...prev, academicTerm: value }))}>
                              <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by term">
                                <div className="flex items-center gap-2"><BookMarked className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by term..." /></div>
                              </SelectTrigger>
                              <SelectContent>{allFilterOptions.terms.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'All Terms' : t}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button onClick={() => setIsClassDashboardOpen(true)} variant="outline" size="sm" title="View AI-powered class performance dashboard">
                              <BarChartHorizontalBig className="mr-2 h-4 w-4 text-blue-500" />
                              Class Dashboard
                            </Button>
                            {isAdminRole && (
                              <Button onClick={() => setIsSchoolDashboardOpen(true)} variant="outline" size="sm" title="View AI-powered school overview dashboard">
                                <Building className="mr-2 h-4 w-4 text-purple-500" />
                                School Overview
                              </Button>
                            )}
                            <Button onClick={() => setIsSelectForPrintDialogOpen(true)} variant="outline" size="sm" title="Select specific reports to print or download">
                              <ListChecks className="mr-2 h-4 w-4 text-orange-500" />
                              Select to Print...
                            </Button>
                            <Button onClick={() => handleInitiatePrint()} variant="outline" size="sm" title="Print all reports in the list">
                              <Printer className="mr-2 h-4 w-4" />
                              Print ({reportsToPrint.length})
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                            <Button onClick={() => setIsImportStudentsDialogOpen(true)} variant="outline" size="sm" title="Import student data from previous term/class">
                              <Upload className="mr-2 h-4 w-4 text-indigo-500" />
                              Import Promoted Students
                            </Button>
                            <Button onClick={handleClearList} disabled={isLoadingReports && allRankedReports.length === 0} variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Clear Local View
                            </Button>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="mt-2 md:mt-1 space-y-1">
                        <span>
                          {reportsCount > 0
                            ? `${filterDescription} Use navigation buttons if multiple reports are in the list.`
                            : 'This area shows a live preview of the data from the form. Click "Add Report to List" to save it to the database.'}
                        </span>
                        <span className="block text-xs italic">
                          <Share2 className="inline-block mr-1 h-3 w-3 text-muted-foreground" /> Share options (Email/WhatsApp) below each report will open your default app.
                        </span>
                        {reportsCount > 0 && <span className="block mt-1 text-xs italic text-primary"><BarChart3 className="inline-block mr-1 h-3 w-3" />Ranking is based on overall average within each class.</span>}
                      </CardDescription>
                    </CardHeader>

                    <CardContent id="report-preview-container" className={cn("flex-grow rounded-b-lg overflow-auto p-0 md:p-2 bg-gray-100/80 dark:bg-gray-800/80", !isPreviewVisible && "hidden")}>
                      {isLoadingReports && allRankedReports.length === 0 ? (
                        <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                          <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                          <h3 className="text-lg font-semibold">Loading Reports...</h3>
                          <p>Fetching your report data from the cloud.</p>
                        </div>
                      ) : reportsCount > 0 ? (
                        <>
                          {filteredReports.map((reportData, index) => (
                            <div key={reportData.id || `report-entry-${reportData.studentEntryNumber}`} className={`report-preview-item ${index === currentPreviewIndex ? 'active-preview-screen' : 'hidden-preview-screen'}`}>
                              {index === currentPreviewIndex && (
                                <div className="report-actions-wrapper-screen no-print p-2 bg-card mb-1 rounded-t-lg">
                                  <ReportActions
                                    report={reportData}
                                    onEditReport={handleLoadReportForEditing}
                                    onDeleteReport={() => setReportToDelete(reportData)}
                                    onPrevious={handlePreviousPreview}
                                    onNext={handleNextPreview}
                                    isPreviousDisabled={currentPreviewIndex === 0}
                                    isNextDisabled={currentPreviewIndex >= reportsCount - 1}
                                    hasMultipleReports={reportsCount > 1}
                                  />
                                </div>
                              )}
                              <ReportPreview
                                data={reportData}
                                classTotal={getClassTotal(reportData.className)}
                                subjectOrder={subjectOrder}
                                sessionLogo={(sessionDefaults as any).schoolLogoDataUri}
                                sessionSignature={(sessionDefaults as any).headMasterSignatureDataUri}
                              />
                            </div>
                          ))}
                        </>
                      ) : currentEditingReport && (currentEditingReport.studentName || currentEditingReport.className || currentEditingReport.schoolName) ? (
                        <ReportPreview
                          data={currentEditingReport}
                          classTotal={getClassTotal(currentEditingReport.className)}
                          subjectOrder={subjectOrder}
                          sessionLogo={(sessionDefaults as any).schoolLogoDataUri}
                          sessionSignature={(sessionDefaults as any).headMasterSignatureDataUri}
                        />
                      ) : (
                        <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                          <FileText className="h-24 w-24 mb-6 text-gray-300 dark:text-gray-600" />
                          <h3 className="text-xl font-semibold mb-2">{reportsCount === 0 && allRankedReports.length > 0 ? `No Reports Found` : `Report Preview Area`}</h3>
                          <p>{noReportsFoundMessage}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>
              )}
            </main>

            <footer className="text-center mt-12 py-6 text-sm text-muted-foreground border-t no-print">
              <p>&copy; {new Date().getFullYear()} Report Card Generator. Professionally designed for educators.</p>
            </footer>
          </div>
        </div>
      </div>

      {/* Print-only container */}
      <div className="print-only-reports">
        {(reportsToPrint.length > 0
          ? reportsToPrint
          : currentEditingReport && (currentEditingReport.studentName || currentEditingReport.className)
            ? [currentEditingReport]
            : []
        ).map((reportData) => (
          <div key={`print-${reportData.id}`} className="a4-page-simulation">
            <ReportPreview
              data={reportData}
              classTotal={getClassTotal(reportData.className)}
              subjectOrder={subjectOrder}
              sessionLogo={(sessionDefaults as any).schoolLogoDataUri}
              sessionSignature={(sessionDefaults as any).headMasterSignatureDataUri}
            />
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <Dialog open={isCustomClassNameDialogOpen} onOpenChange={setIsCustomClassNameDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Class Name</DialogTitle></DialogHeader>
          <Input value={customClassNameInputValue} onChange={e => setCustomClassNameInputValue(e.target.value)} placeholder="e.g., Form 1 Gold" />
          <DialogFooter><Button onClick={handleAddCustomClassNameToListAndForm}>Add Class</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the report for <strong>{reportToDelete?.studentName}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingReport}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReport} disabled={isDeletingReport}>
              {isDeletingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isClassDashboardOpen && (
        <ClassPerformanceDashboard
          isOpen={isClassDashboardOpen}
          onOpenChange={setIsClassDashboardOpen}
          allReports={allRankedReports}
          availableClasses={allFilterOptions.classes.filter(c => c !== 'all')}
          initialClassName={initialClassForDashboard}
          schoolNameProp={schoolNameForDashboard}
          academicYearProp={academicYearForDashboard}
        />
      )}
      {isSchoolDashboardOpen && (
        <SchoolPerformanceDashboard
          isOpen={isSchoolDashboardOpen}
          onOpenChange={setIsSchoolDashboardOpen}
          allReports={allRankedReports}
          schoolNameProp={schoolNameForDashboard}
          academicYearProp={academicYearForDashboard}
          userRole={user.role}
        />
      )}
      {isImportStudentsDialogOpen && (
        <ImportStudentsDialog
          isOpen={isImportStudentsDialogOpen}
          onOpenChange={setIsImportStudentsDialogOpen}
          onImport={handleImportStudents}
        />
      )}
      <Dialog open={isSignaturePadOpen} onOpenChange={setIsSignaturePadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Head Master's Signature</DialogTitle>
            <DialogDescription>
              Draw the signature in the box below using your mouse or finger.
            </DialogDescription>
          </DialogHeader>
          <SignaturePad
            onSave={handleSignatureSave}
            initialDataUrl={(sessionDefaults as any).headMasterSignatureDataUri}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isSelectForPrintDialogOpen} onOpenChange={setIsSelectForPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Reports to Print</DialogTitle>
            <DialogDescription>
              Choose which reports from the current view to include in the printout/PDF.
              If none are selected, all {filteredReports.length} reports will be printed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center space-x-2 mb-2 border p-2 rounded-md bg-muted/50">
              <Checkbox
                id="selectAllForPrint"
                checked={allSelected}
                onCheckedChange={(checked) => {
                  const newSelection: Record<string, boolean> = {};
                  if (checked === true) {
                    filteredReports.forEach(r => { newSelection[r.id] = true; });
                  }
                  setSelectedReportsForPrint(newSelection);
                }}
              />
              <Label htmlFor="selectAllForPrint" className="text-sm font-medium">
                Select All ({selectedCount} / {filteredReports.length} selected)
              </Label>
            </div>
            <ScrollArea className="h-60 border rounded-md p-2">
              <div className="space-y-1">
                {filteredReports.map(report => (
                  <div key={report.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                    <Checkbox
                      id={`print-check-${report.id}`}
                      checked={!!selectedReportsForPrint[report.id]}
                      onCheckedChange={(checked) => {
                        setSelectedReportsForPrint(prev => ({
                          ...prev,
                          [report.id]: !!checked,
                        }));
                      }}
                    />
                    <Label htmlFor={`print-check-${report.id}`} className="font-normal text-sm w-full cursor-pointer">
                      {report.studentName} ({report.className})
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return <AppContent user={user} />;
}
