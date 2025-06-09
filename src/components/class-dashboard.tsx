
'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Users, TrendingUp, Percent, PieChart, Brain, Printer, Loader2, AlertTriangle, Info } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart as RechartsPieChart, Pie, Cell, TooltipProps } from 'recharts';
import { getAiClassInsightsAction } from '@/app/actions';
import type { GenerateClassInsightsOutput, GenerateClassInsightsInput } from '@/ai/flows/generate-class-insights-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ClassPerformanceDashboardProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  reports: ReportData[];
  classNameProp: string; // Renamed to avoid conflict with component's className prop
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

// Helper to calculate final mark for a single subject for internal use
function calculateInternalSubjectFinalMark(subject: SubjectEntry): number | null {
  const caMarkInput = subject.continuousAssessment;
  const examMarkInput = subject.examinationMark;

  if ((caMarkInput === null || caMarkInput === undefined) && (examMarkInput === null || examMarkInput === undefined)) {
    return null; // Not enough data to calculate
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
  classNameProp, // Use renamed prop
  academicTerm,
}: ClassPerformanceDashboardProps) {
  const [classStats, setClassStats] = useState<ClassStatistics | null>(null);
  const [aiAdvice, setAiAdvice] = useState<GenerateClassInsightsOutput | null>(null);
  const [isLoading, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && reports.length > 0) {
      // Calculate statistics
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
            genderMap.get(gender)!.count++;
        } else {
             // Still count student even if no average, for gender distribution
            if (!genderMap.has(gender)) {
                genderMap.set(gender, { scores: [], count: 0 });
            }
            genderMap.get(gender)!.count++;
        }
      });
      
      const genderStats: GenderPerformanceStatForUI[] = Array.from(genderMap.entries()).map(([gender, data]) => ({
        gender,
        count: data.count,
        averageScore: data.scores.length > 0 ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2)) : null,
      }));

      const newStats = { overallClassAverage, totalStudents, subjectStats, genderStats };
      setClassStats(newStats);

      // Fetch AI insights
      setAiAdvice(null); // Reset previous advice
      startTransition(async () => {
        try {
          const aiInput: GenerateClassInsightsInput = {
            className: classNameProp,
            academicTerm,
            overallClassAverage: newStats.overallClassAverage,
            totalStudents: newStats.totalStudents,
            subjectStats: newStats.subjectStats.map(s => ({
                subjectName: s.subjectName,
                numBelowAverage: s.numBelowAverage,
                numAverage: s.numAverage,
                numAboveAverage: s.numAboveAverage,
                classAverageForSubject: s.classAverageForSubject,
            })),
            genderStats: newStats.genderStats.map(g => ({
                gender: g.gender,
                count: g.count,
                averageScore: g.averageScore,
            })),
          };
          const result = await getAiClassInsightsAction(aiInput);
          if (result.success && result.insights) {
            setAiAdvice(result.insights);
          } else {
            toast({ title: "AI Insights Error", description: result.error || "Failed to load AI insights.", variant: "destructive" });
          }
        } catch (error) {
          toast({ title: "AI Insights Request Failed", description: "Could not fetch AI insights.", variant: "destructive" });
        }
      });
    } else if (isOpen && reports.length === 0) {
      setClassStats(null);
      setAiAdvice(null);
    }
  }, [isOpen, reports, classNameProp, academicTerm, toast]);

  const handlePrint = () => {
    const printContents = document.getElementById('class-dashboard-dialog-content')?.innerHTML;
    const originalContents = document.body.innerHTML;

    if (printContents) {
        document.body.innerHTML = `<div class="print-container">${printContents}</div>`;
        const header = document.createElement('div');
        header.className = 'dashboard-print-header'; 
        header.innerHTML = `<h2>Class Performance Dashboard: ${classNameProp} (${academicTerm})</h2> <p>Generated on: ${new Date().toLocaleDateString()}</p>`;
        document.querySelector('.print-container')?.prepend(header);
        
        window.print();
        document.body.innerHTML = originalContents;
        onOpenChange(false); 
        setTimeout(() => onOpenChange(true), 100);
    } else {
         toast({title: "Print Error", description: "Could not find dashboard content to print.", variant: "destructive"});
    }
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
  const GENDER_COLORS = ['#0088FE', '#FF8042', '#FFBB28', '#00C49F'];


  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background/80 border rounded-md shadow-lg backdrop-blur-sm">
          <p className="label font-semibold text-foreground">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        id="class-dashboard-dialog-content"
        className="sm:max-w-4xl h-[90dvh] flex flex-col overflow-y-hidden" // Removed p-0, default p-6 will apply
      >
        <DialogHeader className="border-b no-print"> {/* Removed p-4 */}
          <DialogTitle className="flex items-center text-xl">
            <BarChart3 className="mr-2 h-6 w-6 text-primary" />
            Class Performance Dashboard: {classNameProp}
          </DialogTitle>
          <DialogDescription>
            {academicTerm} - Insights and statistics for the class.
          </DialogDescription>
        </DialogHeader>
        <div id="dashboard-print-header" className="dashboard-print-header hidden print:block p-4 border-b">
            <h2 className="text-lg font-bold">Class Performance Dashboard: {classNameProp} ({academicTerm})</h2>
            <p className="text-sm">Generated on: {new Date().toLocaleDateString()}</p>
        </div>

        <ScrollArea className="flex-1 min-h-0 no-print" data-testid="dashboard-scroll-area">
          <div className="space-y-6 overflow-x-auto"> {/* Removed p-4 */}
            {!classStats && reports.length > 0 && isLoading && (
              <Card className="shadow-none">
                <CardContent className="pt-6 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating class statistics...
                </CardContent>
              </Card>
            )}
            {reports.length === 0 && !isLoading && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center text-lg"><Info className="mr-2 h-5 w-5 text-blue-500" />No Reports Available</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">There are no student reports in the print list to generate a class dashboard. Please add reports first.</p>
                    </CardContent>
                </Card>
            )}
            {!classStats && reports.length > 0 && !isLoading && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center text-lg"><AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />Data Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Could not calculate class statistics. Please check report data or try again.</p>
                    </CardContent>
                </Card>
            )}


            {classStats && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg"><Users className="mr-2 h-5 w-5 text-primary" />Overall Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg"><TrendingUp className="mr-2 h-5 w-5 text-green-500" />Subject Performance Details</CardTitle>
                      <CardDescription>Distribution of students based on score bands per subject (Below Average &lt;40%, Average 40-59%, Above Average &ge;60%).</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full" data-testid="subject-barchart-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={subjectPerformanceChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <XAxis dataKey="name" angle={-30} textAnchor="end" height={70} interval={0} tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }} />
                            <Legend wrapperStyle={{fontSize: "12px"}} />
                            <Bar dataKey="Below Average (<40%)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={15} />
                            <Bar dataKey="Average (40-59%)" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} barSize={15} />
                            <Bar dataKey="Above Average (>=60%)" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={15} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                       <Table className="mt-4 min-w-[700px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead className="text-center">Class Avg (%)</TableHead>
                            <TableHead className="text-center">Below Avg (&lt;40%)</TableHead>
                            <TableHead className="text-center">Average (40-59%)</TableHead>
                            <TableHead className="text-center">Above Avg (&ge;60%)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classStats.subjectStats.map(s => (
                            <TableRow key={s.subjectName}>
                              <TableCell className="font-medium">{s.subjectName}</TableCell>
                              <TableCell className="text-center">{s.classAverageForSubject?.toFixed(1) || 'N/A'}</TableCell>
                              <TableCell className="text-center">{s.numBelowAverage}</TableCell>
                              <TableCell className="text-center">{s.numAverage}</TableCell>
                              <TableCell className="text-center">{s.numAboveAverage}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {classStats.genderStats.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center text-lg"><PieChart className="mr-2 h-5 w-5 text-purple-500" />Gender Performance</CardTitle>
                         <CardDescription>Distribution and average performance by gender.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-6 items-center">
                        <div className="h-[250px] w-full" data-testid="gender-piechart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                            <Pie
                                data={genderChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
                                    const RADIAN = Math.PI / 180;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    return (
                                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px">
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
                            <Legend wrapperStyle={{fontSize: "12px"}}/>
                            </RechartsPieChart>
                        </ResponsiveContainer>
                        </div>
                        <Table className="min-w-[400px]">
                        <TableHeader>
                            <TableRow>
                            <TableHead>Gender</TableHead>
                            <TableHead className="text-center">Count</TableHead>
                            <TableHead className="text-center">Overall Avg (%)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classStats.genderStats.map(g => (
                            <TableRow key={g.gender}>
                                <TableCell className="font-medium">{g.gender}</TableCell>
                                <TableCell className="text-center">{g.count}</TableCell>
                                <TableCell className="text-center">{g.averageScore?.toFixed(1) || 'N/A'}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </CardContent>
                    </Card>
                )}
                
                <Card className={cn("bg-accent/10 border-accent/30", isLoading && aiAdvice === null && classStats ? "" : "border-green-200 bg-green-50/50")}>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                        {isLoading && aiAdvice === null && classStats ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> : <Brain className="mr-2 h-5 w-5 text-green-600" /> }
                        AI Pedagogical Insights &amp; Advice
                    </CardTitle>
                    {isLoading && aiAdvice === null && classStats && <CardDescription>Generating tailored advice for your class...</CardDescription>}
                    {!isLoading && !aiAdvice && classStats && <CardDescription className="text-destructive-foreground/80">Could not load AI insights. Please check your connection or try again.</CardDescription>}
                  </CardHeader>
                  {aiAdvice && (
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <h4 className="font-semibold text-green-700">Overall Assessment:</h4>
                        <p className="text-muted-foreground pl-2">{aiAdvice.overallAssessment}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-green-700">Key Strengths:</h4>
                        <ul className="list-disc list-inside pl-2 text-muted-foreground">
                          {aiAdvice.strengths.map((s, i) => <li key={`strength-${i}`}>{s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-yellow-700">Areas for Concern:</h4>
                        <ul className="list-disc list-inside pl-2 text-muted-foreground">
                          {aiAdvice.areasForConcern.map((a, i) => <li key={`concern-${i}`}>{a}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-700">Actionable Advice for Teacher:</h4>
                        <ul className="list-disc list-inside pl-2 text-muted-foreground">
                          {aiAdvice.actionableAdvice.map((adv, i) => <li key={`advice-${i}`}>{adv}</li>)}
                        </ul>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t no-print dialog-footer-print-hide"> {/* Removed p-4 */}
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

    