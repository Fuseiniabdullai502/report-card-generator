
'use client';

import type {ReportData, SubjectEntry} from '@/lib/schemas';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportPreviewProps {
  data: ReportData;
}

const getGradeAndRemarks = (
  caMarkInput: number | null,
  examMarkInput: number | null
): { grade: string; remarks: string; finalMark: number | string } => {
  // If both marks are null, no calculation needed.
  if (caMarkInput === null && examMarkInput === null) {
    return { grade: 'N/A', remarks: 'Not available', finalMark: '-' };
  }

  // Scale CA mark (out of 60) to contribute 40%
  const scaledCaMark = caMarkInput !== null ? (caMarkInput / 60) * 40 : 0;
  // Scale Exam mark (out of 100) to contribute 60%
  const scaledExamMark = examMarkInput !== null ? (examMarkInput / 100) * 60 : 0;

  let finalPercentageMark: number;

  // Calculate final mark based on provided inputs
  // If only one mark is provided, it contributes its scaled value, and the other is 0.
  // If both are provided, their scaled values are summed.
  if (caMarkInput !== null && examMarkInput !== null) {
    finalPercentageMark = scaledCaMark + scaledExamMark;
  } else if (caMarkInput !== null) { // Only CA provided
    finalPercentageMark = scaledCaMark;
  } else { // Only Exam provided (examMarkInput must be !== null here)
    finalPercentageMark = scaledExamMark;
  }
  
  // Ensure final mark doesn't exceed 100 due to potential floating point inaccuracies if inputs were maxed
  finalPercentageMark = Math.min(finalPercentageMark, 100);

  const displayFinalMark = parseFloat(finalPercentageMark.toFixed(1));

  if (finalPercentageMark >= 90) return { grade: 'A+', remarks: 'Excellent', finalMark: displayFinalMark };
  if (finalPercentageMark >= 80) return { grade: 'A', remarks: 'Very Good', finalMark: displayFinalMark };
  if (finalPercentageMark >= 70) return { grade: 'B+', remarks: 'Good', finalMark: displayFinalMark };
  if (finalPercentageMark >= 60) return { grade: 'B', remarks: 'Satisfactory', finalMark: displayFinalMark };
  if (finalPercentageMark >= 50) return { grade: 'C', remarks: 'Needs Improvement', finalMark: displayFinalMark };
  if (finalPercentageMark >= 40) return { grade: 'D', remarks: 'Unsatisfactory', finalMark: displayFinalMark };
  
  // If we reach here, some mark was provided, but it's below 40.
  return { grade: 'F', remarks: 'Fail', finalMark: displayFinalMark };
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
                <TableHead className="text-center font-semibold text-gray-600">CA Mark (60)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">Exam Mark (100)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">Final Score (100)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600">Grade</TableHead>
                <TableHead className="font-semibold text-gray-600 w-[25%]">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subjects.map((subject, index) => {
                const { grade, remarks, finalMark } = getGradeAndRemarks(subject.continuousAssessment, subject.examinationMark);
                
                return (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-700">{subject.subjectName}</TableCell>
                    <TableCell className="text-center text-gray-700">{subject.continuousAssessment === null ? '-' : subject.continuousAssessment}</TableCell>
                    <TableCell className="text-center text-gray-700">{subject.examinationMark === null ? '-' : subject.examinationMark}</TableCell>
                    <TableCell className="text-center text-gray-700 font-medium">{finalMark}</TableCell>
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
