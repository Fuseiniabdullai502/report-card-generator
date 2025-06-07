// src/app/actions.ts
'use server';

import { generateStudentFeedback, type GenerateStudentFeedbackInput } from '@/ai/flows/generate-student-feedback';
import { z } from 'zod';

// This schema is implicitly defined by GenerateStudentFeedbackInput, but we can re-declare for clarity or if modifications are needed for the action layer.
const ActionInputSchema = z.object({
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
    // Validate input using the schema (Genkit flow already does this, but good practice for action layer)
    const validatedInput = ActionInputSchema.parse(input);
    const result = await generateStudentFeedback(validatedInput);
    return { success: true, feedback: result.feedback };
  } catch (error) {
    console.error("Error generating AI feedback:", error);
    let errorMessage = "Failed to generate AI feedback. Please try again.";
    if (error instanceof z.ZodError) {
      // Providing more specific error messages from Zod can be helpful for debugging
      // but might expose too much detail to the user.
      errorMessage = "Invalid input for AI feedback: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    // For user-facing errors, it's often better to provide a generic message
    // and log the detailed error on the server.
    return { success: false, error: "An unexpected error occurred while generating feedback." };
  }
}
