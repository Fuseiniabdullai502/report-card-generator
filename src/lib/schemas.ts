import { z } from 'zod';

export const SubjectEntrySchema = z.object({
  subjectName: z.string().min(1, 'Subject name is required'),
  continuousAssessment: z.coerce
    .number({ invalid_type_error: 'CA mark must be a number' })
    .min(0, 'CA mark must be 0 or greater')
    .max(100, 'CA mark cannot exceed 100') // Assuming max 100 for now
    .nullable()
    .optional(),
  examinationMark: z.coerce
    .number({ invalid_type_error: 'Exam mark must be a number' })
    .min(0, 'Exam mark must be 0 or greater')
    .max(100, 'Exam mark cannot exceed 100') // Assuming max 100 for now
    .nullable()
    .optional(),
});
export type SubjectEntry = z.infer<typeof SubjectEntrySchema>;

export const ReportDataSchema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  className: z.string().min(1, 'Class name is required'),
  schoolName: z.string().optional().default('Springfield Elementary'),
  academicYear: z.string().optional().default('2023-2024'),
  performanceSummary: z.string().min(1, 'Performance summary is required'),
  strengths: z.string().min(1, 'Strengths are required'),
  areasForImprovement: z.string().min(1, 'Areas for improvement are required'),
  teacherFeedback: z.string().optional(),
  subjects: z
    .array(SubjectEntrySchema)
    .min(1, 'At least one subject is required.')
    .default([{ subjectName: '', continuousAssessment: null, examinationMark: null }]),
});

export type ReportData = z.infer<typeof ReportDataSchema>;
