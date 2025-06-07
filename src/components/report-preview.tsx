'use client';

import type {ReportData} from '@/lib/schemas';
import Image from 'next/image';

interface ReportPreviewProps {
  data: ReportData;
}

export default function ReportPreview({ data }: ReportPreviewProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div id="report-preview" className="bg-white p-8 rounded-lg border border-gray-200 min-h-[700px] flex flex-col text-sm">
      {/* Header Section */}
      <header className="mb-8 pb-4 border-b border-gray-300">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-headline font-bold text-primary">{data.schoolName || 'School Name'}</h2>
            <p className="text-muted-foreground">{data.academicYear || 'Academic Year'}</p>
          </div>
          <Image 
            src="https://placehold.co/120x40.png" // Adjusted size for better fit
            alt="School Logo" 
            width={120} 
            height={40}
            data-ai-hint="school logo"
            className="object-contain"
          />
        </div>
        <h1 className="text-3xl font-headline font-semibold text-center mt-4 text-gray-700">Student Report Card</h1>
      </header>

      {/* Student Information */}
      <section className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <strong className="text-gray-600">Student Name:</strong>
          <p className="text-gray-800">{data.studentName}</p>
        </div>
        <div>
          <strong className="text-gray-600">Class:</strong>
          <p className="text-gray-800">{data.className}</p>
        </div>
      </section>

      {/* Performance Details */}
      <div className="space-y-6 flex-grow">
        <ReportSection title="Performance Summary">
          <p className="text-gray-700 leading-relaxed">{data.performanceSummary}</p>
        </ReportSection>

        <ReportSection title="Strengths">
          <p className="text-gray-700 leading-relaxed">{data.strengths}</p>
        </ReportSection>

        <ReportSection title="Areas for Improvement">
          <p className="text-gray-700 leading-relaxed">{data.areasForImprovement}</p>
        </ReportSection>

        {data.teacherFeedback && (
          <ReportSection title="Teacher's Feedback" highlightColor="bg-green-50">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.teacherFeedback}</p>
          </ReportSection>
        )}
      </div>

      {/* Footer Section */}
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
