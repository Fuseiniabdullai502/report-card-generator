'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a student's performance summary,
 * strengths, and areas for improvement based on their subject marks, attendance, and optionally,
 * performance from previous terms for comparison.
 *
 * - generateReportInsights - A function that takes student, class, attendance, subject data,
 *   and optional previous term data, then returns AI-generated insights.
 * - GenerateReportInsightsInput - The input type for the generateReportInsights function.
 * - GenerateReportInsightsOutput - The return type for the generateReportInsights function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

// Define the schema for individual subject entries for the flow input - NOT EXPORTED
const FlowSubjectEntrySchema = z.object({
  subjectName: z.string(),
  continuousAssessment: z.number().nullable().optional(),
  examinationMark: z.number().nullable().optional(),
});

// Define the schema for previous term performance data - NOT EXPORTED
const PreviousTermPerformanceSchema = z.object({
  termName: z.string().describe("The name of the previous academic term (e.g., 'First Term')."),
  subjects: z.array(FlowSubjectEntrySchema).describe('An array of subjects with their marks for that term.'),
  overallAverage: z.number().nullable().optional().describe("The student's overall average for that term, if available."),
});

// Define the Zod schema for the input - NOT EXPORTED
const GenerateReportInsightsInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  className: z.string().describe('The name of the class.'),
  currentAcademicTerm: z.string().describe('The academic term for which this report is being generated (e.g., "Second Term").'),
  daysAttended: z.number().nullable().optional().describe('Number of days the student attended school in the current term.'),
  totalSchoolDays: z.number().nullable().optional().describe('Total number of school days in the current term.'),
  subjects: z.array(FlowSubjectEntrySchema).describe('An array of subjects with their marks for the current term. CA is out of 60, Exam is out of 100.'),
  previousTermsData: z.array(PreviousTermPerformanceSchema).optional().describe('Performance data from previous academic terms for comparison.'),
});

export type GenerateReportInsightsInput = z.infer<typeof GenerateReportInsightsInputSchema>;

// Output schema is now optional to handle cases where the AI might not return all fields
const GenerateReportInsightsOutputSchema = z.object({
  performanceSummary: z.string().describe('The AI-generated concise (1-3 sentences) overall performance summary for the student, including comparison if previous data was provided.').optional(),
  strengths: z.string().describe("The AI-generated brief list of the student's key strengths (e.g., 2-3 points), considering progress or sustained performance.").optional(),
  areasForImprovement: z.string().describe('The AI-generated brief list of areas where the student can improve (e.g., 2-3 points), considering any decline or persistent challenges.').optional(),
});

export type GenerateReportInsightsOutput = z.infer<typeof GenerateReportInsightsOutputSchema>;

export async function generateReportInsights(input: GenerateReportInsightsInput): Promise<GenerateReportInsightsOutput> {
  return generateReportInsightsFlow(input);
}

const generateReportInsightsPrompt = ai.definePrompt({
  name: 'generateReportInsightsPrompt',
  model: googleAI('gemini-1.5-flash'),
  input: { schema: GenerateReportInsightsInputSchema },
  output: { schema: GenerateReportInsightsOutputSchema },
  prompt: `You are an academic advisor tasked with writing concise insights for a student's report card for the {{{currentAcademicTerm}}}.
Analyze the student's performance based on their subject marks and attendance data provided below for the current term.

Student Name: {{{studentName}}}
Class Name: {{{className}}}

Current Term ({{{currentAcademicTerm}}}) Attendance:
{{#if daysAttended}}
Days Attended: {{{daysAttended}}}{{#if totalSchoolDays}} out of {{{totalSchoolDays}}}{{/if}} days.
{{else}}
Attendance data not available for the current term.
{{/if}}

Current Term ({{{currentAcademicTerm}}}) Subject Performance Details:
{{#each subjects}}
- Subject: {{subjectName}}
  Continuous Assessment (CA): {{#if continuousAssessment}}{{continuousAssessment}} out of 60{{else}}N/A{{/if}}
  Examination Mark (Exam): {{#if examinationMark}}{{examinationMark}} out of 100{{else}}N/A{{/if}}
{{/each}}

Important Grading Information:
- The final score for each subject is calculated by scaling the CA mark to contribute 50% and the Exam mark to contribute 50%.
  - CA scaled = (CA_raw / 60) * 50
  - Exam scaled = (Exam_raw / 100) * 50
  - Final Score = CA_scaled + Exam_scaled (out of 100)
- Grading Scale (based on Final Score):
  - 90-100: A+ (Excellent)
  - 80-89: A (Very Good)
  - 70-79: B+ (Good)
  - 60-69: B (Satisfactory)
  - 50-59: C (Needs Improvement)
  - 40-49: D (Unsatisfactory)
  - Below 40: F (Fail)

{{#if previousTermsData.length}}
Previous Term Performance for Comparison:
{{#each previousTermsData}}
- {{termName}}:
  {{#if overallAverage}}Overall Average for {{termName}}: {{overallAverage}}%{{else}}Overall Average for {{termName}}: N/A{{/if}}
  Subject Performance in {{termName}}:
  {{#each subjects}}
  - {{subjectName}}: {{#if continuousAssessment}}CA: {{continuousAssessment}}/60{{else}}CA: N/A{{/if}}, {{#if examinationMark}}Exam: {{examinationMark}}/100{{else}}Exam: N/A{{/if}} (Final Score for this subject in {{../termName}} would be calculated using the grading info above)
  {{/each}}
{{/each}}

Based on ALL available information (current term performance, attendance, AND comparative analysis if previous term data is provided):
1.  Write a **CONCISE overall performance summary (1-3 sentences)**. If previous term data is available, explicitly compare the student's current performance with their performance in the previous term(s). Highlight trends such as improvement, decline, or consistency in specific subjects or overall.
2.  Identify and list **BRIEFLY the student's key strengths (e.g., 2-3 points)**. If previous term data is available, consider progress or sustained high performance.
3.  Identify and list **CONCISELY areas for improvement (e.g., 2-3 points)**. If previous term data is available, consider any decline in performance or persistent challenges.

Generate only the text for these three sections. Ensure the tone is balanced and suitable for a student report card.
{{else}}
(No previous term data was provided for comparison.)

Based on the current term's information (subject performance and attendance):
1.  Write a **CONCISE overall performance summary (1-3 sentences)**.
2.  Identify and list **BRIEFLY the student's key strengths (e.g., 2-3 points)**.
3.  Identify and list **CONCISELY areas for improvement (e.g., 2-3 points)**.

Generate only the text for these three sections. Ensure the tone is balanced and suitable for a student report card.
{{/if}}
`,
});

const generateReportInsightsFlow = ai.defineFlow(
  {
    name: 'generateReportInsightsFlow',
    inputSchema: GenerateReportInsightsInputSchema,
    outputSchema: GenerateReportInsightsOutputSchema,
  },
  async (input: z.infer<typeof GenerateReportInsightsInputSchema>) => {
    const { output } = await generateReportInsightsPrompt(input);
    if (!output) {
      return {
        performanceSummary: '',
        strengths: '',
        areasForImprovement: '',
      };
    }
    return {
      performanceSummary: output.performanceSummary || '',
      strengths: output.strengths || '',
      areasForImprovement: output.areasForImprovement || '',
    };
  }
);
