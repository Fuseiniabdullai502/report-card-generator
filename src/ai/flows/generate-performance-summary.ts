
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a student's performance summary,
 * strengths, and areas for improvement based on their subject marks and attendance.
 *
 * - generateReportInsights - A function that takes student, class, attendance, and subject data
 *   and returns AI-generated insights.
 * - GenerateReportInsightsInput - The input type for the generateReportInsights function.
 * - GenerateReportInsightsOutput - The return type for the generateReportInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the schema for individual subject entries for the flow input
const FlowSubjectEntrySchema = z.object({
  subjectName: z.string(),
  continuousAssessment: z.number().nullable().optional(),
  examinationMark: z.number().nullable().optional(),
});

const GenerateReportInsightsInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  className: z.string().describe('The name of the class.'),
  daysAttended: z.number().nullable().optional().describe('Number of days the student attended school.'),
  totalSchoolDays: z.number().nullable().optional().describe('Total number of school days in the term.'),
  subjects: z.array(FlowSubjectEntrySchema).describe('An array of subjects with their marks. CA is out of 60, Exam is out of 100.'),
});

export type GenerateReportInsightsInput = z.infer<
  typeof GenerateReportInsightsInputSchema
>;

const GenerateReportInsightsOutputSchema = z.object({
  performanceSummary: z
    .string()
    .describe('The AI-generated overall performance summary for the student.'),
  strengths: z
    .string()
    .describe("The AI-generated list of the student's key strengths."),
  areasForImprovement: z
    .string()
    .describe('The AI-generated list of areas where the student can improve.'),
});

export type GenerateReportInsightsOutput = z.infer<
  typeof GenerateReportInsightsOutputSchema
>;

export async function generateReportInsights(
  input: GenerateReportInsightsInput
): Promise<GenerateReportInsightsOutput> {
  return generateReportInsightsFlow(input);
}

const generateReportInsightsPrompt = ai.definePrompt({
  name: 'generateReportInsightsPrompt',
  input: {schema: GenerateReportInsightsInputSchema},
  output: {schema: GenerateReportInsightsOutputSchema},
  prompt: `You are an academic advisor tasked with writing comprehensive insights for a student's report card.
Analyze the student's performance based on their subject marks and attendance data provided below.

Student Name: {{{studentName}}}
Class Name: {{{className}}}

Attendance:
{{#if daysAttended}}
Days Attended: {{{daysAttended}}}{{#if totalSchoolDays}} out of {{{totalSchoolDays}}}{{/if}} days.
{{else}}
Attendance data not available.
{{/if}}

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

Based on all this information (subject performance, calculated final scores, grades, AND attendance):
1.  Write a concise and constructive **overall performance summary**.
2.  Identify and list the student's key **strengths**. These could include subjects where they excelled, consistent high performance, positive learning attitudes suggested by marks, or positive aspects reflected by good attendance (if applicable).
3.  Identify and list **areas for improvement**. These could include subjects that require more attention, inconsistent performance, or areas where poor attendance (if applicable) might be a factor or concern.

Generate only the text for these three sections. Ensure the tone is balanced and suitable for a student report card.
`,
});

const generateReportInsightsFlow = ai.defineFlow(
  {
    name: 'generateReportInsightsFlow',
    inputSchema: GenerateReportInsightsInputSchema,
    outputSchema: GenerateReportInsightsOutputSchema,
  },
  async input => {
    const {output} = await generateReportInsightsPrompt(input);
    return output!;
  }
);
