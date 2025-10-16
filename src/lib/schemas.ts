
import { z } from 'zod';
import { serverTimestamp } from 'firebase/firestore'; // Import serverTimestamp

export const STUDENT_PROFILES_STORAGE_KEY = 'studentProfilesReportCardApp_v1';

export const SubjectEntrySchema = z.object({
  subjectName: z.string().min(1, 'Subject name is required'),
  continuousAssessment: z.coerce
    .number({ invalid_type_error: 'CA mark must be a number' })
    .min(0, 'CA mark must be 0 or greater')
    .max(60, 'CA mark cannot exceed 60')
    .nullable()
    .optional(),
  examinationMark: z.coerce
    .number({ invalid_type_error: 'Exam mark must be a number' })
    .min(0, 'Exam mark must be 0 or greater')
    .max(100, 'Exam mark cannot exceed 100')
    .nullable()
    .optional(),
});
export type SubjectEntry = z.infer<typeof SubjectEntrySchema>;

export const ReportDataSchema = z.object({
  id: z.string(),
  teacherId: z.string().optional(),
  studentEntryNumber: z.number(),
  studentName: z.string().min(1, 'Student name is required'),
  className: z.string().min(1, 'Class name is required'),
  shsProgram: z.string().optional(),
  gender: z.string().min(1, 'Gender is required'),
  country: z.string().optional().default('Ghana'),
  schoolName: z.string().optional(),
  schoolCategory: z.enum(['public', 'private']).optional().nullable(),
  region: z.string().optional(),
  district: z.string().optional(),
  circuit: z.string().optional(),
  schoolLogoDataUri: z.union([z.string(), z.null(), z.literal('')])
    .optional()
    .describe("A data URI of the school's logo."),
  academicYear: z.string().optional(),
  academicTerm: z.string().optional(),
  reopeningDate: z.string().optional().nullable(),
  selectedTemplateId: z.string().optional().default('default'),
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
  parentEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  parentPhoneNumber: z.string().optional(),
  performanceSummary: z.string().min(1, 'Performance summary is required'),
  strengths: z.string().min(1, 'Strengths are required'),
  areasForImprovement: z.string().min(1, 'Areas for improvement are required'),
  hobbies: z.array(z.string()).optional().default([]),
  teacherFeedback: z.string().optional(),
  instructorContact: z.string().optional(),
  subjects: z
    .array(SubjectEntrySchema)
    .min(1, 'At least one subject is required.')
    .default([{ subjectName: '', continuousAssessment: null, examinationMark: null }]),
  overallAverage: z.number().optional(),
  rank: z.string().optional(),
  promotionStatus: z.string().nullable().optional(),
  studentPhotoUrl: z.union([z.string(), z.null(), z.literal('')])
    .optional()
    .describe("A data URI of the student's photo."),
  headMasterSignatureDataUri: z.union([z.string(), z.null(), z.literal('')])
    .optional()
    .describe("A data URI of the Head Master's signature."),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
}).refine(data => {
  if (
    data.daysAttended !== null &&
    data.daysAttended !== undefined &&
    data.totalSchoolDays !== null &&
    data.totalSchoolDays !== undefined
  ) {
    return data.daysAttended <= data.totalSchoolDays;
  }
  return true;
}, {
  message: "Days attended cannot exceed total school days.",
  path: ["daysAttended"],
});

export type ReportData = z.infer<typeof ReportDataSchema>;

export const defaultReportData: Omit<
  ReportData,
  'id' | 'studentEntryNumber' | 'teacherId' | 'createdAt' | 'overallAverage' | 'rank' | 'updatedAt'
> & { subjects: SubjectEntry[]; hobbies: string[] } = {
  studentName: 'Fuseini Abdullai',
  className: '',
  shsProgram: undefined,
  gender: '',
  country: 'Ghana',
  schoolName: '',
  schoolCategory: undefined,
  region: '',
  district: '',
  circuit: '',
  schoolLogoDataUri: undefined,
  academicYear: '',
  academicTerm: undefined,
  reopeningDate: null,
  selectedTemplateId: 'default',
  daysAttended: null,
  totalSchoolDays: null,
  parentEmail: '',
  parentPhoneNumber: '',
  performanceSummary: '',
  strengths: '',
  areasForImprovement: '',
  hobbies: [],
  teacherFeedback: '',
  instructorContact: '',
  subjects: [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
  promotionStatus: undefined,
  studentPhotoUrl: undefined,
  headMasterSignatureDataUri: undefined,
};
