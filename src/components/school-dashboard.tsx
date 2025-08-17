

'use client';

import React, { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import type { ReportData } from '@/lib/schemas';
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
import { Building, Users, TrendingUp, PieChart as LucidePieChart, Brain, Printer, Loader2, AlertTriangle, Info, BookOpen, Sigma, History, RefreshCw, Trophy } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart as RechartsPieChart, Pie, Cell, type TooltipProps } from 'recharts';
import { getAiSchoolInsightsAction } from '@/app/actions';
import type { GenerateSchoolInsightsOutput, GenerateSchoolInsightsInput } from '@/ai/flows/generate-school-insights-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateSubjectFinalMark, calculateOverallAverage } from '@/lib/calculations';
import Image from 'next/image';
import type { CustomUser } from './auth-provider';

interface SchoolPerformanceDashboardProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allReports: ReportData[];
  schoolNameProp: string;
  academicYearProp: string;
  userRole: CustomUser['role'];
}

interface HistoricalSchoolTermData {
    term: string;
    numStudents: number;
    numClasses: number;
    schoolAverage: number | null;
}

interface SchoolStatistics {
  overallSchoolAverage: number | null;
  totalStudentsInSchool: number;
  numberOfClassesRepresented: number;
  classSummariesForUI: Array<{ className: string; numberOfStudents: number; classAverage: number | null }>;
  overallSubjectStatsForSchoolUI: Array<{ subjectName: string; numBelowAverage: number; numAverage: number; numAboveAverage: number; schoolAverageForSubject: number | null; }>;
  overallGenderStatsForSchoolUI: Array<{ gender: string; count: number; averageScore: number | null; }>;
}

interface SchoolRankData {
    schoolName: string;
    studentCount: number;
    average: number;
    rank: string;
}

