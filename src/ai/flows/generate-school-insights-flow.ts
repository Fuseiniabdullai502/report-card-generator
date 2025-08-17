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
  prompt: `You are an expert educational consultant and data analyst providing a school-level performance review.
... [YOUR ORIGINAL PROMPT TEXT]
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
