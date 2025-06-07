
'use client';

import type {ReportData, SubjectEntry} from '@/lib/schemas';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Medal } from 'lucide-react'; // For rank display, Medal for promotion

interface ReportPreviewProps {
  data: ReportData;
}

const getGradeAndRemarks = (
  caMarkInput: number | null | undefined, 
  examMarkInput: number | null | undefined 
): { grade: string; remarks: string; finalMark: number | string } => {
  if ((caMarkInput === null || caMarkInput === undefined) && (examMarkInput === null || examMarkInput === undefined)) {
    return { grade: 'N/A', remarks: 'Not available', finalMark: '-' };
  }

  const scaledCaMark = (caMarkInput !== null && caMarkInput !== undefined) ? (caMarkInput / 60) * 40 : 0;
  const scaledExamMark = (examMarkInput !== null && examMarkInput !== undefined) ? (examMarkInput / 100) * 60 : 0;

  let finalPercentageMark: number;
  finalPercentageMark = scaledCaMark + scaledExamMark;
  finalPercentageMark = Math.min(finalPercentageMark, 100); 
  const displayFinalMark = parseFloat(finalPercentageMark.toFixed(1));

  if (finalPercentageMark >= 90) return { grade: 'A+', remarks: 'Excellent', finalMark: displayFinalMark };
  if (finalPercentageMark >= 80) return { grade: 'A', remarks: 'Very Good', finalMark: displayFinalMark };
  if (finalPercentageMark >= 70) return { grade: 'B+', remarks: 'Good', finalMark: displayFinalMark };
  if (finalPercentageMark >= 60) return { grade: 'B', remarks: 'Satisfactory', finalMark: displayFinalMark };
  if (finalPercentageMark >= 50) return { grade: 'C', remarks: 'Needs Improvement', finalMark: displayFinalMark };
  if (finalPercentageMark >= 40) return { grade: 'D', remarks: 'Unsatisfactory', finalMark: displayFinalMark };
  if (finalPercentageMark < 40 && finalPercentageMark >=0) return { grade: 'F', remarks: 'Fail', finalMark: displayFinalMark };
  
  return { grade: 'N/A', remarks: 'Incomplete Data', finalMark: displayFinalMark > 0 ? displayFinalMark : '-' };
};

const tertiaryLevelClassesList = [ 
  "LEVEL 100", "LEVEL 200", "LEVEL 300", "LEVEL 400", "LEVEL 500", "LEVEL 600", "LEVEL 700"
];

