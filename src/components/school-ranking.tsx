'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReportData } from '@/lib/schemas';
import { calculateOverallAverage } from '@/lib/calculations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, School, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SchoolPerformance {
  schoolName: string;
  studentCount: number;
  average: number;
  rankNumber: number;
  rank: string;
}

function getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

export default function SchoolRanking() {
  const [rankedSchools, setRankedSchools] = useState<SchoolPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const reportsQuery = query(collection(db, 'reports'));

    const unsubscribe = onSnapshot(reportsQuery, (querySnapshot) => {
      const reports: ReportData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reports.push({
          ...data,
          id: doc.id,
          subjects: data.subjects || [],
          hobbies: data.hobbies || [],
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
        } as ReportData);
      });

      if (reports.length === 0) {
        setRankedSchools([]);
        setIsLoading(false);
        return;
      }

      const reportsBySchool = new Map<string, ReportData[]>();
      reports.forEach(report => {
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
            ? (arr[index - 1] as any).rankNumber // Casting to any to access rankNumber which will exist
            : index + 1;
          return { ...school, rankNumber };
        });

      const finalRankedSchools = sortedSchools.map((school, index, arr) => {
        const { rankNumber } = school;
        const isTiedWithNext = index < arr.length - 1 && arr[index + 1].rankNumber === rankNumber;
        const isTiedWithPrev = index > 0 && arr[index - 1].rankNumber === rankNumber;
        const isTie = isTiedWithNext || isTiedWithPrev;
        const rankString = `${isTie ? 'T-' : ''}${rankNumber}${getOrdinalSuffix(rankNumber)}`;
        return { ...school, rank: rankString };
      });

      setRankedSchools(finalRankedSchools);
      setIsLoading(false);

    }, (error) => {
      console.error("Error fetching reports for school ranking:", error);
      toast({
        title: "Error Fetching Data",
        description: "Could not load school data for ranking.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy /> School Performance Rankings
        </CardTitle>
        <CardDescription>
          Schools are ranked based on the overall average score of all their students' reports in the system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rankedSchools.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Rank</TableHead>
                <TableHead>School Name</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="text-right">Overall Average</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedSchools.map((school) => (
                <TableRow key={school.schoolName}>
                  <TableCell className="font-bold text-lg">{school.rank}</TableCell>
                  <TableCell className="font-medium">{school.schoolName}</TableCell>
                  <TableCell className="text-center">{school.studentCount}</TableCell>
                  <TableCell className="text-right font-semibold">{school.average.toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
            <div className="text-center text-muted-foreground p-8">
                <School className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4">No school data available to generate rankings.</p>
                <p className="text-xs">Ensure reports have a 'School Name' to be included.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
