
'use client';

import { useState, useEffect } from 'react';
import ReportForm from '@/components/report-form';
import ReportPreview from '@/components/report-preview';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Printer, BookMarked, FileText, Eye, ListPlus, Trash2, BarChart3, Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { defaultReportData } from '@/lib/schemas';

// Helper function to calculate final mark for a single subject
function calculateSubjectFinalMark(subject: SubjectEntry): number {
  const caMarkInput = subject.continuousAssessment;
  const examMarkInput = subject.examinationMark;

  if ((caMarkInput === null || caMarkInput === undefined) && (examMarkInput === null || examMarkInput === undefined)) {
    return 0;
  }

  const scaledCaMark = (caMarkInput !== null && caMarkInput !== undefined) ? (caMarkInput / 60) * 40 : 0;
  const scaledExamMark = (examMarkInput !== null && examMarkInput !== undefined) ? (examMarkInput / 100) * 60 : 0;

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


export default function Home() {
  const [currentEditingReport, setCurrentEditingReport] = useState<ReportData>(JSON.parse(JSON.stringify({...defaultReportData, studentEntryNumber: undefined, id: undefined, studentPhotoDataUri: undefined, headMasterSignatureDataUri: undefined, schoolLogoDataUri: undefined})));
  const [reportPrintList, setReportPrintList] = useState<ReportData[]>([]);
  const [nextStudentEntryNumber, setNextStudentEntryNumber] = useState<number>(1);
  const [sessionDefaults, setSessionDefaults] = useState<Partial<ReportData>>({});
  const { toast } = useToast();

  const calculateAndSetRanks = (listToProcess: ReportData[]) => {
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
    
    // Second pass to ensure all tied ranks are marked with T-
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
  };


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

      if (reportPrintList.length === 0) { 
        setSessionDefaults({
          schoolName: currentEditingReport.schoolName,
          schoolLogoDataUri: currentEditingReport.schoolLogoDataUri,
          className: currentEditingReport.className,
          // gender: currentEditingReport.gender, // Gender is student-specific
          academicYear: currentEditingReport.academicYear,
          academicTerm: currentEditingReport.academicTerm,
          totalSchoolDays: currentEditingReport.totalSchoolDays,
          headMasterSignatureDataUri: currentEditingReport.headMasterSignatureDataUri,
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
        gender: newFormBase.gender, // Reset gender for new student
        academicYear: sessionDefaults.academicYear ?? newFormBase.academicYear,
        academicTerm: sessionDefaults.academicTerm ?? newFormBase.academicTerm,
        totalSchoolDays: sessionDefaults.totalSchoolDays !== undefined && sessionDefaults.totalSchoolDays !== null 
                         ? sessionDefaults.totalSchoolDays 
                         : newFormBase.totalSchoolDays,
        headMasterSignatureDataUri: sessionDefaults.headMasterSignatureDataUri ?? newFormBase.headMasterSignatureDataUri,
        studentName: '', 
        daysAttended: null,
        performanceSummary: '',
        strengths: '',
        areasForImprovement: '',
        hobbies: [], // Reset hobbies for new student
        teacherFeedback: '',
        instructorContact: '',
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

    const dataStr = JSON.stringify(reportPrintList, null, 2); // Pretty print JSON
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const dataUrl = URL.createObjectURL(dataBlob);
    
    const exportFileDefaultName = `report_cards_data_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUrl);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement); // Required for Firefox
    linkElement.click();
    linkElement.remove(); // Clean up
    URL.revokeObjectURL(dataUrl); // Clean up blob URL

    toast({
        title: "Data Downloaded",
        description: "Report list data has been downloaded as a JSON file.",
    });
  };
  
  const reportsCount = reportPrintList.length;
  const reportsLabel = reportsCount === 1 ? 'Report' : 'Reports';

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-body bg-background text-foreground">
      <header className="mb-8 text-center no-print relative">
        <div className="flex items-center justify-center gap-3">
         <BookMarked className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
         <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary">Report Card Generator</h1>
        </div>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Easily create, customize, rank, and print student report cards.</p>
        <div className="absolute top-0 right-0">
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
              <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
                <div className="flex items-center gap-2">
                  <Eye className="mr-2 h-5 w-5 md:h-6 md:w-6 text-primary" />
                  <CardTitle className="font-headline text-xl md:text-2xl">Report Print Preview ({reportsCount} {reportsLabel})</CardTitle>
                </div>
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
              <CardDescription className="mt-2 md:mt-0">
                This area shows all reports added to the print list, sorted by rank. Each will attempt to print on a new page.
                Browser print dialog usually offers "Save as PDF". "Download Data" saves list as JSON. Session defaults (School, Class, Term etc.) apply after the first student entry.
                {reportsCount > 0 && <span className="block mt-1 text-xs italic text-primary"><BarChart3 className="inline-block mr-1 h-3 w-3" />Ranking is based on the average of final subject scores (CA 40%, Exam 60%).</span>}
              </CardDescription>
            </CardHeader>
            <CardContent id="report-preview-container" className="flex-grow rounded-b-lg overflow-auto p-0 md:p-2 bg-gray-100 dark:bg-gray-800">
              {reportsCount > 0 ? (
                reportPrintList.map((reportData) => (
                  <ReportPreview key={reportData.id || `report-entry-${reportData.studentEntryNumber}`} data={reportData} />
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
  );
