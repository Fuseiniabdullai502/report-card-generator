
'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
  DialogDescription as ShadcnDialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea
import { BarChart3, Users, TrendingUp, Percent, PieChart, Brain, Printer, Loader2, AlertTriangle, Info, MessageCircleQuestion } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart as RechartsPieChart, Pie, Cell, TooltipProps } from 'recharts';
import { getAiClassInsightsAction } from '@/app/actions';
import type { GenerateClassInsightsOutput, GenerateClassInsightsInput } from '@/ai/flows/generate-class-insights-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ClassPerformanceDashboardProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  reports: ReportData[];
  classNameProp: string;
  academicTerm: string;
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


export default function ClassPerformanceDashboard({
  isOpen,
  onOpenChange,
  reports,
  classNameProp,
  academicTerm,
}: ClassPerformanceDashboardProps) {
  const [classStats, setClassStats] = useState<ClassStatistics | null>(null);
  const [aiAdvice, setAiAdvice] = useState<GenerateClassInsightsOutput | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingAi, startAiTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && reports.length > 0) {
      setIsLoadingStats(true);
      const totalStudents = reports.length;
      let sumOfOverallAverages = 0;
      let studentsWithOverallAverage = 0;

      reports.forEach(report => {
        if (report.overallAverage !== undefined && report.overallAverage !== null) {
          sumOfOverallAverages += report.overallAverage;
          studentsWithOverallAverage++;
        }
      });
      const overallClassAverage = studentsWithOverallAverage > 0 ? parseFloat((sumOfOverallAverages / studentsWithOverallAverage).toFixed(2)) : null;

      const subjectMap: Map<string, { scores: number[]; count: number }> = new Map();
      reports.forEach(report => {
        report.subjects.forEach(subject => {
          if (subject.subjectName && subject.subjectName.trim() !== '') {
            const finalMark = calculateInternalSubjectFinalMark(subject);
            if (finalMark !== null) {
              if (!subjectMap.has(subject.subjectName)) {
                subjectMap.set(subject.subjectName, { scores: [], count: 0 });
              }
              subjectMap.get(subject.subjectName)!.scores.push(finalMark);
              subjectMap.get(subject.subjectName)!.count++;
            }
          }
        });
      });

      const subjectStats: SubjectPerformanceStatForUI[] = Array.from(subjectMap.entries()).map(([subjectName, data]) => {
        const subjectAvg = data.scores.length > 0 ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2)) : null;
        return {
          subjectName,
          numBelowAverage: data.scores.filter(score => score < 40).length,
          numAverage: data.scores.filter(score => score >= 40 && score < 60).length,
          numAboveAverage: data.scores.filter(score => score >= 60).length,
          classAverageForSubject: subjectAvg,
        };
      });

      const genderMap: Map<string, { scores: number[]; count: number }> = new Map();
      reports.forEach(report => {
        const gender = report.gender || 'Unknown';
         if (report.overallAverage !== undefined && report.overallAverage !== null) {
            if (!genderMap.has(gender)) {
                genderMap.set(gender, { scores: [], count: 0 });
            }
            genderMap.get(gender)!.scores.push(report.overallAverage);
         }
        if (!genderMap.has(gender)) {
            genderMap.set(gender, { scores: [], count: (genderMap.get(gender)?.count || 0) });
        }
        genderMap.get(gender)!.count++;
      });
      
      const genderStats: GenderPerformanceStatForUI[] = Array.from(genderMap.entries()).map(([gender, data]) => ({
        gender,
        count: data.count,
        averageScore: data.scores.length > 0 ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2)) : null,
      }));

      const newStats = { overallClassAverage, totalStudents, subjectStats, genderStats };
      setClassStats(newStats);
      setIsLoadingStats(false);

      setAiAdvice(null); 
      startAiTransition(async () => {
        try {
          const aiInput: GenerateClassInsightsInput = {
            className: classNameProp,
            academicTerm,
            overallClassAverage: newStats.overallClassAverage,
            totalStudents: newStats.totalStudents,
            subjectStats: newStats.subjectStats.map(s => ({ ...s })),
            genderStats: newStats.genderStats.map(g => ({ ...g })),
          };
          const result = await getAiClassInsightsAction(aiInput);
          if (result.success && result.insights) {
            setAiAdvice(result.insights);
          } else {
            setAiAdvice(null); 
            toast({ title: "AI Insights Error", description: result.error || "Failed to load AI insights. The model might be unavailable or the request timed out.", variant: "destructive" });
          }
        } catch (error) {
          setAiAdvice(null);
          toast({ title: "AI Insights Request Failed", description: "Could not fetch AI insights due to a network or server error.", variant: "destructive" });
        }
      });
    } else if (isOpen && reports.length === 0) {
      setClassStats(null);
      setAiAdvice(null);
      setIsLoadingStats(false);
    }
  }, [isOpen, reports, classNameProp, academicTerm, toast]);

  const handlePrint = () => {
    if (!classStats || reports.length === 0) {
      toast({title: "Nothing to Print", description: "Dashboard data is not available or no reports loaded.", variant: "destructive"});
      return;
    }
    window.print();
  };

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

  const renderAiInsights = () => {
    if (isLoadingAi && !aiAdvice) {
      return (
        <CardContent className="pt-4 flex items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Generating AI pedagogical insights...
        </CardContent>
      );
    }
    if (!aiAdvice && !isLoadingAi && classStats) {
      return (
        <CardContent className="pt-4 text-muted-foreground">
          <div className="flex items-center">
             <MessageCircleQuestion className="mr-2 h-5 w-5 text-destructive" />
            <span>AI insights could not be loaded or are unavailable for this data.</span>
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
            <CardContent className="pt-4 text-muted-foreground">
                 <div className="flex items-center">
                    <Info className="mr-2 h-5 w-5 text-blue-500" />
                    <span>AI analysis complete. No specific points were raised in the key categories for the provided data.</span>
                </div>
            </CardContent>
        );
       }

      return (
        <CardContent className="pt-4 space-y-3 text-sm">
          {overallAssessment && overallAssessment.trim() !== '' && (
            <div>
              <h4 className="font-semibold text-green-700 dark:text-green-400">Overall Assessment:</h4>
              <p className="text-muted-foreground pl-2 whitespace-pre-wrap">{overallAssessment}</p>
            </div>
          )}
          {strengths && strengths.length > 0 && strengths.some(s => s.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-green-700 dark:text-green-400">Key Strengths:</h4>
              <ul className="list-disc list-inside pl-2 text-muted-foreground whitespace-pre-wrap">
                {strengths.filter(s => s.trim() !== '').map((s, i) => <li key={`strength-${i}`}>{s}</li>)}
              </ul>
            </div>
          )}
          {areasForConcern && areasForConcern.length > 0 && areasForConcern.some(a => a.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-yellow-700 dark:text-yellow-400">Areas for Concern:</h4>
              <ul className="list-disc list-inside pl-2 text-muted-foreground whitespace-pre-wrap">
                {areasForConcern.filter(a => a.trim() !== '').map((a, i) => <li key={`concern-${i}`}>{a}</li>)}
              </ul>
            </div>
          )}
          {actionableAdvice && actionableAdvice.length > 0 && actionableAdvice.some(ad => ad.trim() !== '') && (
            <div>
              <h4 className="font-semibold text-blue-700 dark:text-blue-400">Actionable Advice for Teacher:</h4>
              <ul className="list-disc list-inside pl-2 text-muted-foreground whitespace-pre-wrap">
                {actionableAdvice.filter(adv => adv.trim() !== '').map((adv, i) => <li key={`advice-${i}`}>{adv}</li>)}
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
        id="class-dashboard-dialog-content"
        className="max-w-4xl max-h-[90dvh] flex flex-col p-0 overflow-hidden"
      >
        <DialogHeader className="p-6 border-b no-print shrink-0">
          <DialogTitle className="text-xl font-bold text-primary flex items-center">
            <BarChart3 className="mr-3 h-6 w-6" />
            Class Performance Dashboard: {classNameProp}
          </DialogTitle>
          <ShadcnDialogDescription className="text-xs text-muted-foreground pt-1">
            {academicTerm} - Insights and statistics for the class. Click "Print Dashboard" to open browser print preview.
          </ShadcnDialogDescription>
        </DialogHeader>
        
        <div id="dashboard-print-header" className="dashboard-print-header hidden print:block p-6 border-b">
            <h2 className="text-xl font-bold">Class Performance Dashboard: {classNameProp} ({academicTerm})</h2>
            <p className="text-sm">Generated on: {new Date().toLocaleDateString()}</p>
        </div>

        <ScrollArea data-testid="dashboard-scroll-area" className="flex-1 min-h-0">
          <div className="p-6 space-y-6 overflow-x-auto">
            {(isLoadingStats && !classStats) && (
              <Card className="shadow-md">
                <CardContent className="pt-6 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating class statistics...
                </CardContent>
              </Card>
            )}
            {reports.length === 0 && !isLoadingStats && (
                 <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 mb-3 flex items-center"><Info className="mr-2 h-5 w-5" />No Reports Available</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-muted-foreground">There are no student reports in the print list to generate a class dashboard. Please add reports first.</p>
                    </CardContent>
                </Card>
            )}
            {!classStats && reports.length > 0 && !isLoadingStats && (
                 <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 mb-3 flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />Data Error</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-muted-foreground">Could not calculate class statistics. Please check report data or try again.</p>
                    </CardContent>
                </Card>
            )}

            {classStats && (
              <>
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-primary border-b pb-2 mb-3 flex items-center"><Users className="mr-2 h-5 w-5" />Overall Snapshot</CardTitle>
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

                {classStats.subjectStats.length > 0 && (
                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-primary border-b pb-2 mb-3 flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-green-600" />Subject Performance</CardTitle>
                      <ShadcnCardDescription className="text-xs text-muted-foreground pt-1">Distribution of students based on score bands per subject (Below Average &lt;40%, Average 40-59%, Above Average &ge;60%).</ShadcnCardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="h-[300px] w-full min-w-[500px]" data-testid="subject-barchart-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={subjectPerformanceChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                       <Table className="mt-6 border rounded-md min-w-[700px]">
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-semibold py-2 px-3">Subject</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3">Class Avg (%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-red-600 dark:text-red-400">Below Avg (&lt;40%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-blue-600 dark:text-blue-400">Average (40-59%)</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3 text-green-600 dark:text-green-400">Above Avg (&ge;60%)</TableHead>
                          </TableRow>
                        </TableHeader>
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
                 <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-primary border-b pb-2 mb-3 flex items-center"><PieChart className="mr-2 h-5 w-5 text-purple-600" />Gender Statistics</CardTitle>
                         <ShadcnCardDescription className="text-xs text-muted-foreground pt-1">Distribution and average performance by gender.</ShadcnCardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 grid md:grid-cols-2 gap-6 items-center">
                        <div className="h-[250px] w-full min-w-[300px]" data-testid="gender-piechart-container">
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
                        <Table className="border rounded-md min-w-[300px]">
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                            <TableHead className="font-semibold py-2 px-3">Gender</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3">Count</TableHead>
                            <TableHead className="text-center font-semibold py-2 px-3">Overall Avg (%)</TableHead>
                            </TableRow>
                        </TableHeader>
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
                
                <Card className={cn("shadow-md bg-accent/10 print:bg-green-50 border-green-200 dark:border-green-700")}>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-primary border-b pb-2 mb-3 flex items-center">
                        {isLoadingAi && !aiAdvice ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> : <Brain className="mr-2 h-5 w-5 text-green-600" /> }
                        AI Pedagogical Insights &amp; Advice
                    </CardTitle>
                  </CardHeader>
                  {renderAiInsights()}
                </Card>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t no-print dialog-footer-print-hide shrink-0">
          <Button variant="outline" onClick={handlePrint} disabled={!classStats || reports.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Dashboard
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    