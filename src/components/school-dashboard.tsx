
'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogFooter as ShadcnDialogFooter,
  DialogTitle as ShadcnDialogTitle,
  DialogClose,
  DialogDescription as ShadcnDialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader as ShadcnUITableHeader, TableRow } from '@/components/ui/table';
import { Building, Users, TrendingUp, Percent, PieChart as LucidePieChart, Brain, Printer, Loader2, AlertTriangle, Info, BookOpen, Sigma } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart as RechartsPieChart, Pie, Cell, type TooltipProps } from 'recharts';
import { getAiSchoolInsightsAction } from '@/app/actions';
import type { GenerateSchoolInsightsOutput, GenerateSchoolInsightsInput, ClassSummary as AIClassSummary, SchoolSubjectPerformanceStat as AISchoolSubjectStat, SchoolGenderPerformanceStat as AISchoolGenderStat } from '@/ai/flows/generate-school-insights-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SchoolPerformanceDashboardProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allReports: ReportData[];
  schoolNameProp: string;
  academicTermProp: string; 
}

interface AggregatedClassSummaryForUI {
  className: string;
  numberOfStudents: number;
  classAverage: number | null;
  subjectStats: Array<{
    subjectName: string;
    numBelowAverage: number;
    numAverage: number;
    numAboveAverage: number;
    classAverageForSubject: number | null;
  }>;
}

interface AggregatedSchoolSubjectStatForUI {
  subjectName: string;
  numBelowAverage: number;
  numAverage: number;
  numAboveAverage: number;
  schoolAverageForSubject: number | null;
}

interface AggregatedSchoolGenderStatForUI {
  gender: string;
  count: number;
  averageScore: number | null;
}

export interface SchoolStatistics {
  overallSchoolAverage: number | null;
  totalStudentsInSchool: number;
  numberOfClassesRepresented: number;
  classSummariesForUI: AggregatedClassSummaryForUI[];
  overallSubjectStatsForSchoolUI: AggregatedSchoolSubjectStatForUI[];
  overallGenderStatsForSchoolUI: AggregatedSchoolGenderStatForUI[];
}

// Helper from class-dashboard, ensure it's consistent or imported if modularized
function calculateInternalSubjectFinalMark(subject: SubjectEntry): number | null {
  const caMarkInput = subject.continuousAssessment;
  const examMarkInput = subject.examinationMark;

  if ((caMarkInput === null || caMarkInput === undefined) && (examMarkInput === null || examMarkInput === undefined)) {
    return null;
  }
  const scaledCaMark = (caMarkInput !== null && caMarkInput !== undefined) ? (Number(caMarkInput) / 60) * 40 : 0;
  const scaledExamMark = (examMarkInput !== null && examMarkInput !== undefined) ? (Number(examMarkInput) / 100) * 60 : 0;
  
  let finalPercentageMark = scaledCaMark + scaledExamMark;
  finalPercentageMark = Math.min(finalPercentageMark, 100);
  return parseFloat(finalPercentageMark.toFixed(1));
}


