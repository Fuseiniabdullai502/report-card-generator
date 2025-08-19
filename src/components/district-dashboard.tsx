

'use client';

import React, { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import type { ReportData } from '@/lib/schemas';
import type { CustomUser } from './auth-provider';
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
import { Building, Users, TrendingUp, PieChart as LucidePieChart, Brain, Printer, Loader2, AlertTriangle, Info, BookOpen, Sigma, History, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart as RechartsPieChart, Pie, Cell, type TooltipProps } from 'recharts';
import { getAiDistrictInsightsAction } from '@/app/actions';
import type { GenerateDistrictInsightsOutput, GenerateDistrictInsightsInput } from '@/ai/flows/generate-district-insights-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateSubjectFinalMark, calculateOverallAverage } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import Image from 'next/image';

interface DistrictPerformanceDashboardProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allReports: ReportData[];
  user: CustomUser;
}

interface HistoricalDistrictTermData {
    term: string;
    numStudents: number;
    numSchools: number;
    districtAverage: number | null;
}

interface DistrictStatistics {
  overallDistrictAverage: number | null;
  totalStudentsInDistrict: number;
  numberOfSchoolsRepresented: number;
  schoolSummariesForUI: Array<{ schoolName: string; numberOfStudents: number; schoolAverage: number | null }>;
  overallSubjectStatsForDistrictUI: Array<{ subjectName: string; numBelowAverage: number; numAverage: number; numAboveAverage: number; districtAverageForSubject: number | null; }>;
  overallGenderStatsForDistrictUI: Array<{ gender: string; count: number; averageScore: number | null; }>;
}

