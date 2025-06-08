
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, BookOpen, Percent, Users2, PieChart, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, MinusSquare, Loader2, Printer } from 'lucide-react';
import type { GenerateClassInsightsOutput } from '@/ai/flows/generate-class-insights-flow';

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

export default function ClassDashboard({ isOpen, onClose, classStats, aiAdvice, isLoading }: ClassDashboardProps) {
  if (!isOpen) {
    return null;
  }

  const handlePrintDashboard = () => {
    window.print();
  };

  const renderContent = () => {
    if (!classStats) { // Initial loading before stats are calculated, or if no reports.
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <BarChart3 className="h-12 w-12 animate-pulse text-primary" />
          <p className="mt-4 text-lg text-muted-foreground">Calculating class statistics...</p>
        </div>
      );
    }

    return (
      <>
        <div className="dashboard-print-header">
          <h2 className="text-xl font-bold">Class Performance Dashboard: {classStats.className}</h2>
          <p className="text-sm">Date Printed: {new Date().toLocaleDateString()}</p>
        </div>

        <DialogHeader className="mb-4 no-print"> {/* Hide DialogHeader on print */}
          <DialogTitle className="text-2xl flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Class Performance Dashboard: {classStats.className}
          </DialogTitle>
          <DialogDescription>
            An overview of class performance based on {classStats.totalStudents} student reports. Pass Mark: {classStats.passMark}%.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-200px)] pr-3"> {/* Adjusted max height */}
          <div className="space-y-6">
            {/* Overall Class Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Overall Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Total Students Analyzed:</p>
                  <p className="font-semibold text-lg">{classStats.totalStudents}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Overall Class Average:</p>
                  <p className="font-semibold text-lg">
                    {classStats.overallClassAverage !== null ? `${classStats.overallClassAverage.toFixed(2)}%` : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Subject Performance */}
            {classStats.subjectStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Subject Performance
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
                            {subject.averageMark !== null ? `${subject.averageMark.toFixed(1)}%` : 'N/A'}
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

            {/* Gender Performance */}
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
                            {genderStat.averageScore !== null ? `${genderStat.averageScore.toFixed(2)}%` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

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
                    <p className="text-center text-muted-foreground py-5">No AI insights available or an error occurred.</p>
                )}
                </CardContent>
              </Card>
          </div>
        </ScrollArea>
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-full" id="class-dashboard-dialog-content"> {/* Increased width and added ID */}
        {renderContent()}
        <DialogFooter className="mt-6 pt-4 border-t dialog-footer-print-hide"> {/* Added dialog-footer-print-hide to entire footer */}
          <Button onClick={handlePrintDashboard} variant="default">
            <Printer className="mr-2 h-4 w-4" />
            Print Dashboard
          </Button>
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
