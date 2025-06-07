
// src/app/actions.ts
'use server';

import { generateStudentFeedback, type GenerateStudentFeedbackInput } from '@/ai/flows/generate-student-feedback';
import { generateReportInsights, type GenerateReportInsightsInput, type GenerateReportInsightsOutput } from '@/ai/flows/generate-performance-summary'; // Updated import
import { editImage, type EditImageInput, type EditImageOutput } from '@/ai/flows/edit-image-flow';
import type { SubjectEntry } from '@/lib/schemas';
import { z } from 'zod';

// Schema for student feedback generation
const StudentFeedbackActionInputSchema = z.object({
  studentName: z.string(),
  className: z.string(),
  performanceSummary: z.string(),
  areasForImprovement: z.string(),
  strengths: z.string(),
});

export async function getAiFeedbackAction(
  input: GenerateStudentFeedbackInput
): Promise<{ success: boolean; feedback?: string; error?: string }> {
  try {
    const validatedInput = StudentFeedbackActionInputSchema.parse(input);
    const result = await generateStudentFeedback(validatedInput);
    return { success: true, feedback: result.feedback };
  } catch (error) {
    console.error("Error generating AI feedback:", error);
    let errorMessage = "Failed to generate AI feedback. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI feedback: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: "An unexpected error occurred while generating feedback." };
  }
}

// Schema for report insights generation (summary, strengths, areas for improvement)
const FlowSubjectEntrySchema = z.object({
  subjectName: z.string(),
  continuousAssessment: z.number().nullable().optional(),
  examinationMark: z.number().nullable().optional(),
});

const ReportInsightsActionInputSchema = z.object({
  studentName: z.string().min(1, "Student name is required"),
  className: z.string().min(1, "Class name is required"),
  daysAttended: z.number().nullable().optional(),
  totalSchoolDays: z.number().nullable().optional(),
  subjects: z.array(FlowSubjectEntrySchema).min(1, "At least one subject is required"),
});

// Renamed from getAiPerformanceSummaryAction to getAiReportInsightsAction
export async function getAiReportInsightsAction(
  input: { studentName: string; className: string; daysAttended?: number | null; totalSchoolDays?: number | null; subjects: SubjectEntry[] }
): Promise<{ success: boolean; insights?: GenerateReportInsightsOutput; error?: string }> {
  try {
    // Validate input specifically for this action
    const validatedInput = ReportInsightsActionInputSchema.parse(input);
    
    const flowSubjects = validatedInput.subjects.map(s => ({
        subjectName: s.subjectName,
        continuousAssessment: s.continuousAssessment,
        examinationMark: s.examinationMark,
    }));

    const result = await generateReportInsights({
        studentName: validatedInput.studentName,
        className: validatedInput.className,
        daysAttended: validatedInput.daysAttended,
        totalSchoolDays: validatedInput.totalSchoolDays,
        subjects: flowSubjects,
    });
    return { success: true, insights: result };
  } catch (error) {
    console.error("Error generating AI report insights:", error);
    let errorMessage = "Failed to generate AI insights. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI insights: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: "An unexpected error occurred while generating the insights." };
  }
}

// Schema for AI image editing
const EditImageActionInputSchema = z.object({
    photoDataUri: z.string().min(1, "Image data URI is required."),
    prompt: z.string().min(1, "Edit prompt is required."),
});

export async function editImageWithAiAction(
    input: EditImageInput
): Promise<{ success: boolean; editedPhotoDataUri?: string; error?: string }> {
    try {
        const validatedInput = EditImageActionInputSchema.parse(input);
        const result = await editImage(validatedInput);
        return { success: true, editedPhotoDataUri: result.editedPhotoDataUri };
    } catch (error) {
        console.error("Error editing image with AI:", error);
        let errorMessage = "Failed to edit image with AI. Please try again.";
        if (error instanceof z.ZodError) {
            errorMessage = "Invalid input for AI image editing: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        return { success: false, error: "An unexpected error occurred while editing the image." };
    }
}
