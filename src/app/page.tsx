
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import NextImage from 'next/image';
import ReportForm from '@/components/report-form';
import ReportPreview from '@/components/report-preview';
import ReportActions from '@/components/report-actions';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Printer, BookMarked, FileText, Eye, Trash2, BarChart3, Download, Share2, ChevronLeft, ChevronRight, BarChartHorizontalBig, Building, Upload, Loader2, AlertTriangle, Users, PlusCircle, CalendarDays, Type, Signature, UploadCloud, FolderDown, LayoutTemplate, LogOut, Shield } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { defaultReportData, STUDENT_PROFILES_STORAGE_KEY } from '@/lib/schemas';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, Timestamp, doc, setDoc, deleteDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { calculateOverallAverage, calculateSubjectFinalMark } from '@/lib/calculations';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import type { CustomUser } from '@/components/auth-provider';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ghanaRegions, ghanaRegionsAndDistricts, ghanaDistrictsAndCircuits } from '@/lib/ghana-regions-districts';
import { cn } from '@/lib/utils';

// Dynamically import heavy components
const ClassPerformanceDashboard = dynamic(() => import('@/components/class-dashboard'), { 
    ssr: false,
    loading: () => <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> 
});
const SchoolPerformanceDashboard = dynamic(() => import('@/components/school-dashboard'), { 
    ssr: false,
    loading: () => <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> 
});
const ImportStudentsDialog = dynamic(() => import('@/components/import-students-dialog'), { 
    ssr: false,
    loading: () => <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> 
});


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


function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatRankString(rankNumber: number, isTie: boolean): string {
  if (rankNumber <= 0) return 'N/A';
  const suffix = getOrdinalSuffix(rankNumber);
  return `${isTie ? 'T-' : ''}${rankNumber}${suffix}`;
}

