
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for a class based on performance data.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

// -------------------------
// Input Schemas
// -------------------------
const SubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  numBelowAverage: z.number().describe('Number of students performing below average (e.g., <40%)'),
  numAverage: z.number().describe('Number of students performing average (e.g., 40-59%)'),
  numAboveAverage: z.number().describe('Number of students performing above average (e.g., >=60%)'),
  classAverageForSubject: z.number().nullable().describe('The average score for this subject in the class.'),
});

const GenderPerformanceStatSchema = z.object({
  gender: z.string(),
  count: z.number(),
  averageScore: z.number().nullable().describe('Average overall score for this gender group.'),
});

const GenerateClassInsightsInputSchema = z.object({
  className: z.string().describe('The name of the class.'),
  academicTerm: z.string().describe('The academic term.'),
  overallClassAverage: z.number().nullable().describe('The overall average score for the entire class.'),
  totalStudents: z.number().describe('Total number of students in the class.'),
  subjectStats: z.array(SubjectPerformanceStatSchema).describe('Performance statistics for each subject.'),
  genderStats: z.array(GenderPerformanceStatSchema).describe('Performance statistics broken down by gender.'),
});
export type GenerateClassInsightsInput = z.infer<typeof GenerateClassInsightsInputSchema>;

// -------------------------
// Output Schema (strict)
// -------------------------
const RecommendedResourceSchema = z.object({
  name: z.string().describe('The name of the recommended resource (e.g., "Khan Academy", "CrashCourse").'),
  type: z.enum(['Website', 'YouTube Channel']).describe('The type of the resource.'),
  url: z.string().describe('The full URL to the resource.'),
  description: z.string().describe('A brief (1-sentence) explanation of why this resource is helpful for the identified areas of concern.'),
});

const GenerateClassInsightsOutputSchema = z.object({
  overallAssessment: z.string().describe("A general assessment of the class's performance."),
  strengths: z.array(z.string()).describe('Key strengths observed in the class.'),
  areasForConcern: z.array(z.string()).describe('Areas that might need attention or improvement.'),
  actionableAdvice: z.array(z.string()).describe('Specific, actionable advice for the teacher.'),
  recommendedResources: z.array(RecommendedResourceSchema).describe('A list of 2-3 recommended educational websites or YouTube channels to help address areas for concern.'),
});
export type GenerateClassInsightsOutput = z.infer<typeof GenerateClassInsightsOutputSchema>;

// -------------------------
// Public Entry Function
// -------------------------
export async function generateClassInsights(input: GenerateClassInsightsInput): Promise<GenerateClassInsightsOutput> {
  return generateClassInsightsFlow(input);
}

// -------------------------
// Prompt Definition
// -------------------------
const prompt = ai.definePrompt({
  name: 'generateClassInsightsPrompt',
  model: 'gemini-1.5-flash',
  input: { schema: GenerateClassInsightsInputSchema },
  output: { schema: GenerateClassInsightsOutputSchema },
  prompt: `You are an experienced educational analyst and pedagogical advisor.
You have been provided with performance data for {{{className}}} for the {{{academicTerm}}}.
There are a total of {{{totalStudents}}} students.
The overall class average is {{#if overallClassAverage}}{{{overallClassAverage}}}%{{else}}N/A{{/if}}.

Subject Performance:
{{#each subjectStats}}
- {{subjectName}}:
  - Below Average (<40%): {{numBelowAverage}} students
  - Average (40-59%): {{numAverage}} students
  - Above Average (>=60%): {{numAboveAverage}} students
  - Class Average in {{subjectName}}: {{#if classAverageForSubject}}{{classAverageForSubject}}%{{else}}N/A{{/if}}
{{/each}}

Gender Performance:
{{#each genderStats}}
- {{gender}}s: {{count}} students, Average Score: {{#if averageScore}}{{averageScore}}%{{else}}N/A{{/if}}
{{/each}}

Based on this data, you MUST provide:
1. **Overall Assessment**: A general summary of the class's performance.
2. **Strengths**: ALWAYS identify at least one subject or trend where the class is performing well. Be encouraging. Do not leave this field empty.
3. **Areas for Concern**: CRITICAL - ALWAYS analyze the data to find at least one subject where a significant number of students are below average or where the class average is lowest. Explicitly list this as an area for concern. Do not leave this field empty.
4. **Actionable Advice for Teacher**: CRITICAL - For each 'Area for Concern' you identified, you MUST provide at least one specific, practical, and actionable piece of advice that a teacher can implement in the classroom. Do not leave this field empty.
5. **Recommended Resources**: Based on the 'Areas for Concern', recommend 2-3 specific, high-quality, and well-known educational websites or YouTube channels (like Khan Academy, BBC Bitesize, CrashCourse, etc.) that could help the teacher and students. For each resource, provide its name, type (Website or YouTube Channel), a valid URL, and a brief description of its relevance.

Ensure all output fields are present. If a section seems balanced, find the most subtle positive or negative trend to highlight. Do not return empty arrays for strengths, concerns, or advice. Format the output as JSON matching the GenerateClassInsightsOutputSchema.`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  },
});

// -------------------------
// Flow Definition (with try/catch)
// -------------------------
const generateClassInsightsFlow = ai.defineFlow(
  {
    name: 'generateClassInsightsFlow',
    inputSchema: GenerateClassInsightsInputSchema,
    outputSchema: GenerateClassInsightsOutputSchema,
  },
  async (input: GenerateClassInsightsInput) => {
    try {
      const { output } = await prompt(input);
      // Ensure that we return a valid object even if the AI response is partially empty
      return {
        overallAssessment: output?.overallAssessment ?? '',
        strengths: output?.strengths ?? [],
        areasForConcern: output?.areasForConcern ?? [],
        actionableAdvice: output?.actionableAdvice ?? [],
        recommendedResources: output?.recommendedResources ?? [],
      };
    } catch (e) {
      console.error('Error generating class insights:', e);
      // Return a completely empty object on failure to prevent downstream errors
      return {
        overallAssessment: '',
        strengths: [],
        areasForConcern: [],
        actionableAdvice: [],
        recommendedResources: [],
      };
    }
  }
);
