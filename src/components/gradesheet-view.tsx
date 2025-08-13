
'use client';

import React from 'react';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';

interface GradesheetViewProps {
  reports: ReportData[];
  subjects: string[];
  onScoreChange: (reportId: string, subjectName: string, markType: 'continuousAssessment' | 'examinationMark', value: string) => void;
}

const GradesheetView: React.FC<GradesheetViewProps> = ({ reports, subjects, onScoreChange }) => {
  if (reports.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No students in this class to display on the gradesheet.</div>;
  }
  
  return (
    <div className="overflow-x-auto relative border rounded-lg">
      <Table className="min-w-full">
        <TableHeader className="sticky top-0 bg-muted z-10">
          <TableRow>
            <TableHead className="w-[40px] sticky left-0 bg-muted z-20">#</TableHead>
            <TableHead className="min-w-[200px] sticky left-10 bg-muted z-20">Student Name</TableHead>
            {subjects.map(subject => (
              <TableHead key={subject} colSpan={2} className="text-center border-l min-w-[150px]">
                {subject}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            <TableHead className="sticky left-0 bg-muted z-20"></TableHead>
            <TableHead className="sticky left-10 bg-muted z-20"></TableHead>
            {subjects.map(subject => (
              <React.Fragment key={`${subject}-sub`}>
                <TableHead className="text-center border-l">CA (60)</TableHead>
                <TableHead className="text-center">Exam (100)</TableHead>
              </React.Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report, index) => (
            <TableRow key={report.id}>
              <TableCell className="sticky left-0 bg-background z-20">{index + 1}</TableCell>
              <TableCell className="font-medium sticky left-10 bg-background z-20">{report.studentName}</TableCell>
              {subjects.map(subjectName => {
                const subjectData = report.subjects.find(s => s.subjectName === subjectName);
                return (
                  <React.Fragment key={`${report.id}-${subjectName}`}>
                    <TableCell className="border-l p-1">
                      <Input
                        type="number"
                        placeholder="-"
                        className="text-center min-w-[60px]"
                        value={subjectData?.continuousAssessment ?? ''}
                        onChange={(e) => onScoreChange(report.id, subjectName, 'continuousAssessment', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                       <Input
                        type="number"
                        placeholder="-"
                        className="text-center min-w-[60px]"
                        value={subjectData?.examinationMark ?? ''}
                        onChange={(e) => onScoreChange(report.id, subjectName, 'examinationMark', e.target.value)}
                      />
                    </TableCell>
                  </React.Fragment>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default GradesheetView;