function AppContent({ user }: { user: CustomUser }) {
  const [currentEditingReport, setCurrentEditingReport] = useState<ReportData>(() => {
    const base = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId'>;
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
  
  const [customClassNames, setCustomClassNames] = useState<string[]>([]);
  const [isCustomClassNameDialogOpen, setIsCustomClassNameDialogOpen] = useState(false);
  const [customClassNameInputValue, setCustomClassNameInputValue] = useState('');
  
  // State for filters
  const [adminFilters, setAdminFilters] = useState({
    schoolName: 'all',
    className: 'all',
    academicYear: 'all',
    academicTerm: 'all',
  });
  
  const router = useRouter();

  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [availableCircuits, setAvailableCircuits] = useState<string[]>([]);
  const [indexError, setIndexError] = useState<string | null>(null);

  const isSuperAdmin = user.role === 'super-admin';
  const isBigAdmin = user.role === 'big-admin';
  const isAdmin = user.role === 'admin';
  const isRegularUser = user.role === 'user';
  const isAdminRole = isSuperAdmin || isBigAdmin || isAdmin;

  // Effect to set and lock session defaults for regular users
  useEffect(() => {
    if (isRegularUser) {
      const userDefaults: Partial<ReportData> = {
        region: user.region ?? '',
        district: user.district ?? '',
        circuit: user.circuit ?? '',
        schoolName: user.schoolName ?? '',
        className: user.classNames?.[0] || '', // Default to first assigned class
      };
      setSessionDefaults(prev => ({...prev, ...userDefaults}));
      setCurrentEditingReport(prev => ({...prev, ...userDefaults}));
    }
  }, [user, isRegularUser]);

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

  // Generate options for filter dropdowns
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
    
    // For 'user' role, filter class list to only assigned classes
    let userVisibleClasses = Array.from(classes).sort();
    if (isRegularUser && user.classNames) {
        userVisibleClasses = user.classNames;
    }

    return {
        schools: ['all', ...Array.from(schools).sort()],
        classes: ['all', ...userVisibleClasses],
        years: ['all', ...Array.from(years).sort()],
        terms: ['all', ...Array.from(terms).sort()],
    };
  }, [allRankedReports, isRegularUser, user.classNames]);

  // Apply filters based on user role
  const filteredReports = useMemo(() => {
    let reports = allRankedReports;
    if (isAdminRole) {
      reports = reports.filter(report => 
        (adminFilters.schoolName === 'all' || report.schoolName === adminFilters.schoolName) &&
        (adminFilters.className === 'all' || report.className === adminFilters.className) &&
        (adminFilters.academicYear === 'all' || report.academicYear === adminFilters.academicYear) &&
        (adminFilters.academicTerm === 'all' || report.academicTerm === adminFilters.academicTerm)
      );
    } else { // user role
      if (adminFilters.className !== 'all') { // Let 'user' also filter by class
        reports = reports.filter(report => report.className === adminFilters.className);
      }
    }
    return reports;
  }, [allRankedReports, isAdminRole, adminFilters]);

  // Reset preview index when filters change
  useEffect(() => {
    setCurrentPreviewIndex(0);
  }, [adminFilters]);

  const handleAdminFilterChange = (filterName: keyof typeof adminFilters, value: string) => {
    setAdminFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const calculateAndSetRanks = useCallback((listToProcess: ReportData[]) => {
    if (listToProcess.length === 0) {
        setAllRankedReports([]);
        return;
    }

    const reportsWithAverages = listToProcess.map(report => {
        const overallAverage = calculateOverallAverage(report.subjects);
        return { ...report, overallAverage: overallAverage ?? undefined };
    });

    const reportsByClass = new Map<string, ReportData[]>();
    reportsWithAverages.forEach(report => {
        const className = report.className || 'Unclassified';
        if (!reportsByClass.has(className)) {
            reportsByClass.set(className, []);
        }
        reportsByClass.get(className)!.push(report);
    });

    const allClassRankedReports: ReportData[] = [];
    reportsByClass.forEach((classReports) => {
        const sortedReports = [...classReports].sort((a, b) => (b.overallAverage ?? -1) - (a.overallAverage ?? -1));

        const reportsWithRankNumbers = sortedReports.map((report, index) => {
            if (report.overallAverage === null || report.overallAverage === undefined) {
                return { ...report, rank: 'N/A' };
            }
            if (index === 0) {
                return { ...report, rank: '1' };
            }
            const prevReport = sortedReports[index - 1];
            if (report.overallAverage === prevReport.overallAverage) {
                return { ...report, rank: prevReport.rank! };
            } else {
                return { ...report, rank: (index + 1).toString() };
            }
        });
        
        const finalFormattedReports = reportsWithRankNumbers.map((report, index, arr) => {
            if (report.rank === 'N/A' || !report.rank) return { ...report, rank: 'N/A' };
            const rankNumber = parseInt(report.rank, 10);
            if (isNaN(rankNumber)) return { ...report, rank: 'N/A' };
            
            const isTiedWithNext = index < arr.length - 1 && arr[index + 1].rank === report.rank;
            const isTiedWithPrev = index > 0 && arr[index - 1].rank === report.rank;
            const isTie = isTiedWithNext || isTiedWithPrev;

            return { ...report, rank: formatRankString(rankNumber, isTie) };
        });

        allClassRankedReports.push(...finalFormattedReports);
    });

    // Restore original sort order for consistency
    setAllRankedReports(allClassRankedReports.sort((a, b) => (a.className || '').localeCompare(b.className || '') || (a.studentEntryNumber || 0) - (b.studentEntryNumber || 0)));
}, []);


  useEffect(() => {
    if (!user?.uid) {
        setIsLoadingReports(false);
        return;
    }
    
    setIsLoadingReports(true);
    setIndexError(null);
    const reportsCollectionRef = collection(db, 'reports');
    
    let q;
    switch(user.role) {
        case 'super-admin':
            q = query(reportsCollectionRef); // Removed order by to avoid composite index need
            break;
        case 'big-admin':
            if (!user.district) {
                toast({ title: "Configuration Error", description: "Your 'big-admin' account is not associated with a district.", variant: "destructive" });
                setIsLoadingReports(false);
                return;
            }
            q = query(reportsCollectionRef, where('district', '==', user.district));
            break;
        case 'admin':
            if (!user.schoolName) {
                toast({ title: "Configuration Error", description: "Your 'admin' account is not associated with a school.", variant: "destructive" });
                setIsLoadingReports(false);
                return;
            }
            q = query(reportsCollectionRef, where('schoolName', '==', user.schoolName));
            break;
        case 'user':
            if (user.classNames && user.classNames.length > 0) {
                q = query(reportsCollectionRef, where('teacherId', '==', user.uid), where('className', 'in', user.classNames));
            } else {
                // If user has no classes assigned, fetch reports they created, though ideally they shouldn't be able to create any without a class
                 q = query(reportsCollectionRef, where('teacherId', '==', user.uid));
            }
            break;
        default:
            q = query(reportsCollectionRef, where('teacherId', '==', user.uid));
            break;
    }


    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setIndexError(null);
      const fetchedReports: ReportData[] = [];
      let maxEntryNum = 0;
      const classNamesFromDB = new Set<string>();

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<ReportData, 'id'> & { createdAt: Timestamp | null; clientSideId?: string };
        if (data.className) {
            classNamesFromDB.add(data.className);
        }
        fetchedReports.push({
            ...data,
            id: doc.id,
            subjects: data.subjects || [],
            hobbies: data.hobbies || [],
            createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
        });
        if (data.studentEntryNumber && data.studentEntryNumber > maxEntryNum) {
            maxEntryNum = data.studentEntryNumber;
        }
      });
      
      // Sort reports on the client side to avoid needing composite indexes in Firestore
      fetchedReports.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

      // Set session defaults based on user role and fetched data
      const newSessionDefaults: Partial<ReportData> = {};
      if (user.role === 'admin' && user.schoolName) {
          newSessionDefaults.schoolName = user.schoolName;
          const firstReportFromSchool = fetchedReports.find(r => r.schoolName === user.schoolName);
          if(firstReportFromSchool) {
            newSessionDefaults.region = firstReportFromSchool.region;
            newSessionDefaults.district = firstReportFromSchool.district;
          }
      } else if (user.role === 'big-admin' && user.district) {
          newSessionDefaults.district = user.district;
           const firstReportFromDistrict = fetchedReports.find(r => r.district === user.district);
           if(firstReportFromDistrict) {
            newSessionDefaults.region = firstReportFromDistrict.region;
           }
      } else if (user.role === 'user') {
          // User's scope is now set in a separate useEffect, this is a fallback.
          newSessionDefaults.schoolName = user.schoolName ?? fetchedReports.find(r => r.schoolName?.trim())?.schoolName ?? '';
          newSessionDefaults.region = user.region ?? fetchedReports.find(r => r.region?.trim())?.region ?? '';
          newSessionDefaults.district = user.district ?? fetchedReports.find(r => r.district?.trim())?.district ?? '';
          newSessionDefaults.circuit = user.circuit ?? fetchedReports.find(r => r.circuit?.trim())?.circuit ?? '';
      }
      setSessionDefaults(prev => ({...prev, ...newSessionDefaults}));
      
      setCustomClassNames(prev => [...new Set([...prev, ...Array.from(classNamesFromDB)])]);
      calculateAndSetRanks(fetchedReports);
      setNextStudentEntryNumber(maxEntryNum + 1);
      setIsLoadingReports(false);

      if (fetchedReports.length === 0) {
        const baseReset = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId' | 'updatedAt'>;
        setCurrentEditingReport(prev => ({
          ...baseReset,
          ...sessionDefaults,
          ...newSessionDefaults,
          studentEntryNumber: maxEntryNum + 1,
          id: `unsaved-${Date.now()}`,
          createdAt: undefined,
          updatedAt: undefined,
          overallAverage: undefined,
          rank: undefined,
          teacherId: user.uid,
        }));
      }
    }, (error: any) => { 
      console.error("Error fetching reports from Firestore:", error);
      if (error.code === 'failed-precondition') {
        let indexField = 'teacherId';
        if (user.role === 'big-admin') indexField = 'district';
        if (user.role === 'admin') indexField = 'schoolName';
        const errorMessage = `A database index is needed to filter reports. Please check your browser's developer console for a link to create it. This is a one-time setup.`;
        setIndexError(errorMessage);
        toast({ 
          title: "Action Required: Firestore Index Needed", 
          description: errorMessage,
          variant: "destructive",
          duration: 20000 
        });
      } else {
        toast({ title: "Error Fetching Reports", description: "Could not load reports from the database.", variant: "destructive" });
      }
      setIsLoadingReports(false);
    });

    return () => unsubscribe();
  }, [user, calculateAndSetRanks, toast]);


  const handleFormUpdate = useCallback((data: ReportData) => {
    setCurrentEditingReport(prev => ({...prev, ...data}));
  }, []);

  const handleResetToBlankForm = useCallback((newDefaults?: Partial<ReportData>) => {
    const newNextStudentEntryNumber = nextStudentEntryNumber;
    const newStudentBase = JSON.parse(JSON.stringify(defaultReportData));
    
    const defaultsToApply = newDefaults || sessionDefaults;

    const newStudentDataForForm: ReportData = {
      ...newStudentBase,
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

    toast({
      title: "Form Cleared",
      description: "Ready for a new student's report entry.",
    });
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
      selectedTemplateId: currentEditingReport.selectedTemplateId,
      totalSchoolDays: currentEditingReport.totalSchoolDays,
      headMasterSignatureDataUri: currentEditingReport.headMasterSignatureDataUri,
      instructorContact: currentEditingReport.instructorContact,
    };
    setSessionDefaults(newDefaults);
    
    handleResetToBlankForm(newDefaults);
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
      gender: formDataFromForm.gender,
      schoolName: formDataFromForm.schoolName || '',
      region: formDataFromForm.region || '',
      district: formDataFromForm.district || '',
      circuit: formDataFromForm.circuit || '',
      schoolLogoDataUri: formDataFromForm.schoolLogoDataUri || null,
      academicYear: formDataFromForm.academicYear || '',
      academicTerm: formDataFromForm.academicTerm || '',
      selectedTemplateId: formDataFromForm.selectedTemplateId ?? 'default',
      daysAttended: formDataFromForm.daysAttended === undefined || formDataFromForm.daysAttended === null ? null : Number(formDataFromForm.daysAttended),
      totalSchoolDays: formDataFromForm.totalSchoolDays === undefined || formDataFromForm.totalSchoolDays === null ? null : Number(formDataFromForm.totalSchoolDays),
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
        continuousAssessment: s.continuousAssessment === undefined || s.continuousAssessment === null ? null : Number(s.continuousAssessment),
        examinationMark: s.examinationMark === undefined || s.examinationMark === null ? null : Number(s.examinationMark),
      })),
      promotionStatus: formDataFromForm.promotionStatus || null,
      studentPhotoDataUri: formDataFromForm.studentPhotoDataUri || null,
      headMasterSignatureDataUri: formDataFromForm.headMasterSignatureDataUri || null,
      clientSideId: formDataFromForm.id,
    };

    try {
        if (isEditing) {
            const reportRef = doc(db, 'reports', formDataFromForm.id);
            await setDoc(reportRef, {
                ...reportToSaveForFirestore,
                updatedAt: serverTimestamp()
            }, { merge: true });
            toast({
                title: "Report Updated",
                description: `${reportToSaveForFirestore.studentName}'s report has been successfully updated.`,
            });
        } else {
            await addDoc(collection(db, 'reports'), {
                ...reportToSaveForFirestore,
                createdAt: serverTimestamp(),
            });
            toast({
                title: "Report Submitted",
                description: `${reportToSaveForFirestore.studentName}'s report submitted to Firestore. List will update.`,
            });
        }

    } catch (error) {
        console.error("Detailed Firestore Save Error: ", error);
        toast({
            title: "Firestore Save Error",
            description: `Could not save report. ${error instanceof Error ? error.message : String(error)}`,
            variant: "destructive",
        });
        return;
    }

    if (!isEditing && reportToSaveForFirestore.academicTerm === 'First Term' && reportToSaveForFirestore.studentName) {
      try {
        const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
        const profiles: Record<string, { studentName: string; studentPhotoDataUri?: string; className?: string; gender?: string }> = storedProfilesRaw ? JSON.parse(storedProfilesRaw) : {};
        const profileKey = reportToSaveForFirestore.studentName;
        profiles[profileKey] = {
          studentName: reportToSaveForFirestore.studentName,
          studentPhotoDataUri: reportToSaveForFirestore.studentPhotoDataUri ?? undefined,
          className: reportToSaveForFirestore.className,
          gender: reportToSaveForFirestore.gender ?? undefined,
        };
        localStorage.setItem(STUDENT_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      } catch (e) {
        console.error("Error saving student profile to localStorage:", e);
      }
    }

    const newSessionDefaults = {
      schoolName: reportToSaveForFirestore.schoolName,
      region: reportToSaveForFirestore.region,
      district: reportToSaveForFirestore.district,
      circuit: reportToSaveForFirestore.circuit,
      schoolLogoDataUri: reportToSaveForFirestore.schoolLogoDataUri,
      className: reportToSaveForFirestore.className,
      academicYear: reportToSaveForFirestore.academicYear,
      academicTerm: reportToSaveForFirestore.academicTerm ?? '',
      selectedTemplateId: reportToSaveForFirestore.selectedTemplateId ?? 'default',
      totalSchoolDays: reportToSaveForFirestore.totalSchoolDays,
      headMasterSignatureDataUri: reportToSaveForFirestore.headMasterSignatureDataUri,
      instructorContact: reportToSaveForFirestore.instructorContact,
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
      academicYear: reportToEdit.academicYear,
      academicTerm: reportToEdit.academicTerm,
      selectedTemplateId: reportToEdit.selectedTemplateId,
      totalSchoolDays: reportToEdit.totalSchoolDays,
      headMasterSignatureDataUri: reportToEdit.headMasterSignatureDataUri,
      instructorContact: reportToEdit.instructorContact,
    };
    setSessionDefaults(newDefaults);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
        title: `Editing Report for ${reportToEdit.studentName}`,
        description: "The report data has been loaded into the form.",
    });
  }, [toast]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error) {
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

    const newBase = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId' | 'updatedAt'>;
    setCurrentEditingReport({
        ...newBase,
        ...sessionDefaults,
        id: `unsaved-${Date.now()}`,
        studentEntryNumber: nextStudentEntryNumber,
        createdAt: undefined,
        updatedAt: undefined,
        overallAverage: undefined,
        rank: undefined,
        teacherId: user.uid,
     });
  }

  const reportsCount = filteredReports.length;

  const handleInitiatePrint = (isPdfDownload: boolean) => {
    if (reportsCount === 0) {
      toast({
        title: `Nothing to ${isPdfDownload ? 'Download' : 'Print'}`,
        description: "Add or filter reports to the list to use this feature.",
        variant: "destructive",
      });
      return;
    }

    if (isPdfDownload) {
      toast({
        title: "Preparing PDF Download...",
        description: "Your browser's print dialog will open. Please select 'Save as PDF' as the destination.",
      });
    }

    window.print();
  };

  const handleNextPreview = () => {
    setCurrentPreviewIndex(prev => Math.min(prev + 1, reportsCount - 1));
  };

  const handlePreviousPreview = () => {
    setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
  };

  const handleSessionDefaultChange = (field: keyof typeof sessionDefaults, value: any) => {
    const newDefaults = { ...sessionDefaults, [field]: value };
    
    if (field === 'region') {
        const newRegion = value as string;
        const districts = newRegion ? (ghanaRegionsAndDistricts[newRegion] || []) : [];
        setAvailableDistricts(districts.sort());
        newDefaults.district = ''; // Reset district when region changes
        newDefaults.circuit = ''; // Also reset circuit
    }

    if (field === 'district') {
        newDefaults.circuit = ''; // Reset circuit when district changes
    }
    
    setSessionDefaults(newDefaults);
    setCurrentEditingReport(prev => ({...prev, ...newDefaults}));
  };

  const handleSessionImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: keyof Pick<ReportData, 'schoolLogoDataUri' | 'headMasterSignatureDataUri'>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const originalDataUri = reader.result as string;
        handleSessionDefaultChange(fieldName, originalDataUri);
        toast({ title: "Image Uploaded", description: `Session ${fieldName === 'schoolLogoDataUri' ? 'logo' : 'signature'} updated.` });
      };
      reader.readAsDataURL(file);
    }
    if(event.target) event.target.value = '';
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
    return sessionDefaults.schoolName || currentEditingReport.schoolName || "School";
  }, [user.role, user.schoolName, sessionDefaults.schoolName, currentEditingReport.schoolName]);
  
  const academicYearForDashboard = useMemo(() => {
    return sessionDefaults.academicYear ?? allRankedReports[0]?.academicYear ?? "All Years";
  }, [sessionDefaults.academicYear, allRankedReports]);

 const handleImportStudents = async (selectedStudentNames: string[], destinationClass: string) => {
    if (selectedStudentNames.length === 0 || !destinationClass) {
      toast({ title: "Import Error", description: "No students selected or destination class missing.", variant: "destructive" });
      return;
    }

    // ✅ Validate required fields first
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
        const profiles: Record<string, { studentName: string; studentPhotoDataUri?: string; className?: string; gender?: string }> = storedProfilesRaw ? JSON.parse(storedProfilesRaw) : {};
        
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
                    studentPhotoDataUri: profile.studentPhotoDataUri ?? null,
                    className: destinationClass,
                    schoolName: sessionDefaults.schoolName ?? defaultReportData.schoolName,
                    region: sessionDefaults.region ?? defaultReportData.region,
                    district: sessionDefaults.district ?? defaultReportData.district,
                    circuit: sessionDefaults.circuit ?? defaultReportData.circuit,
                    schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? null,
                    academicYear: sessionDefaults.academicYear ?? defaultReportData.academicYear,
                    academicTerm: sessionDefaults.academicTerm ?? defaultReportData.academicTerm,
                    selectedTemplateId: sessionDefaults.selectedTemplateId ?? 'default',
                    totalSchoolDays: sessionDefaults.totalSchoolDays ?? null,
                    headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? defaultReportData.headMasterSignatureDataUri,
                    instructorContact: sessionDefaults.instructorContact || "",
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
            toast({
                title: "Students Imported",
                description: `${importedCount} student(s) imported to ${destinationClass} and saved to Firestore. List will update.`,
            });
            
            const newNextEntryNumForForm = currentImportEntryNumberBase + importedCount;
            const studentSpecificDefaultsForImport = JSON.parse(JSON.stringify(defaultReportData)) as typeof defaultReportData;

            // ✅ Proceed safely with fallbacks for optional fields
            setCurrentEditingReport({
                ...studentSpecificDefaultsForImport,
                schoolName: sessionDefaults.schoolName,
                region: sessionDefaults.region,
                district: sessionDefaults.district,
                circuit: sessionDefaults.circuit ?? '',
                schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? '',
                className: destinationClass,
                academicYear: sessionDefaults.academicYear,
                academicTerm: sessionDefaults.academicTerm,
                selectedTemplateId: sessionDefaults.selectedTemplateId,
                totalSchoolDays: sessionDefaults.totalSchoolDays ?? null,
                headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? '',
                instructorContact: sessionDefaults.instructorContact ?? '',
                id: `unsaved-${Date.now()}`,
                studentEntryNumber: newNextEntryNumForForm,
                teacherId: user.uid,
            });

            setNextStudentEntryNumber(newNextEntryNumForForm);
            setSessionDefaults(prev => ({ ...prev, className: destinationClass }));
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
        if (currentClassFilter !== 'all') {
            return currentClassFilter;
        }
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
            
        if (user.role === 'super-admin') {
            return activeFilters ? `Filtering by: ${activeFilters}` : 'Showing all reports in the system.';
        }
        if (user.role === 'big-admin') {
             return `Viewing District: ${user.district}. ${activeFilters ? `Filtering by: ${activeFilters}` : 'Showing all reports in your district.'}`;
        }
        if (user.role === 'admin') {
             return `Viewing School: ${user.schoolName}. ${activeFilters ? `Filtering by: ${activeFilters}` : 'Showing all reports in your school.'}`;
        }
        // User role
        if (!user.classNames || user.classNames.length === 0) {
            return 'You are not assigned to any classes. Please contact an administrator.';
        }
        return `Showing reports for: ${adminFilters.className === 'all' ? 'All My Classes' : adminFilters.className}.`;
    }, [user, adminFilters]);

    const noReportsFoundMessage = useMemo(() => {
        if (reportsCount === 0 && allRankedReports.length > 0) {
            return 'No reports match the selected filters. Try broadening your criteria.';
        }
        return `The report card preview will appear here as you fill out the form.`;
    }, [reportsCount, allRankedReports.length]);

  return (
    <>
      <div className="main-app-container">
        <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-body bg-background text-foreground">
          <header className="mb-8 text-center no-print relative">
            <div className="absolute top-0 left-0 flex items-center gap-2">
                {isAdminRole && (
                    <Link href="/admin" passHref>
                        <Button variant="outline" size="sm">
                            <Shield className="mr-2 h-4 w-4" />
                            Admin Panel
                        </Button>
                    </Link>
                )}
            </div>

            <div className="flex items-center justify-center gap-3">
            <BookMarked className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary">Report Card Generator</h1>
            </div>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Welcome, {user.email} ({user.role})</p>
            
            <div className="absolute top-0 right-0 flex items-center gap-2">
              <ThemeToggleButton />
              <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4"/>Logout</Button>
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

          <Card className="mb-8 p-4 no-print">
            <CardHeader className="p-2">
                <CardTitle className="text-lg flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Session Controls</CardTitle>
                <CardDescription className="text-xs">These settings apply to the current report and are carried over for new entries.</CardDescription>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="sessionRegion" className="text-sm font-medium">Region</Label>
                        <Select value={sessionDefaults.region || ''} onValueChange={value => handleSessionDefaultChange('region', value)} disabled={!isSuperAdmin}>
                            <SelectTrigger id="sessionRegion"><SelectValue placeholder="Select region" /></SelectTrigger>
                            <SelectContent>
                                {ghanaRegions.map(region => <SelectItem key={region} value={region}>{region}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sessionDistrict" className="text-sm font-medium">District/Municipal</Label>
                        <Select 
                            value={sessionDefaults.district || ''} 
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
                            value={sessionDefaults.circuit ?? ''} 
                            onChange={e => handleSessionDefaultChange('circuit', e.target.value)} 
                            placeholder="e.g., Kalpohin"
                            list="circuit-datalist"
                            disabled={!isSuperAdmin && !isBigAdmin && !isAdmin}
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
                        <Input id="sessionSchoolName" value={sessionDefaults.schoolName ?? ''} onChange={e => handleSessionDefaultChange('schoolName', e.target.value)} placeholder="e.g., Faacom Academy" disabled={!isSuperAdmin && !isBigAdmin}/>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sessionAcademicYear" className="text-sm font-medium">Academic Year</Label>
                        <Select value={sessionDefaults.academicYear || ''} onValueChange={value => handleSessionDefaultChange('academicYear', value)}>
                            <SelectTrigger id="sessionAcademicYear"><SelectValue placeholder="Select academic year" /></SelectTrigger>
                            <SelectContent>
                                {academicYearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sessionClassName" className="text-sm font-medium">Current Class</Label>
                        <Select value={sessionDefaults.className || ''} onValueChange={value => handleSessionDefaultChange('className', value === ADD_CUSTOM_CLASS_VALUE ? '' : value)} disabled={isRegularUser}>
                            <SelectTrigger id="sessionClassName"><SelectValue placeholder="Select or add class" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ADD_CUSTOM_CLASS_VALUE} onSelect={() => setIsCustomClassNameDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Add New Class...</SelectItem>
                                <SelectSeparator />
                                {isRegularUser && user.classNames?.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                {!isRegularUser && classLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                                {!isRegularUser && customClassNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sessionAcademicTerm" className="text-sm font-medium">Academic Term</Label>
                        <Select value={sessionDefaults.academicTerm || ''} onValueChange={value => handleSessionDefaultChange('academicTerm', value)}>
                            <SelectTrigger id="sessionAcademicTerm"><SelectValue placeholder="Select term/semester" /></SelectTrigger>
                            <SelectContent>
                                {academicTermOptions.map(term => <SelectItem key={term} value={term}>{term}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sessionTemplate" className="text-sm font-medium">Report Template</Label>
                        <Select value={sessionDefaults.selectedTemplateId || 'default'} onValueChange={value => handleSessionDefaultChange('selectedTemplateId', value)}>
                            <SelectTrigger id="sessionTemplate"><SelectValue placeholder="Select a template" /></SelectTrigger>
                            <SelectContent>
                                {reportTemplateOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sessionTotalSchoolDays" className="text-sm font-medium">Total School Days</Label>
                        <Input id="sessionTotalSchoolDays" type="number" value={sessionDefaults.totalSchoolDays ?? ''} onChange={e => handleSessionDefaultChange('totalSchoolDays', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g., 90" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sessionInstructorContact" className="text-sm font-medium">Instructor's Contact</Label>
                        <Input id="sessionInstructorContact" value={sessionDefaults.instructorContact ?? ''} onChange={e => handleSessionDefaultChange('instructorContact', e.target.value)} placeholder="Phone or Email" />
                    </div>
                    <div className="space-y-1 flex items-center gap-2">
                    <input type="file" id="sessionSchoolLogoUpload" className="hidden" accept="image/*" onChange={e => handleSessionImageUpload(e, 'schoolLogoDataUri')} />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('sessionSchoolLogoUpload')?.click()}><UploadCloud className="mr-2 h-4 w-4" />Logo</Button>
                    {sessionDefaults.schoolLogoDataUri && <NextImage src={sessionDefaults.schoolLogoDataUri} alt="logo" width={40} height={40} className="rounded border p-1 object-contain"/>}
                    </div>
                    <div className="space-y-1 flex items-center gap-2">
                    <input type="file" id="sessionHeadMasterSignatureUpload" className="hidden" accept="image/*" onChange={e => handleSessionImageUpload(e, 'headMasterSignatureDataUri')} />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('sessionHeadMasterSignatureUpload')?.click()}><Signature className="mr-2 h-4 w-4" />Signature</Button>
                    {sessionDefaults.headMasterSignatureDataUri && <NextImage src={sessionDefaults.headMasterSignatureDataUri} alt="signature" width={80} height={40} className="rounded border p-1 object-contain"/>}
                    </div>
                </div>
            </CardContent>
          </Card>

          <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-8">
            <section className="lg:col-span-2 no-print space-y-4">
              <ReportForm
                onFormUpdate={handleFormUpdate}
                initialData={currentEditingReport}
                isEditing={!currentEditingReport.id.startsWith('unsaved-')}
                reportPrintListForHistory={allRankedReports}
                onSaveReport={handleSaveOrUpdateReport}
                onResetForm={handleClearAndReset}
              />
            </section>

            <section className="lg:col-span-3 flex flex-col">
              <Card className="shadow-lg flex-grow flex flex-col bg-card text-card-foreground">
                <CardHeader className="no-print">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Eye className="mr-1 h-5 w-5 md:h-6 md:w-6 text-primary" />
                        <CardTitle className="font-headline text-lg md:text-xl">
                          {reportsCount > 0 ? `Report ${currentPreviewIndex + 1} of ${reportsCount}` : `Report Print Preview`}
                        </CardTitle>
                      </div>
                      {reportsCount > 1 && (
                        <div className="flex items-center gap-2">
                          <Button onClick={handlePreviousPreview} disabled={currentPreviewIndex === 0} variant="outline" size="icon" aria-label="Previous Report">
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button onClick={handleNextPreview} disabled={currentPreviewIndex >= reportsCount - 1} variant="outline" size="icon" aria-label="Next Report">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 items-stretch">
                      <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                        {isAdminRole && (
                            <Select value={adminFilters.schoolName} onValueChange={value => handleAdminFilterChange('schoolName', value)} disabled={user.role === 'admin'}>
                                <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by school">
                                    <div className="flex items-center gap-2"><Building className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by school..." /></div>
                                </SelectTrigger>
                                <SelectContent>{allFilterOptions.schools.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Schools' : s}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                        <Select value={adminFilters.className} onValueChange={value => handleAdminFilterChange('className', value)}>
                            <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by class">
                                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by class..." /></div>
                            </SelectTrigger>
                            <SelectContent>{allFilterOptions.classes.map(c => <SelectItem key={c} value={c}>{c === 'all' ? 'All My Classes' : c}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={adminFilters.academicYear} onValueChange={value => handleAdminFilterChange('academicYear', value)}>
                            <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by year">
                                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by year..." /></div>
                            </SelectTrigger>
                            <SelectContent>{allFilterOptions.years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={adminFilters.academicTerm} onValueChange={value => handleAdminFilterChange('academicTerm', value)}>
                            <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by term">
                                <div className="flex items-center gap-2"><BookMarked className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by term..." /></div>
                            </SelectTrigger>
                            <SelectContent>{allFilterOptions.terms.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'All Terms' : t}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button
                            onClick={() => setIsClassDashboardOpen(true)}
                            disabled={reportsCount === 0 || isLoadingReports}
                            variant="outline"
                            size="sm"
                            title={reportsCount > 0 ? "View AI-powered class performance dashboard" : "Add reports to list to view dashboard"}
                          >
                          <BarChartHorizontalBig className="mr-2 h-4 w-4" />
                          Class Dashboard
                        </Button>
                        {isAdminRole && (
                            <Button
                                onClick={() => setIsSchoolDashboardOpen(true)}
                                disabled={reportsCount === 0 || isLoadingReports}
                                variant="outline"
                                size="sm"
                                title={reportsCount > 0 ? "View AI-powered school overview dashboard" : "Add reports to list to view dashboard"}
                            >
                              <Building className="mr-2 h-4 w-4" />
                              School Overview
                            </Button>
                        )}
                        <Button onClick={() => handleInitiatePrint(true)} disabled={reportsCount === 0 || isLoadingReports} variant="outline" size="sm" title={reportsCount > 0 ? "Download all reports in the list as a single PDF" : "Add or filter reports to the list to enable download"}>
                          <Download className="mr-2 h-4 w-4" />
                          Download as PDF
                        </Button>
                        <Button onClick={() => handleInitiatePrint(false)} disabled={reportsCount === 0 || isLoadingReports} variant="outline" size="sm" title={reportsCount > 0 ? "Print all reports in the list" : "Add or filter reports to the list to enable printing"}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print ({reportsCount})
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                        <Button
                            onClick={() => setIsImportStudentsDialogOpen(true)}
                            variant="outline"
                            size="sm"
                            title="Import student data from previous term/class"
                            disabled={isLoadingReports}
                          >
                          <Upload className="mr-2 h-4 w-4" />
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
                <CardContent id="report-preview-container" className="flex-grow rounded-b-lg overflow-auto p-0 md:p-2 bg-gray-100 dark:bg-gray-800">
                  {isLoadingReports && allRankedReports.length === 0 ? (
                    <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                      <h3 className="text-lg font-semibold">Loading Reports...</h3>
                      <p>Fetching your report data from the cloud.</p>
                    </div>
                  ) : reportsCount > 0 ? (
                    // This is the list of SAVED reports for SCREEN view
                    <>
                      {filteredReports.map((reportData, index) => (
                        <div key={reportData.id || `report-entry-${reportData.studentEntryNumber}`} className={`report-preview-item ${index === currentPreviewIndex ? 'active-preview-screen' : 'hidden-preview-screen'}`}>
                            {index === currentPreviewIndex && (
                              <div className="report-actions-wrapper-screen no-print p-2 bg-card mb-1 rounded-t-lg">
                                <ReportActions report={reportData} onEditReport={handleLoadReportForEditing} />
                              </div>
                            )}
                            <div className="a4-page-simulation break-inside-avoid">
                              <ReportPreview data={reportData} />
                            </div>
                        </div>
                      ))}
                    </>
                  ) : currentEditingReport && (currentEditingReport.studentName || currentEditingReport.className || currentEditingReport.schoolName) ? (
                      // This is the LIVE preview of the report being edited in the form
                      <div className="a4-page-simulation break-inside-avoid">
                        <ReportPreview data={currentEditingReport} />
                      </div>
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
          </main>

          <footer className="text-center mt-12 py-6 text-sm text-muted-foreground border-t no-print">
            <p>&copy; {new Date().getFullYear()} Report Card Generator. Professionally designed for educators.</p>
          </footer>
        </div>
      </div>

      {/* This is the dedicated container for PRINTING ONLY. It is OUTSIDE the main app container. */}
      <div className="print-only-reports">
        {reportsCount > 0 ? (
          filteredReports.map((reportData) => (
            <div key={`print-${reportData.id}`} className="a4-page-simulation">
              <ReportPreview data={reportData} />
            </div>
          ))
        ) : currentEditingReport && (currentEditingReport.studentName || currentEditingReport.className || currentEditingReport.schoolName) ? (
          <div className="a4-page-simulation">
            <ReportPreview data={currentEditingReport} />
          </div>
        ) : null}
      </div>


      <Dialog open={isCustomClassNameDialogOpen} onOpenChange={setIsCustomClassNameDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Class Name</DialogTitle></DialogHeader>
          <Input value={customClassNameInputValue} onChange={e => setCustomClassNameInputValue(e.target.value)} placeholder="e.g., Form 1 Gold"/>
          <DialogFooter><Button onClick={handleAddCustomClassNameToListAndForm}>Add Class</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
              allReports={allRankedReports.filter(r => r.academicYear === sessionDefaults.academicYear)}
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
