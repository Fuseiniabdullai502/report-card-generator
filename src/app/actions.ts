
// src/app/actions.ts
'use server';

import { generateStudentFeedback, type GenerateStudentFeedbackInput } from '@/ai/flows/generate-student-feedback';
import { generatePerformanceSummary, type GeneratePerformanceSummaryInput } from '@/ai/flows/generate-performance-summary';
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

// Schema for performance summary generation
const FlowSubjectEntrySchema = z.object({
  subjectName: z.string(),
  continuousAssessment: z.number().nullable().optional(),
  examinationMark: z.number().nullable().optional(),
});

const PerformanceSummaryActionInputSchema = z.object({
  studentName: z.string().min(1, "Student name is required"),
  className: z.string().min(1, "Class name is required"),
  subjects: z.array(FlowSubjectEntrySchema).min(1, "At least one subject is required"),
});

export async function getAiPerformanceSummaryAction(
  input: { studentName: string; className: string; subjects: SubjectEntry[] }
): Promise<{ success: boolean; performanceSummary?: string; error?: string }> {
  try {
    // Validate input specifically for this action
    const validatedInput = PerformanceSummaryActionInputSchema.parse(input);
    
    // Map SubjectEntry[] to FlowSubjectEntrySchema[] expected by the flow
    // This is important if SubjectEntry from @/lib/schemas has more fields or different structure than FlowSubjectEntrySchema
    const flowSubjects = validatedInput.subjects.map(s => ({
        subjectName: s.subjectName,
        continuousAssessment: s.continuousAssessment,
        examinationMark: s.examinationMark,
    }));

    const result = await generatePerformanceSummary({
        studentName: validatedInput.studentName,
        className: validatedInput.className,
        subjects: flowSubjects,
    });
    return { success: true, performanceSummary: result.performanceSummary };
  } catch (error) {
    console.error("Error generating AI performance summary:", error);
    let errorMessage = "Failed to generate performance summary. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI summary: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: "An unexpected error occurred while generating the summary." };
  }
}
