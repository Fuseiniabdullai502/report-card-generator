
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating personalized student feedback in bulk.
 *
 * - generateBulkStudentFeedback - A function that takes an array of student performance data and returns feedback for each.
 * - GenerateBulkStudentFeedbackInput - The input type for the function.
 * - GenerateBulkStudentFeedbackOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single student's input
const StudentFeedbackDataSchema = z.object({
  studentId: z.string(),
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

// Input schema for the entire flow
const GenerateBulkStudentFeedbackInputSchema = z.object({
  students: z.array(StudentFeedbackDataSchema),
});
export type GenerateBulkStudentFeedbackInput = z.infer<typeof GenerateBulkStudentFeedbackInputSchema>;


// Schema for a single student's generated feedback
const StudentFeedbackOutputSchema = z.object({
    studentId: z.string().describe("The original ID of the student this feedback is for."),
    feedback: z.string().describe('The AI-generated personalized feedback for the student.'),
});


// Output schema for the entire flow
const GenerateBulkStudentFeedbackOutputSchema = z.object({
  feedbacks: z.array(StudentFeedbackOutputSchema),
});
export type GenerateBulkStudentFeedbackOutput = z.infer<typeof GenerateBulkStudentFeedbackOutputSchema>;


export async function generateBulkStudentFeedback(
  input: GenerateBulkStudentFeedbackInput
): Promise<GenerateBulkStudentFeedbackOutput> {
  return generateBulkStudentFeedbackFlow(input);
}


const generateBulkStudentFeedbackPrompt = ai.definePrompt({
  name: 'generateBulkStudentFeedbackPrompt',
  model: 'gemini-1.5-pro-latest',
  input: {schema: GenerateBulkStudentFeedbackInputSchema},
  output: {schema: GenerateBulkStudentFeedbackOutputSchema},
  prompt: `You are a helpful and efficient teacher providing feedback to a group of students.
Based on the provided list of student performance data, generate **concise (1-2 sentences)**, personalized, and constructive feedback for EACH student.

Return the feedback as an array of objects, where each object contains the original 'studentId' and the generated 'feedback'.

Students Data:
{{#each students}}
---
Student ID: {{{studentId}}}
Student Name: {{{studentName}}}
Class Name: {{{className}}}
Performance Summary: {{{performanceSummary}}}
Areas for Improvement: {{{areasForImprovement}}}
Strengths: {{{strengths}}}
---
{{/each}}
`,
});

const generateBulkStudentFeedbackFlow = ai.defineFlow(
  {
    name: 'generateBulkStudentFeedbackFlow',
    inputSchema: GenerateBulkStudentFeedbackInputSchema,
    outputSchema: GenerateBulkStudentFeedbackOutputSchema,
  },
  async (input: GenerateBulkStudentFeedbackInput) => {
    const {output} = await generateBulkStudentFeedbackPrompt(input);
    if (!output?.feedbacks) {
      return {
        feedbacks: [],
      };
    }
    return {
      feedbacks: output.feedbacks || [],
    };
  }
);
