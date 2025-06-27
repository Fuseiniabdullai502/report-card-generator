
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Printer, BookMarked, FileText, Eye, Trash2, BarChart3, Download, Share2, ChevronLeft, ChevronRight, BarChartHorizontalBig, Building, Upload, Loader2, AlertTriangle, Users, PlusCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { defaultReportData } from '@/lib/schemas';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, Timestamp, doc, deleteDoc, writeBatch } from 'firebase/firestore';

export const STUDENT_PROFILES_STORAGE_KEY = 'studentProfilesReportCardApp_v1';
const ADD_CUSTOM_CLASS_VALUE = "--add-custom-class--";
const classLevels = ["KG1", "KG2", "BASIC 1", "BASIC 2", "BASIC 3", "BASIC 4", "BASIC 5", "BASIC 6", "JHS1", "JHS2", "JHS3", "SHS1", "SHS2", "SHS3", "LEVEL 100", "LEVEL 200", "LEVEL 300", "LEVEL 400", "LEVEL 500", "LEVEL 600", "LEVEL 700"];


function calculateSubjectFinalMark(subject: SubjectEntry): number | null {
  const caMarkInput = subject.continuousAssessment;
  const examMarkInput = subject.examinationMark;

  const caVal = Number(caMarkInput);
  const examVal = Number(examMarkInput);
  
  const caIsValid = caMarkInput !== null && caMarkInput !== undefined && !Number.isNaN(caVal);
  const examIsValid = examMarkInput !== null && examMarkInput !== undefined && !Number.isNaN(examVal);

  if (!caIsValid && !examIsValid) {
    return null;
  }

  const safeCaVal = caIsValid ? caVal : 0;
  const safeExamVal = examIsValid ? examVal : 0;

  const scaledCaMark = (safeCaVal / 60) * 40;
  const scaledExamMark = (safeExamVal / 100) * 60;
  
  let finalPercentageMark = scaledCaMark + scaledExamMark;
  finalPercentageMark = Math.min(finalPercentageMark, 100);
  
  if (Number.isNaN(finalPercentageMark)) {
      return null;
  }

  return parseFloat(finalPercentageMark.toFixed(1));
}


function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatRankString(rankNumber: number, isTie: boolean): string {
  const suffix = getOrdinalSuffix(rankNumber);
  return `${isTie ? 'T-' : ''}${rankNumber}${suffix}`;
}

