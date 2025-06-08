
'use server';
/**
 * @fileOverview A Genkit flow for generating insights and advice on overall class performance.
 *
 * - generateClassInsights - A function that analyzes aggregated class performance data
 *   and returns AI-generated advice for the teacher.
 * - GenerateClassInsightsInput - The input type for the generateClassInsights function.
 * - GenerateClassInsightsOutput - The return type for the generateClassInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  averageMark: z.number().nullable().describe("Average mark for this subject in the class (0-100)."),
  studentsAboveAverage: z.number().describe("Number of students scoring above the subject's class average."),
  studentsAtAverage: z.number().describe("Number of students scoring at (within a small tolerance) the subject's class average."),
  studentsBelowAverage: z.number().describe("Number of students scoring below the subject's class average."),
  passRate: z.number().describe('Percentage of students passing this subject (e.g., 75 for 75%).'),
});
export type SubjectPerformanceStat = z.infer<typeof SubjectPerformanceStatSchema>;

const GenderPerformanceStatSchema = z.object({
  gender: z.string().describe("e.g., Male, Female, Other, Unspecified"),
  averageScore: z.number().nullable().describe("Average overall score for students of this gender (0-100)."),
  count: z.number().describe("Number of students of this gender."),
});
export type GenderPerformanceStat = z.infer<typeof GenderPerformanceStatSchema>;

const GenerateClassInsightsInputSchema = z.object({
  className: z.string().describe("The name of the class being analyzed."),
  totalStudents: z.number().describe("Total number of students in the class whose reports are being analyzed."),
  overallClassAverage: z.number().nullable().describe("The average score of all students in the class across all subjects (0-100)."),
  subjectStats: z.array(SubjectPerformanceStatSchema).describe("Performance statistics for each subject taught in the class."),
  genderStats: z.array(GenderPerformanceStatSchema).describe("Overall performance statistics aggregated by gender."),
  passMark: z.number().default(50).describe("The pass mark used for calculating pass rates, out of 100."),
});
export type GenerateClassInsightsInput = z.infer<typeof GenerateClassInsightsInputSchema>;

const GenerateClassInsightsOutputSchema = z.object({
  overallSummary: z.string().describe("A brief (2-3 sentences) overview of the class's general academic performance based on the provided data."),
  subjectAnalysis: z.string().describe("Detailed analysis of performance across different subjects. Highlight subjects where students excel, subjects where they struggle, and any subjects with notable performance distribution (e.g., highly polarized)."),
  genderAnalysis: z.string().describe("Observations on performance based on gender, if notable and statistically relevant trends exist. This section should be framed constructively, focusing on equity and avoiding generalizations. If differences are minor or data for a gender group is too small for meaningful comparison, it should be stated."),
  recommendations: z.string().describe("Actionable recommendations for the teacher. These could include pedagogical strategies, areas for targeted student support, subjects needing curriculum attention, or ways to leverage class strengths. Aim for 2-4 distinct recommendations."),
});
export type GenerateClassInsightsOutput = z.infer<typeof GenerateClassInsightsOutputSchema>;

export async function generateClassInsights(
  input: GenerateClassInsightsInput
): Promise<GenerateClassInsightsOutput> {
  return generateClassInsightsFlow(input);
}

const generateClassInsightsPrompt = ai.definePrompt({
  name: 'generateClassInsightsPrompt',
  input: {schema: GenerateClassInsightsInputSchema},
  output: {schema: GenerateClassInsightsOutputSchema},
  prompt: `You are an experienced educational analyst assisting a teacher with understanding their class's performance.
Analyze the following aggregated data for "{{className}}":

Total Students Analyzed: {{{totalStudents}}}
Overall Class Average Score: {{#if overallClassAverage}}{{{overallClassAverage}}}%{{else}}N/A{{/if}}
Assumed Pass Mark for Analysis: {{{passMark}}}%

Subject Performance Breakdown:
{{#each subjectStats}}
- Subject: {{subjectName}}
  - Class Average Mark: {{#if averageMark}}{{{averageMark}}}%{{else}}N/A{{/if}}
  - Students Above Subject Average: {{studentsAboveAverage}}
  - Students At Subject Average: {{studentsAtAverage}}
  - Students Below Subject Average: {{studentsBelowAverage}}
  - Subject Pass Rate: {{passRate}}%
{{/each}}

Gender-Based Performance Overview:
{{#each genderStats}}
{{#if count}}
- Gender: {{gender}}
  - Number of Students: {{count}}
  - Average Overall Score: {{#if averageScore}}{{{averageScore}}}%{{else}}N/A{{/if}}
{{/if}}
{{/each}}

Based *only* on the provided statistical data:

1.  **Overall Summary**: Write a brief (2-3 sentences) overview of the class's general academic performance.
2.  **Subject Analysis**:
    - Identify subjects where students are generally performing well (e.g., high class average for the subject, high pass rates, many students above average for that subject).
    - Identify subjects where students appear to be struggling (e.g., low class average for the subject, low pass rates, many students below average for that subject).
    - Note any subjects with a particularly wide spread of performance (e.g., high numbers in both above and below average categories).
3.  **Gender Analysis**:
    - Comment on overall performance trends across different genders *only if* the data shows notable differences and if the number of students in each gender group is sufficient for a meaningful (though basic) comparison.
    - Frame observations constructively and focus on equity. Avoid making generalizations or stereotypes.
    - If differences are minor, or if data for any gender group is too small (e.g., less than 5 students), explicitly state that robust conclusions about gender-based performance cannot be drawn from the provided data.
4.  **Recommendations**:
    - Provide 2-4 actionable recommendations for the teacher. These could be related to teaching strategies for specific subjects, areas where differentiated instruction might be beneficial, or ways to leverage identified class strengths. Recommendations should be directly tied to the patterns observed in the data.

Ensure your analysis is objective, data-driven, and supportive. Focus on providing helpful insights to the teacher.
Do not invent data or make assumptions beyond what is provided.
`,
});

const generateClassInsightsFlow = ai.defineFlow(
  {
    name: 'generateClassInsightsFlow',
    inputSchema: GenerateClassInsightsInputSchema,
    outputSchema: GenerateClassInsightsOutputSchema,
  },
  async input => {
    const {output} = await generateClassInsightsPrompt(input);
    // Add safety settings if needed for more sensitive content, though educational analysis should be fine.
    // For example:
    // const { output } = await generateClassInsightsPrompt(input, {
    //   config: {
    //     safetySettings: [
    //       { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    //     ],
    //   },
    // });
    return output!;
  }
);