function aggregateSchoolData(reports: ReportData[]): SchoolStatistics | null {
  if (!reports || reports.length === 0) return null;

  const totalStudentsInSchool = reports.length;
  let sumOfAllStudentAverages = 0;
  let studentsWithOverallAverageCount = 0;

  const classDataMap: Map<string, { reports: ReportData[], subjectScores: Map<string, number[]>, studentAverages: number[] }> = new Map();
  const schoolSubjectScoresMap: Map<string, number[]> = new Map();
  const schoolGenderMap: Map<string, { scores: number[], count: number }> = new Map();

  reports.forEach(report => {
    // Overall School Average
    if (report.overallAverage !== undefined && report.overallAverage !== null) {
      sumOfAllStudentAverages += report.overallAverage;
      studentsWithOverallAverageCount++;
    }

    // Per-Class Aggregation
    if (!classDataMap.has(report.className)) {
      classDataMap.set(report.className, { reports: [], subjectScores: new Map(), studentAverages: [] });
    }
    classDataMap.get(report.className)!.reports.push(report);
    if (report.overallAverage !== undefined && report.overallAverage !== null) {
      classDataMap.get(report.className)!.studentAverages.push(report.overallAverage);
    }
    
    report.subjects.forEach(subject => {
      if (subject.subjectName && subject.subjectName.trim() !== '') {
        const finalMark = calculateInternalSubjectFinalMark(subject);
        if (finalMark !== null) {
          // For class-level subject scores
          const classSubjectScores = classDataMap.get(report.className)!.subjectScores;
          if (!classSubjectScores.has(subject.subjectName)) {
            classSubjectScores.set(subject.subjectName, []);
          }
          classSubjectScores.get(subject.subjectName)!.push(finalMark);

          // For school-level subject scores
          if (!schoolSubjectScoresMap.has(subject.subjectName)) {
            schoolSubjectScoresMap.set(subject.subjectName, []);
          }
          schoolSubjectScoresMap.get(subject.subjectName)!.push(finalMark);
        }
      }
    });
    
    // School-Wide Gender Aggregation
    const gender = report.gender || 'Unknown';
    if (!schoolGenderMap.has(gender)) {
      schoolGenderMap.set(gender, { scores: [], count: 0 });
    }
    if (report.overallAverage !== undefined && report.overallAverage !== null) {
        schoolGenderMap.get(gender)!.scores.push(report.overallAverage);
    }
    schoolGenderMap.get(gender)!.count++;
  });

  const overallSchoolAverage = studentsWithOverallAverageCount > 0 ? parseFloat((sumOfAllStudentAverages / studentsWithOverallAverageCount).toFixed(2)) : null;
  const numberOfClassesRepresented = classDataMap.size;

  const classSummariesForUI: AggregatedClassSummaryForUI[] = Array.from(classDataMap.entries()).map(([className, data]) => {
    const classAvg = data.studentAverages.length > 0 ? parseFloat((data.studentAverages.reduce((a, b) => a + b, 0) / data.studentAverages.length).toFixed(2)) : null;
    const subjectStats = Array.from(data.subjectScores.entries()).map(([subjectName, scores]) => ({
      subjectName,
      numBelowAverage: scores.filter(score => score < 40).length,
      numAverage: scores.filter(score => score >= 40 && score < 60).length,
      numAboveAverage: scores.filter(score => score >= 60).length,
      classAverageForSubject: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
    }));
    return {
      className,
      numberOfStudents: data.reports.length,
      classAverage: classAvg,
      subjectStats,
    };
  });

  const overallSubjectStatsForSchoolUI: AggregatedSchoolSubjectStatForUI[] = Array.from(schoolSubjectScoresMap.entries()).map(([subjectName, scores]) => ({
    subjectName,
    numBelowAverage: scores.filter(score => score < 40).length,
    numAverage: scores.filter(score => score >= 40 && score < 60).length,
    numAboveAverage: scores.filter(score => score >= 60).length,
    schoolAverageForSubject: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
  }));

  const overallGenderStatsForSchoolUI: AggregatedSchoolGenderStatForUI[] = Array.from(schoolGenderMap.entries()).map(([gender, data]) => ({
    gender,
    count: data.count,
    averageScore: data.scores.length > 0 ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2)) : null,
  }));
  
  return {
    overallSchoolAverage,
    totalStudentsInSchool,
    numberOfClassesRepresented,
    classSummariesForUI,
    overallSubjectStatsForSchoolUI,
    overallGenderStatsForSchoolUI,
  };
}


