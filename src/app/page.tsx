
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ReportForm from '@/components/report-form';
import ReportPreview from '@/components/report-preview';
import ReportActions from '@/components/report-actions';
// import ClassDashboard, { type ClassStatistics, type SubjectPerformanceStatForUI, type GenderPerformanceStatForUI } from '@/components/class-dashboard'; // Removed
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Printer, BookMarked, FileText, Eye, ListPlus, Trash2, BarChart3, Download, Share2, ChevronLeft, ChevronRight } from 'lucide-react'; // Removed BarChartHorizontalBig
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { defaultReportData } from '@/lib/schemas';
// import { getAiClassInsightsAction } from '@/app/actions'; // Removed
// import type { GenerateClassInsightsOutput } from '@/ai/flows/generate-class-insights-flow'; // Removed


// Helper function to calculate final mark for a single subject
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
  const [currentEditingReport, setCurrentEditingReport] = useState<ReportData>(JSON.parse(JSON.stringify({...defaultReportData, studentEntryNumber: undefined, id: undefined, studentPhotoDataUri: undefined, headMasterSignatureDataUri: undefined, schoolLogoDataUri: undefined})));
  const [reportPrintList, setReportPrintList] = useState<ReportData[]>([]);
  const [nextStudentEntryNumber, setNextStudentEntryNumber] = useState<number>(1);
  const [sessionDefaults, setSessionDefaults] = useState<Partial<ReportData>>({});
  const { toast } = useToast();

  const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number>(0);


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

    const rankedReports = sortedReports.map((report, index) => {
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
  }, []);


  const handleFormUpdate = (data: ReportData) => {
    setCurrentEditingReport(data);
  };

  const handleAddToList = () => {
    if (currentEditingReport) {
      if (!currentEditingReport.studentName || !currentEditingReport.className) {
        toast({
          title: "Incomplete Report",
          description: "Please ensure student name and class are filled before adding to the list.",
          variant: "destructive",
        });
        return;
      }
      const reportWithEntryNumber = {
        ...currentEditingReport,
        id: `report-${Date.now()}-${Math.random()}`,
        studentEntryNumber: nextStudentEntryNumber,
      };

      const newList = [...reportPrintList, reportWithEntryNumber];
      calculateAndSetRanks(newList);
      setCurrentPreviewIndex(newList.length - 1); // View the newly added report

      if (reportPrintList.length === 0) {
        setSessionDefaults({
          schoolName: currentEditingReport.schoolName,
          schoolLogoDataUri: currentEditingReport.schoolLogoDataUri,
          className: currentEditingReport.className,
          academicYear: currentEditingReport.academicYear,
          academicTerm: currentEditingReport.academicTerm,
          totalSchoolDays: currentEditingReport.totalSchoolDays,
          headMasterSignatureDataUri: currentEditingReport.headMasterSignatureDataUri,
          instructorContact: currentEditingReport.instructorContact,
        });
      }

      const currentEntryNum = nextStudentEntryNumber;
      setNextStudentEntryNumber(prevNumber => prevNumber + 1);
      toast({
        title: "Report Added & Ranked",
        description: `${currentEditingReport.studentName}'s report (Entry #${currentEntryNum}) added and list re-ranked.`,
      });

      const newFormBase = JSON.parse(JSON.stringify(defaultReportData));
      const newCurrentEditingReport: ReportData = {
        ...newFormBase,
        schoolName: sessionDefaults.schoolName ?? newFormBase.schoolName,
        schoolLogoDataUri: sessionDefaults.schoolLogoDataUri ?? newFormBase.schoolLogoDataUri,
        className: sessionDefaults.className ?? newFormBase.className,
        gender: newFormBase.gender,
        academicYear: sessionDefaults.academicYear ?? newFormBase.academicYear,
        academicTerm: sessionDefaults.academicTerm ?? newFormBase.academicTerm,
        totalSchoolDays: sessionDefaults.totalSchoolDays !== undefined && sessionDefaults.totalSchoolDays !== null
                         ? sessionDefaults.totalSchoolDays
                         : newFormBase.totalSchoolDays,
        headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? newFormBase.headMasterSignatureDataUri,
        instructorContact: sessionDefaults.instructorContact ?? newFormBase.instructorContact,
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
        studentEntryNumber: undefined,
        id: undefined,
        overallAverage: undefined,
        rank: undefined,
        studentPhotoDataUri: undefined,
      };
      setCurrentEditingReport(newCurrentEditingReport);

    } else {
       toast({
        title: "No Report Data",
        description: "Please fill the form to add a report to the list.",
        variant: "destructive",
      });
    }
  };

  const handleClearList = () => {
    setReportPrintList([]);
    setNextStudentEntryNumber(1);
    setCurrentPreviewIndex(0);
    setSessionDefaults({});
    toast({
      title: "Print List Cleared",
      description: "All reports have been removed and ranking reset. Session defaults cleared.",
    });
    setCurrentEditingReport(JSON.parse(JSON.stringify({...defaultReportData, studentEntryNumber: undefined, id: undefined, studentPhotoDataUri: undefined, headMasterSignatureDataUri: undefined, schoolLogoDataUri: undefined })));
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

    toast({
        title: "Data Downloaded",
        description: "Report list data has been downloaded as a JSON file.",
    });
  };
  
  const reportsCount = reportPrintList.length;

  const handleNextPreview = () => {
    setCurrentPreviewIndex(prev => Math.min(prev + 1, reportPrintList.length - 1));
  };

  const handlePreviousPreview = () => {
    setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
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
            Add Current Report to Print &amp; Rank List
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
                      {reportsCount > 0 ? `Report ${currentPreviewIndex + 1} of ${reportsCount}` : `Report Print Preview (0 Reports)`}
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
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                    <Button onClick={handleDownloadData} disabled={reportsCount === 0} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download Data
                    </Button>
                    <Button onClick={handlePrint} disabled={reportsCount === 0} variant="outline" size="sm">
                      <Printer className="mr-2 h-4 w-4" />
                      Print All ({reportsCount})
                    </Button>
                    <Button onClick={handleClearList} disabled={reportsCount === 0} variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear List
                    </Button>
                  </div>
                </div>


              </div>
              <CardDescription className="mt-2 md:mt-1 space-y-1">
                <span>
                  This area shows one report at a time. Use navigation buttons if multiple reports are in the list. "Print All" prints all reports in the list.
                </span>
                <span className="block text-xs italic">
                  <Share2 className="inline-block mr-1 h-3 w-3 text-muted-foreground" /> Share options (Email/WhatsApp) below each report will open your default app with a pre-filled message. Automated sending is not supported.
                </span>
                {reportsCount > 0 && <span className="block mt-1 text-xs italic text-primary"><BarChart3 className="inline-block mr-1 h-3 w-3" />Ranking is based on the average of final subject scores (CA 40%, Exam 60%).</span>}
              </CardDescription>
            </CardHeader>
            <CardContent id="report-preview-container" className="flex-grow rounded-b-lg overflow-auto p-0 md:p-2 bg-gray-100 dark:bg-gray-800">
              {reportsCount > 0 ? (
                reportPrintList.map((reportData, index) => (
                  <React.Fragment key={reportData.id || `report-entry-${reportData.studentEntryNumber}`}>
                    {/* Show actions only for the currently active preview */}
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
              ) : (
                <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                  <FileText className="h-24 w-24 mb-6 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-xl font-semibold mb-2">No Reports in Print List</h3>
                  <p>Fill out the form, then click "Add Current Report to Print List" to see reports here.</p>
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
    {/* ClassDashboard component removed */}
    </>
  );
}


export default function Home() {
  return (
    <AppContent />
  );
}