export default function DistrictPerformanceDashboard({
  isOpen,
  onOpenChange,
  allReports,
  user,
}: DistrictPerformanceDashboardProps) {
  const [districtStats, setDistrictStats] = useState<DistrictStatistics | null>(null);
  const [aiDistrictAdvice, setAiDistrictAdvice] = useState<GenerateDistrictInsightsOutput | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingAi, startAiTransition] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const districtName = user.district || 'District';

  const allAvailableYears = useMemo(() => ['all', ...[...new Set(allReports.map(r => r.academicYear).filter(Boolean) as string[])].sort()], [allReports]);
  const allAvailableTerms = useMemo(() => ['all', ...[...new Set(allReports.map(r => r.academicTerm).filter(Boolean) as string[])].sort()], [allReports]);

  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');

  const filteredReports = useMemo(() => {
    return allReports.filter(report => 
      (selectedYear === 'all' || report.academicYear === selectedYear) &&
      (selectedTerm === 'all' || report.academicTerm === selectedTerm)
    );
  }, [allReports, selectedYear, selectedTerm]);

  const handlePrint = () => {
    if (!districtStats) {
      toast({title: "Nothing to Print", description: "Dashboard data is not available.", variant: "destructive"});
      return;
    }
    const body = document.body;
    body.classList.add('dashboard-printing-active');
    setTimeout(() => {
      window.print();
      body.classList.remove('dashboard-printing-active');
    }, 300);
  };


  const fetchDistrictAiInsights = useCallback(async () => {
    if (!districtStats) return;

    setAiDistrictAdvice(null);
    setAiError(null);
    startAiTransition(async () => {
      try {
        const sanitizedAiInput: GenerateDistrictInsightsInput = {
          districtName,
          academicTerm: selectedTerm === 'all' ? 'All Terms' : selectedTerm,
          overallDistrictAverage: districtStats.overallDistrictAverage ?? null,
          totalStudentsInDistrict: districtStats.totalStudentsInDistrict,
          numberOfSchoolsRepresented: districtStats.numberOfSchoolsRepresented,
          schoolSummaries: districtStats.schoolSummariesForUI.map(ss => ({
            schoolName: ss.schoolName,
            schoolAverage: ss.schoolAverage ?? null,
            numberOfStudents: ss.numberOfStudents,
          })),
          overallSubjectStatsForDistrict: districtStats.overallSubjectStatsForDistrictUI.map(s => ({
            ...s,
            districtAverageForSubject: s.districtAverageForSubject ?? null,
          })),
          overallGenderStatsForDistrict: districtStats.overallGenderStatsForDistrictUI.map(g => ({
            ...g,
            averageScore: g.averageScore ?? null,
          })),
        };

        const result = await getAiDistrictInsightsAction(sanitizedAiInput);
        if (result.success && result.insights) {
          setAiDistrictAdvice(result.insights);
        } else {
          const errorMessage = result.error || "An unknown error occurred while generating district insights.";
          setAiError(errorMessage);
          toast({ title: "AI District Insights Error", description: errorMessage, variant: "destructive" });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setAiError(errorMessage);
        toast({ title: "AI District Insights Request Failed", description: `Client error: ${errorMessage}`, variant: "destructive" });
      }
    });
  }, [districtStats, districtName, selectedTerm, toast]);

  useEffect(() => {
    if (!isOpen || filteredReports.length === 0) {
      setDistrictStats(null);
      setAiDistrictAdvice(null);
      setAiError(null);
      return;
    }

    setIsLoadingStats(true);
    const newStats = aggregateDistrictDataForTerm(filteredReports);
    setDistrictStats(newStats);
    setIsLoadingStats(false);
    
  }, [isOpen, filteredReports]); 

  const districtSubjectPerformanceChartData = useMemo(() => {
    return districtStats?.overallSubjectStatsForDistrictUI.map(s => ({
      name: s.subjectName,
      'Below Average (<40%)': s.numBelowAverage,
      'Average (40-59%)': s.numAverage,
      'Above Average (>=60%)': s.numAboveAverage,
    })) || [];
  }, [districtStats]);

  const districtGenderChartData = useMemo(() => {
    return districtStats?.overallGenderStatsForDistrictUI.map(g => ({
      name: g.gender,
      value: g.count,
    })) || [];
  }, [districtStats]);
  const GENDER_COLORS = ['#0088FE', '#FF8042', '#FFBB28', '#00C49F', '#AF19FF'];

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background/90 border rounded-md shadow-lg backdrop-blur-sm text-xs">
          <p className="label font-semibold text-foreground">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="capitalize">{`${entry.name}: ${entry.value}`}</p>
          ))}
        </div>
      );
    }
    return null;
  };
  
   const renderAiDistrictInsights = () => {
    if (isLoadingAi && !aiDistrictAdvice && !aiError) {
      return <CardContent className="pt-4 flex items-center justify-center text-accent-foreground/80"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Generating district-level insights...</CardContent>;
    }
    if (aiError) {
      return (
        <CardContent className="pt-4 text-accent-foreground/90">
          <div className="flex items-start p-4 bg-destructive/10 border border-destructive/30 rounded-md">
            <AlertTriangle className="mr-3 h-6 w-6 text-destructive shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-destructive">District Insights Unavailable</p>
              <pre className="mt-2 p-2 bg-destructive/20 rounded text-xs font-mono whitespace-pre-wrap">{aiError}</pre>
            </div>
          </div>
        </CardContent>
      );
    }
    if (aiDistrictAdvice) {
      const { overallDistrictAssessment, keyStrengthsDistrictWide, areasForConcernDistrictWide, actionableAdviceForDistrict, interSchoolObservations } = aiDistrictAdvice;
      return (
        <CardContent className="pt-4 space-y-3 text-sm text-accent-foreground">
          {overallDistrictAssessment && <div><h4 className="font-semibold text-green-600">Overall Assessment:</h4><p className="pl-2">{overallDistrictAssessment}</p></div>}
          {keyStrengthsDistrictWide && keyStrengthsDistrictWide.length > 0 && <div><h4 className="font-semibold text-green-600">Key Strengths:</h4><ul className="list-disc list-inside pl-2">{keyStrengthsDistrictWide.map((s, i) => <li key={`strength-${i}`}>{s}</li>)}</ul></div>}
          {areasForConcernDistrictWide && areasForConcernDistrictWide.length > 0 && <div><h4 className="font-semibold text-yellow-600">Areas for Concern:</h4><ul className="list-disc list-inside pl-2">{areasForConcernDistrictWide.map((a, i) => <li key={`concern-${i}`}>{a}</li>)}</ul></div>}
          {actionableAdviceForDistrict && actionableAdviceForDistrict.length > 0 && <div><h4 className="font-semibold text-blue-600">Actionable Advice:</h4><ul className="list-disc list-inside pl-2">{actionableAdviceForDistrict.map((adv, i) => <li key={`advice-${i}`}>{adv}</li>)}</ul></div>}
          {interSchoolObservations && interSchoolObservations.length > 0 && <div><h4 className="font-semibold text-purple-600">Inter-School Observations:</h4><ul className="list-disc list-inside pl-2">{interSchoolObservations.map((obs, i) => <li key={`obs-${i}`}>{obs}</li>)}</ul></div>}
        </CardContent>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent id="school-dashboard-dialog-content" className="max-w-6xl w-[95vw] h-[calc(100vh-4rem)] flex flex-col">
        <ShadcnDialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b bg-background sticky top-0 z-10 dialog-header-print-hide">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                    <ShadcnDialogTitle className="text-xl font-bold text-primary flex items-center"><Building className="mr-3 h-6 w-6" />District Dashboard: {districtName}</ShadcnDialogTitle>
                    <ShadcnDialogDescription>Analysis for {selectedYear === 'all' ? 'All Years' : selectedYear}, {selectedTerm === 'all' ? 'All Terms' : selectedTerm}</ShadcnDialogDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue/></SelectTrigger>
                        <SelectContent>{allAvailableYears.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : y}</SelectItem>)}</SelectContent>
                    </Select>
                     <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue/></SelectTrigger>
                        <SelectContent>{allAvailableTerms.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'All Terms' : t}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
        </ShadcnDialogHeader>
        <div data-testid="school-dashboard-inner-scroll-container" className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          <div className="dashboard-print-header relative">
            {/* Watermark */}
            {districtName && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden watermark-container">
                  <p 
                    className="font-bold text-gray-500/20 dark:text-gray-400/20 transform -rotate-45 select-none"
                    style={{
                        fontSize: 'clamp(2rem, 15vw, 8rem)',
                        lineHeight: '1.2',
                        wordBreak: 'break-word',
                    }}
                  >
                      {districtName}
                  </p>
              </div>
            )}
            <div className="relative z-10">
                <div className="flex justify-center mb-2">
                    <Image src="https://upload.wikimedia.org/wikipedia/commons/5/59/Coat_of_arms_of_Ghana.svg" alt="Ghana Coat of Arms" width={60} height={60} />
                </div>
                <h2 className="text-xl font-bold">{districtName} District - Performance Dashboard</h2>
                <p className="text-sm">Academic Session: {selectedYear === 'all' ? 'All Years' : selectedYear}, {selectedTerm === 'all' ? 'All Terms' : selectedTerm} | Generated on: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          {isLoadingStats ? <Card><CardContent className="pt-6 flex justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading stats...</CardContent></Card> : !districtStats ? <Card><CardContent className="pt-6 text-center text-muted-foreground">No reports found for the selected period.</CardContent></Card> : (
            <>
              <Card><CardHeader><CardTitle className="flex items-center"><Sigma className="mr-2"/>District Snapshot</CardTitle></CardHeader><CardContent className="grid md:grid-cols-4 gap-4"><div className="text-center"><p className="text-sm text-muted-foreground">Total Students</p><p className="text-2xl font-bold">{districtStats.totalStudentsInDistrict}</p></div><div className="text-center"><p className="text-sm text-muted-foreground">Schools Represented</p><p className="text-2xl font-bold">{districtStats.numberOfSchoolsRepresented}</p></div><div className="text-center"><p className="text-sm text-muted-foreground">District Average</p><p className="text-2xl font-bold">{districtStats.overallDistrictAverage?.toFixed(2)}%</p></div></CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center"><Building className="mr-2"/>School Performance</CardTitle></CardHeader><CardContent><Table><ShadcnUITableHeader><TableRow><TableHead>School</TableHead><TableHead className="text-center">Students</TableHead><TableHead className="text-center">Avg (%)</TableHead></TableRow></ShadcnUITableHeader><TableBody>{districtStats.schoolSummariesForUI.sort((a,b) => (b.schoolAverage || 0) - (a.schoolAverage || 0)).map(s => <TableRow key={s.schoolName}><TableCell>{s.schoolName}</TableCell><TableCell className="text-center">{s.numberOfStudents}</TableCell><TableCell className="text-center">{s.schoolAverage?.toFixed(1) || 'N/A'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center"><BookOpen className="mr-2"/>Subject Performance</CardTitle></CardHeader>
                <CardContent>
                    <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={districtSubjectPerformanceChartData}><XAxis dataKey="name" angle={-35} textAnchor="end" height={80} interval={0} tick={{fontSize:10}}/><YAxis/><Tooltip content={<CustomTooltip/>}/><Legend/><Bar dataKey="Below Average (<40%)" fill="hsl(var(--destructive))"/><Bar dataKey="Average (40-59%)" fill="hsl(var(--primary))"/><Bar dataKey="Above Average (>=60%)" fill="hsl(var(--accent))"/></BarChart></ResponsiveContainer></div>
                    <Table className="mt-6 border rounded-md min-w-[700px] bg-card">
                        <ShadcnUITableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-semibold py-2 px-3">Subject</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3">District Avg (%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-red-600 dark:text-red-400">Below Avg (&lt;40%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-blue-600 dark:text-blue-400">Average (40-59%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-green-600 dark:text-green-400">Above Avg (&ge;60%)</TableHead>
                          </TableRow>
                        </ShadcnUITableHeader>
                        <TableBody>
                          {districtStats.overallSubjectStatsForDistrictUI.map(s => (
                            <TableRow key={s.subjectName}>
                              <TableCell className="font-medium py-2 px-3">{s.subjectName}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.districtAverageForSubject?.toFixed(1) || 'N/A'}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.numBelowAverage}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.numAverage}</TableCell>
                              <TableCell className="text-center py-2 px-3">{s.numAboveAverage}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                    </Table>
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="flex items-center"><LucidePieChart className="mr-2"/>Gender Statistics</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-6 items-center"><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={districtGenderChartData} dataKey="value" nameKey="name" label>{districtGenderChartData.map((e,i) => <Cell key={`cell-${i}`} fill={GENDER_COLORS[i % GENDER_COLORS.length]}/>)}</Pie><Tooltip content={<CustomTooltip/>}/><Legend/></RechartsPieChart></ResponsiveContainer></div><Table><ShadcnUITableHeader><TableRow><TableHead>Gender</TableHead><TableHead className="text-center">Count</TableHead><TableHead className="text-center">Avg (%)</TableHead></TableRow></ShadcnUITableHeader><TableBody>{districtStats.overallGenderStatsForDistrictUI.map(g => <TableRow key={g.gender}><TableCell>{g.gender}</TableCell><TableCell className="text-center">{g.count}</TableCell><TableCell className="text-center">{g.averageScore?.toFixed(1) || 'N/A'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
              <Card className="bg-accent/10"><CardHeader><div className="flex justify-between items-center"><CardTitle className="flex items-center"><Brain className="mr-2"/>AI Insights & Advice</CardTitle><Button variant="outline" size="sm" onClick={fetchDistrictAiInsights} disabled={isLoadingAi}><RefreshCw className={cn("mr-2 h-4 w-4", isLoadingAi && "animate-spin")}/>Reload</Button></div></CardHeader>{renderAiDistrictInsights()}</Card>
            </>
          )}
        </div>
        <ShadcnDialogFooter className="shrink-0 border-t pt-4 flex-row justify-end dialog-footer-print-hide">
            <Button variant="outline" onClick={handlePrint} disabled={!districtStats}>
                <Printer className="mr-2 h-4 w-4" /> Print Dashboard
            </Button>
            <DialogClose asChild>
                <Button>Close</Button>
            </DialogClose>
        </ShadcnDialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function aggregateDistrictDataForTerm(reports: ReportData[]): DistrictStatistics | null {
    if (!reports || reports.length === 0) return null;

    const totalStudentsInDistrict = reports.length;
    const districtWideAverage = calculateOverallAverage(reports.flatMap(r => r.subjects));
    
    const schoolDataMap = new Map<string, ReportData[]>();
    reports.forEach(report => {
        if (report.schoolName) {
          if (!schoolDataMap.has(report.schoolName)) schoolDataMap.set(report.schoolName, []);
          schoolDataMap.get(report.schoolName)!.push(report);
        }
    });

    const numberOfSchoolsRepresented = schoolDataMap.size;
    const schoolSummariesForUI = Array.from(schoolDataMap.entries()).map(([schoolName, schoolReports]) => ({
      schoolName,
      numberOfStudents: schoolReports.length,
      schoolAverage: calculateOverallAverage(schoolReports.flatMap(r => r.subjects)),
    }));

    const districtSubjectScoresMap = new Map<string, number[]>();
    reports.forEach(report => report.subjects.forEach(subject => {
        if(subject.subjectName) {
            const finalMark = calculateSubjectFinalMark(subject);
            if (finalMark !== null) {
                if (!districtSubjectScoresMap.has(subject.subjectName)) districtSubjectScoresMap.set(subject.subjectName, []);
                districtSubjectScoresMap.get(subject.subjectName)!.push(finalMark);
            }
        }
    }));

    const overallSubjectStatsForDistrictUI = Array.from(districtSubjectScoresMap.entries()).map(([subjectName, scores]) => ({
        subjectName,
        numBelowAverage: scores.filter(s => s < 40).length,
        numAverage: scores.filter(s => s >= 40 && s < 60).length,
        numAboveAverage: scores.filter(s => s >= 60).length,
        districtAverageForSubject: scores.length > 0 ? scores.reduce((a,b)=>a+b,0) / scores.length : null,
    }));

    const districtGenderMap = new Map<string, { scores: number[], count: number }>();
    reports.forEach(report => {
        const gender = report.gender || 'Unknown';
        if (!districtGenderMap.has(gender)) districtGenderMap.set(gender, { scores: [], count: 0 });
        
        const studentAverage = calculateOverallAverage(report.subjects);
        if (studentAverage !== null) {
          districtGenderMap.get(gender)!.scores.push(studentAverage);
        }
        districtGenderMap.get(gender)!.count++;
    });

    const overallGenderStatsForDistrictUI = Array.from(districtGenderMap.entries()).map(([gender, data]) => ({
        gender,
        count: data.count,
        averageScore: data.scores.length > 0 ? data.scores.reduce((a,b)=>a+b,0) / data.scores.length : null,
    }));
  
    return {
        overallDistrictAverage: districtWideAverage,
        totalStudentsInDistrict,
        numberOfSchoolsRepresented,
        schoolSummariesForUI,
        overallSubjectStatsForDistrictUI,
        overallGenderStatsForDistrictUI,
    };
}
