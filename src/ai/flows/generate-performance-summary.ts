
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a student's performance summary
 * based on their subject marks.
 *
 * - generatePerformanceSummary - A function that takes student and subject data and returns an AI-generated performance summary.
 * - GeneratePerformanceSummaryInput - The input type for the generatePerformanceSummary function.
 * - GeneratePerformanceSummaryOutput - The return type for the generatePerformanceSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { SubjectEntry } from '@/lib/schemas'; // Re-using SubjectEntry type

// Define the schema for individual subject entries for the flow input
const FlowSubjectEntrySchema = z.object({
  subjectName: z.string(),
  continuousAssessment: z.number().nullable().optional(),
  examinationMark: z.number().nullable().optional(),
});

const GeneratePerformanceSummaryInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  className: z.string().describe('The name of the class.'),
  subjects: z.array(FlowSubjectEntrySchema).describe('An array of subjects with their marks. CA is out of 60, Exam is out of 100.'),
});

export type GeneratePerformanceSummaryInput = z.infer<
  typeof GeneratePerformanceSummaryInputSchema
>;

const GeneratePerformanceSummaryOutputSchema = z.object({
  performanceSummary: z
    .string()
    .describe('The AI-generated performance summary for the student based on subject marks.'),
});

export type GeneratePerformanceSummaryOutput = z.infer<
  typeof GeneratePerformanceSummaryOutputSchema
>;

export async function generatePerformanceSummary(
  input: GeneratePerformanceSummaryInput
): Promise<GeneratePerformanceSummaryOutput> {
  return generatePerformanceSummaryFlow(input);
}

const generatePerformanceSummaryPrompt = ai.definePrompt({
  name: 'generatePerformanceSummaryPrompt',
  input: {schema: GeneratePerformanceSummaryInputSchema},
  output: {schema: GeneratePerformanceSummaryOutputSchema},
  prompt: `You are an academic advisor tasked with writing a performance summary for a student's report card.
Analyze the student's performance based on their subject marks provided below.

Student Name: {{{studentName}}}
Class Name: {{{className}}}

Subject Performance Details:
{{#each subjects}}
- Subject: {{subjectName}}
  Continuous Assessment (CA): {{#if continuousAssessment}}{{continuousAssessment}} out of 60{{else}}N/A{{/if}}
  Examination Mark (Exam): {{#if examinationMark}}{{examinationMark}} out of 100{{else}}N/A{{/if}}
{{/each}}

Important Grading Information:
- The final score for each subject is calculated by scaling the CA mark to contribute 40% and the Exam mark to contribute 60%.
  - CA scaled = (CA_raw / 60) * 40
  - Exam scaled = (Exam_raw / 100) * 60
  - Final Score = CA_scaled + Exam_scaled (out of 100)
- Grading Scale (based on Final Score):
  - 90-100: A+ (Excellent)
  - 80-89: A (Very Good)
  - 70-79: B+ (Good)
  - 60-69: B (Satisfactory)
  - 50-59: C (Needs Improvement)
  - 40-49: D (Unsatisfactory)
  - Below 40: F (Fail)

Based on this information, write a concise and constructive overall performance summary for the student.
Highlight general academic trends, subjects where the student excelled, and subjects that might require more attention or show potential for improvement.
The summary should be suitable for inclusion in a student report card. Focus on providing a balanced view.
Generate only the performance summary text.
`,
});

const generatePerformanceSummaryFlow = ai.defineFlow(
  {
    name: 'generatePerformanceSummaryFlow',
    inputSchema: GeneratePerformanceSummaryInputSchema,
    outputSchema: GeneratePerformanceSummaryOutputSchema,
  },
  async input => {
    const {output} = await generatePerformanceSummaryPrompt(input);
    return output!;
  }
);
