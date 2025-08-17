
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for a class based on performance data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

const RecommendedResourceSchema = z.object({
  name: z.string().describe('The name of the recommended resource (e.g., "Khan Academy", "CrashCourse").'),
  type: z.enum(['Website', 'YouTube Channel']).describe('The type of the resource.'),
  url: z.string().url().describe('The full URL to the resource.'),
  description: z.string().describe('A brief (1-sentence) explanation of why this resource is helpful for the identified areas of concern.'),
});

const GenerateClassInsightsOutputSchema = z.object({
  overallAssessment: z.string().describe('A general assessment of the class\'s performance.').optional(),
  strengths: z.array(z.string()).describe('Key strengths observed in the class.').optional(),
  areasForConcern: z.array(z.string()).describe('Areas that might need attention or improvement.').optional(),
  actionableAdvice: z.array(z.string()).describe('Specific, actionable advice for the teacher.').optional(),
  recommendedResources: z.array(RecommendedResourceSchema).describe('A list of 2-3 recommended educational websites or YouTube channels to help address areas for concern.').optional(),
});
export type GenerateClassInsightsOutput = z.infer<typeof GenerateClassInsightsOutputSchema>;

export async function generateClassInsights(input: GenerateClassInsightsInput): Promise<GenerateClassInsightsOutput> {
  return generateClassInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateClassInsightsPrompt',
  model: 'googleai/gemini-1.5-flash',
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

Based on this data, provide:
1. **Overall Assessment**
2. **Strengths**
3. **Areas for Concern**
4. **Actionable Advice**
5. **Recommended Resources**: Based on the 'Areas for Concern', recommend 2-3 specific, high-quality, and well-known educational websites or YouTube channels (like Khan Academy, BBC Bitesize, CrashCourse, etc.) that could help the teacher and students. For each resource, provide its name, type (Website or YouTube Channel), a valid URL, and a brief description of its relevance.

Format the output as JSON matching the GenerateClassInsightsOutputSchema.`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  },
});

const generateClassInsightsFlow = ai.defineFlow(
  {
    name: 'generateClassInsightsFlow',
    inputSchema: GenerateClassInsightsInputSchema,
    outputSchema: GenerateClassInsightsOutputSchema,
  },
  async (input: GenerateClassInsightsInput) => {
    const { output } = await prompt(input);
    if (!output) {
      return {
        overallAssessment: '',
        strengths: [],
        areasForConcern: [],
        actionableAdvice: [],
        recommendedResources: [],
      };
    }
    return {
      overallAssessment: output.overallAssessment || '',
      strengths: output.strengths || [],
      areasForConcern: output.areasForConcern || [],
      actionableAdvice: output.actionableAdvice || [],
      recommendedResources: output.recommendedResources || [],
    };
  }
);
