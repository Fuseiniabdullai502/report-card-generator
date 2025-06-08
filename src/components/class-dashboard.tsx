
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, BookOpen, Percent, Users2, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, MinusSquare, Loader2, Printer, Save, PieChart as PieChartIcon, Info } from 'lucide-react';
import type { GenerateClassInsightsOutput } from '@/ai/flows/generate-class-insights-flow';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";


export interface SubjectPerformanceStatForUI {
  subjectName: string;
  averageMark: number | null;
  studentsAboveAverage: number;
  studentsAtAverage: number;
  studentsBelowAverage: number;
  passRate: number;
}

export interface GenderPerformanceStatForUI {
  gender: string;
  averageScore: number | null;
  count: number;
}

export interface ClassStatistics {
  className: string;
  totalStudents: number;
  overallClassAverage: number | null;
  subjectStats: SubjectPerformanceStatForUI[];
  genderStats: GenderPerformanceStatForUI[];
  passMark: number;
}

interface ClassDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  classStats: ClassStatistics | null;
  aiAdvice: GenerateClassInsightsOutput | null;
  isLoading: boolean; // For AI advice loading
}

const subjectChartConfig = {
  averageMark: {
    label: "Avg. Mark",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const genderChartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];


// Helper for custom pie chart label
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent * 100 < 5) return null; // Don't render label if slice is too small

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-medium">
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};


