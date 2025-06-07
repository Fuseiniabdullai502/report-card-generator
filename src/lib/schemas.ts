
import { z } from 'zod';

export const SubjectEntrySchema = z.object({
  subjectName: z.string().min(1, 'Subject name is required'),
  continuousAssessment: z.coerce
    .number({ invalid_type_error: 'CA mark must be a number' })
    .min(1, 'CA mark must be 1 or greater')
    .max(60, 'CA mark cannot exceed 60')
    .nullable()
    .optional(),
  examinationMark: z.coerce
    .number({ invalid_type_error: 'Exam mark must be a number' })
    .min(1, 'Exam mark must be 1 or greater')
    .max(100, 'Exam mark cannot exceed 100')
    .nullable()
    .optional(),
});
export type SubjectEntry = z.infer<typeof SubjectEntrySchema>;

export const ReportDataSchema = z.object({
  id: z.string().optional(), // Optional ID for list management
  studentEntryNumber: z.number().optional(), // For session-based serial numbering
  studentName: z.string().min(1, 'Student name is required'),
  className: z.string().min(1, 'Class name is required'),
  gender: z.string().optional(),
  schoolName: z.string().optional().default('Springfield Elementary'),
  academicYear: z.string().optional().default('2023-2024'),
  academicTerm: z.string().optional().default('First Term'),
  daysAttended: z.coerce
    .number({ invalid_type_error: 'Days attended must be a number' })
    .min(0, 'Days attended cannot be negative')
    .nullable()
    .optional(),
  totalSchoolDays: z.coerce
    .number({ invalid_type_error: 'Total school days must be a number' })
    .min(0, 'Total school days cannot be negative')
    .nullable()
    .optional(),
  performanceSummary: z.string().min(1, 'Performance summary is required'),
  strengths: z.string().min(1, 'Strengths are required'),
  areasForImprovement: z.string().min(1, 'Areas for improvement are required'),
  teacherFeedback: z.string().optional(),
  instructorContact: z.string().optional(),
  subjects: z
    .array(SubjectEntrySchema)
    .min(1, 'At least one subject is required.')
    .default([{ subjectName: '', continuousAssessment: null, examinationMark: null }]),
  overallAverage: z.number().optional(),
  rank: z.string().optional(),
  promotionStatus: z.string().optional(),
  studentPhotoDataUri: z.string().optional().describe("A data URI of the student's photo."),
  headMasterSignatureDataUri: z.string().optional().describe("A data URI of the Head Master's signature."),
}).refine(data => {
  if (data.daysAttended !== null && data.daysAttended !== undefined &&
      data.totalSchoolDays !== null && data.totalSchoolDays !== undefined) {
    return data.daysAttended <= data.totalSchoolDays;
  }
  return true;
}, {
  message: "Days attended cannot exceed total school days.",
  path: ["daysAttended"],
});

export type ReportData = z.infer<typeof ReportDataSchema>;

export const defaultReportData: Omit<ReportData, 'overallAverage' | 'rank' | 'id' | 'studentEntryNumber'> & { subjects: SubjectEntry[] } = {
  studentName: '',
  className: '',
  gender: undefined,
  schoolName: 'Springfield Elementary',
  academicYear: '2023-2024',
  academicTerm: 'First Term',
  daysAttended: null,
  totalSchoolDays: null,
  performanceSummary: '',
  strengths: '',
  areasForImprovement: '',
  teacherFeedback: '',
  instructorContact: '',
  subjects: [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
  promotionStatus: undefined,
  studentPhotoDataUri: undefined,
  headMasterSignatureDataUri: undefined,
};
