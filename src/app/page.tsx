
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Printer, BookMarked, FileText, Eye, ListPlus, Trash2, BarChart3, Download, Share2, ChevronLeft, ChevronRight, BarChartHorizontalBig, Building, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { defaultReportData } from '@/lib/schemas';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';

export const STUDENT_PROFILES_STORAGE_KEY = 'studentProfilesReportCardApp_v1';

function calculateSubjectFinalMark(subject: SubjectEntry): number {
  const caMarkInput = subject.continuousAssessment;
  const examMarkInput = subject.examinationMark;

  if ((caMarkInput === null || caMarkInput === undefined) && (examMarkInput === null || examMarkInput === undefined)) {
    return 0;
  }

  const scaledCaMark = (caMarkInput !== null && caMarkInput !== undefined) ? (Number(caMarkInput) / 60) * 40 : 0;
  const scaledExamMark = (examMarkInput !== null && examMarkInput !== undefined) ? (Number(examMarkInput) / 100) * 60 : 0;

  let finalPercentageMark: number;
  finalPercentageMark = scaledCaMark + scaledExamMark;
  finalPercentageMark = Math.min(finalPercentageMark, 100);
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
    const base = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'teacherId' | 'createdAt' | 'overallAverage' | 'rank'>;
    return {
      ...base,
      id: `unsaved-${Date.now()}`,
      studentEntryNumber: 1, // Initial placeholder, will be updated
      teacherId: undefined,
      createdAt: undefined,
      overallAverage: undefined,
      rank: undefined,
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


  const calculateAndSetRanks = useCallback((listToProcess: ReportData[]) => {
    if (listToProcess.length === 0) {
      setReportPrintList([]);
      return;
    }

    const reportsWithAverages = listToProcess.map(report => {
      let totalScore = 0;
      let validSubjectCount = 0;
      report.subjects.forEach(subject => {
        if (subject.subjectName && subject.subjectName.trim() !== '') {
            const finalMark = calculateSubjectFinalMark(subject);
            totalScore += finalMark;
            validSubjectCount++;
        }
      });
      const overallAverage = validSubjectCount > 0 ? parseFloat((totalScore / validSubjectCount).toFixed(2)) : 0;
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
        lastScore = report.overallAverage ?? 0;
        return { ...report, rank: formatRankString(displayRankCounter, false) };
      } else {
        return { ...report, rank: formatRankString(displayRankCounter, true) };
      }
    });

    for (let i = 0; i < rankedReports.length; i++) {
        if (i > 0 && rankedReports[i].overallAverage === rankedReports[i-1].overallAverage) {
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
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<ReportData, 'id'> & { createdAt: Timestamp };
        fetchedReports.push({
            ...data,
            id: doc.id, 
        });
        if (data.studentEntryNumber && data.studentEntryNumber > maxEntryNum) {
            maxEntryNum = data.studentEntryNumber;
        }
      });
      calculateAndSetRanks(fetchedReports);
      setNextStudentEntryNumber(maxEntryNum + 1);
      setIsLoadingReports(false);
      // Update currentEditingReport's studentEntryNumber if list is empty
      if (fetchedReports.length === 0) {
        setCurrentEditingReport(prev => ({
          ...prev,
          studentEntryNumber: maxEntryNum + 1,
        }));
      }
    }, (error) => {
      console.error("Error fetching reports from Firestore:", error);
      toast({ title: "Error Fetching Reports", description: "Could not load reports from the database.", variant: "destructive" });
      setIsLoadingReports(false);
    });

    return () => unsubscribe();
  }, [calculateAndSetRanks, toast]);


  const handleFormUpdate = (data: ReportData) => {
    setCurrentEditingReport(data);
  };

  const handleAddToList = async () => {
    if (!currentEditingReport) {
      toast({ title: "No Report Data", description: "Form is empty.", variant: "destructive" });
      return;
    }
     if (!currentEditingReport.studentName || !currentEditingReport.className) {
        toast({
          title: "Incomplete Report",
          description: "Please ensure student name and class are filled.",
          variant: "destructive",
        });
        return;
      }

    const reportWithMetadata: ReportData = {
      ...currentEditingReport,
      studentEntryNumber: nextStudentEntryNumber, 
      createdAt: serverTimestamp(),
      // Ensure fields like overallAverage and rank are not carried over if they were on currentEditingReport
      overallAverage: undefined,
      rank: undefined,
    };


    try {
      await addDoc(collection(db, 'reports'), reportWithMetadata);
      toast({
        title: "Report Submitted",
        description: `${currentEditingReport.studentName}'s report submitted. List will update.`,
      });
    } catch (error) {
      console.error("Error adding report to Firestore: ", error);
      toast({
        title: "Firestore Save Error",
        description: "Could not save report to the database.",
        variant: "destructive",
      });
    }

    if (reportWithMetadata.academicTerm === 'First Term' && reportWithMetadata.studentName) {
      try {
        const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
        const profiles: Record<string, { studentName: string; studentPhotoDataUri?: string; className?: string; gender?: string }> = storedProfilesRaw ? JSON.parse(storedProfilesRaw) : {};
        const profileKey = reportWithMetadata.studentName;
        profiles[profileKey] = {
          studentName: reportWithMetadata.studentName,
          studentPhotoDataUri: reportWithMetadata.studentPhotoDataUri,
          className: reportWithMetadata.className,
          gender: reportWithMetadata.gender,
        };
        localStorage.setItem(STUDENT_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      } catch (e) {
        console.error("Error saving student profile to localStorage:", e);
      }
    }

    if (reportPrintList.length === 0 && !sessionDefaults.schoolName) {
      setSessionDefaults({
        schoolName: currentEditingReport.schoolName,
        schoolLogoDataUri: currentEditingReport.schoolLogoDataUri,
        className: currentEditingReport.className,
        academicYear: currentEditingReport.academicYear,
        academicTerm: currentEditingReport.academicTerm,
        selectedTemplateId: currentEditingReport.selectedTemplateId,
        totalSchoolDays: currentEditingReport.totalSchoolDays,
        headMasterSignatureDataUri: currentEditingReport.headMasterSignatureDataUri,
        instructorContact: currentEditingReport.instructorContact,
      });
    }
    
    const newNextStudentEntryNumber = nextStudentEntryNumber + 1;
    setNextStudentEntryNumber(newNextStudentEntryNumber);

    const newFormBase = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'teacherId' | 'createdAt' | 'overallAverage' | 'rank'>;
    setCurrentEditingReport({
      ...newFormBase,
      schoolName: sessionDefaults.schoolName ?? newFormBase.schoolName,
      schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? newFormBase.schoolLogoDataUri,
      className: sessionDefaults.className ?? newFormBase.className,
      gender: undefined, // Reset gender
      academicYear: sessionDefaults.academicYear ?? newFormBase.academicYear,
      academicTerm: sessionDefaults.academicTerm ?? newFormBase.academicTerm,
      selectedTemplateId: sessionDefaults.selectedTemplateId ?? newFormBase.selectedTemplateId,
      totalSchoolDays: sessionDefaults.totalSchoolDays !== undefined && sessionDefaults.totalSchoolDays !== null
                       ? sessionDefaults.totalSchoolDays
                       : newFormBase.totalSchoolDays,
      headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? newFormBase.headMasterSignatureDataUri,
      instructorContact: sessionDefaults.instructorContact ?? newFormBase.instructorContact,
      id: `unsaved-${Date.now()}`, 
      studentEntryNumber: newNextStudentEntryNumber,
      studentName: '',
      daysAttended: null,
      parentEmail: '',
      parentPhoneNumber: '',
      performanceSummary: '',
      strengths: '',
      areasForImprovement: '',
      hobbies: [],
      teacherFeedback: '',
      subjects: [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
      promotionStatus: undefined,
      studentPhotoDataUri: undefined,
      overallAverage: undefined,
      rank: undefined,
      teacherId: undefined,
      createdAt: undefined,
    });
  };

  const handleClearList = () => {
    setReportPrintList([]);
    setCurrentPreviewIndex(0);
    setSessionDefaults({});
    toast({
      title: "Local View Cleared",
      description: "Your local view of reports has been cleared. Data in the database is not affected.",
    });
    const newBase = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'teacherId' | 'createdAt' | 'overallAverage' | 'rank'>;
    setCurrentEditingReport({ 
        ...newBase,
        id: `unsaved-${Date.now()}`,
        studentEntryNumber: nextStudentEntryNumber, // Use current nextStudentEntryNumber
        teacherId: undefined,
        createdAt: undefined,
        overallAverage: undefined,
        rank: undefined,
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

  const handleDownloadData = () => {
    if (reportPrintList.length === 0) {
      toast({
        title: "No Reports in List",
        description: "Please add reports to the list before downloading data.",
        variant: "destructive",
      });
      return;
    }

    const dataStr = JSON.stringify(reportPrintList, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const dataUrl = URL.createObjectURL(dataBlob);
    const exportFileDefaultName = `report_cards_data_${new Date().toISOString().slice(0,10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUrl);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    linkElement.remove();
    URL.revokeObjectURL(dataUrl);
    toast({ title: "Data Downloaded", description: "Current report list data has been downloaded." });
  };

  const reportsCount = reportPrintList.length;

  const handleNextPreview = () => {
    setCurrentPreviewIndex(prev => Math.min(prev + 1, reportsCount - 1));
  };

  const handlePreviousPreview = () => {
    setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
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
      let currentImportEntryNumber = nextStudentEntryNumber;

      selectedStudentNames.forEach(studentName => {
        const profile = Object.values(profiles).find(p => p.studentName === studentName);
        if (profile) {
          const reportId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newFormBase = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'teacherId' | 'createdAt' | 'overallAverage' | 'rank'>;
          const importedReport: ReportData = {
            ...newFormBase,
            id: reportId,
            studentEntryNumber: currentImportEntryNumber++,
            createdAt: serverTimestamp(),
            studentName: profile.studentName,
            gender: profile.gender,
            studentPhotoDataUri: profile.studentPhotoDataUri,
            className: destinationClass,
            schoolName: sessionDefaults.schoolName ?? newFormBase.schoolName,
            schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? newFormBase.schoolLogoDataUri,
            academicYear: sessionDefaults.academicYear ?? newFormBase.academicYear,
            academicTerm: sessionDefaults.academicTerm ?? newFormBase.academicTerm,
            selectedTemplateId: sessionDefaults.selectedTemplateId ?? newFormBase.selectedTemplateId,
            totalSchoolDays: sessionDefaults.totalSchoolDays ?? newFormBase.totalSchoolDays,
            headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? newFormBase.headMasterSignatureDataUri,
            instructorContact: sessionDefaults.instructorContact ?? newFormBase.instructorContact,
            daysAttended: null, parentEmail: '', parentPhoneNumber: '',
            performanceSummary: '', strengths: '', areasForImprovement: '',
            hobbies: [], teacherFeedback: '',
            subjects: [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
            promotionStatus: undefined, overallAverage: undefined, rank: undefined,
            teacherId: undefined, 
          };
          reportsToImportPromises.push(addDoc(collection(db, 'reports'), importedReport));
        }
      });

      if (reportsToImportPromises.length > 0) {
        Promise.all(reportsToImportPromises)
          .then(() => {
            toast({
              title: "Students Imported",
              description: `${reportsToImportPromises.length} student(s) imported to ${destinationClass} and saved. List will update.`,
            });
            
            const newNextEntryNumForForm = currentImportEntryNumber;
            setNextStudentEntryNumber(newNextEntryNumForForm); // Update the main counter

            const newFormBaseReset = JSON.parse(JSON.stringify(defaultReportData)) as Omit<ReportData, 'id' | 'studentEntryNumber' | 'teacherId' | 'createdAt' | 'overallAverage' | 'rank'>;
            setCurrentEditingReport({
                ...newFormBaseReset,
                schoolName: sessionDefaults.schoolName ?? newFormBaseReset.schoolName,
                schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? newFormBaseReset.schoolLogoDataUri,
                className: sessionDefaults.className ?? newFormBaseReset.className,
                academicYear: sessionDefaults.academicYear ?? newFormBaseReset.academicYear,
                academicTerm: sessionDefaults.academicTerm ?? newFormBaseReset.academicTerm,
                selectedTemplateId: sessionDefaults.selectedTemplateId ?? newFormBaseReset.selectedTemplateId,
                totalSchoolDays: sessionDefaults.totalSchoolDays ?? newFormBaseReset.totalSchoolDays,
                headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? newFormBaseReset.headMasterSignatureDataUri,
                instructorContact: sessionDefaults.instructorContact ?? newFormBaseReset.instructorContact,
                id: `unsaved-${Date.now()}`,
                studentEntryNumber: newNextEntryNumForForm,
                teacherId: undefined,
                createdAt: undefined,
                overallAverage: undefined,
                rank: undefined,
            });
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

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-8">
        <section className="lg:col-span-2 no-print space-y-4">
          <ReportForm
            onFormUpdate={handleFormUpdate}
            initialData={currentEditingReport}
            reportPrintListForHistory={reportPrintList}
          />
          <Button onClick={handleAddToList} className="w-full" variant="default">
            <ListPlus className="mr-2 h-4 w-4" />
            Add Current Report to Print & Rank List
          </Button>
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
                    <Button onClick={handleDownloadData} disabled={reportsCount === 0 || isLoadingReports} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download Data
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
                    : 'This area shows a live preview of the form data. Click "Add Current Report..." to save it.'}
                </span>
                <span className="block text-xs italic">
                  <Share2 className="inline-block mr-1 h-3 w-3 text-muted-foreground" /> Share options (Email/WhatsApp) below each report will open your default app.
                </span>
                {reportsCount > 0 && <span className="block mt-1 text-xs italic text-primary"><BarChart3 className="inline-block mr-1 h-3 w-3" />Ranking is based on overall average.</span>}
              </CardDescription>
            </CardHeader>
            <CardContent id="report-preview-container" className="flex-grow rounded-b-lg overflow-auto p-0 md:p-2 bg-gray-100 dark:bg-gray-800">
              {reportsCount > 0 ? (
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
              ) : isLoadingReports ? (
                 <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                  <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                  <h3 className="text-lg font-semibold">Loading Reports...</h3>
                  <p>Fetching your report data from the cloud.</p>
                </div>
              ) : currentEditingReport ? (
                <>
                  {/* No ReportActions for unsaved form data preview to avoid confusion */}
                  <div className="report-preview-item active-preview-screen">
                    <ReportPreview data={currentEditingReport} />
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                  <FileText className="h-24 w-24 mb-6 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-xl font-semibold mb-2">Form is Empty</h3>
                  <p>Fill out the form and click "Update Preview" or "Add Current Report to Print List".</p>
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