export default function ReportPreview({ data }: ReportPreviewProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const attendanceString = (data.daysAttended !== null && data.daysAttended !== undefined && data.totalSchoolDays !== null && data.totalSchoolDays !== undefined)
    ? `${data.daysAttended} / ${data.totalSchoolDays} days`
    : 'N/A';

  const isPromotionStatusRelevant = data.academicTerm === 'Third Term' && 
                                   data.className && 
                                   !tertiaryLevelClassesList.includes(data.className);

  return (
    <div id="printable-report-area" className="a4-page-simulation flex flex-col text-sm">
      <header className="mb-6 pb-3 border-b border-gray-300">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-headline font-bold text-primary">{data.schoolName || 'School Name'}</h2>
            <p className="text-muted-foreground">{data.academicYear || 'Academic Year'} - {data.academicTerm || 'Term/Semester'}</p>
            {data.studentEntryNumber && (
              <p className="text-xs text-gray-500 mt-0.5">Entry #: {data.studentEntryNumber}</p>
            )}
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
        <h1 className="text-3xl font-headline font-semibold text-center mt-3 text-gray-700">Student Report Card</h1>
      </header>

      <section className="mb-4 flex justify-between items-start">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs flex-grow pr-4">
          <div>
            <span className="font-semibold text-gray-600">Student Name:</span>
            <p className="text-gray-800 text-sm">{data.studentName}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Class:</span>
            <p className="text-gray-800 text-sm">{data.className}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Gender:</span>
            <p className="text-gray-800 text-sm">{data.gender || 'N/A'}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Attendance:</span>
            <p className="text-gray-800 text-sm">{attendanceString}</p>
          </div>
          {data.rank && (
            <div className="col-span-1">
              <span className="font-semibold text-gray-600 flex items-center"><Award className="mr-1 h-3.5 w-3.5 text-amber-500" />Position:</span>
              <p className="text-gray-800 text-sm font-semibold">{data.rank}</p>
            </div>
          )}
           {data.overallAverage !== undefined && data.overallAverage !== null && (
            <div className="col-span-1">
              <span className="font-semibold text-gray-600">Overall Avg:</span>
              <p className="text-gray-800 text-sm font-semibold">{data.overallAverage.toFixed(2)}%</p>
            </div>
          )}
          {isPromotionStatusRelevant && data.promotionStatus && (
            <div className="sm:col-span-1">
              <span className="font-semibold text-gray-600 flex items-center"><Medal className="mr-1 h-3.5 w-3.5 text-green-600" />Promotion:</span>
              <p className="text-gray-800 text-sm font-semibold">{data.promotionStatus}</p>
            </div>
          )}
        </div>
        {data.studentPhotoDataUri && (
          <div className="ml-auto flex-shrink-0 text-center">
            <Image
              src={data.studentPhotoDataUri}
              alt={`${data.studentName || 'Student'}'s photo`}
              width={80}
              height={100}
              className="object-cover rounded border border-gray-300 shadow-sm"
              data-ai-hint="student portrait"
            />
            <p className="text-xs text-gray-700 mt-1 font-medium">{data.studentName}</p>
          </div>
        )}
      </section>


      {data.subjects && data.subjects.length > 0 && (
        <section className="mb-4">
          <h3 className="text-base font-headline font-semibold mb-1.5 text-primary border-b pb-0.5">Subject Performance</h3>
          <Table className="border rounded-md text-xs">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-gray-600 w-[28%] py-1 px-2">Subject</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-1 px-2">CA (60)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-1 px-2">Exam (100)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-1 px-2">Final (100)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-1 px-2">Grade</TableHead>
                <TableHead className="font-semibold text-gray-600 w-[25%] py-1 px-2">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subjects.map((subject, index) => {
                 if (!subject.subjectName || subject.subjectName.trim() === '') return null; 
                const { grade, remarks, finalMark } = getGradeAndRemarks(subject.continuousAssessment, subject.examinationMark);

                return (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-700 py-1 px-2">{subject.subjectName}</TableCell>
                    <TableCell className="text-center text-gray-700 py-1 px-2">{subject.continuousAssessment === null || subject.continuousAssessment === undefined ? '-' : subject.continuousAssessment}</TableCell>
                    <TableCell className="text-center text-gray-700 py-1 px-2">{subject.examinationMark === null || subject.examinationMark === undefined ? '-' : subject.examinationMark}</TableCell>
                    <TableCell className="text-center text-gray-700 font-medium py-1 px-2">{finalMark}</TableCell>
                    <TableCell className="text-center text-gray-700 py-1 px-2">{grade}</TableCell>
                    <TableCell className="text-gray-700 py-1 px-2">{remarks}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      <div className="space-y-4 flex-grow text-xs">
        {data.performanceSummary && (
          <ReportSection title="Overall Performance Summary">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.performanceSummary}</p>
          </ReportSection>
        )}

        {data.strengths && (
          <ReportSection title="Strengths">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.strengths}</p>
          </ReportSection>
        )}

        {data.areasForImprovement && (
          <ReportSection title="Areas for Improvement">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.areasForImprovement}</p>
          </ReportSection>
        )}

        {data.teacherFeedback && (
          <ReportSection title="Teacher's Feedback" highlightColor="bg-green-50 print:bg-green-50">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.teacherFeedback}</p>
          </ReportSection>
        )}
      </div>

      <footer className="mt-8 pt-4 border-t border-gray-300 text-[10px] text-gray-600">
        <div className="flex justify-between items-end">
          <div>
            <p><span className="font-semibold">Date Issued:</span> {currentDate}</p>
            {data.instructorContact && (
              <p className="mt-1"><span className="font-semibold">Instructor Contact:</span> {data.instructorContact}</p>
            )}
          </div>
          <div>
            <p className="mb-1 font-semibold">Teacher's Signature:</p>
            <div className="h-8 border-b border-gray-400 w-40"></div>
          </div>
        </div>
         <p className="text-center mt-4 text-gray-500">&copy; {new Date().getFullYear()} {data.schoolName || 'School Name'}. Confidential Document.</p>
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
    <div className={`p-3 border border-gray-200 rounded-md shadow-sm ${highlightColor || ''}`}>
      <h3 className="text-base font-headline font-semibold mb-1.5 text-primary border-b pb-0.5">{title}</h3>
      {children}
    </div>
  );
}
