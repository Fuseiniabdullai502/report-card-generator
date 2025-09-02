
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for an entire school based on performance data from multiple classes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SchoolSubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  numBelowAverage: z.number(),
  numAverage: z.number(),
  numAboveAverage: z.number(),
  schoolAverageForSubject: z.number().nullable(),
});

const SchoolGenderPerformanceStatSchema = z.object({
  gender: z.string(),
  count: z.number(),
  averageScore: z.number().nullable(),
});

const ClassSummarySchema = z.object({
  className: z.string(),
  classAverage: z.number().nullable(),
  numberOfStudents: z.number(),
});

const GenerateSchoolInsightsInputSchema = z.object({
  schoolName: z.string(),
  academicTerm: z.string(),
  overallSchoolAverage: z.number().nullable(),
  totalStudentsInSchool: z.number(),
  numberOfClassesRepresented: z.number(),
  classSummaries: z.array(ClassSummarySchema),
  overallSubjectStatsForSchool: z.array(SchoolSubjectPerformanceStatSchema),
  overallGenderStatsForSchool: z.array(SchoolGenderPerformanceStatSchema),
});
export type GenerateSchoolInsightsInput = z.infer<typeof GenerateSchoolInsightsInputSchema>;

const GenerateSchoolInsightsOutputSchema = z.object({
  overallSchoolAssessment: z.string().optional(),
  keyStrengthsSchoolWide: z.array(z.string()).optional(),
  areasForConcernSchoolWide: z.array(z.string()).optional(),
  actionableAdviceForSchool: z.array(z.string()).optional(),
  interClassObservations: z.array(z.string()).optional(),
});
export type GenerateSchoolInsightsOutput = z.infer<typeof GenerateSchoolInsightsOutputSchema>;

export async function generateSchoolInsights(input: GenerateSchoolInsightsInput): Promise<GenerateSchoolInsightsOutput> {
  return generateSchoolInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSchoolInsightsPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: GenerateSchoolInsightsInputSchema },
  output: { schema: GenerateSchoolInsightsOutputSchema },
  prompt: `You are an expert educational consultant and data analyst providing a school-level performance review for {{{schoolName}}}.
You are analyzing data for the {{{academicTerm}}}.
There are a total of {{{totalStudentsInSchool}}} students across {{{numberOfClassesRepresented}}} classes.
The overall school average is {{#if overallSchoolAverage}}{{{overallSchoolAverage}}}%{{else}}N/A{{/if}}.

Performance of Classes in the School:
{{#each classSummaries}}
- {{className}}: {{numberOfStudents}} students, Class Average: {{#if classAverage}}{{classAverage}}%{{else}}N/A{{/if}}
{{/each}}

Overall Subject Performance Across the School:
{{#each overallSubjectStatsForSchool}}
- {{subjectName}}:
  - Below Average (<40%): {{numBelowAverage}} students
  - Average (40-59%): {{numAverage}} students
  - Above Average (>=60%): {{numAboveAverage}} students
  - School Average in {{subjectName}}: {{#if schoolAverageForSubject}}{{schoolAverageForSubject}}%{{else}}N/A{{/if}}
{{/each}}

Overall Gender Performance Across the School:
{{#each overallGenderStatsForSchool}}
- {{gender}}s: {{count}} students, Average Score: {{#if averageScore}}{{averageScore}}%{{else}}N/A{{/if}}
{{/each}}

Based on this comprehensive school-level data, provide:
1. **Overall School Assessment**: A summary of the school's academic health.
2. **Key Strengths (School-Wide)**: Identify subjects or trends where the school excels.
3. **Areas for Concern (School-Wide)**: Pinpoint subjects or trends that require attention.
4. **Actionable Advice for School Administration**: Suggest concrete, strategic actions the school administration can take.
5. **Inter-Class Observations**: Note any significant performance gaps or similarities between classes that might inform school strategy.

Ensure all output fields are present, using empty strings or empty arrays if no specific points can be made for a particular section.
`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  },
});

const generateSchoolInsightsFlow = ai.defineFlow(
  {
    name: 'generateSchoolInsightsFlow',
    inputSchema: GenerateSchoolInsightsInputSchema,
    outputSchema: GenerateSchoolInsightsOutputSchema,
  },
  async (input: GenerateSchoolInsightsInput) => {
    const { output } = await prompt(input);

    if (!output) {
      return {
        overallSchoolAssessment: '',
        keyStrengthsSchoolWide: [],
        areasForConcernSchoolWide: [],
        actionableAdviceForSchool: [],
        interClassObservations: [],
      };
    }

    return {
      overallSchoolAssessment: output.overallSchoolAssessment || '',
      keyStrengthsSchoolWide: output.keyStrengthsSchoolWide || [],
      areasForConcernSchoolWide: output.areasForConcernSchoolWide || [],
      actionableAdviceForSchool: output.actionableAdviceForSchool || [],
      interClassObservations: output.interClassObservations || [],
    };
  }
);
