
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for an entire district based on performance data from multiple schools.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

const DistrictSubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  numBelowAverage: z.number(),
  numAverage: z.number(),
  numAboveAverage: z.number(),
  districtAverageForSubject: z.number().nullable(),
});

const DistrictGenderPerformanceStatSchema = z.object({
  gender: z.string(),
  count: z.number(),
  averageScore: z.number().nullable(),
});

const SchoolSummarySchema = z.object({
  schoolName: z.string(),
  schoolAverage: z.number().nullable(),
  numberOfStudents: z.number(),
});

const GenerateDistrictInsightsInputSchema = z.object({
  districtName: z.string(),
  academicTerm: z.string(),
  overallDistrictAverage: z.number().nullable(),
  totalStudentsInDistrict: z.number(),
  numberOfSchoolsRepresented: z.number(),
  schoolSummaries: z.array(SchoolSummarySchema),
  overallSubjectStatsForDistrict: z.array(DistrictSubjectPerformanceStatSchema),
  overallGenderStatsForDistrict: z.array(DistrictGenderPerformanceStatSchema),
});
export type GenerateDistrictInsightsInput = z.infer<typeof GenerateDistrictInsightsInputSchema>;

const GenerateDistrictInsightsOutputSchema = z.object({
  overallDistrictAssessment: z.string().optional(),
  keyStrengthsDistrictWide: z.array(z.string()).optional(),
  areasForConcernDistrictWide: z.array(z.string()).optional(),
  actionableAdviceForDistrict: z.array(z.string()).optional(),
  interSchoolObservations: z.array(z.string()).optional(),
});
export type GenerateDistrictInsightsOutput = z.infer<typeof GenerateDistrictInsightsOutputSchema>;

export async function generateDistrictInsights(input: GenerateDistrictInsightsInput): Promise<GenerateDistrictInsightsOutput> {
  return generateDistrictInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDistrictInsightsPrompt',
  model: 'gemini-1.5-pro-latest',
  input: { schema: GenerateDistrictInsightsInputSchema },
  output: { schema: GenerateDistrictInsightsOutputSchema },
  prompt: `You are an expert educational director and data analyst providing a district-level performance review for the {{{districtName}}} district.
You are analyzing the data for the {{{academicTerm}}}.
There are a total of {{{totalStudentsInDistrict}}} students across {{{numberOfSchoolsRepresented}}} schools.
The overall district average is {{#if overallDistrictAverage}}{{{overallDistrictAverage}}}%{{else}}N/A{{/if}}.

Performance of Schools in the District:
{{#each schoolSummaries}}
- {{schoolName}}: {{numberOfStudents}} students, School Average: {{#if schoolAverage}}{{schoolAverage}}%{{else}}N/A{{/if}}
{{/each}}

Overall Subject Performance Across the District:
{{#each overallSubjectStatsForDistrict}}
- {{subjectName}}:
  - Below Average (<40%): {{numBelowAverage}} students
  - Average (40-59%): {{numAverage}} students
  - Above Average (>=60%): {{numAboveAverage}} students
  - District Average in {{subjectName}}: {{#if districtAverageForSubject}}{{districtAverageForSubject}}%{{else}}N/A{{/if}}
{{/each}}

Overall Gender Performance Across the District:
{{#each overallGenderStatsForDistrict}}
- {{gender}}s: {{count}} students, Average Score: {{#if averageScore}}{{averageScore}}%{{else}}N/A{{/if}}
{{/each}}

Based on this comprehensive district-level data, you MUST provide:
1. **Overall District Assessment**: A summary of the district's academic health.
2. **Key Strengths (District-Wide)**: ALWAYS identify at least one subject or positive trend where the district excels.
3. **Areas for Concern (District-Wide)**: ALWAYS pinpoint at least one subject or trend that requires attention at a district level, even if performance is generally good.
4. **Actionable Advice for District Administration**: For each 'Area for Concern' you identified, suggest at least one concrete, strategic action the district administration can take.
5. **Inter-School Observations**: Note any significant performance gaps or similarities between schools that might inform district strategy.

Ensure all output fields are present. If a section seems balanced, find the most subtle positive or negative trend to highlight. Do not return empty arrays for strengths, concerns, or advice.
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

const generateDistrictInsightsFlow = ai.defineFlow(
  {
    name: 'generateDistrictInsightsFlow',
    inputSchema: GenerateDistrictInsightsInputSchema,
    outputSchema: GenerateDistrictInsightsOutputSchema,
  },
  async (input: GenerateDistrictInsightsInput) => {
    const { output } = await prompt(input);

    if (!output) {
      return {
        overallDistrictAssessment: '',
        keyStrengthsDistrictWide: [],
        areasForConcernDistrictWide: [],
        actionableAdviceForDistrict: [],
        interSchoolObservations: [],
      };
    }

    return {
      overallDistrictAssessment: output.overallDistrictAssessment || '',
      keyStrengthsDistrictWide: output.keyStrengthsDistrictWide || [],
      areasForConcernDistrictWide: output.areasForConcernDistrictWide || [],
      actionableAdviceForDistrict: output.actionableAdviceForDistrict || [],
      interSchoolObservations: output.interSchoolObservations || [],
    };
  }
);
