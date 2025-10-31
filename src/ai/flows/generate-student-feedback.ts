'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating personalized student feedback.
 *
 * - generateStudentFeedback -  A function that takes student performance data and returns AI-generated feedback.
 * - GenerateStudentFeedbackInput - The input type for the generateStudentFeedback function.
 * - GenerateStudentFeedbackOutput - The return type for the generateStudentFeedback function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

const GenerateStudentFeedbackInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  className: z.string().describe('The name of the class.'),
  performanceSummary: z
    .string()
    .describe("A summary of the student's performance in the class."),
  areasForImprovement: z
    .string()
    .describe('Areas where the student can improve.'),
  strengths: z.string().describe("The student's strengths in the class."),
});

export type GenerateStudentFeedbackInput = z.infer<
  typeof GenerateStudentFeedbackInputSchema
>;

const GenerateStudentFeedbackOutputSchema = z.object({
  feedback: z
    .string()
    .describe('The AI-generated personalized feedback for the student.')
    .optional(),
});

export type GenerateStudentFeedbackOutput = z.infer<
  typeof GenerateStudentFeedbackOutputSchema
>;

export async function generateStudentFeedback(
  input: GenerateStudentFeedbackInput
): Promise<GenerateStudentFeedbackOutput> {
  return generateStudentFeedbackFlow(input);
}

const generateStudentFeedbackPrompt = ai.definePrompt({
  name: 'generateStudentFeedbackPrompt',
  model: googleAI('gemini-1.5-flash'),
  input: {schema: GenerateStudentFeedbackInputSchema},
  output: {schema: GenerateStudentFeedbackOutputSchema},
  prompt: `You are a helpful teacher providing feedback to students.

  Based on the student's performance data, generate **concise (1-2 sentences)** personalized feedback that is specific and constructive. Focus on the most impactful points.

  Student Name: {{{studentName}}}
  Class Name: {{{className}}}
  Performance Summary: {{{performanceSummary}}}
  Areas for Improvement: {{{areasForImprovement}}}
  Strengths: {{{strengths}}}

  Feedback:`,
});

const generateStudentFeedbackFlow = ai.defineFlow(
  {
    name: 'generateStudentFeedbackFlow',
    inputSchema: GenerateStudentFeedbackInputSchema,
    outputSchema: GenerateStudentFeedbackOutputSchema,
  },
  async (input: z.infer<typeof GenerateStudentFeedbackInputSchema>) => {
    const {output} = await generateStudentFeedbackPrompt(input);
    if (!output) {
      return {
        feedback: '',
      };
    }
    return {
      feedback: output.feedback || '',
    };
  }
);