function AppContent() {
  const [currentEditingReport, setCurrentEditingReport] = useState<ReportData>(() => {
    const base = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'createdAt' | 'overallAverage' | 'rank' | 'teacherId'>;
    return {
      ...base,
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: 1,
      createdAt: undefined,
      overallAverage: undefined,
      rank: undefined,
      teacherId: undefined,
    };
  });
  const [reportPrintList, setReportPrintList] = useState<ReportData[]>([]);
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


  const calculateAndSetRanks = useCallback((listToProcess: ReportData[]) => {
    if (listToProcess.length === 0) {
      setReportPrintList([]);
      return;
    }

    const reportsWithAverages = listToProcess.map(report => {
      let totalScore = 0;
      let validSubjectCount = 0;
      let hasValidSubjects = false;
      report.subjects.forEach(subject => {
        if (subject.subjectName && subject.subjectName.trim() !== '') {
            hasValidSubjects = true;
            const finalMark = calculateSubjectFinalMark(subject);
            if (finalMark !== null) {
                totalScore += finalMark;
                validSubjectCount++;
            }
        }
      });
      const overallAverage = hasValidSubjects && validSubjectCount > 0 ? parseFloat((totalScore / validSubjectCount).toFixed(2)) : null;
      return { ...report, overallAverage };
    });

    const sortedReports = [...reportsWithAverages].sort((a, b) => (b.overallAverage ?? 0) - (a.overallAverage ?? 0));

    let lastScore = -1;
    let actualRank = 0;
    let displayRankCounter = 0;

    const rankedReports = sortedReports.map((report) => {
      actualRank++;
      if (report.overallAverage !== lastScore) {
        displayRankCounter = actualRank;
        lastScore = report.overallAverage ?? -1;
        return { ...report, rank: formatRankString(displayRankCounter, false) };
      } else {
        return { ...report, rank: formatRankString(displayRankCounter, true) };
      }
    });

    for (let i = 0; i < rankedReports.length; i++) {
        if (i > 0 && rankedReports[i].overallAverage !== null && rankedReports[i].overallAverage === rankedReports[i-1].overallAverage) {
            const baseRank = parseInt(rankedReports[i-1].rank!.replace('T-', '').replace(/(st|nd|rd|th)$/, ''));
            rankedReports[i].rank = formatRankString(baseRank, true);
             if (!rankedReports[i-1].rank?.startsWith('T-')) {
                rankedReports[i-1].rank = formatRankString(baseRank, true);
            }
        }
    }
    setReportPrintList(rankedReports);
    if (rankedReports.length > 0 && currentPreviewIndex >= rankedReports.length) {
        setCurrentPreviewIndex(rankedReports.length -1);
    } else if (rankedReports.length === 0) {
        setCurrentPreviewIndex(0);
    }

  }, [currentPreviewIndex]);

  useEffect(() => {
    setIsLoadingReports(true);
    const reportsCollectionRef = collection(db, 'reports');
    const q = query(reportsCollectionRef, orderBy('createdAt', 'asc'));

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
          teacherId: undefined,
        }));
      }
    }, (error) => {
      console.error("Error fetching reports from Firestore:", error);
      toast({ title: "Error Fetching Reports", description: "Could not load reports from the database.", variant: "destructive" });
      setIsLoadingReports(false);
    });

    return () => unsubscribe();
  }, [calculateAndSetRanks, toast, sessionDefaults]);


  const handleFormUpdate = useCallback((data: ReportData) => {
    setCurrentEditingReport(prev => ({...prev, ...data}));
  }, []);

  const handleResetToBlankForm = useCallback(() => {
    const newNextStudentEntryNumber = nextStudentEntryNumber; // Use the current next number

    const newStudentBase = JSON.parse(JSON.stringify(defaultReportData));
    
    const newStudentDataForForm: ReportData = {
      ...newStudentBase,
      ...sessionDefaults, // Apply session defaults
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: newNextStudentEntryNumber,
      createdAt: undefined,
      overallAverage: undefined,
      rank: undefined,
      teacherId: undefined,
    };
    
    setCurrentEditingReport(newStudentDataForForm);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    toast({
      title: "Form Cleared",
      description: "Ready for a new student's report entry.",
    });
  }, [nextStudentEntryNumber, sessionDefaults, toast]);

  const handleSaveReportAndResetForm = async (formDataFromForm: ReportData) => {
    const reportToSaveForFirestore = {
      studentEntryNumber: formDataFromForm.studentEntryNumber,
      studentName: formDataFromForm.studentName || '',
      className: formDataFromForm.className || '',
      gender: formDataFromForm.gender || null,
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

    const newNextStudentEntryNumber = nextStudentEntryNumber + 1;
    
    // Create a fresh, clean report object for the next student using a deep copy
    const newStudentBase = JSON.parse(JSON.stringify(defaultReportData));
    
    const newStudentDataForForm: ReportData = {
      ...newStudentBase,
      ...newSessionDefaults,
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: newNextStudentEntryNumber,
      createdAt: undefined,
      overallAverage: undefined,
      rank: undefined,
      teacherId: undefined,
    };
    
    setCurrentEditingReport(newStudentDataForForm);
    setNextStudentEntryNumber(newNextStudentEntryNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    toast({
      title: "Form Cleared",
      description: "Ready for the next student's report entry.",
    });
  };


  const handleClearList = async () => {
    if (reportPrintList.length === 0) {
        toast({ title: "Local View Already Clear", description: "No reports in the local view to clear. Firestore data is unaffected." });
        return;
    }
    setReportPrintList([]);
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
        teacherId: undefined,
     });
  }

  const handlePrint = () => {
    if (reportPrintList.length > 0) {
      window.print();
    } else {
      toast({
        title: "No Reports in List",
        description: "Please add reports to the list before printing.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAsPdf = () => {
    if (reportPrintList.length === 0) {
      toast({
        title: "No Reports to Download",
        description: "Please add reports to the list before downloading as a PDF.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Preparing PDF Download...",
      description: "Your browser's print dialog will open. Please select 'Save as PDF' as the destination.",
    });

    // A small delay can help ensure the toast is visible before the print dialog blocks the UI
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const reportsCount = reportPrintList.length;

  const handleNextPreview = () => {
    setCurrentPreviewIndex(prev => Math.min(prev + 1, reportsCount - 1));
  };

  const handlePreviousPreview = () => {
    setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
  };

  const handleSessionClassChange = (value: string) => {
    if (value === ADD_CUSTOM_CLASS_VALUE) {
        setIsCustomClassNameDialogOpen(true);
    } else {
        const newSessionDefaults = { ...sessionDefaults, className: value };
        setSessionDefaults(newSessionDefaults);
        // Also update the current form in case the user is editing
        setCurrentEditingReport(prev => ({...prev, className: value}));
    }
  };

  const handleAddCustomClassNameToListAndForm = () => {
      const newClassName = customClassNameInputValue.trim();
      if (newClassName === '') return;
      handleSessionClassChange(newClassName);
      if (!classLevels.includes(newClassName) && !customClassNames.includes(newClassName)) {
          setCustomClassNames(prev => [...new Set([...prev, newClassName])]);
      }
      setIsCustomClassNameDialogOpen(false);
      setCustomClassNameInputValue('');
  };


  const currentClassNameForDashboard = useMemo(() => {
    if (reportsCount > 0 && reportPrintList[currentPreviewIndex]) {
      return reportPrintList[currentPreviewIndex].className || "N/A";
    }
    const classNamesInList = new Set(reportPrintList.map(r => r.className).filter(Boolean));
    if (classNamesInList.size === 1) return classNamesInList.values().next().value;
    if (classNamesInList.size > 1) return "Multiple Classes";
    return currentEditingReport.className || "N/A";
  }, [reportPrintList, currentPreviewIndex, currentEditingReport.className, reportsCount]);

  const currentAcademicTermForDashboard = useMemo(() => {
     if (reportsCount > 0 && reportPrintList[currentPreviewIndex]) {
      return reportPrintList[currentPreviewIndex].academicTerm || "N/A";
    }
    const termsInList = new Set(reportPrintList.map(r => r.academicTerm).filter(Boolean));
    if (termsInList.size === 1) return termsInList.values().next().value;
    if (termsInList.size > 1) return "Multiple Terms";
    return currentEditingReport.academicTerm || "N/A";
  }, [reportPrintList, currentPreviewIndex, currentEditingReport.academicTerm, reportsCount]);

  const schoolNameForDashboard = useMemo(() => {
    return sessionDefaults.schoolName || currentEditingReport.schoolName || "School";
  }, [sessionDefaults.schoolName, currentEditingReport.schoolName]);

  const academicTermForSchoolDashboard = useMemo(() => {
    if (reportsCount > 0) {
      const uniqueTerms = new Set(reportPrintList.map(r => r.academicTerm).filter(Boolean));
      if (uniqueTerms.size === 1) return uniqueTerms.values().next().value;
      return "Multiple Terms Summary";
    }
    return currentEditingReport.academicTerm || "Term Summary";
  }, [reportPrintList, currentEditingReport.academicTerm, reportsCount]);

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
            studentEntryNumber: currentImportEntryNumberBase + index,
            createdAt: serverTimestamp(),
            studentName: profile.studentName,
            gender: profile.gender ?? null,
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
                teacherId: undefined,
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


  return (
    <>
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-body bg-background text-foreground">
      <header className="mb-8 text-center no-print relative">
        <div className="flex items-center justify-center gap-3">
         <BookMarked className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
         <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary">Report Card Generator</h1>
        </div>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Easily create, customize, rank, and print student report cards.</p>
         <div className="absolute top-0 right-0 flex items-center gap-2">
          <ThemeToggleButton />
        </div>
      </header>
      
      <Card className="mb-8 p-4 no-print">
        <CardHeader className="p-2">
            <CardTitle className="text-lg flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Session Controls</CardTitle>
            <CardDescription className="text-xs">Set the class for the current data entry session. This will apply to all new reports.</CardDescription>
        </CardHeader>
        <CardContent className="p-2">
            <div className="max-w-sm">
                <Label htmlFor="sessionClassName" className="text-sm font-medium">Current Class</Label>
                <Select value={sessionDefaults.className || ''} onValueChange={handleSessionClassChange}>
                    <SelectTrigger id="sessionClassName"><SelectValue placeholder="Select or add class" /></SelectTrigger>
                    <SelectContent>
                        {classLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                        {customClassNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        <SelectSeparator />
                        <SelectItem value={ADD_CUSTOM_CLASS_VALUE}><PlusCircle className="mr-2 h-4 w-4" />Add New Class...</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>


      <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-8">
        <section className="lg:col-span-2 no-print space-y-4">
          <ReportForm
            onFormUpdate={handleFormUpdate}
            initialData={currentEditingReport}
            key={currentEditingReport.id}
            reportPrintListForHistory={reportPrintList}
            onSaveReport={handleSaveReportAndResetForm}
            onResetForm={handleResetToBlankForm}
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
                      Print All ({reportsCount})
                    </Button>
                    <Button onClick={handleClearList} disabled={isLoadingReports && reportsCount === 0} variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Local View
                    </Button>
                  </div>
                </div>
              </div>
              <CardDescription className="mt-2 md:mt-1 space-y-1">
                <span>
                  {reportsCount > 0
                    ? 'This area shows one report at a time from the list. Use navigation buttons if multiple reports are in the list.'
                    : 'This area shows a live preview of the data from the form. Click "Add Report to List" to save it to the database.'}
                </span>
                <span className="block text-xs italic">
                  <Share2 className="inline-block mr-1 h-3 w-3 text-muted-foreground" /> Share options (Email/WhatsApp) below each report will open your default app.
                </span>
                {reportsCount > 0 && <span className="block mt-1 text-xs italic text-primary"><BarChart3 className="inline-block mr-1 h-3 w-3" />Ranking is based on overall average.</span>}
              </CardDescription>
            </CardHeader>
            <CardContent id="report-preview-container" className="flex-grow rounded-b-lg overflow-auto p-0 md:p-2 bg-gray-100 dark:bg-gray-800">
              {isLoadingReports && reportsCount === 0 ? (
                 <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                  <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                  <h3 className="text-lg font-semibold">Loading Reports...</h3>
                  <p>Fetching your report data from the cloud.</p>
                </div>
              ) : reportsCount > 0 && reportPrintList[currentPreviewIndex] ? (
                reportPrintList.map((reportData, index) => (
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
                  <h3 className="text-xl font-semibold mb-2">Report Preview Area</h3>
                  <p>The report card preview will appear here as you fill out the form.</p>
                  <p className="text-xs mt-1">When you finish, click "Add Report to List" to save it.</p>
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
            reports={reportPrintList}
            classNameProp={currentClassNameForDashboard}
            academicTerm={currentAcademicTermForDashboard}
        />
    )}
    {isSchoolDashboardOpen && (
        <SchoolPerformanceDashboard
            isOpen={isSchoolDashboardOpen}
            onOpenChange={setIsSchoolDashboardOpen}
            allReports={reportPrintList}
            schoolNameProp={schoolNameForDashboard}
            academicTermProp={academicTermForSchoolDashboard}
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
  return (
    <AppContent />
  );
}
