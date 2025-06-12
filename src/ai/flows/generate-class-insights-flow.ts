
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for a class based on performance data.
 *
 * - generateClassInsights - A function that takes class statistics and returns AI-generated insights.
 * - GenerateClassInsightsInput - The input type for the generateClassInsights function.
 * - GenerateClassInsightsOutput - The return type for the generateClassInsights function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

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
  overallAssessment: z.string().describe('A general assessment of the class\'s performance. This could be an empty string if no specific assessment is made.').default(''),
  strengths: z.array(z.string()).describe('Key strengths observed in the class. This could be an empty array.').default([]),
  areasForConcern: z.array(z.string()).describe('Areas that might need attention or improvement. This could be an empty array.').default([]),
  actionableAdvice: z.array(z.string()).describe('Specific, actionable advice for the teacher. This could be an empty array.').default([]),
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
1.  **Overall Assessment**: A brief summary of the class's general performance level. If no strong assessment can be made, this can be a neutral statement or empty.
2.  **Strengths**: Identify 2-3 key strengths of the class. These could be subjects where many students excel, strong performance by a particular group if significant, or overall high achievement if applicable. If no clear strengths, return an empty array.
3.  **Areas for Concern**: Identify 2-3 areas that might need attention. This could be subjects with many struggling students, significant disparities, or overall low performance if applicable. If no clear concerns, return an empty array.
4.  **Actionable Advice**: Provide 2-3 concise, practical, and actionable pieces of advice for the teacher to help improve learning outcomes, address weaknesses, or build on strengths. If no specific advice, return an empty array.

Focus on constructive feedback. Be specific where possible, referencing subject names or patterns.
Format the output as JSON matching the GenerateClassInsightsOutputSchema.
Ensure overallAssessment is a string (can be empty), and strengths, areasForConcern, and actionableAdvice are arrays of strings (can be empty arrays).
If the input data is insufficient to make a meaningful judgment on any part, provide an empty string or empty array for that part rather than making assumptions.
`,
  // It's good practice to set some safety settings, though for this content they might not be strictly necessary.
  // Using less restrictive settings as an example.
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
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        // This case means the AI model call failed or did not return parsable JSON according to the schema.
        // The schema now has defaults, so an empty object {} might be returned if the model sends nothing.
        // However, if the model truly fails or sends malformed JSON, output will be null.
        throw new Error('AI failed to generate class insights. The model may not have returned the expected output format, or the input was insufficient. Please check the data or try again.');
    }
    // Ensure all parts of the output conform to the schema, especially if the model returns partial data.
    // The Zod schema's .default() should handle missing fields if the AI returns a valid object.
    return {
        overallAssessment: output.overallAssessment || '',
        strengths: output.strengths || [],
        areasForConcern: output.areasForConcern || [],
        actionableAdvice: output.actionableAdvice || [],
    };
  }
);
