
'use client';

import type {ReportData, SubjectEntry} from '@/lib/schemas';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportPreviewProps {
  data: ReportData;
}

// Basic grading logic (can be expanded)
// Assumes CA and Exam marks are out of 100 each for simplicity, or total is out of 200.
// Or, if CA max is 40 and Exam max is 60, total is out of 100.
// For this example, let's assume total mark is out of 100 for simplicity if not specified.
// We'll calculate total as sum, and grade based on a generic 0-100 scale for the total.
// Let's assume total possible score for each subject is 100 for grading.
const getGradeAndRemarks = (totalMark: number | null): { grade: string; remarks: string } => {
  if (totalMark === null || totalMark < 0) return { grade: 'N/A', remarks: 'Not available' };
  
  // Assuming total possible score for grading is 100 for each subject
  // If CA and Exam are out of different totals, this logic would need adjustment.
  // For now, let's assume the `totalMark` calculated is effectively out of 100 for grading.
  // Or, if CA + Exam is, e.g. 40 + 60 = 100. This is a common scenario.
  // If CA and Exam marks are up to 100 each, then total can be 200.
  // The schema has max 100 for each, so total can be 200.
  // Let's make grade based on percentage of 200.
  const percentage = (totalMark / 200) * 100; // If CA max 100, Exam max 100

  if (percentage >= 90) return { grade: 'A+', remarks: 'Excellent' };
  if (percentage >= 80) return { grade: 'A', remarks: 'Very Good' };
  if (percentage >= 70) return { grade: 'B+', remarks: 'Good' };
  if (percentage >= 60) return { grade: 'B', remarks: 'Satisfactory' };
  if (percentage >= 50) return { grade: 'C', remarks: 'Needs Improvement' };
  if (percentage >= 40) return { grade: 'D', remarks: 'Unsatisfactory' };
  return { grade: 'F', remarks: 'Fail' };
};


export default function ReportPreview({ data }: ReportPreviewProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div id="report-preview" className="bg-white p-6 md:p-8 rounded-lg border border-gray-200 min-h-[700px] flex flex-col text-sm">
      <header className="mb-8 pb-4 border-b border-gray-300">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-headline font-bold text-primary">{data.schoolName || 'School Name'}</h2>
            <p className="text-muted-foreground">{data.academicYear || 'Academic Year'}</p>
          </div>
          <Image 
            src="https://placehold.co/120x60.png" 
            alt="School Logo" 
            width={120} 
            height={60}
            data-ai-hint="school logo"
            className="object-contain"
          />
        </div>
        <h1 className="text-3xl font-headline font-semibold text-center mt-4 text-gray-700">Student Report Card</h1>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <strong className="text-gray-600">Student Name:</strong>
          <p className="text-gray-800">{data.studentName}</p>
        </div>
        <div>
          <strong className="text-gray-600">Class:</strong>
          <p className="text-gray-800">{data.className}</p>
        </div>
      </section>

      {/* Subject Performance Table */}
      {data.subjects && data.subjects.length > 0 && (
        <section className="mb-6">
          <h3 className="text-lg font-headline font-semibold mb-2 text-primary border-b pb-1">Subject Performance</h3>
          <Table className="border rounded-md">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-gray-600 w-[30%]">Subject</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">CA Mark</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">Exam Mark</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">Total (200)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">Grade</TableHead>
                <TableHead className="font-semibold text-gray-600 w-[25%]">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subjects.map((subject, index) => {
                const caMark = subject.continuousAssessment ?? 0;
                const examMark = subject.examinationMark ?? 0;
                const totalMark = (subject.continuousAssessment === null && subject.examinationMark === null) ? null : caMark + examMark;
                const { grade, remarks } = getGradeAndRemarks(totalMark);
                
                return (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-700">{subject.subjectName}</TableCell>
                    <TableCell className="text-center text-gray-700">{subject.continuousAssessment === null ? '-' : subject.continuousAssessment}</TableCell>
                    <TableCell className="text-center text-gray-700">{subject.examinationMark === null ? '-' : subject.examinationMark}</TableCell>
                    <TableCell className="text-center text-gray-700 font-medium">{totalMark === null ? '-' : totalMark}</TableCell>
                    <TableCell className="text-center text-gray-700">{grade}</TableCell>
                    <TableCell className="text-gray-700">{remarks}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      <div className="space-y-6 flex-grow">
        <ReportSection title="Overall Performance Summary">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.performanceSummary}</p>
        </ReportSection>

        <ReportSection title="Strengths">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.strengths}</p>
        </ReportSection>

        <ReportSection title="Areas for Improvement">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.areasForImprovement}</p>
        </ReportSection>

        {data.teacherFeedback && (
          <ReportSection title="Teacher's Feedback" highlightColor="bg-green-50">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.teacherFeedback}</p>
          </ReportSection>
        )}
      </div>

      <footer className="mt-10 pt-6 border-t border-gray-300 text-xs text-gray-600">
        <div className="flex justify-between items-center">
          <div>
            <p><strong>Date Issued:</strong> {currentDate}</p>
          </div>
          <div>
            <p className="mb-1"><strong>Teacher's Signature:</strong></p>
            <div className="h-10 border-b border-gray-400 w-48"></div>
          </div>
        </div>
         <p className="text-center mt-6 text-gray-500">&copy; {new Date().getFullYear()} {data.schoolName || 'School Name'}. Confidential Document.</p>
      </footer>
    </div>
  );
}

interface ReportSectionProps {
  title: string;
  children: React.ReactNode;
  highlightColor?: string;
}

function ReportSection({ title, children, highlightColor }: ReportSectionProps) {
  return (
    <div className={`p-4 border border-gray-200 rounded-md shadow-sm ${highlightColor || ''}`}>
      <h3 className="text-lg font-headline font-semibold mb-2 text-primary border-b pb-1">{title}</h3>
      {children}
    </div>
  );
}
