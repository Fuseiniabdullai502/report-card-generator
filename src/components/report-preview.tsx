
'use client';

import type {ReportData, SubjectEntry} from '@/lib/schemas';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Medal } from 'lucide-react'; // For rank display, Medal for promotion
import { cn } from '@/lib/utils';

interface ReportPreviewProps {
  data: ReportData;
}

interface TemplateStyles {
  headerContainerClass: string;
  headerTitleClass: string;
  headerSubtitleClass: string;
  sectionTitleClass: string;
  sectionContainerClass: string;
  tableHeaderClass: string;
  overallReportBorderClass: string;
  mainHeaderTextClass: string;
}

const getTemplateSpecificStyles = (templateId?: string): TemplateStyles => {
  switch (templateId) {
    case 'professionalBlue':
      return {
        headerContainerClass: 'pb-3 border-b border-blue-400 bg-blue-50',
        headerTitleClass: 'text-2xl font-headline font-bold text-blue-700',
        headerSubtitleClass: 'text-blue-600 font-semibold',
        sectionTitleClass: 'text-base font-headline font-semibold mb-1.5 text-blue-700 border-b border-blue-300 pb-0.5',
        sectionContainerClass: 'p-2 border border-blue-300 rounded-md shadow-sm', // p-2 from p-3
        tableHeaderClass: 'bg-blue-100',
        overallReportBorderClass: 'border border-blue-400',
        mainHeaderTextClass: 'text-3xl font-headline font-semibold text-center mt-3 text-blue-700',
      };
    case 'elegantGreen':
      return {
        headerContainerClass: 'pb-3 border-b border-green-400 bg-green-50',
        headerTitleClass: 'text-2xl font-headline font-bold text-green-700',
        headerSubtitleClass: 'text-green-600 font-semibold',
        sectionTitleClass: 'text-base font-headline font-semibold mb-1.5 text-green-700 border-b border-green-300 pb-0.5',
        sectionContainerClass: 'p-2 border border-green-300 rounded-md shadow-sm', // p-2 from p-3
        tableHeaderClass: 'bg-green-100',
        overallReportBorderClass: 'border border-green-400',
        mainHeaderTextClass: 'text-3xl font-headline font-semibold text-center mt-3 text-green-700',
      };
    case 'minimalistGray':
      return {
        headerContainerClass: 'pb-2 border-b border-gray-200',
        headerTitleClass: 'text-xl font-headline font-semibold text-gray-700',
        headerSubtitleClass: 'text-gray-500 font-normal text-xs',
        sectionTitleClass: 'text-sm font-headline font-medium mb-1 text-gray-600 border-b border-gray-200 pb-0.5',
        sectionContainerClass: 'p-2 border border-gray-200 rounded shadow-none', // p-2 from p-3 (though it was already p-2 in previous diff)
        tableHeaderClass: 'bg-gray-100',
        overallReportBorderClass: 'border border-gray-300 shadow-sm',
        mainHeaderTextClass: 'text-2xl font-headline font-medium text-center mt-2 text-gray-600',
      };
    case 'academicRed':
      return {
        headerContainerClass: 'pb-3 border-b-2 border-red-500',
        headerTitleClass: 'text-2xl font-headline font-bold text-red-700',
        headerSubtitleClass: 'text-red-600 font-semibold',
        sectionTitleClass: 'text-base font-headline font-bold mb-1.5 text-red-700 border-b border-red-200 pb-0.5',
        sectionContainerClass: 'p-2 border border-red-200 rounded-md', // p-2 from p-3
        tableHeaderClass: 'bg-red-50',
        overallReportBorderClass: 'border border-red-300',
        mainHeaderTextClass: 'text-3xl font-headline font-semibold text-center mt-3 text-red-700',
      };
    case 'creativeTeal':
      return {
        headerContainerClass: 'pb-3 border-b border-teal-400 bg-teal-50',
        headerTitleClass: 'text-2xl font-headline font-bold text-teal-700',
        headerSubtitleClass: 'text-teal-600 font-semibold',
        sectionTitleClass: 'text-base font-headline font-semibold mb-1.5 text-teal-700 border-b border-teal-300 pb-0.5 italic',
        sectionContainerClass: 'p-2 border border-teal-300 rounded-lg shadow-sm', // p-2 from p-3
        tableHeaderClass: 'bg-teal-100',
        overallReportBorderClass: 'border border-teal-400',
        mainHeaderTextClass: 'text-3xl font-headline font-semibold text-center mt-3 text-teal-700',
      };
    default: // Default Template
      return {
        headerContainerClass: 'pb-3 border-b border-gray-300',
        headerTitleClass: 'text-2xl font-headline font-bold text-primary',
        headerSubtitleClass: 'text-muted-foreground font-semibold',
        sectionTitleClass: 'text-base font-headline font-semibold mb-1.5 text-primary border-b pb-0.5',
        sectionContainerClass: 'p-2 border border-gray-200 rounded-md shadow-sm', // p-2 from p-3
        tableHeaderClass: 'bg-gray-50',
        overallReportBorderClass: 'border border-gray-300',
        mainHeaderTextClass: 'text-3xl font-headline font-semibold text-center mt-3 text-gray-700',
      };
  }
};


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
  
  const hobbiesText = data.hobbies && data.hobbies.length > 0 ? data.hobbies.join(', ') : '';
  
  const templateStyles = getTemplateSpecificStyles(data.selectedTemplateId);

  const highlightColorForTeacherFeedback = data.selectedTemplateId === 'elegantGreen' ? 'bg-green-50 print:bg-green-50' 
                                      : data.selectedTemplateId === 'professionalBlue' ? 'bg-blue-50 print:bg-blue-50'
                                      : data.selectedTemplateId === 'creativeTeal' ? 'bg-teal-50 print:bg-teal-50'
                                      : 'bg-green-50 print:bg-green-50'; // Default highlight

  return (
    <div id="printable-report-area" className={cn("a4-page-simulation flex flex-col text-sm", templateStyles.overallReportBorderClass)}>
      <header className={cn("mb-4", templateStyles.headerContainerClass)}> {/* mb-4 from mb-6 */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className={templateStyles.headerTitleClass}>{data.schoolName || 'School Name'}</h2>
            <p className={templateStyles.headerSubtitleClass}>{data.academicYear || 'Academic Year'} - {data.academicTerm || 'Term/Semester'}</p>
            {data.studentEntryNumber && (
              <p className="text-xs text-gray-500 mt-0.5 font-semibold">Entry #: {data.studentEntryNumber}</p>
            )}
          </div>
          {data.schoolLogoDataUri && (
            <Image
              src={data.schoolLogoDataUri}
              alt="School Logo"
              width={120}
              height={60}
              data-ai-hint="school logo"
              className="object-contain"
            />
          )}
        </div>
        <h1 className={templateStyles.mainHeaderTextClass}>Student Report Card</h1>
      </header>

      <section className="mb-3 flex justify-between items-start"> {/* mb-3 from mb-4 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs flex-grow pr-4">
          <div>
            <span className="font-semibold text-gray-600">Student Name:</span>
            <p className="text-gray-800 text-sm font-semibold">{data.studentName}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Class:</span>
            <p className="text-gray-800 text-sm font-semibold">{data.className}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Gender:</span>
            <p className="text-gray-800 text-sm font-semibold">{data.gender || 'N/A'}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Attendance:</span>
            <p className="text-gray-800 text-sm font-semibold">{attendanceString}</p>
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
        <section className="mb-3"> {/* mb-3 from mb-4 */}
          <h3 className={templateStyles.sectionTitleClass}>Subject Performance</h3>
          <Table className={cn("border rounded-md text-xs", templateStyles.overallReportBorderClass)}>
            <TableHeader>
              <TableRow className={templateStyles.tableHeaderClass}>
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

      <div className="space-y-3 flex-grow text-xs"> {/* space-y-3 from space-y-4 */}
        {data.performanceSummary && (
          <ReportSection title="Overall Performance Summary" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.performanceSummary}</p>
          </ReportSection>
        )}

        {data.strengths && (
          <ReportSection title="Strengths" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.strengths}</p>
          </ReportSection>
        )}

        {data.areasForImprovement && (
          <ReportSection title="Areas for Improvement" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.areasForImprovement}</p>
          </ReportSection>
        )}

        {hobbiesText && (
          <ReportSection title="Hobbies / Co-curricular Activities" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{hobbiesText}</p>
          </ReportSection>
        )}

        {data.teacherFeedback && (
          <ReportSection title="Teacher's Feedback" templateStyles={templateStyles} highlightColor={highlightColorForTeacherFeedback}>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.teacherFeedback}</p>
          </ReportSection>
        )}
      </div>

      <footer className="mt-6 pt-3 border-t border-gray-300 text-[10px] text-gray-600"> {/* mt-6 pt-3 from mt-8 pt-4 */}
        <div className="flex justify-between items-end">
          <div>
            <p><span className="font-semibold">Date Issued:</span> {currentDate}</p>
            {data.instructorContact && (
              <p className="mt-1"><span className="font-semibold">Instructor Contact:</span> {data.instructorContact}</p>
            )}
          </div>
          <div className="text-center">
             {data.headMasterSignatureDataUri && (
              <div className="mb-1">
                <Image
                  src={data.headMasterSignatureDataUri}
                  alt="Head Master's Signature"
                  width={120}
                  height={40}
                  className="object-contain mx-auto"
                  data-ai-hint="signature"
                />
              </div>
            )}
            <p className="mb-1 font-semibold">Head Master's Signature:</p>
            <div className="h-8 border-b border-gray-400 w-40 mx-auto"></div>
          </div>
          <div className="text-center">
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
  templateStyles: TemplateStyles;
  highlightColor?: string;
}

function ReportSection({ title, children, templateStyles, highlightColor }: ReportSectionProps) {
  return (
    <div className={cn(templateStyles.sectionContainerClass, highlightColor || '')}>
      <h3 className={templateStyles.sectionTitleClass}>{title}</h3>
      {children}
    </div>
  );
}

