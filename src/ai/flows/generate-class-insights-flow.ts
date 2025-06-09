
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for a class based on performance data.
 *
 * - generateClassInsights - A function that takes class statistics and returns AI-generated insights.
 * - GenerateClassInsightsInput - The input type for the generateClassInsights function.
 * - GenerateClassInsightsOutput - The return type for the generateClassInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

const GenerateClassInsightsOutputSchema = z.object({
  overallAssessment: z.string().describe('A general assessment of the class\'s performance.'),
  strengths: z.array(z.string()).describe('Key strengths observed in the class.'),
  areasForConcern: z.array(z.string()).describe('Areas that might need attention or improvement.'),
  actionableAdvice: z.array(z.string()).describe('Specific, actionable advice for the teacher.'),
});
export type GenerateClassInsightsOutput = z.infer<typeof GenerateClassInsightsOutputSchema>;

export async function generateClassInsights(input: GenerateClassInsightsInput): Promise<GenerateClassInsightsOutput> {
  return generateClassInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateClassInsightsPrompt',
  input: {schema: GenerateClassInsightsInputSchema},
  output: {schema: GenerateClassInsightsOutputSchema},
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

Based on this data, provide:
1.  **Overall Assessment**: A brief summary of the class's general performance level.
2.  **Strengths**: Identify 2-3 key strengths of the class. These could be subjects where many students excel, strong performance by a particular group if significant, or overall high achievement if applicable.
3.  **Areas for Concern**: Identify 2-3 areas that might need attention. This could be subjects with many struggling students, significant disparities, or overall low performance if applicable.
4.  **Actionable Advice**: Provide 2-3 concise, practical, and actionable pieces of advice for the teacher to help improve learning outcomes, address weaknesses, or build on strengths.

Focus on constructive feedback. Be specific where possible, referencing subject names or patterns.
Format the output as JSON matching the CGenerateClassInsightsOutputSchema.
Ensure strengths, areasForConcern, and actionableAdvice are arrays of strings.
`,
});

const generateClassInsightsFlow = ai.defineFlow(
  {
    name: 'generateClassInsightsFlow',
    inputSchema: GenerateClassInsightsInputSchema,
    outputSchema: GenerateClassInsightsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error('AI failed to generate class insights. The model may not have returned the expected output format or the input was insufficient.');
    }
    return output;
  }
);
