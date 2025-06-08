
// src/app/actions.ts
'use server';

import { generateStudentFeedback, type GenerateStudentFeedbackInput } from '@/ai/flows/generate-student-feedback';
import { 
  generateReportInsights, 
  type GenerateReportInsightsInput, // This is the TYPE for the flow's input
  type GenerateReportInsightsOutput
} from '@/ai/flows/generate-performance-summary'; 
import { editImage, type EditImageInput, type EditImageOutput } from '@/ai/flows/edit-image-flow';
import { generateClassInsights, type GenerateClassInsightsInput, type GenerateClassInsightsOutput } from '@/ai/flows/generate-class-insights-flow';
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
    return { success: false, error: errorMessage };
  }
}

// Local Zod schema for validating input to getAiReportInsightsAction
// This must be compatible with the GenerateReportInsightsInput TYPE from the flow
const ActionFlowSubjectEntrySchema = z.object({
  subjectName: z.string(),
  continuousAssessment: z.number().nullable().optional(),
  examinationMark: z.number().nullable().optional(),
});

const ActionGenerateReportInsightsInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  className: z.string().describe('The name of the class.'),
  daysAttended: z.number().nullable().optional().describe('Number of days the student attended school.'),
  totalSchoolDays: z.number().nullable().optional().describe('Total number of school days in the term.'),
  subjects: z.array(ActionFlowSubjectEntrySchema).describe('An array of subjects with their marks. CA is out of 60, Exam is out of 100.'),
});


export async function getAiReportInsightsAction(
  input: GenerateReportInsightsInput // Use the TYPE from the flow for the function signature
): Promise<{ success: boolean; insights?: GenerateReportInsightsOutput; error?: string }> {
  try {
    // Validate input using the action's local schema
    const validatedInput = ActionGenerateReportInsightsInputSchema.parse(input);
    
    // Call the flow with the validated input. It will conform to GenerateReportInsightsInput type.
    const result = await generateReportInsights(validatedInput);
    return { success: true, insights: result };
  } catch (error) {
    console.error("Error generating AI report insights:", error);
    let errorMessage = "Failed to generate AI insights. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI insights: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message; 
    }
    return { success: false, error: errorMessage };
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
        return { success: false, error: errorMessage };
    }
}

// Schema for Class Insights AI action
// Re-using schemas from the flow definition (types are fine, Zod schema objects would be re-defined here if needed)
const SubjectPerformanceStatActionSchema = z.object({
  subjectName: z.string(),
  averageMark: z.number().nullable(),
  studentsAboveAverage: z.number(),
  studentsAtAverage: z.number(),
  studentsBelowAverage: z.number(),
  passRate: z.number(),
});

const GenderPerformanceStatActionSchema = z.object({
  gender: z.string(),
  averageScore: z.number().nullable(),
  count: z.number(),
});

const ClassInsightsActionInputSchema = z.object({
  className: z.string().min(1, "Class name is required"),
  totalStudents: z.number().min(1, "Total students must be at least 1"),
  overallClassAverage: z.number().nullable(),
  subjectStats: z.array(SubjectPerformanceStatActionSchema).min(1, "At least one subject statistic is required"),
  genderStats: z.array(GenderPerformanceStatActionSchema),
  passMark: z.number().default(50),
});


export async function getAiClassInsightsAction(
  input: GenerateClassInsightsInput // Use the TYPE from the flow for the function signature
): Promise<{ success: boolean; insights?: GenerateClassInsightsOutput; error?: string }> {
  try {
    // Validate input specifically for this action before passing to the flow
    const validatedInput = ClassInsightsActionInputSchema.parse(input);
    const result = await generateClassInsights(validatedInput);
    return { success: true, insights: result };
  } catch (error) {
    console.error("Error generating AI class insights:", error);
    let errorMessage = "Failed to generate AI class insights. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI class insights: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message; 
    }
    return { success: false, error: errorMessage };
  }
}