export default function SchoolPerformanceDashboard({
  isOpen,
  onOpenChange,
  allReports,
  schoolNameProp,
  academicTermProp,
}: SchoolPerformanceDashboardProps) {
  const [schoolStats, setSchoolStats] = useState<SchoolStatistics | null>(null);
  const [aiSchoolAdvice, setAiSchoolAdvice] = useState<GenerateSchoolInsightsOutput | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingAi, startAiTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && allReports.length > 0) {
      setIsLoadingStats(true);
      const newStats = aggregateSchoolData(allReports);
      setSchoolStats(newStats);
      setIsLoadingStats(false);

      if (newStats) {
        setAiSchoolAdvice(null); 
        startAiTransition(async () => {
          try {
            const aiInput: GenerateSchoolInsightsInput = {
              schoolName: schoolNameProp,
              academicTerm: academicTermProp,
              overallSchoolAverage: newStats.overallSchoolAverage,
              totalStudentsInSchool: newStats.totalStudentsInSchool,
              numberOfClassesRepresented: newStats.numberOfClassesRepresented,
              classSummaries: newStats.classSummariesForUI.map(cs => ({
                  className: cs.className,
                  classAverage: cs.classAverage,
                  numberOfStudents: cs.numberOfStudents
              })),
              overallSubjectStatsForSchool: newStats.overallSubjectStatsForSchoolUI.map(s => ({...s})),
              overallGenderStatsForSchool: newStats.overallGenderStatsForSchoolUI.map(g => ({...g})),
            };
            const result = await getAiSchoolInsightsAction(aiInput);
            if (result.success && result.insights) {
              setAiSchoolAdvice(result.insights);
            } else {
              setAiSchoolAdvice(null); 
              toast({ title: "AI School Insights Error", description: result.error || "Failed to load AI school insights.", variant: "destructive" });
            }
          } catch (error) {
            setAiSchoolAdvice(null);
            console.error("Client-side error during AI school insights fetch:", error);
            toast({ title: "AI School Insights Request Failed", description: `Client error: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
          }
        });
      }
    } else if (isOpen && allReports.length === 0) {
      setSchoolStats(null);
      setAiSchoolAdvice(null);
      setIsLoadingStats(false);
    }
  }, [isOpen, allReports, schoolNameProp, academicTermProp, toast]); 

  const handlePrint = () => {
    if (!schoolStats || allReports.length === 0) {
      toast({title: "Nothing to Print", description: "School dashboard data is not available.", variant: "destructive"});
      return;
    }
    window.print();
  };

  const schoolSubjectPerformanceChartData = useMemo(() => {
    return schoolStats?.overallSubjectStatsForSchoolUI.map(s => ({
      name: s.subjectName,
      'Below Average (<40%)': s.numBelowAverage,
      'Average (40-59%)': s.numAverage,
      'Above Average (>=60%)': s.numAboveAverage,
    })) || [];
  }, [schoolStats]);

  const schoolGenderChartData = useMemo(() => {
    return schoolStats?.overallGenderStatsForSchoolUI.map(g => ({
      name: g.gender,
      value: g.count,
    })) || [];
  }, [schoolStats]);
  const GENDER_COLORS = ['#0088FE', '#FF8042', '#FFBB28', '#00C49F', '#AF19FF'];

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background/90 border rounded-md shadow-lg backdrop-blur-sm text-xs">
          <p className="label font-semibold text-foreground">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="capitalize">
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

 const renderAiSchoolInsights = () => {
    if (isLoadingAi && !aiSchoolAdvice) {
      return (
        <CardContent className="pt-4 flex items-center justify-center text-accent-foreground/80">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Generating AI school-level insights...
        </CardContent>
      );
    }
    if (!aiSchoolAdvice && !isLoadingAi && schoolStats && allReports.length > 0) {
      return (
        <CardContent className="pt-4 text-accent-foreground/90">
          <div className="flex items-start p-4 bg-destructive/10 border border-destructive/30 rounded-md">
            <AlertTriangle className="mr-3 h-6 w-6 text-destructive shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-destructive">AI School Insights Unavailable</p>
              <p className="text-sm mt-1">The AI insights for the school could not be generated. Please ensure your <code className="bg-destructive/20 px-1 rounded text-xs font-mono">GOOGLE_API_KEY</code> is correctly set up and check server console logs for specific errors.</p>
            </div>
          </div>
        </CardContent>
      );
    }
    if (aiSchoolAdvice) {
       const { overallSchoolAssessment, keyStrengthsSchoolWide, areasForConcernSchoolWide, actionableAdviceForSchool, interClassObservations } = aiSchoolAdvice;
       const hasContent = (overallSchoolAssessment && overallSchoolAssessment.trim() !== '') || 
                          (keyStrengthsSchoolWide && keyStrengthsSchoolWide.length > 0 && keyStrengthsSchoolWide.some(s => s.trim() !== '')) || 
                          (areasForConcernSchoolWide && areasForConcernSchoolWide.length > 0 && areasForConcernSchoolWide.some(a => a.trim() !== '')) || 
                          (actionableAdviceForSchool && actionableAdviceForSchool.length > 0 && actionableAdviceForSchool.some(ad => ad.trim() !== '')) ||
                          (interClassObservations && interClassObservations.length > 0 && interClassObservations.some(obs => obs.trim() !== ''));

       if (!hasContent) {
        return (
            <CardContent className="pt-4 text-accent-foreground/80">
                 <div className="flex items-center p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                    <Info className="mr-2 h-5 w-5 text-blue-400 shrink-0" />
                    <span className="text-sm">AI analysis complete. No specific school-wide points were raised by the AI for the provided data.</span>
                </div>
            </CardContent>
        );
       }

      return (
        <CardContent className="pt-4 space-y-3 text-sm text-accent-foreground">
          {overallSchoolAssessment && overallSchoolAssessment.trim() !== '' && (
            <div>
              <h4 className="font-semibold text-green-600 dark:text-green-500">Overall School Assessment:</h4>
              <p className="pl-2 whitespace-pre-wrap">{overallSchoolAssessment}</p>
            </div>
          )}
          {keyStrengthsSchoolWide && keyStrengthsSchoolWide.length > 0 && keyStrengthsSchoolWide.some(s => s.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-green-600 dark:text-green-500">Key Strengths (School-Wide):</h4>
              <ul className="list-disc list-inside pl-2 whitespace-pre-wrap">
                {keyStrengthsSchoolWide.filter(s => s.trim() !== '').map((s, i) => <li key={`sch-strength-${i}`}>{s}</li>)}
              </ul>
            </div>
          )}
          {areasForConcernSchoolWide && areasForConcernSchoolWide.length > 0 && areasForConcernSchoolWide.some(a => a.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-yellow-600 dark:text-yellow-500">Areas for Concern (School-Wide):</h4>
              <ul className="list-disc list-inside pl-2 whitespace-pre-wrap">
                {areasForConcernSchoolWide.filter(a => a.trim() !== '').map((a, i) => <li key={`sch-concern-${i}`}>{a}</li>)}
              </ul>
            </div>
          )}
          {actionableAdviceForSchool && actionableAdviceForSchool.length > 0 && actionableAdviceForSchool.some(ad => ad.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-blue-600 dark:text-blue-500">Actionable Advice for School Admin:</h4>
              <ul className="list-disc list-inside pl-2 whitespace-pre-wrap">
                {actionableAdviceForSchool.filter(adv => adv.trim() !== '').map((adv, i) => <li key={`sch-advice-${i}`}>{adv}</li>)}
              </ul>
            </div>
          )}
           {interClassObservations && interClassObservations.length > 0 && interClassObservations.some(obs => obs.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-purple-600 dark:text-purple-500">Inter-Class Observations:</h4>
              <ul className="list-disc list-inside pl-2 whitespace-pre-wrap">
                {interClassObservations.filter(obs => obs.trim() !== '').map((obs, i) => <li key={`sch-obs-${i}`}>{obs}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      );
    }
    return null;
  };


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        id="school-dashboard-dialog-content"
        className="max-w-5xl w-[95vw] h-[calc(100vh-4rem)] flex flex-col overflow-hidden"
      >
        <ShadcnDialogHeader className="w-full shrink-0 px-6 pt-6 pb-4 border-b bg-background sticky top-0 z-10">
          <ShadcnDialogTitle className="text-xl font-bold text-primary flex items-center">
            <Building className="mr-3 h-6 w-6" />
            School Performance Dashboard: {schoolNameProp}
          </ShadcnDialogTitle>
          <ShadcnDialogDescription className="text-xs text-muted-foreground pt-1">
            {academicTermProp} - Aggregated insights and statistics for the entire school.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        
        <div 
          data-testid="school-dashboard-inner-scroll-container"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-6 space-y-6"
        >
            <div id="school-dashboard-print-header" className="school-dashboard-print-header hidden print:block px-6 pt-6 pb-4 mb-4 border-b">
                <h2 className="text-xl font-bold">School Performance Dashboard: {schoolNameProp} ({academicTermProp})</h2>
                <p className="text-sm">Generated on: {new Date().toLocaleDateString()}</p>
            </div>

            {(isLoadingStats && !schoolStats) && (
              <Card className="shadow-md">
                <CardContent className="pt-6 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Aggregating school statistics...
                </CardContent>
              </Card>
            )}
            {allReports.length === 0 && !isLoadingStats && (
                 <Card className="shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><Info className="mr-2 h-5 w-5" />No Reports Available</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">There are no student reports to generate a school dashboard. Please add reports first.</p>
                    </CardContent>
                </Card>
            )}
            {!schoolStats && allReports.length > 0 && !isLoadingStats && (
                 <Card className="shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />Data Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Could not aggregate school statistics. Please check report data or try again.</p>
                    </CardContent>
                </Card>
            )}

            {schoolStats && (
              <>
                <Card className="shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><Sigma className="mr-2 h-5 w-5" />School-Wide Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Students</p>
                      <p className="font-semibold text-lg">{schoolStats.totalStudentsInSchool}</p>
                    </div>
                     <div>
                      <p className="text-muted-foreground">Classes Represented</p>
                      <p className="font-semibold text-lg">{schoolStats.numberOfClassesRepresented}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Overall School Average</p>
                      <p className="font-semibold text-lg">
                        {schoolStats.overallSchoolAverage !== null ? `${schoolStats.overallSchoolAverage.toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {schoolStats.classSummariesForUI.length > 0 && (
                    <Card className="shadow-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><Users className="mr-2 h-5 w-5 text-indigo-600" />Class Performance Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Table className="border rounded-md bg-card min-w-[500px]">
                                <ShadcnUITableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="font-semibold py-2 px-3">Class Name</TableHead>
                                        <TableHead className="text-center font-semibold py-2 px-3"># Students</TableHead>
                                        <TableHead className="text-center font-semibold py-2 px-3">Class Avg (%)</TableHead>
                                    </TableRow>
                                </ShadcnUITableHeader>
                                <TableBody>
                                    {schoolStats.classSummariesForUI.sort((a,b) => (b.classAverage || 0) - (a.classAverage || 0)).map(cs => (
                                        <TableRow key={cs.className}>
                                            <TableCell className="font-medium py-2 px-3">{cs.className}</TableCell>
                                            <TableCell className="text-center py-2 px-3">{cs.numberOfStudents}</TableCell>
                                            <TableCell className="text-center py-2 px-3">{cs.classAverage?.toFixed(1) || 'N/A'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {schoolStats.overallSubjectStatsForSchoolUI.length > 0 && (
                  <Card className="shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><BookOpen className="mr-2 h-5 w-5 text-green-600" />School-Wide Subject Performance</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground pt-1">Distribution of students based on score bands per subject across the entire school.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div data-testid="school-subject-barchart-container" className="h-[300px] min-w-[600px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={schoolSubjectPerformanceChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} interval={0} tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }} />
                            <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}} />
                            <Bar dataKey="Below Average (<40%)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={15} />
                            <Bar dataKey="Average (40-59%)" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} barSize={15} />
                            <Bar dataKey="Above Average (>=60%)" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={15} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                       <Table className="mt-6 border rounded-md bg-card min-w-[700px]">
                        <ShadcnUITableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-semibold py-2 px-3">Subject</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3">School Avg (%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-red-600 dark:text-red-400">Below Avg (&lt;40%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-blue-600 dark:text-blue-400">Average (40-59%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-green-600 dark:text-green-400">Above Avg (&ge;60%)</TableHead>
                          </TableRow>
                        </ShadcnUITableHeader>
                        <TableBody>
                          {schoolStats.overallSubjectStatsForSchoolUI.map(s => (
                            <TableRow key={s.subjectName}>
                              <TableCell className="font-medium py-2 px-3">{s.subjectName}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.schoolAverageForSubject?.toFixed(1) || 'N/A'}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.numBelowAverage}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.numAverage}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.numAboveAverage}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {schoolStats.overallGenderStatsForSchoolUI.length > 0 && (
                 <Card className="shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><LucidePieChart className="mr-2 h-5 w-5 text-purple-600" />School-Wide Gender Statistics</CardTitle>
                         <CardDescription className="text-xs text-muted-foreground pt-1">Distribution and average performance by gender across the school.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 grid md:grid-cols-2 gap-6 items-center">
                        <div data-testid="school-gender-piechart-container" className="h-[250px] min-w-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                            <Pie
                                data={schoolGenderChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
                                    const RADIAN = Math.PI / 180;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    if (percent * 100 < 5) return null; 
                                    return (
                                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="11px" fontWeight="medium">
                                        {`${name} (${(percent * 100).toFixed(0)}%)`}
                                    </text>
                                    );
                                }}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                            >
                                {schoolGenderChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}}/>
                            </RechartsPieChart>
                        </ResponsiveContainer>
                        </div>
                        <Table className="border rounded-md bg-card min-w-[300px]">
                        <ShadcnUITableHeader className="bg-muted/50">
                            <TableRow>
                            <TableHead className="font-semibold py-2 px-3">Gender</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3">Count</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3">Overall Avg (%)</TableHead>
                            </TableRow>
                        </ShadcnUITableHeader>
                        <TableBody>
                            {schoolStats.overallGenderStatsForSchoolUI.map(g => (
                            <TableRow key={g.gender}>
                                <TableCell className="font-medium py-2 px-3">{g.gender}</TableCell>
                                <TableCell className="text-center py-2 px-3">{g.count}</TableCell>
                                <TableCell className="text-center py-2 px-3">{g.averageScore?.toFixed(1) || 'N/A'}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </CardContent>
                    </Card>
                )}
                
                <Card className={cn("shadow-md bg-accent/10 border border-accent/30 dark:border-accent/50")}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center">
                        {isLoadingAi && !aiSchoolAdvice ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> : <Brain className="mr-2 h-5 w-5 text-green-600" /> }
                        AI School-Level Insights &amp; Advice
                    </CardTitle>
                  </CardHeader>
                  {renderAiSchoolInsights()}
                </Card>
              </>
            )}
          </div>

        <ShadcnDialogFooter className="w-full shrink-0 border-t px-6 pb-6 pt-4 bg-background sticky bottom-0 z-10 dialog-footer-print-hide">
          <Button variant="outline" onClick={handlePrint} disabled={!schoolStats || allReports.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print School Dashboard
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </ShadcnDialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