export default function SchoolPerformanceDashboard({
  isOpen,
  onOpenChange,
  allReports,
  schoolNameProp,
  academicYearProp,
  userRole,
}: SchoolPerformanceDashboardProps) {
  const [schoolStats, setSchoolStats] = useState<SchoolStatistics | null>(null);
  const [aiSchoolAdvice, setAiSchoolAdvice] = useState<GenerateSchoolInsightsOutput | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingAi, startAiTransition] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [mostRecentTerm, setMostRecentTerm] = useState<string>('');
  const [historicalData, setHistoricalData] = useState<HistoricalSchoolTermData[]>([]);
  const [rankedSchools, setRankedSchools] = useState<SchoolRankData[]>([]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('school-dashboard-is-open');
    } else {
      document.body.classList.remove('school-dashboard-is-open');
    }
    return () => {
      document.body.classList.remove('school-dashboard-is-open');
    };
  }, [isOpen]);

  const fetchSchoolAiInsights = useCallback(async () => {
    if (!schoolStats) {
      return;
    }

    setAiSchoolAdvice(null);
    setAiError(null);
    startAiTransition(async () => {
      try {
        const sanitizedAiInput: GenerateSchoolInsightsInput = {
          schoolName: schoolNameProp,
          academicTerm: mostRecentTerm,
          overallSchoolAverage: schoolStats.overallSchoolAverage ?? null,
          totalStudentsInSchool: schoolStats.totalStudentsInSchool,
          numberOfClassesRepresented: schoolStats.numberOfClassesRepresented,
          classSummaries: schoolStats.classSummariesForUI.map(cs => ({
            className: cs.className,
            classAverage: cs.classAverage ?? null,
            numberOfStudents: cs.numberOfStudents,
          })),
          overallSubjectStatsForSchool: schoolStats.overallSubjectStatsForSchoolUI.map(s => ({
            ...s,
            schoolAverageForSubject: s.schoolAverageForSubject ?? null,
          })),
          overallGenderStatsForSchool: schoolStats.overallGenderStatsForSchoolUI.map(g => ({
            ...g,
            averageScore: g.averageScore ?? null,
          })),
        };

        const result = await getAiSchoolInsightsAction(sanitizedAiInput);
        if (result.success && result.insights) {
          setAiSchoolAdvice(result.insights);
        } else {
          const errorMessage = result.error || "An unknown error occurred while generating school insights.";
          setAiError(errorMessage);
          toast({ title: "AI School Insights Error", description: errorMessage, variant: "destructive" });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setAiError(errorMessage);
        toast({ title: "AI School Insights Request Failed", description: `Client error: ${errorMessage}`, variant: "destructive" });
      }
    });
  }, [schoolStats, schoolNameProp, mostRecentTerm, toast]);

  useEffect(() => {
    if (!isOpen || allReports.length === 0) {
      setSchoolStats(null);
      setAiSchoolAdvice(null);
      setAiError(null);
      setMostRecentTerm('');
      setHistoricalData([]);
      setRankedSchools([]);
      return;
    }

    setIsLoadingStats(true);

    const reportsByTerm = new Map<string, ReportData[]>();
    allReports.forEach(report => {
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

    const reportsForCurrentTerm = reportsByTerm.get(newMostRecentTerm) || [];
    
    const newStats = aggregateSchoolDataForTerm(reportsForCurrentTerm);
    setSchoolStats(newStats);
    setIsLoadingStats(false);
    
    const newHistoricalData = sortedTerms.map(term => {
        const termReports = reportsByTerm.get(term)!;
        const avg = calculateOverallAverage(termReports.flatMap(r => r.subjects));
        const numClasses = new Set(termReports.map(r => r.className)).size;
        return {
            term: term,
            numStudents: termReports.length,
            numClasses: numClasses,
            schoolAverage: avg
        };
    });
    setHistoricalData(newHistoricalData);

    // School Ranking Logic for Super Admin
    if (userRole === 'super-admin') {
        const reportsBySchool = new Map<string, ReportData[]>();
        allReports.forEach(report => {
            const schoolName = report.schoolName?.trim();
            if (schoolName) {
              if (!reportsBySchool.has(schoolName)) {
                reportsBySchool.set(schoolName, []);
              }
              reportsBySchool.get(schoolName)!.push(report);
            }
        });

        const schoolPerformances = Array.from(reportsBySchool.entries()).map(([schoolName, schoolReports]) => {
            const allAverages = schoolReports
              .map(report => calculateOverallAverage(report.subjects))
              .filter(avg => avg !== null) as number[];

            const average = allAverages.length > 0
              ? allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length
              : 0;

            return {
              schoolName,
              studentCount: schoolReports.length,
              average,
            };
        });

        const sortedSchools = schoolPerformances
            .sort((a, b) => b.average - a.average)
            .map((school, index, arr) => {
              const rankNumber = (index > 0 && school.average === arr[index - 1].average)
                ? (arr[index - 1] as any).rankNumber
                : index + 1;
              return { ...school, rankNumber };
            });
        
        const getOrdinalSuffix = (n: number): string => {
            const s = ['th', 'st', 'nd', 'rd'];
            const v = n % 100;
            return s[(v - 20) % 10] || s[v] || s[0];
        };

        const finalRankedSchools = sortedSchools.map((school, index, arr) => {
            const { rankNumber } = school;
            const isTiedWithNext = index < arr.length - 1 && arr[index + 1].rankNumber === rankNumber;
            const isTiedWithPrev = index > 0 && arr[index - 1].rankNumber === rankNumber;
            const isTie = isTiedWithNext || isTiedWithPrev;
            const rankString = `${isTie ? 'T-' : ''}${rankNumber}${getOrdinalSuffix(rankNumber)}`;
            return { ...school, rank: rankString };
        });

        setRankedSchools(finalRankedSchools);
    } else {
        setRankedSchools([]);
    }

  }, [isOpen, allReports, userRole]); 

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
    if (isLoadingAi && !aiSchoolAdvice && !aiError) {
      return (
        <CardContent className="pt-4 flex items-center justify-center text-accent-foreground/80">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Generating school-level insights...
        </CardContent>
      );
    }
    if (aiError) {
      return (
        <CardContent className="pt-4 text-accent-foreground/90">
          <div className="flex items-start p-4 bg-destructive/10 border border-destructive/30 rounded-md">
            <AlertTriangle className="mr-3 h-6 w-6 text-destructive shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-destructive">School Insights Unavailable</p>
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
                    <span className="text-sm">Analysis complete. No specific school-wide points were raised by the AI for the provided data.</span>
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
    return (
       <CardContent className="pt-4">
        <Button onClick={fetchSchoolAiInsights} disabled={!schoolStats || isLoadingAi}>
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
        id="school-dashboard-dialog-content"
        className="max-w-7xl w-[95vw] h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-gray-100/80 dark:bg-gray-800/80 p-0"
      >
        <ShadcnDialogHeader className="w-full shrink-0 px-4 py-3 border-b bg-background sticky top-0 z-10 dialog-header-print-hide">
          <ShadcnDialogTitle className="text-xl font-bold text-primary flex items-center">
            <Building className="mr-3 h-6 w-6" />
            School Dashboard: {schoolNameProp}
          </ShadcnDialogTitle>
          <ShadcnDialogDescription className="text-xs text-muted-foreground pt-1">
            {mostRecentTerm ? `Analysis for ${academicYearProp}, ${mostRecentTerm}` : "Aggregated insights for the entire school"}
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        
        <div 
          data-testid="school-dashboard-inner-scroll-container"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
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
              <div className="school-dashboard-print-header">
                  <div className="flex justify-center mb-2">
                      <Image src="https://upload.wikimedia.org/wikipedia/commons/5/59/Coat_of_arms_of_Ghana.svg" alt="Ghana Coat of Arms" width={60} height={60} />
                  </div>
                  <h2 className="text-xl font-bold">{schoolNameProp} - School Performance Dashboard</h2>
                  <p className="text-sm">{academicYearProp} - {mostRecentTerm} | Generated on: {new Date().toLocaleDateString()}</p>
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
                          <p className="text-muted-foreground">Could not aggregate school statistics for the most recent term. Please check report data or try again.</p>
                      </CardContent>
                  </Card>
              )}

              {schoolStats && (
                <>
                  <Card className="shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><Sigma className="mr-2 h-5 w-5" />School-Wide Snapshot ({mostRecentTerm})</CardTitle>
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
                  
                  {historicalData.length > 1 && (
                      <Card className="shadow-md">
                          <CardHeader className="pb-3">
                              <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><History className="mr-2 h-5 w-5"/>School Term-over-Term</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                              <Table className="border rounded-md min-w-[500px]">
                                  <ShadcnUITableHeader className="bg-muted/50">
                                      <TableRow>
                                          <TableHead className="font-semibold">Term</TableHead>
                                          <TableHead className="text-center font-semibold"># Students</TableHead>
                                          <TableHead className="text-center font-semibold"># Classes</TableHead>
                                          <TableHead className="text-center font-semibold">School Average (%)</TableHead>
                                      </TableRow>
                                  </ShadcnUITableHeader>
                                  <TableBody>
                                      {historicalData.map(data => (
                                          <TableRow key={data.term}>
                                              <TableCell className="font-medium">{data.term}</TableCell>
                                              <TableCell className="text-center">{data.numStudents}</TableCell>
                                              <TableCell className="text-center">{data.numClasses}</TableCell>
                                              <TableCell className="text-center">{data.schoolAverage?.toFixed(1) ?? 'N/A'}</TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </CardContent>
                      </Card>
                  )}


                  {schoolStats.classSummariesForUI.length > 0 && (
                      <Card className="shadow-md">
                          <CardHeader className="pb-3">
                              <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><Users className="mr-2 h-5 w-5 text-indigo-600" />Class Performance ({mostRecentTerm})</CardTitle>
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

                  {userRole === 'super-admin' && rankedSchools.length > 1 && (
                      <Card className="shadow-md">
                          <CardHeader className="pb-3">
                              <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center">
                                  <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
                                  School Performance Ranking
                              </CardTitle>
                              <CardDescription className="text-xs text-muted-foreground pt-1">
                                  Ranking of all schools in the system based on their overall student average for the most recent term.
                              </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-4">
                              <Table className="border rounded-md bg-card min-w-[500px]">
                                  <ShadcnUITableHeader className="bg-muted/50">
                                      <TableRow>
                                          <TableHead className="font-semibold py-2 px-3 w-[80px]">Rank</TableHead>
                                          <TableHead className="font-semibold py-2 px-3">School Name</TableHead>
                                          <TableHead className="text-center font-semibold py-2 px-3">Students</TableHead>
                                          <TableHead className="text-right font-semibold py-2 px-3">Avg (%)</TableHead>
                                      </TableRow>
                                  </ShadcnUITableHeader>
                                  <TableBody>
                                      {rankedSchools.map(school => (
                                          <TableRow key={school.schoolName}>
                                              <TableCell className="font-bold text-lg py-2 px-3">{school.rank}</TableCell>
                                              <TableCell className="font-medium py-2 px-3">{school.schoolName}</TableCell>
                                              <TableCell className="text-center py-2 px-3">{school.studentCount}</TableCell>
                                              <TableCell className="text-right font-semibold py-2 px-3">{school.average.toFixed(2)}</TableCell>
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
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><BookOpen className="mr-2 h-5 w-5 text-green-600" />School-Wide Subject Performance ({mostRecentTerm})</CardTitle>
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
                          <CardTitle className="text-lg font-semibold text-primary border-b pb-2 flex items-center"><LucidePieChart className="mr-2 h-5 w-5 text-purple-600" />School-Wide Gender Statistics ({mostRecentTerm})</CardTitle>
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
                      <div className="flex justify-between items-center border-b pb-2">
                        <CardTitle className="text-lg font-semibold text-primary flex items-center">
                            {isLoadingAi && !aiSchoolAdvice ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> : <Brain className="mr-2 h-5 w-5 text-green-600" /> }
                            School-Level Insights &amp; Advice ({mostRecentTerm})
                        </CardTitle>
                        
                          <Button variant="outline" size="sm" onClick={fetchSchoolAiInsights} disabled={isLoadingAi || !schoolStats}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingAi ? 'animate-spin' : ''}`} />
                            {aiSchoolAdvice ? 'Regenerate' : 'Generate'}
                          </Button>
                        
                      </div>
                    </CardHeader>
                    {renderAiSchoolInsights()}
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>

        <ShadcnDialogFooter className="w-full shrink-0 border-t px-4 py-3 bg-background sticky bottom-0 z-10 dialog-footer-print-hide flex-row justify-end space-x-2">
          <Button variant="outline" onClick={handlePrint} disabled={!schoolStats || allReports.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print School Dashboard
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogClose>
        </ShadcnDialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function aggregateSchoolDataForTerm(reports: ReportData[]): SchoolStatistics | null {
    if (!reports || reports.length === 0) return null;

    const totalStudentsInSchool = reports.length;

    const schoolWideAverage = calculateOverallAverage(reports.flatMap(r => r.subjects));

    const classDataMap: Map<string, ReportData[]> = new Map();
    reports.forEach(report => {
        if (!classDataMap.has(report.className)) {
            classDataMap.set(report.className, []);
        }
        classDataMap.get(report.className)!.push(report);
    });
    
    const numberOfClassesRepresented = classDataMap.size;

    const classSummariesForUI = Array.from(classDataMap.entries()).map(([className, classReports]) => ({
      className,
      numberOfStudents: classReports.length,
      classAverage: calculateOverallAverage(classReports.flatMap(r => r.subjects)),
    }));

    const schoolSubjectScoresMap: Map<string, number[]> = new Map();
    reports.forEach(report => {
        report.subjects.forEach(subject => {
            if (subject.subjectName && subject.subjectName.trim() !== '') {
                const finalMark = calculateSubjectFinalMark(subject);
                if (finalMark !== null && !Number.isNaN(finalMark)) {
                    if (!schoolSubjectScoresMap.has(subject.subjectName)) {
                        schoolSubjectScoresMap.set(subject.subjectName, []);
                    }
                    schoolSubjectScoresMap.get(subject.subjectName)!.push(finalMark);
                }
            }
        });
    });

    const overallSubjectStatsForSchoolUI = Array.from(schoolSubjectScoresMap.entries()).map(([subjectName, scores]) => ({
        subjectName,
        numBelowAverage: scores.filter(score => score < 40).length,
        numAverage: scores.filter(score => score >= 40 && score < 60).length,
        numAboveAverage: scores.filter(score => score >= 60).length,
        schoolAverageForSubject: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
    }));

    const schoolGenderMap: Map<string, { scores: number[], count: number }> = new Map();
    reports.forEach(report => {
        const gender = report.gender || 'Unknown';
        if (!schoolGenderMap.has(gender)) {
            schoolGenderMap.set(gender, { scores: [], count: 0 });
        }
        const studentAverage = calculateOverallAverage(report.subjects);
        if (studentAverage !== null) {
          schoolGenderMap.get(gender)!.scores.push(studentAverage);
        }
        schoolGenderMap.get(gender)!.count++;
    });

    const overallGenderStatsForSchoolUI = Array.from(schoolGenderMap.entries()).map(([gender, data]) => ({
        gender,
        count: data.count,
        averageScore: data.scores.length > 0 ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2)) : null,
    }));
  
    return {
        overallSchoolAverage: schoolWideAverage,
        totalStudentsInSchool,
        numberOfClassesRepresented,
        classSummariesForUI,
        overallSubjectStatsForSchoolUI,
        overallGenderStatsForSchoolUI,
    };
}
