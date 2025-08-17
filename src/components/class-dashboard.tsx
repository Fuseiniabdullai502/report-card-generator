

'use client';

import React, { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
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
import { BarChart3, Users, TrendingUp, PieChart as LucidePieChart, Brain, Printer, Loader2, AlertTriangle, Info, FolderDown, History, RefreshCw, Trophy } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart as RechartsPieChart, Pie, Cell, type TooltipProps } from 'recharts';
import { getAiClassInsightsAction } from '@/app/actions';
import type { GenerateClassInsightsOutput, GenerateClassInsightsInput } from '@/ai/flows/generate-class-insights-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateSubjectFinalMark, calculateOverallAverage } from '@/lib/calculations';
import Image from 'next/image';


interface ClassPerformanceDashboardProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allReports: ReportData[];
  availableClasses: string[];
  initialClassName: string;
  schoolNameProp: string;
  academicYearProp: string;
}

interface SubjectPerformanceStatForUI {
  subjectName: string;
  numBelowAverage: number;
  numAverage: number;
  numAboveAverage: number;
  classAverageForSubject: number | null;
}

interface GenderPerformanceStatForUI {
  gender: string;
  count: number;
  averageScore: number | null;
}

export interface ClassStatistics {
  overallClassAverage: number | null;
  totalStudents: number;
  subjectStats: SubjectPerformanceStatForUI[];
  genderStats: GenderPerformanceStatForUI[];
}

interface HistoricalTermData {
    term: string;
    numStudents: number;
    classAverage: number | null;
}

