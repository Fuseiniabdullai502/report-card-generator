
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
        headerContainerClass: 'pb-2 border-b border-blue-400 bg-blue-50',
        headerTitleClass: 'text-2xl font-headline font-bold text-blue-700',
        headerSubtitleClass: 'text-blue-600 font-semibold',
        sectionTitleClass: 'report-section-title text-base font-headline font-semibold mb-1 text-blue-700 border-b border-blue-300 pb-0.5',
        sectionContainerClass: 'report-section-container p-2 print:p-1.5 border border-blue-300 rounded-md shadow-sm',
        tableHeaderClass: 'bg-blue-100',
        overallReportBorderClass: 'border border-blue-400',
        mainHeaderTextClass: 'report-main-header text-3xl font-headline font-semibold text-center mt-2 print:mt-1 text-blue-700',
      };
    case 'elegantGreen':
      return {
        headerContainerClass: 'pb-2 border-b border-green-400 bg-green-50',
        headerTitleClass: 'text-2xl font-headline font-bold text-green-700',
        headerSubtitleClass: 'text-green-600 font-semibold',
        sectionTitleClass: 'report-section-title text-base font-headline font-semibold mb-1 text-green-700 border-b border-green-300 pb-0.5',
        sectionContainerClass: 'report-section-container p-2 print:p-1.5 border border-green-300 rounded-md shadow-sm',
        tableHeaderClass: 'bg-green-100',
        overallReportBorderClass: 'border border-green-400',
        mainHeaderTextClass: 'report-main-header text-3xl font-headline font-semibold text-center mt-2 print:mt-1 text-green-700',
      };
    case 'minimalistGray':
      return {
        headerContainerClass: 'pb-1 border-b border-gray-200',
        headerTitleClass: 'text-xl font-headline font-semibold text-gray-700',
        headerSubtitleClass: 'text-gray-500 font-normal text-xs',
        sectionTitleClass: 'report-section-title text-sm font-headline font-medium mb-1 text-gray-600 border-b border-gray-200 pb-0.5',
        sectionContainerClass: 'report-section-container p-2 print:p-1.5 border border-gray-200 rounded shadow-none',
        tableHeaderClass: 'bg-gray-100',
        overallReportBorderClass: 'border border-gray-300 shadow-sm',
        mainHeaderTextClass: 'report-main-header text-2xl font-headline font-medium text-center mt-1 text-gray-600',
      };
    case 'academicRed':
      return {
        headerContainerClass: 'pb-2 border-b-2 border-red-500',
        headerTitleClass: 'text-2xl font-headline font-bold text-red-700',
        headerSubtitleClass: 'text-red-600 font-semibold',
        sectionTitleClass: 'report-section-title text-base font-headline font-bold mb-1 text-red-700 border-b border-red-200 pb-0.5',
        sectionContainerClass: 'report-section-container p-2 print:p-1.5 border border-red-200 rounded-md',
        tableHeaderClass: 'bg-red-50',
        overallReportBorderClass: 'border border-red-300',
        mainHeaderTextClass: 'report-main-header text-3xl font-headline font-semibold text-center mt-2 print:mt-1 text-red-700',
      };
    case 'creativeTeal':
      return {
        headerContainerClass: 'pb-2 border-b border-teal-400 bg-teal-50',
        headerTitleClass: 'text-2xl font-headline font-bold text-teal-700',
        headerSubtitleClass: 'text-teal-600 font-semibold',
        sectionTitleClass: 'report-section-title text-base font-headline font-semibold mb-1 text-teal-700 border-b border-teal-300 pb-0.5 italic',
        sectionContainerClass: 'report-section-container p-2 print:p-1.5 border border-teal-300 rounded-lg shadow-sm',
        tableHeaderClass: 'bg-teal-100',
        overallReportBorderClass: 'border border-teal-400',
        mainHeaderTextClass: 'report-main-header text-3xl font-headline font-semibold text-center mt-2 print:mt-1 text-teal-700',
      };
    default: // Default Template
      return {
        headerContainerClass: 'pb-2 border-b border-gray-300',
        headerTitleClass: 'text-2xl font-headline font-bold text-primary',
        headerSubtitleClass: 'text-muted-foreground font-semibold',
        sectionTitleClass: 'report-section-title text-base font-headline font-semibold mb-1 text-primary border-b pb-0.5',
        sectionContainerClass: 'report-section-container p-2 print:p-1.5 border border-gray-200 rounded-md shadow-sm',
        tableHeaderClass: 'bg-gray-50',
        overallReportBorderClass: 'border border-gray-300',
        mainHeaderTextClass: 'report-main-header text-3xl font-headline font-semibold text-center mt-2 print:mt-1 text-gray-700',
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
                                   !tertiaryLevelClassesList.includes(data.className.toUpperCase());
  
  const hobbiesText = data.hobbies && data.hobbies.length > 0 ? data.hobbies.join(', ') : '';
  
  const templateStyles = getTemplateSpecificStyles(data.selectedTemplateId);

  const highlightColorForTeacherFeedback = data.selectedTemplateId === 'elegantGreen' ? 'bg-green-50 print:bg-green-50' 
                                      : data.selectedTemplateId === 'professionalBlue' ? 'bg-blue-50 print:bg-blue-50'
                                      : data.selectedTemplateId === 'creativeTeal' ? 'bg-teal-50 print:bg-teal-50'
                                      : 'bg-green-50 print:bg-green-50'; // Default highlight

  return (
    <div id="printable-report-area" className={cn("a4-page-simulation flex flex-col text-sm", templateStyles.overallReportBorderClass)}>
      <header className={cn("mb-2 print:mb-1", templateStyles.headerContainerClass)}>
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
        <h1 className={cn(templateStyles.mainHeaderTextClass, "report-main-header print:mt-1 print:text-2xl")}>Student Report Card</h1>
      </header>
      
      <section className="mb-2 print:mb-1 flex justify-between items-start gap-4">
          <div className="flex-grow">
              <table className="w-full text-xs report-student-info-table">
                  <tbody>
                      <tr>
                          <td className="font-semibold text-gray-600 pr-2 pb-0.5 print:pb-0">Student Name:</td>
                          <td className="font-bold text-gray-800 pr-4 pb-0.5 print:pb-0" colSpan={3}>{data.studentName || 'N/A'}</td>
                      </tr>
                      <tr>
                          <td className="font-semibold text-gray-600 pr-2 pb-0.5 print:pb-0">Class:</td>
                          <td className="font-bold text-gray-800 pr-4 pb-0.5 print:pb-0">{data.className || 'N/A'}</td>
                          <td className="font-semibold text-gray-600 pr-2 pb-0.5 print:pb-0">Gender:</td>
                          <td className="text-gray-800 pr-4 pb-0.5 print:pb-0">{data.gender || 'N/A'}</td>
                      </tr>
                      <tr>
                          <td className="font-semibold text-gray-600 pr-2 pb-0.5 print:pb-0">Attendance:</td>
                          <td className="text-gray-800 pb-0.5 print:pb-0">{attendanceString}</td>
                          <td className="font-semibold text-gray-600 pr-2 pb-0.5 print:pb-0">Position:</td>
                          <td className="font-bold text-gray-800 pr-4 pb-0.5 print:pb-0">{data.rank || 'N/A'}</td>
                      </tr>
                      <tr>
                           <td className="font-semibold text-gray-600 pr-2 pb-0.5 print:pb-0">Overall Avg:</td>
                           <td className="font-bold text-gray-800 pb-0.5 print:pb-0">{data.overallAverage !== undefined && data.overallAverage !== null ? `${data.overallAverage.toFixed(2)}%` : 'N/A'}</td>
                          {isPromotionStatusRelevant && data.promotionStatus ? (
                          <>
                              <td className="font-semibold text-gray-600 pr-2 pb-0.5 print:pb-0">Promotion:</td>
                              <td className="font-bold text-gray-800 pb-0.5 print:pb-0">
                                <div className="flex items-center gap-2">
                                  {data.promotionStatus === 'Promoted' && <Award className="h-4 w-4 text-green-600" />}
                                  <span>{data.promotionStatus}</span>
                                </div>
                              </td>
                          </>
                          ) : <td colSpan={2}></td>}
                      </tr>
                  </tbody>
              </table>
          </div>
          {data.studentPhotoDataUri && (
              <div className="flex-shrink-0 text-center">
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
        <section className="mb-1.5 print:mb-1">
          <h3 className={templateStyles.sectionTitleClass}>Subject Performance</h3>
          <Table className={cn("border rounded-md text-xs report-subjects-table", templateStyles.overallReportBorderClass)}>
            <TableHeader>
              <TableRow className={templateStyles.tableHeaderClass}>
                <TableHead className="font-semibold text-gray-600 w-[28%] py-0.5 px-2 print:px-1.5">Subject</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-0.5 px-2 print:px-1.5">CA (60)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-0.5 px-2 print:px-1.5">Exam (100)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-0.5 px-2 print:px-1.5">Final (100)</TableHead>
                <TableHead className="text-center font-semibold text-gray-600 py-0.5 px-2 print:px-1.5">Grade</TableHead>
                <TableHead className="font-semibold text-gray-600 w-[25%] py-0.5 px-2 print:px-1.5">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subjects.map((subject, index) => {
                 if (!subject.subjectName || subject.subjectName.trim() === '') return null; 
                const { grade, remarks, finalMark } = getGradeAndRemarks(subject.continuousAssessment, subject.examinationMark);

                return (
                  <TableRow key={index} className="hover:bg-gray-50 print:py-0">
                    <TableCell className="font-medium text-gray-700 py-0.5 px-2 print:px-1.5">{subject.subjectName}</TableCell>
                    <TableCell className="text-center text-gray-700 py-0.5 px-2 print:px-1.5">{subject.continuousAssessment === null || subject.continuousAssessment === undefined ? '-' : subject.continuousAssessment}</TableCell>
                    <TableCell className="text-center text-gray-700 py-0.5 px-2 print:px-1.5">{subject.examinationMark === null || subject.examinationMark === undefined ? '-' : subject.examinationMark}</TableCell>
                    <TableCell className="text-center text-gray-700 font-medium py-0.5 px-2 print:px-1.5">{finalMark}</TableCell>
                    <TableCell className="text-center text-gray-700 py-0.5 px-2 print:px-1.5">{grade}</TableCell>
                    <TableCell className="text-gray-700 py-0.5 px-2 print:px-1.5">{remarks}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      <div className="space-y-1.5 print:space-y-1 flex-grow text-xs">
        {data.performanceSummary && (
          <ReportSection title="Overall Performance Summary" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-tight print:leading-tight whitespace-pre-wrap">{data.performanceSummary}</p>
          </ReportSection>
        )}

        {data.strengths && (
          <ReportSection title="Strengths" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-tight print:leading-tight whitespace-pre-wrap">{data.strengths}</p>
          </ReportSection>
        )}

        {data.areasForImprovement && (
          <ReportSection title="Areas for Improvement" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-tight print:leading-tight whitespace-pre-wrap">{data.areasForImprovement}</p>
          </ReportSection>
        )}

        {hobbiesText && (
          <ReportSection title="Hobbies / Co-curricular Activities" templateStyles={templateStyles}>
            <p className="text-gray-700 leading-tight print:leading-tight whitespace-pre-wrap">{hobbiesText}</p>
          </ReportSection>
        )}

        {data.teacherFeedback && (
          <ReportSection title="Teacher's Feedback" templateStyles={templateStyles} highlightColor={highlightColorForTeacherFeedback}>
            <p className="text-gray-700 leading-tight print:leading-tight whitespace-pre-wrap">{data.teacherFeedback}</p>
          </ReportSection>
        )}
      </div>

      <footer className="mt-auto pt-2 print:pt-1 border-t border-gray-300 text-[10px] print:text-[8pt] text-gray-600 report-footer">
        <div className="flex justify-between items-end">
          <div>
            <p><span className="font-semibold">Date Issued:</span> {currentDate}</p>
            {data.instructorContact && (
              <p className="mt-0.5 print:mt-0"><span className="font-semibold">Instructor Contact:</span> {data.instructorContact}</p>
            )}
          </div>
          <div className="text-center">
             {data.headMasterSignatureDataUri && (
              <div className="mb-0.5">
                <Image
                  src={data.headMasterSignatureDataUri}
                  alt="Head Master's Signature"
                  width={120}
                  height={40}
                  className="object-contain mx-auto signature-image"
                  data-ai-hint="signature"
                />
              </div>
            )}
            <p className="mb-0.5 font-semibold">Head Master's Signature:</p>
            <div className="h-8 border-b border-gray-400 w-40 mx-auto signature-line"></div>
          </div>
          <div className="text-center">
            <p className="mb-0.5 font-semibold">Teacher's Signature:</p>
            <div className="h-8 border-b border-gray-400 w-40 signature-line"></div>
          </div>
        </div>
         <p className="text-center mt-2 print:mt-1 text-gray-500">&copy; {new Date().getFullYear()} {data.schoolName || 'School Name'}. Confidential Document.</p>
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
