
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for an entire district based on performance data from multiple schools.
 */

import { ai } from '@/ai/genkit';
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
  model: 'gemini-1.5-flash',
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

Based on this comprehensive district-level data, provide:
1. **Overall District Assessment**: A summary of the district's academic health.
2. **Key Strengths (District-Wide)**: Identify subjects or trends where the district excels.
3. **Areas for Concern (District-Wide)**: Pinpoint subjects or trends that require attention at a district level.
4. **Actionable Advice for District Administration**: Suggest concrete, strategic actions the district administration can take (e.g., professional development for teachers in a specific subject, resource allocation, cross-school collaboration).
5. **Inter-School Observations**: Note any significant performance gaps or similarities between schools that might inform district strategy.

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
      actionableAdviceForDistrict: output.actionableAdviceForSchool || [], // Mapped from old prompt if present
      interSchoolObservations: output.interSchoolObservations || [],
    };
  }
);