export default function ClassPerformanceDashboard({
  isOpen,
  onOpenChange,
  allReports,
  availableClasses,
  initialClassName,
  schoolNameProp,
  academicYearProp,
}: ClassPerformanceDashboardProps) {
  const [selectedClass, setSelectedClass] = useState(initialClassName);
  const [classStats, setClassStats] = useState<ClassStatistics | null>(null);
  const [rankedStudents, setRankedStudents] = useState<ReportData[]>([]);
  const [aiAdvice, setAiAdvice] = useState<GenerateClassInsightsOutput | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingAi, startAiTransition] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);
  const { toast } = useToast();

  const [mostRecentTerm, setMostRecentTerm] = useState<string>('');
  const [historicalData, setHistoricalData] = useState<HistoricalTermData[]>([]);


  const handlePrint = (printType: 'dashboard' | 'rankings') => {
    if (reportsForClass.length === 0) {
      toast({
        title: "Nothing to Print",
        description: "Dashboard or ranking data is not available.",
        variant: "destructive",
      });
      return;
    }

    const body = document.body;
    body.classList.add('dashboard-printing-active');
    
    if (printType === 'rankings') {
        body.setAttribute('data-print-target', 'rankings');
    } else {
        body.setAttribute('data-print-target', 'dashboard');
    }

    setTimeout(() => {
      window.print();
      body.classList.remove('dashboard-printing-active');
      body.removeAttribute('data-print-target');
    }, 300);
  };


  useEffect(() => {
    if (isOpen) {
      const validInitial = availableClasses.includes(initialClassName) && initialClassName;
      const defaultClass = availableClasses[0] || '';
      setSelectedClass(validInitial || defaultClass);
    }
  }, [isOpen, initialClassName, availableClasses]);

  const reportsForClass = useMemo(() => {
    return allReports.filter(report => report.className === selectedClass);
  }, [allReports, selectedClass]);
  
  const fetchAiInsights = useCallback(async () => {
    if (!classStats || !selectedClass || !mostRecentTerm) {
      return;
    }

    setAiAdvice(null);
    setAiError(null);
    startAiTransition(async () => {
      try {
        const sanitizedAiInput: GenerateClassInsightsInput = {
          className: selectedClass,
          academicTerm: mostRecentTerm,
          overallClassAverage: classStats.overallClassAverage ?? null,
          totalStudents: classStats.totalStudents,
          subjectStats: classStats.subjectStats
            .filter(s => s.subjectName.trim() !== '')
            .map(s => ({
              ...s,
              classAverageForSubject: s.classAverageForSubject ?? null,
            })),
          genderStats: classStats.genderStats.map(g => ({
            ...g,
            averageScore: g.averageScore ?? null,
          })),
        };
        
        const result = await getAiClassInsightsAction(sanitizedAiInput);
        if (result.success && result.insights) {
          setAiAdvice(result.insights);
        } else {
          const errorMessage = result.error || "An unknown error occurred while generating insights.";
          setAiError(errorMessage);
          toast({ title: "AI Insights Error", description: errorMessage, variant: "destructive" });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setAiError(errorMessage);
        toast({ 
          title: "AI Insights Request Failed", 
          description: `A client-side error occurred: ${errorMessage}. Please check the browser console.`, 
          variant: "destructive" 
        });
      }
    });
  }, [classStats, selectedClass, mostRecentTerm, toast]);

  // Effect for calculating statistics when the class or reports change
  useEffect(() => {
    if (!isOpen || reportsForClass.length === 0) {
      setClassStats(null);
      setMostRecentTerm('');
      setHistoricalData([]);
      setRankedStudents([]);
      setAiAdvice(null);
      setAiError(null);
      return;
    }

    setIsLoadingStats(true);

    const reportsByTerm = new Map<string, ReportData[]>();
    reportsForClass.forEach(report => {
        const term = report.academicTerm || 'Unknown Term';
        if (!reportsByTerm.has(term)) {
            reportsByTerm.set(term, []);
        }
        reportsByTerm.get(term)!.push(report);
    });

    const termOrder = ["First Term", "Second Term", "Third Term", "First Semester", "Second Semester"];
    const sortedTerms = Array.from(reportsByTerm.keys()).sort((a, b) => {
        const indexA = termOrder.indexOf(a);
        const indexB = termOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    const newMostRecentTerm = sortedTerms[sortedTerms.length - 1] || '';
    setMostRecentTerm(newMostRecentTerm);
    
    const reports = reportsByTerm.get(newMostRecentTerm) || [];
    const sortedStudents = [...reports].sort((a, b) => (b.overallAverage ?? -1) - (a.overallAverage ?? -1));
    setRankedStudents(sortedStudents);

    const totalStudents = reports.length;

    const validOverallAverages = reports
      .map(r => r.overallAverage)
      .filter(avg => avg !== undefined && avg !== null && !Number.isNaN(avg)) as number[];
      
    const overallClassAverage = validOverallAverages.length > 0 
      ? parseFloat((validOverallAverages.reduce((a, b) => a + b, 0) / validOverallAverages.length).toFixed(2)) 
      : null;

    const subjectMap: Map<string, { scores: number[] }> = new Map();
    reports.forEach(report => {
      (report.subjects ?? []).forEach(subject => {
        if (subject.subjectName && subject.subjectName.trim() !== '') {
          const finalMark = calculateSubjectFinalMark(subject);
          if (finalMark !== null && !Number.isNaN(finalMark)) {
            if (!subjectMap.has(subject.subjectName)) {
              subjectMap.set(subject.subjectName, { scores: [] });
            }
            subjectMap.get(subject.subjectName)!.scores.push(finalMark);
          }
        }
      });
    });

    const subjectStats: SubjectPerformanceStatForUI[] = Array.from(subjectMap.entries()).map(([subjectName, data]) => {
      const validScores = data.scores.filter(s => s !== null && !Number.isNaN(s));
      const subjectAvg = validScores.length > 0 ? parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)) : null;
      return {
        subjectName,
        numBelowAverage: validScores.filter(score => score < 40).length,
        numAverage: validScores.filter(score => score >= 40 && score < 60).length,
        numAboveAverage: validScores.filter(score => score >= 60).length,
        classAverageForSubject: subjectAvg,
      };
    });

    const genderMap: Map<string, { scores: number[]; count: number }> = new Map();
    reports.forEach(report => {
      const gender = report.gender || 'Unknown';
      if (!genderMap.has(gender)) {
          genderMap.set(gender, { scores: [], count: 0 });
      }
      if (report.overallAverage !== undefined && report.overallAverage !== null && !Number.isNaN(report.overallAverage)) {
          genderMap.get(gender)!.scores.push(report.overallAverage);
      }
      genderMap.get(gender)!.count++;
    });
    
    const genderStats: GenderPerformanceStatForUI[] = Array.from(genderMap.entries()).map(([gender, data]) => {
      const validScores = data.scores.filter(s => s !== null && !Number.isNaN(s));
      return {
          gender,
          count: data.count,
          averageScore: validScores.length > 0 ? parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)) : null,
      };
    });

    const newStats = { overallClassAverage, totalStudents, subjectStats, genderStats };
    setClassStats(newStats);
    setIsLoadingStats(false);
    
    const newHistoricalData = sortedTerms.map(term => {
        const termReports = reportsByTerm.get(term)!;
        const avg = calculateOverallAverage(termReports.flatMap(r => r.subjects ?? []));
        return {
            term,
            numStudents: termReports.length,
            classAverage: avg
        };
    });
    setHistoricalData(newHistoricalData);
  }, [isOpen, reportsForClass]);

  const subjectPerformanceChartData = useMemo(() => {
    return classStats?.subjectStats.map(s => ({
      name: s.subjectName,
      'Below Average (<40%)': s.numBelowAverage,
      'Average (40-59%)': s.numAverage,
      'Above Average (>=60%)': s.numAboveAverage,
    })) || [];
  }, [classStats]);

  const genderChartData = useMemo(() => {
    return classStats?.genderStats.map(g => ({
      name: g.gender,
      value: g.count,
    })) || [];
  }, [classStats]);
  const GENDER_COLORS = ['#0088FE', '#FF8042', '#FFBB28', '#00C49F', '#AF19FF'];


  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && Array.isArray(payload) && payload.length) {
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

 const renderAiInsights = () => {
    if (isLoadingAi && !aiAdvice && !aiError) {
      return (
        <CardContent className="pt-4 flex items-center justify-center text-accent-foreground/80">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Generating pedagogical insights...
        </CardContent>
      );
    }
    if (aiError) {
      return (
        <CardContent className="pt-4 text-accent-foreground/90">
          <div className="flex items-start p-4 bg-destructive/10 border border-destructive/30 rounded-md">
            <AlertTriangle className="mr-3 h-6 w-6 text-destructive shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-destructive">Insights Unavailable</p>
              <p className="text-sm mt-1">The AI failed to generate insights. The error was:</p>
              <pre className="mt-2 p-2 bg-destructive/20 rounded text-xs font-mono whitespace-pre-wrap">
                  {aiError}
              </pre>
               <p className="text-sm mt-2">
                  <strong>Troubleshooting Steps:</strong>
              </p>
              <ol className="text-sm list-decimal list-inside mt-1 space-y-1">
                  <li>Ensure your <strong>GOOGLE_API_KEY</strong> in the <code>.env.local</code> file is correct and saved.</li>
                  <li>This error often means the API key must be linked to a Google Cloud project with billing enabled.</li>
                  <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-primary">Google AI Studio</a>, create a new key, and associate it with a Cloud project. You may need to enable the <strong>Generative Language API</strong> or <strong>Vertex AI API</strong> in that project.</li>
                  <li>Google provides a free tier, so you are unlikely to be charged for development usage.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      );
    }
    if (aiAdvice) {
       const { overallAssessment, strengths, areasForConcern, actionableAdvice } = aiAdvice;
       const hasContent = (overallAssessment && overallAssessment.trim() !== '') || 
                          (strengths && strengths.length > 0 && strengths.some(s => s.trim() !== '')) || 
                          (areasForConcern && areasForConcern.length > 0 && areasForConcern.some(a => a.trim() !== '')) || 
                          (actionableAdvice && actionableAdvice.length > 0 && actionableAdvice.some(ad => ad.trim() !== ''));

       if (!hasContent) {
        return (
            <CardContent className="pt-4 text-accent-foreground/80">
                 <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                    <div className="flex items-center">
                        <Info className="mr-2 h-5 w-5 text-blue-400 shrink-0" />
                        <span className="text-sm">Analysis complete. No specific points were raised by the AI for the provided data.</span>
                    </div>
                     <p className="text-xs text-muted-foreground mt-2">
                        <strong>Note:</strong> This usually means the AI didn't detect any statistically significant trends or patterns in the class data.
                    </p>
                </div>
            </CardContent>
        );
       }

      return (
        <CardContent className="pt-4 space-y-3 text-sm text-accent-foreground">
          {overallAssessment && overallAssessment.trim() !== '' && (
            <div>
              <h4 className="font-semibold text-green-500 dark:text-green-400">Overall Assessment:</h4>
              <p className="pl-2 whitespace-pre-wrap">{overallAssessment}</p>
            </div>
          )}
          {strengths && strengths.length > 0 && strengths.some(s => s.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-green-500 dark:text-green-400">Key Strengths:</h4>
              <ul className="list-disc list-inside pl-2 whitespace-pre-wrap">
                {strengths.filter(s => s.trim() !== '').map((s, i) => <li key={`strength-${i}`}>{s}</li>)}
              </ul>
            </div>
          )}
          {areasForConcern && areasForConcern.length > 0 && areasForConcern.some(a => a.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-yellow-500 dark:text-yellow-400">Areas for Concern:</h4>
              <ul className="list-disc list-inside pl-2 whitespace-pre-wrap">
                {areasForConcern.filter(a => a.trim() !== '').map((a, i) => <li key={`concern-${i}`}>{a}</li>)}
              </ul>
            </div>
          )}
          {actionableAdvice && actionableAdvice.length > 0 && actionableAdvice.some(ad => ad.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-blue-500 dark:text-blue-400">Actionable Advice for Teacher:</h4>
              <ul className="list-disc list-inside pl-2 whitespace-pre-wrap">
                {actionableAdvice.filter(adv => adv.trim() !== '').map((adv, i) => <li key={`advice-${i}`}>{adv}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      );
    }
    return (
      <CardContent className="pt-4">
        <Button onClick={fetchAiInsights} disabled={!classStats || isLoadingAi}>
          {isLoadingAi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
           Generate AI Insights
        </Button>
      </CardContent>
    );
  };


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        id="class-dashboard-dialog-content"
        className="max-w-7xl w-[95vw] h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-gray-100/80 dark:bg-gray-800/80 p-0"
      >
        <ShadcnDialogHeader className="w-full shrink-0 px-4 py-3 border-b bg-background sticky top-0 z-10 dialog-header-print-hide">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <ShadcnDialogTitle className="text-xl font-bold text-primary flex items-center">
              <BarChart3 className="mr-3 h-6 w-6" />
              Class Dashboard: {schoolNameProp}
            </ShadcnDialogTitle>
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={availableClasses.length === 0}>
              <SelectTrigger className="w-full sm:w-[250px]" title="Select a class to view its dashboard">
                  <div className="flex items-center gap-2">
                      <FolderDown className="h-4 w-4 text-primary" />
                      <SelectValue placeholder="Select a class..." />
                  </div>
              </SelectTrigger>
              <SelectContent>
                  {availableClasses.map(cls => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                  {availableClasses.length === 0 && <SelectItem value="" disabled>No classes available</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <ShadcnDialogDescription className="text-xs text-muted-foreground pt-1">
            {selectedClass ? `Analysis for ${selectedClass} (${academicYearProp}, ${mostRecentTerm || 'Latest Term'})` : "Select a class to view its dashboard"}
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        
        <div
          data-testid="dashboard-inner-scroll-container"
          className="flex-1 min-h-0 overflow-y-auto p-4"
        >
          <div className="a4-page-simulation space-y-6 relative">
             {/* Watermark */}
            {schoolNameProp && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden watermark-container">
                  <p 
                    className="font-bold text-gray-500/5 dark:text-gray-400/5 transform -rotate-45 select-none"
                    style={{
                        fontSize: 'clamp(2rem, 15vw, 8rem)',
                        lineHeight: '1.2',
                        wordBreak: 'break-word',
                    }}
                  >
                      {schoolNameProp}
                  </p>
              </div>
            )}
            
            <div className="relative z-10">
              <div className="dashboard-print-header">
                  <div className="flex justify-center mb-2">
                      <Image src="https://upload.wikimedia.org/wikipedia/commons/5/59/Coat_of_arms_of_Ghana.svg" alt="Ghana Coat of Arms" width={60} height={60} />
                  </div>
                  <h2 className="text-xl font-bold">{schoolNameProp} - Class Performance: {selectedClass}</h2>
                  <p className="text-sm">{academicYearProp} - {mostRecentTerm} | Generated on: {new Date().toLocaleDateString()}</p>
              </div>
              <div className="ranking-print-header">
                  <div className="flex justify-center mb-2">
                      <Image src="https://upload.wikimedia.org/wikipedia/commons/5/59/Coat_of_arms_of_Ghana.svg" alt="Ghana Coat of Arms" width={60} height={60} />
                  </div>
                  <h2 className="text-xl font-bold">{schoolNameProp} - Student Ranking: {selectedClass}</h2>
                  <p className="text-sm">{academicYearProp} - {mostRecentTerm} | Generated on: {new Date().toLocaleDateString()}</p>
              </div>

              {(isLoadingStats && !classStats) && (
                <Card className="shadow-md">
                  <CardContent className="pt-6 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating class statistics...
                  </CardContent>
                </Card>
              )}
              {reportsForClass.length === 0 && !isLoadingStats && (
                  <Card className="shadow-md">
                      <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><Info className="mr-2 h-5 w-5" />No Reports Available</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <p className="text-muted-foreground">There are no student reports for class '{selectedClass}' to generate a dashboard. Please add reports or select a different class.</p>
                      </CardContent>
                  </Card>
              )}
              {!classStats && reportsForClass.length > 0 && !isLoadingStats && (
                  <Card className="shadow-md">
                      <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />Data Error</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <p className="text-muted-foreground">Could not calculate class statistics for the most recent term. Please check report data or try again.</p>
                      </CardContent>
                  </Card>
              )}

              {classStats && (
                <>
                  <Card className="shadow-md print-hide-on-rankings">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><Users className="mr-2 h-5 w-5" />Overall Snapshot ({mostRecentTerm})</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Students</p>
                        <p className="font-semibold text-lg">{classStats.totalStudents}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Overall Class Average</p>
                        <p className="font-semibold text-lg">
                          {classStats.overallClassAverage !== null ? `${classStats.overallClassAverage.toFixed(2)}%` : 'N/A'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md student-ranking-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <CardTitle className="text-lg font-semibold text-primary flex items-center">
                          <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
                          Student Ranking ({mostRecentTerm})
                        </CardTitle>
                        <Button variant="outline" size="sm" className="no-print" onClick={() => handlePrint('rankings')}>
                            <Printer className="mr-2 h-4 w-4" /> Print Rankings
                        </Button>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground pt-1 no-print">
                        Students in this class ranked by their overall average for the term.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <Table className="border rounded-md min-w-[500px]">
                            <ShadcnUITableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-semibold w-[80px]">Rank</TableHead>
                                    <TableHead className="font-semibold">Student Name</TableHead>
                                    <TableHead className="text-right font-semibold">Average (%)</TableHead>
                                </TableRow>
                            </ShadcnUITableHeader>
                            <TableBody className="table-body-rankings">
                                {rankedStudents.map((student) => (
                                    <TableRow key={student.id}>
                                        <TableCell className="font-bold text-lg">{student.rank || 'N/A'}</TableCell>
                                        <TableCell>{student.studentName}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {student.overallAverage !== undefined && student.overallAverage !== null ? student.overallAverage.toFixed(2) : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                  </Card>

                  {historicalData.length > 1 && (
                      <Card className="shadow-md print-hide-on-rankings">
                          <CardHeader className="pb-3">
                              <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><History className="mr-2 h-5 w-5"/>Term-over-Term Comparison</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                              <Table className="border rounded-md min-w-[500px]">
                                  <ShadcnUITableHeader className="bg-muted/50">
                                      <TableRow>
                                          <TableHead className="font-semibold">Term</TableHead>
                                          <TableHead className="text-center font-semibold"># Students</TableHead>
                                          <TableHead className="text-center font-semibold">Class Average (%)</TableHead>
                                      </TableRow>
                                  </ShadcnUITableHeader>
                                  <TableBody>
                                      {historicalData.map(data => (
                                          <TableRow key={data.term}>
                                              <TableCell className="font-medium">{data.term}</TableCell>
                                              <TableCell className="text-center">{data.numStudents}</TableCell>
                                              <TableCell className="text-center">{data.classAverage?.toFixed(1) ?? 'N/A'}</TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </CardContent>
                      </Card>
                  )}

                  {classStats.subjectStats.length > 0 && (
                    <Card className="shadow-md print-hide-on-rankings">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-green-600" />Subject Performance ({mostRecentTerm})</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground pt-1">Distribution of students based on score bands per subject (Below Average &lt;40%, Average 40-59%, Above Average &ge;60%).</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div data-testid="subject-barchart-container" className="h-[300px] min-w-[500px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectPerformanceChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                              <XAxis 
                                dataKey="name" 
                                angle={-35} 
                                textAnchor="end" 
                                height={80} 
                                interval={0} 
                                tick={{ fontSize: 10 }}
                                tickFormatter={(name) => name.length > 12 ? `${name.slice(0, 12)}…` : name}
                              />
                              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }} />
                              <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}} />
                              <Bar dataKey="Below Average (<40%)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={15} />
                              <Bar dataKey="Average (40-59%)" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} barSize={15} />
                              <Bar dataKey="Above Average (>=60%)" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={15} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <Table className="mt-6 border rounded-md min-w-[700px] bg-card">
                          <ShadcnUITableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="font-semibold py-2 px-3">Subject</TableHead>
                              <TableHead className="text-center font-semibold py-2 px-3">Class Avg (%)</TableHead>
                              <TableHead className="text-center font-semibold py-2 px-3 text-red-600 dark:text-red-400">Below Avg (&lt;40%)</TableHead>
                              <TableHead className="text-center font-semibold py-2 px-3 text-blue-600 dark:text-blue-400">Average (40-59%)</TableHead>
                              <TableHead className="text-center font-semibold py-2 px-3 text-green-600 dark:text-green-400">Above Avg (&ge;60%)</TableHead>
                            </TableRow>
                          </ShadcnUITableHeader>
                          <TableBody>
                            {classStats.subjectStats.map(s => (
                              <TableRow key={s.subjectName}>
                                <TableCell className="font-medium py-2 px-3">{s.subjectName}</TableCell>
                                <TableCell className="text-center py-2 px-3">{s.classAverageForSubject?.toFixed(1) || 'N/A'}</TableCell>
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

                  {classStats.genderStats.length > 0 && (
                  <Card className="shadow-md print-hide-on-rankings">
                      <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><LucidePieChart className="mr-2 h-5 w-5 text-purple-600" />Gender Statistics ({mostRecentTerm})</CardTitle>
                          <CardDescription className="text-xs text-muted-foreground pt-1">Distribution and average performance by gender.</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4 grid md:grid-cols-2 gap-6 items-center">
                          <div data-testid="gender-piechart-container" className="h-[250px] min-w-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <RechartsPieChart>
                              <Pie
                                  data={genderChartData}
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
                                  {genderChartData.map((entry, index) => (
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
                              {classStats.genderStats.map(g => (
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
                  
                  <Card className={cn("shadow-md bg-accent/10 border border-accent/30 dark:border-accent/50 print-hide-on-rankings")}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <CardTitle className="text-lg font-semibold text-primary flex items-center">
                            {isLoadingAi && !aiAdvice ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> : <Brain className="mr-2 h-5 w-5 text-green-600" /> }
                            Pedagogical Insights &amp; Advice ({mostRecentTerm})
                        </CardTitle>
                        
                          <Button variant="outline" size="sm" onClick={fetchAiInsights} disabled={isLoadingAi || !classStats}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingAi ? 'animate-spin' : ''}`} />
                            {aiAdvice ? 'Regenerate' : 'Generate'}
                          </Button>
                        
                      </div>
                    </CardHeader>
                    {renderAiInsights()}
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>

        <ShadcnDialogFooter className="w-full shrink-0 border-t px-4 py-3 bg-background sticky bottom-0 z-10 dialog-footer-print-hide flex flex-row justify-end space-x-2">
          <Button variant="outline" onClick={() => handlePrint('dashboard')} disabled={!classStats || reportsForClass.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Dashboard
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </ShadcnDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