export default function ClassDashboard({ isOpen, onClose, classStats, aiAdvice, isLoading }: ClassDashboardProps) {
  if (!isOpen) {
    return null;
  }

  if (!classStats) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-3xl w-full max-h-[90svh] flex flex-col" id="class-dashboard-dialog-content">
          <div className="flex flex-col items-center justify-center h-64">
            <BarChart3 className="h-12 w-12 animate-pulse text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Calculating class statistics...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  const handlePrintDashboard = () => {
    window.print();
  };

  const subjectChartData = classStats?.subjectStats
    .filter(s => s.averageMark !== null)
    .map(s => ({ name: s.subjectName, averageMark: s.averageMark! })) || [];

  const genderChartData = classStats?.genderStats
    .filter(g => g.count > 0)
    .map((g, index) => ({
      name: g.gender,
      value: g.count,
      fill: genderChartColors[index % genderChartColors.length],
    })) || [];
    
  const genderChartConfig = classStats?.genderStats.reduce((acc, stat, index) => {
      acc[stat.gender.toLowerCase().replace(/\s+/g, '')] = { // e.g., 'male', 'unspecified'
          label: stat.gender,
          color: genderChartColors[index % genderChartColors.length]
      };
      return acc;
  }, {} as ChartConfig) || {};

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl w-full max-h-[90svh] flex flex-col" id="class-dashboard-dialog-content">
            <div className="dashboard-print-header">
              <h2 className="text-xl font-bold">Class Performance Dashboard: {classStats.className}</h2>
              <p className="text-sm">Date Printed: {new Date().toLocaleDateString()}</p>
            </div>

            <DialogHeader className="mb-4 no-print">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <BarChart3 className="h-7 w-7 text-primary" />
                Class Performance Dashboard: {classStats.className}
              </DialogTitle>
              <DialogDescription>
                An overview of class performance based on {classStats.totalStudents} student reports. Pass Mark: {classStats.passMark}%.
                Use the buttons below to print or save as PDF (via print options).
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 pr-3">
              <div className="space-y-6">
                {/* Overall Class Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Overall Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Total Students Analyzed:</p>
                      <p className="font-semibold text-base">{classStats.totalStudents}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Overall Class Average:</p>
                      <p className="font-semibold text-base break-all" data-testid="overall-class-average-value">
                        {typeof classStats.overallClassAverage === 'number'
                          ? `${classStats.overallClassAverage.toFixed(2)}%`
                          : 'N/A'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Subject Performance Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Subject Average Marks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subjectChartData.length > 0 ? (
                      <ChartContainer config={subjectChartConfig} className="min-h-[200px] w-full">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={subjectChartData} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                            <ChartTooltip
                              content={<ChartTooltipContent />}
                              cursor={{ fill: "hsl(var(--background))", opacity: 0.5 }}
                            />
                            <Bar dataKey="averageMark" fill="var(--color-averageMark)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground bg-muted/30 rounded-md p-4">
                        <Info className="h-8 w-8 mb-2 text-primary" />
                        <p className="text-center">No data available for subject average marks.</p>
                        <p className="text-xs text-center mt-1">Ensure subjects have marks entered in student reports.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subject Performance Table */}
                {classStats.subjectStats.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Subject Performance Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead className="text-center">Avg. Mark</TableHead>
                            <TableHead className="text-center">Pass Rate</TableHead>
                            <TableHead className="text-center"><ArrowUpWideNarrow className="inline h-4 w-4 mr-1 text-green-500"/>Above Avg.</TableHead>
                            <TableHead className="text-center"><MinusSquare className="inline h-4 w-4 mr-1 text-yellow-500"/>At Avg.</TableHead>
                            <TableHead className="text-center"><ArrowDownWideNarrow className="inline h-4 w-4 mr-1 text-red-500"/>Below Avg.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classStats.subjectStats.map((subject) => (
                            <TableRow key={subject.subjectName}>
                              <TableCell className="font-medium">{subject.subjectName}</TableCell>
                              <TableCell className="text-center">
                                {typeof subject.averageMark === 'number' ? `${subject.averageMark.toFixed(1)}%` : 'N/A'}
                              </TableCell>
                              <TableCell className="text-center">{subject.passRate.toFixed(0)}%</TableCell>
                              <TableCell className="text-center">{subject.studentsAboveAverage}</TableCell>
                              <TableCell className="text-center">{subject.studentsAtAverage}</TableCell>
                              <TableCell className="text-center">{subject.studentsBelowAverage}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                
                {/* Gender Distribution Pie Chart & Table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-primary" />
                        Gender Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {genderChartData.length > 0 ? (
                        <ChartContainer config={genderChartConfig} className="min-h-[200px] w-full aspect-square">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                              <Pie
                                data={genderChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                labelLine={false}
                                label={renderCustomizedLabel}
                              >
                                {genderChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground bg-muted/30 rounded-md p-4">
                          <Info className="h-8 w-8 mb-2 text-primary" />
                          <p className="text-center">No gender data available for chart.</p>
                          <p className="text-xs text-center mt-1">Ensure student gender is specified in reports.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {classStats.genderStats.filter(g => g.count > 0).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users2 className="h-5 w-5 text-primary" />
                          Gender Performance (Overall Average)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Gender</TableHead>
                              <TableHead className="text-center">Student Count</TableHead>
                              <TableHead className="text-center">Average Score</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {classStats.genderStats.filter(g => g.count > 0).map((genderStat) => (
                              <TableRow key={genderStat.gender}>
                                <TableCell className="font-medium">{genderStat.gender}</TableCell>
                                <TableCell className="text-center">{genderStat.count}</TableCell>
                                <TableCell className="text-center">
                                  {typeof genderStat.averageScore === 'number' ? `${genderStat.averageScore.toFixed(2)}%` : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>


                {/* AI Teacher Advice */}
                <Card className="bg-accent/10 border-accent">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-accent">
                        <Star className="h-5 w-5 animate-pulse" />
                        AI Generated Insights & Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-3 text-muted-foreground">Loading AI Insights...</p>
                        </div>
                    ) : aiAdvice ? (
                        <>
                        <div>
                            <h4 className="font-semibold">Overall Summary:</h4>
                            <p className="whitespace-pre-wrap">{aiAdvice.overallSummary}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold">Subject Analysis:</h4>
                            <p className="whitespace-pre-wrap">{aiAdvice.subjectAnalysis}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold">Gender Analysis:</h4>
                            <p className="whitespace-pre-wrap">{aiAdvice.genderAnalysis}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold">Recommendations:</h4>
                            <p className="whitespace-pre-wrap">{aiAdvice.recommendations}</p>
                        </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-5 text-muted-foreground">
                          <Info className="h-8 w-8 mb-2 text-primary" />
                          <p className="text-center">No AI insights available.</p>
                          <p className="text-xs text-center mt-1">This could be due to an error or if insights generation was not triggered.</p>
                        </div>
                    )}
                    </CardContent>
                  </Card>
              </div>
            </ScrollArea>

            <DialogFooter className="mt-6 pt-4 border-t dialog-footer-print-hide">
              <Button onClick={handlePrintDashboard} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                Print Dashboard
              </Button>
              <Button onClick={onClose} variant="default"> {/* Changed "Save as PDF" to just "Close" for simplicity, print handles PDF */}
                Close
              </Button>
            </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    