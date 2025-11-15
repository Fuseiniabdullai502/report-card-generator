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
                                                  teacherId: z.string().optional().nullable(),
                                                    studentEntryNumber: z.coerce.number(),
                                                      studentName: z.string().min(1, 'Student name is required'),
                                                        className: z.string().min(1, 'Class name is required'),
                                                          shsProgram: z.string().optional().nullable(),
                                                            gender: z.string().trim().optional().nullable(),
                                                              country: z.string().optional().default('Ghana'),
                                                                schoolName: z.string().optional().nullable(),
                                                                  schoolCategory: z.enum(['public', 'private']).optional().nullable(),
                                                                    region: z.string().optional().nullable(),
                                                                      district: z.string().optional().nullable(),
                                                                        circuit: z.string().optional().nullable(),
                                                                          schoolLogoDataUri: z.union([z.string(), z.null(), z.literal('')])
                                                                              .optional()
                                                                                  .describe("A data URI of the school's logo."),
                                                                                    academicYear: z.string().optional().nullable(),
                                                                                      academicTerm: z.string().optional().nullable(),
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
                                                                                                                                parentEmail: z.string().email({ message: "Invalid email address" }).optional().nullable(),
                                                                                                                                  parentPhoneNumber: z.string().optional().nullable(),
                                                                                                                                    performanceSummary: z.string().trim().optional().default(''),
                                                                                                                                      strengths: z.string().trim().optional().default(''),
                                                                                                                                        areasForImprovement: z.string().trim().optional().default(''),
                                                                                                                                          hobbies: z.array(z.string()).optional().default([]),
                                                                                                                                            teacherFeedback: z.string().optional().nullable(),
                                                                                                                                              instructorContact: z.string().optional().nullable(),
                                                                                                                                                subjects: z
                                                                                                                                                    .array(SubjectEntrySchema)
                                                                                                                                                        .min(1, 'At least one subject is required.')
                                                                                                                                                            .default([{ subjectName: 'Subject', continuousAssessment: null, examinationMark: null }]),
                                                                                                                                                              overallAverage: z.number().optional().nullable(),
                                                                                                                                                                rank: z.string().optional().nullable(),
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
                                                                                                                                                                                                                                    shsProgram: null,
                                                                                                                                                                                                                                      gender: null,
                                                                                                                                                                                                                                        country: 'Ghana',
                                                                                                                                                                                                                                          schoolName: null,
                                                                                                                                                                                                                                            schoolCategory: null,
                                                                                                                                                                                                                                              region: null,
                                                                                                                                                                                                                                                district: null,
                                                                                                                                                                                                                                                  circuit: null,
                                                                                                                                                                                                                                                    schoolLogoDataUri: null,
                                                                                                                                                                                                                                                      academicYear: null,
                                                                                                                                                                                                                                                        academicTerm: null,
                                                                                                                                                                                                                                                          reopeningDate: null,
                                                                                                                                                                                                                                                            selectedTemplateId: 'default',
                                                                                                                                                                                                                                                              daysAttended: null,
                                                                                                                                                                                                                                                                totalSchoolDays: null,
                                                                                                                                                                                                                                                                  parentEmail: null,
                                                                                                                                                                                                                                                                    parentPhoneNumber: null,
                                                                                                                                                                                                                                                                      performanceSummary: '',
                                                                                                                                                                                                                                                                        strengths: '',
                                                                                                                                                                                                                                                                          areasForImprovement: '',
                                                                                                                                                                                                                                                                            hobbies: [],
                                                                                                                                                                                                                                                                              teacherFeedback: null,
                                                                                                                                                                                                                                                                                instructorContact: null,
                                                                                                                                                                                                                                                                                  subjects: [{ subjectName: 'Subject', continuousAssessment: null, examinationMark: null }],
                                                                                                                                                                                                                                                                                    promotionStatus: null,
                                                                                                                                                                                                                                                                                      studentPhotoUrl: null,
                                                                                                                                                                                                                                                                                        headMasterSignatureDataUri: null,
                                                                                                                                                                                                                                                                                        };