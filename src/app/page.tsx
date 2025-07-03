
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import NextImage from 'next/image';
import ReportForm from '@/components/report-form';
import ReportPreview from '@/components/report-preview';
import ReportActions from '@/components/report-actions';
import ClassPerformanceDashboard from '@/components/class-dashboard';
import SchoolPerformanceDashboard from '@/components/school-dashboard';
import ImportStudentsDialog from '@/components/import-students-dialog';
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
import { defaultReportData } from '@/lib/schemas';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, Timestamp, doc, deleteDoc, writeBatch, where, limit } from 'firebase/firestore';
import { calculateOverallAverage } from '@/lib/calculations';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import type { CustomUser } from '@/components/auth-provider';
import { signOut } from 'firebase/auth';
import Link from 'next/link';

export const STUDENT_PROFILES_STORAGE_KEY = 'studentProfilesReportCardApp_v1';
const ADD_CUSTOM_CLASS_VALUE = "--add-custom-class--";
const classLevels = ["KG1", "KG2", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "JHS1", "JHS2", "JHS3", "SHS1", "SHS2", "SHS3", "Level 100", "Level 200", "Level 300", "Level 400", "Level 500", "Level 600", "Level 700"];
const academicTermOptions = ["First Term", "Second Term", "Third Term", "First Semester", "Second Semester"];
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
  const [userClassFilter, setUserClassFilter] = useState<string>('all');
  
  const router = useRouter();

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

    return {
        schools: ['all', ...Array.from(schools).sort()],
        classes: ['all', ...Array.from(classes).sort()],
        years: ['all', ...Array.from(years).sort()],
        terms: ['all', ...Array.from(terms).sort()],
    };
  }, [allRankedReports]);

  // Apply filters based on user role
  const filteredReports = useMemo(() => {
    let reports = allRankedReports;
    if (user.role === 'admin') {
      reports = reports.filter(report => 
        (adminFilters.schoolName === 'all' || report.schoolName === adminFilters.schoolName) &&
        (adminFilters.className === 'all' || report.className === adminFilters.className) &&
        (adminFilters.academicYear === 'all' || report.academicYear === adminFilters.academicYear) &&
        (adminFilters.academicTerm === 'all' || report.academicTerm === adminFilters.academicTerm)
      );
    } else {
      if (userClassFilter !== 'all') {
        reports = reports.filter(report => report.className === userClassFilter);
      }
    }
    return reports;
  }, [allRankedReports, user.role, adminFilters, userClassFilter]);

  // Reset preview index when filters change
  useEffect(() => {
    setCurrentPreviewIndex(0);
  }, [adminFilters, userClassFilter]);

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
        return { ...report, overallAverage };
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
    const reportsCollectionRef = collection(db, 'reports');
    
    // Conditionally build the query based on user role
    let q;
    if (user.role === 'admin') {
      // Admin can see all reports. This requires Firestore rules to allow this.
      q = query(reportsCollectionRef, orderBy('createdAt', 'asc'));
    } else {
      // Regular user sees only their own reports. This is more secure and performant.
      q = query(
        reportsCollectionRef, 
        where('teacherId', '==', user.uid),
        orderBy('createdAt', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
      
      setCustomClassNames(prev => [...new Set([...prev, ...Array.from(classNamesFromDB)])]);
      calculateAndSetRanks(fetchedReports);
      setNextStudentEntryNumber(maxEntryNum + 1);
      setIsLoadingReports(false);

      if (fetchedReports.length === 0) {
        const baseReset = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId'>;
        setCurrentEditingReport(prev => ({
          ...baseReset,
          ...sessionDefaults,
          studentEntryNumber: maxEntryNum + 1,
          id: `unsaved-${Date.now()}`,
          createdAt: undefined,
          overallAverage: undefined,
          rank: undefined,
          teacherId: user.uid,
        }));
      }
    }, (error: any) => { // Use 'any' to access the 'code' property
      console.error("Error fetching reports from Firestore:", error);
      if (error.code === 'failed-precondition') {
        toast({ 
          title: "Firestore Index Required", 
          description: "A database index is needed to filter reports. Please check your browser's developer console for a link to create it. This is a one-time setup.",
          variant: "destructive",
          duration: 20000 
        });
      } else {
        toast({ title: "Error Fetching Reports", description: "Could not load reports from the database.", variant: "destructive" });
      }
      setIsLoadingReports(false);
    });

    return () => unsubscribe();
  }, [user.uid, user.role, calculateAndSetRanks, toast, sessionDefaults]);


  const handleFormUpdate = useCallback((data: ReportData) => {
    setCurrentEditingReport(prev => ({...prev, ...data}));
  }, []);

  const handleResetToBlankForm = useCallback((newDefaults?: Partial<ReportData>) => {
    const newNextStudentEntryNumber = nextStudentEntryNumber;
    const newStudentBase = JSON.parse(JSON.stringify(defaultReportData));
    
    // Use the explicitly passed defaults if they exist, otherwise fall back to the state.
    const defaultsToApply = newDefaults || sessionDefaults;

    const newStudentDataForForm: ReportData = {
      ...newStudentBase,
      ...defaultsToApply,
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: newNextStudentEntryNumber,
      createdAt: undefined,
      overallAverage: undefined,
      rank: undefined,
      teacherId: user.uid,
    };
    
    setCurrentEditingReport(newStudentDataForForm);
    // setCurrentVisibleSubjectIndex(0); // Reset subject pager
    window.scrollTo({ top: 0, behavior: 'smooth' });

    toast({
      title: "Form Cleared",
      description: "Ready for a new student's report entry.",
    });
  }, [nextStudentEntryNumber, sessionDefaults, toast, user.uid]);

  const handleClearAndReset = useCallback(() => {
    // First, update sessionDefaults with the latest info from the current form
    // This ensures that when we reset, we use the most recent session-like settings
    const newDefaults = {
      schoolName: currentEditingReport.schoolName,
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
    
    // Now, call the reset function, passing the new defaults to avoid stale state issues
    handleResetToBlankForm(newDefaults);
  }, [currentEditingReport, handleResetToBlankForm]);

  const handleSaveReportAndResetForm = async (formDataFromForm: ReportData) => {
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
    
    const reportToSaveForFirestore = {
      teacherId: user.uid,
      studentEntryNumber: formDataFromForm.studentEntryNumber,
      studentName: formDataFromForm.studentName || '',
      className: formDataFromForm.className || '',
      gender: formDataFromForm.gender,
      schoolName: formDataFromForm.schoolName || '',
      schoolLogoDataUri: formDataFromForm.schoolLogoDataUri || null,
      academicYear: formDataFromForm.academicYear || '',
      academicTerm: formDataFromForm.academicTerm || '',
      selectedTemplateId: formDataFromForm.selectedTemplateId || 'default',
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
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'reports'), reportToSaveForFirestore);
      toast({
        title: "Report Submitted",
        description: `${reportToSaveForFirestore.studentName}'s report submitted to Firestore. List will update.`,
      });
    } catch (error) {
      console.error("Detailed Firestore Save Error: ", error);
      toast({
        title: "Firestore Save Error",
        description: `Could not save report. ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
      return;
    }

    if (reportToSaveForFirestore.academicTerm === 'First Term' && reportToSaveForFirestore.studentName) {
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
      schoolLogoDataUri: reportToSaveForFirestore.schoolLogoDataUri,
      className: reportToSaveForFirestore.className,
      academicYear: reportToSaveForFirestore.academicYear,
      academicTerm: reportToSaveForFirestore.academicTerm,
      selectedTemplateId: reportToSaveForFirestore.selectedTemplateId,
      totalSchoolDays: reportToSaveForFirestore.totalSchoolDays,
      headMasterSignatureDataUri: reportToSaveForFirestore.headMasterSignatureDataUri,
      instructorContact: reportToSaveForFirestore.instructorContact,
    };
    setSessionDefaults(newSessionDefaults);

    handleResetToBlankForm(newSessionDefaults);
  };

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

    const newBase = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId'>;
    setCurrentEditingReport({
        ...newBase,
        ...sessionDefaults,
        id: `unsaved-${Date.now()}`,
        studentEntryNumber: nextStudentEntryNumber,
        createdAt: undefined,
        overallAverage: undefined,
        rank: undefined,
        teacherId: user.uid,
     });
  }

  const handlePrint = () => {
    if (filteredReports.length > 0) {
      window.print();
    } else {
      toast({
        title: "No Reports in List",
        description: "Please add or filter reports to the list before printing.",
        variant: "destructive",
      });
      return;
    }
  };

  const handleDownloadAsPdf = () => {
    if (filteredReports.length === 0) {
      toast({
        title: "No Reports to Download",
        description: "Please add or filter reports to the list before downloading as a PDF.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Preparing PDF Download...",
      description: "Your browser's print dialog will open. Please select 'Save as PDF' as the destination.",
    });

    setTimeout(() => {
      window.print();
    }, 500);
  };

  const reportsCount = filteredReports.length;

  const handleNextPreview = () => {
    setCurrentPreviewIndex(prev => Math.min(prev + 1, reportsCount - 1));
  };

  const handlePreviousPreview = () => {
    setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
  };

  const handleSessionDefaultChange = (field: keyof typeof sessionDefaults, value: any) => {
    setSessionDefaults(prev => ({ ...prev, [field]: value }));
    setCurrentEditingReport(prev => ({...prev, [field]: value}));
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
    return sessionDefaults.schoolName || currentEditingReport.schoolName || "School";
  }, [sessionDefaults.schoolName, currentEditingReport.schoolName]);

  const academicTermForSchoolDashboard = useMemo(() => {
    if (reportsCount > 0) {
      const uniqueTerms = new Set(filteredReports.map(r => r.academicTerm).filter(Boolean));
      if (uniqueTerms.size === 1) return uniqueTerms.values().next().value;
      return "Multiple Terms Summary";
    }
    return currentEditingReport.academicTerm || "Term Summary";
  }, [filteredReports, currentEditingReport.academicTerm, reportsCount]);

 const handleImportStudents = (selectedStudentNames: string[], destinationClass: string) => {
    if (selectedStudentNames.length === 0 || !destinationClass) {
      toast({ title: "Import Error", description: "No students selected or destination class missing.", variant: "destructive" });
      return;
    }

    try {
      const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
      const profiles: Record<string, { studentName: string; studentPhotoDataUri?: string; className?: string; gender?: string }> = storedProfilesRaw ? JSON.parse(storedProfilesRaw) : {};

      const reportsToImportPromises: Promise<void>[] = [];
      let currentImportEntryNumberBase = nextStudentEntryNumber;

      selectedStudentNames.forEach((studentName, index) => {
        const profile = Object.values(profiles).find(p => p.studentName === studentName);
        if (profile) {
          const importedReportForFirestore = {
            teacherId: user.uid,
            studentEntryNumber: currentImportEntryNumberBase + index,
            createdAt: serverTimestamp(),
            studentName: profile.studentName,
            gender: profile.gender ?? '',
            studentPhotoDataUri: profile.studentPhotoDataUri ?? null,
            className: destinationClass,
            schoolName: sessionDefaults.schoolName ?? defaultReportData.schoolName,
            schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? null,
            academicYear: sessionDefaults.academicYear ?? defaultReportData.academicYear,
            academicTerm: sessionDefaults.academicTerm ?? defaultReportData.academicTerm,
            selectedTemplateId: sessionDefaults.selectedTemplateId ?? defaultReportData.selectedTemplateId,
            totalSchoolDays: sessionDefaults.totalSchoolDays ?? null,
            headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? null,
            instructorContact: sessionDefaults.instructorContact || "",
            daysAttended: null, parentEmail: '', parentPhoneNumber: '',
            performanceSummary: '', strengths: '', areasForImprovement: '',
            hobbies: [], teacherFeedback: '',
            subjects: [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
            promotionStatus: null,
            clientSideId: `imported-${Date.now()}-${index}`,
          };
          reportsToImportPromises.push(addDoc(collection(db, 'reports'), importedReportForFirestore));
        }
      });

      if (reportsToImportPromises.length > 0) {
        Promise.all(reportsToImportPromises)
          .then(() => {
            toast({
              title: "Students Imported",
              description: `${reportsToImportPromises.length} student(s) imported to ${destinationClass} and saved to Firestore. List will update.`,
            });
            const newNextEntryNumForForm = currentImportEntryNumberBase + reportsToImportPromises.length;
            const studentSpecificDefaultsForImport = JSON.parse(JSON.stringify(defaultReportData)) as typeof defaultReportData;

            setCurrentEditingReport({
                schoolName: sessionDefaults.schoolName ?? studentSpecificDefaultsForImport.schoolName,
                schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? studentSpecificDefaultsForImport.schoolLogoDataUri,
                className: destinationClass,
                academicYear: sessionDefaults.academicYear ?? studentSpecificDefaultsForImport.academicYear,
                academicTerm: sessionDefaults.academicTerm ?? studentSpecificDefaultsForImport.academicTerm,
                selectedTemplateId: sessionDefaults.selectedTemplateId ?? studentSpecificDefaultsForImport.selectedTemplateId,
                totalSchoolDays: sessionDefaults.totalSchoolDays ?? studentSpecificDefaultsForImport.totalSchoolDays,
                headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? studentSpecificDefaultsForImport.headMasterSignatureDataUri,
                instructorContact: sessionDefaults.instructorContact ?? studentSpecificDefaultsForImport.instructorContact,
                studentName: studentSpecificDefaultsForImport.studentName,
                gender: studentSpecificDefaultsForImport.gender,
                studentPhotoDataUri: studentSpecificDefaultsForImport.studentPhotoDataUri,
                subjects: studentSpecificDefaultsForImport.subjects.map(s => ({...s})),
                daysAttended: studentSpecificDefaultsForImport.daysAttended,
                parentEmail: studentSpecificDefaultsForImport.parentEmail,
                parentPhoneNumber: studentSpecificDefaultsForImport.parentPhoneNumber,
                performanceSummary: studentSpecificDefaultsForImport.performanceSummary,
                strengths: studentSpecificDefaultsForImport.strengths,
                areasForImprovement: studentSpecificDefaultsForImport.areasForImprovement,
                hobbies: [...studentSpecificDefaultsForImport.hobbies],
                teacherFeedback: studentSpecificDefaultsForImport.teacherFeedback,
                promotionStatus: studentSpecificDefaultsForImport.promotionStatus,
                id: `unsaved-${Date.now()}`,
                studentEntryNumber: newNextEntryNumForForm,
                createdAt: undefined,
                overallAverage: undefined,
                rank: undefined,
                teacherId: user.uid,
            });
            setNextStudentEntryNumber(newNextEntryNumForForm);
            setSessionDefaults(prev => ({...prev, className: destinationClass}));
          })
          .catch(error => {
            console.error("Error importing students to Firestore:", error);
            toast({ title: "Import Failed", description: "Could not save imported students to the database.", variant: "destructive" });
          });
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
        const currentClassFilter = user.role === 'admin' ? adminFilters.className : userClassFilter;
        if (currentClassFilter !== 'all') {
            return currentClassFilter;
        }
        const available = allFilterOptions.classes.filter(c => c !== 'all');
        return available.length > 0 ? available[0] : '';
    }, [user.role, adminFilters.className, userClassFilter, allFilterOptions.classes]);

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
        if (user.role === 'admin') {
            const activeFilters = Object.entries(adminFilters)
                .filter(([, value]) => value !== 'all')
                .map(([key, value]) => `${prettyFilterKey(key)}: ${value}`)
                .join(', ');
            return activeFilters ? `Filtering by: ${activeFilters}` : 'Showing all reports in the system.';
        }
        return `Showing reports for: ${userClassFilter === 'all' ? 'All Classes' : userClassFilter}.`;
    }, [user.role, adminFilters, userClassFilter]);

    const noReportsFoundMessage = useMemo(() => {
        if (reportsCount === 0 && allRankedReports.length > 0) {
            if (user.role === 'admin') {
                return 'No reports match the selected admin filters. Try broadening your criteria.';
            }
            return `No reports match the filter "${userClassFilter}". Select "All Classes" or add reports.`;
        }
        return `The report card preview will appear here as you fill out the form.`;
    }, [reportsCount, allRankedReports.length, user.role, userClassFilter]);


  return (
    <>
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-body bg-background text-foreground">
      <header className="mb-8 text-center no-print relative">
        <div className="absolute top-0 left-0 flex items-center gap-2">
            {user.role === 'admin' && (
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
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Welcome, {user.email}</p>
         
        <div className="absolute top-0 right-0 flex items-center gap-2">
          <ThemeToggleButton />
          <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4"/>Logout</Button>
        </div>
      </header>
      
      <Card className="mb-8 p-4 no-print">
        <CardHeader className="p-2">
            <CardTitle className="text-lg flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Session Controls</CardTitle>
            <CardDescription className="text-xs">Set defaults for the current data entry session. These apply to all new reports.</CardDescription>
        </CardHeader>
        <CardContent className="p-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                    <Label htmlFor="sessionSchoolName" className="text-sm font-medium">School Name</Label>
                    <Input id="sessionSchoolName" value={sessionDefaults.schoolName || ''} onChange={e => handleSessionDefaultChange('schoolName', e.target.value)} placeholder="e.g., Faacom Academy" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="sessionAcademicYear" className="text-sm font-medium">Academic Year</Label>
                    <Input id="sessionAcademicYear" value={sessionDefaults.academicYear || ''} onChange={e => handleSessionDefaultChange('academicYear', e.target.value)} placeholder="e.g., 2023-2024" />
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="sessionClassName" className="text-sm font-medium">Current Class</Label>
                    <Select value={sessionDefaults.className || ''} onValueChange={value => handleSessionDefaultChange('className', value === ADD_CUSTOM_CLASS_VALUE ? '' : value)}>
                        <SelectTrigger id="sessionClassName"><SelectValue placeholder="Select or add class" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ADD_CUSTOM_CLASS_VALUE} onSelect={() => setIsCustomClassNameDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Add New Class...</SelectItem>
                            <SelectSeparator />
                            {classLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                            {customClassNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
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
                    <Input id="sessionInstructorContact" value={sessionDefaults.instructorContact || ''} onChange={e => handleSessionDefaultChange('instructorContact', e.target.value)} placeholder="Phone or Email" />
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
            reportPrintListForHistory={allRankedReports}
            onSaveReport={handleSaveReportAndResetForm}
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
                    {user.role === 'admin' ? (
                        <>
                            <Select value={adminFilters.schoolName} onValueChange={value => handleAdminFilterChange('schoolName', value)}>
                                <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by school">
                                    <div className="flex items-center gap-2"><Building className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by school..." /></div>
                                </SelectTrigger>
                                <SelectContent>{allFilterOptions.schools.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Schools' : s}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={adminFilters.className} onValueChange={value => handleAdminFilterChange('className', value)}>
                                <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter by class">
                                    <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><SelectValue placeholder="Filter by class..." /></div>
                                </SelectTrigger>
                                <SelectContent>{allFilterOptions.classes.map(c => <SelectItem key={c} value={c}>{c === 'all' ? 'All Classes' : c}</SelectItem>)}</SelectContent>
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
                        </>
                    ) : (
                         <Select value={userClassFilter} onValueChange={setUserClassFilter}>
                           <SelectTrigger className="w-auto min-w-[150px] max-w-[200px]" title="Filter reports by class">
                             <div className="flex items-center gap-2">
                               <FolderDown className="h-4 w-4 text-primary" />
                               <SelectValue placeholder="Filter by class..." />
                             </div>
                           </SelectTrigger>
                           <SelectContent>
                             {allFilterOptions.classes.map(cls => (
                               <SelectItem key={cls} value={cls}>{cls === 'all' ? 'All Classes' : cls}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                    )}
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
                    <Button onClick={handleDownloadAsPdf} disabled={reportsCount === 0 || isLoadingReports} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download as PDF
                    </Button>
                    <Button onClick={handlePrint} disabled={reportsCount === 0 || isLoadingReports} variant="outline" size="sm">
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
              ) : reportsCount > 0 && filteredReports[currentPreviewIndex] ? (
                filteredReports.map((reportData, index) => (
                  <React.Fragment key={reportData.id || `report-entry-${reportData.studentEntryNumber}`}>
                    {index === currentPreviewIndex && (
                       <div className="report-actions-wrapper-screen no-print p-2 bg-card mb-1 rounded-t-lg">
                         <ReportActions report={reportData} />
                       </div>
                    )}
                    <div className={`report-preview-item ${index === currentPreviewIndex ? 'active-preview-screen' : 'hidden-preview-screen'}`}>
                      <ReportPreview data={reportData} />
                    </div>
                  </React.Fragment>
                ))
              ) : currentEditingReport && (currentEditingReport.studentName || currentEditingReport.className || currentEditingReport.schoolName) ? (
                <>
                  <div className="report-preview-item active-preview-screen" key={currentEditingReport.id}>
                    <ReportPreview data={currentEditingReport} />
                  </div>
                </>
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
        />
    )}
    {isSchoolDashboardOpen && (
        <SchoolPerformanceDashboard
            isOpen={isSchoolDashboardOpen}
            onOpenChange={setIsSchoolDashboardOpen}
            allReports={filteredReports}
            schoolNameProp={schoolNameForDashboard}
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

    