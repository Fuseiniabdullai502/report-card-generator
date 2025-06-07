import { z } from 'zod';

export const ReportDataSchema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  className: z.string().min(1, 'Class name is required'),
  schoolName: z.string().optional().default('Springfield Elementary'),
  academicYear: z.string().optional().default('2023-2024'),
  performanceSummary: z.string().min(1, 'Performance summary is required'),
  strengths: z.string().min(1, 'Strengths are required'),
  areasForImprovement: z.string().min(1, 'Areas for improvement are required'),
  teacherFeedback: z.string().optional(),
});

export type ReportData = z.infer<typeof ReportDataSchema>;
