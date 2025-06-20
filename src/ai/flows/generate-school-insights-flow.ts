
'use server';
/**
 * @fileOverview A Genkit flow to generate insights and advice for an entire school based on performance data from multiple classes.
 *
 * - generateSchoolInsights - A function that takes aggregated school statistics and returns AI-generated insights.
 * - GenerateSchoolInsightsInput - The input type for the generateSchoolInsights function.
 * - GenerateSchoolInsightsOutput - The return type for the generateSchoolInsights function.
 */

import {sirAi} from '@/ai/genkit';
import {z}from 'genkit';

const SchoolSubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  numBelowAverage: z.number().describe('Number of students performing below average (e.g., <40%) across the school'),
  numAverage: z.number().describe('Number of students performing average (e.g., 40-59%) across the school'),
  numAboveAverage: z.number().describe('Number of students performing above average (e.g., >=60%) across the school'),
  schoolAverageForSubject: z.number().nullable().describe('The average score for this subject across the entire school.'),
});

const SchoolGenderPerformanceStatSchema = z.object({
  gender: z.string(),
  count: z.number(),
  averageScore: z.number().nullable().describe('Average overall score for this gender group across the school.'),
});

const ClassSummarySchema = z.object({
  className: z.string(),
  classAverage: z.number().nullable(),
  numberOfStudents: z.number(),
});

const GenerateSchoolInsightsInputSchema = z.object({
  schoolName: z.string().describe('The name of the school.'),
  academicTerm: z.string().describe('The academic term or period being analyzed (e.g., "First Term", "Annual Summary").'),
  overallSchoolAverage: z.number().nullable().describe('The overall average score for the entire school.'),
  totalStudentsInSchool: z.number().describe('Total number of students included in this analysis.'),
  numberOfClassesRepresented: z.number().describe('Total number of unique classes represented in the data.'),
  classSummaries: z.array(ClassSummarySchema).describe('Performance summary for each class.'),
  overallSubjectStatsForSchool: z.array(SchoolSubjectPerformanceStatSchema).describe('Aggregated performance statistics for each subject across the school.'),
  overallGenderStatsForSchool: z.array(SchoolGenderPerformanceStatSchema).describe('Aggregated performance statistics broken down by gender across the school.'),
});
export type GenerateSchoolInsightsInput = z.infer<typeof GenerateSchoolInsightsInputSchema>;

const GenerateSchoolInsightsOutputSchema = z.object({
  overallSchoolAssessment: z.string().describe('A general assessment of the school\'s performance. Can be empty.').default(''),
  keyStrengthsSchoolWide: z.array(z.string()).describe('Key strengths observed across the school. Can be an empty array.').default([]),
  areasForConcernSchoolWide: z.array(z.string()).describe('School-wide areas that might need attention or improvement. Can be an empty array.').default([]),
  actionableAdviceForSchool: z.array(z.string()).describe('Specific, actionable advice for the school administration, presented in paragraph form. Can be an empty array.').default([]),
  interClassObservations: z.array(z.string()).describe('Observations on performance variations or trends between different classes. Can be an empty array.').default([]),
});
export type GenerateSchoolInsightsOutput = z.infer<typeof GenerateSchoolInsightsOutputSchema>;

export async function generateSchoolInsights(input: GenerateSchoolInsightsInput): Promise<GenerateSchoolInsightsOutput> {
  return generateSchoolInsightsFlow(input);
}

const prompt = sirAi.definePrompt({
  name: 'generateSchoolInsightsPrompt',
  input: {schema: GenerateSchoolInsightsInputSchema},
  output: {schema: GenerateSchoolInsightsOutputSchema},
  prompt: `You are an expert educational consultant and data analyst providing a school-level performance review.
You have been provided with aggregated performance data for {{{schoolName}}} for the {{{academicTerm}}}.
Total students analyzed: {{{totalStudentsInSchool}}}.
Number of classes represented: {{{numberOfClassesRepresented}}}.
The overall school average is {{#if overallSchoolAverage}}{{{overallSchoolAverage}}}%{{else}}N/A{{/if}}.

Class Performance Summaries:
{{#each classSummaries}}
- Class: {{className}} ({{numberOfStudents}} students) - Average: {{#if classAverage}}{{classAverage}}%{{else}}N/A{{/if}}
{{/each}}

Overall Subject Performance (School-Wide):
{{#each overallSubjectStatsForSchool}}
- Subject: {{subjectName}}
  - Below Average (<40%): {{numBelowAverage}} students
  - Average (40-59%): {{numAverage}} students
  - Above Average (>=60%): {{numAboveAverage}} students
  - School Average in {{subjectName}}: {{#if schoolAverageForSubject}}{{schoolAverageForSubject}}%{{else}}N/A{{/if}}
{{/each}}

Overall Gender Performance (School-Wide):
{{#each overallGenderStatsForSchool}}
- {{gender}}s: {{count}} students, Average Score: {{#if averageScore}}{{averageScore}}%{{else}}N/A{{/if}}
{{/each}}

Based on this comprehensive data, provide:
1.  **Overall School Assessment**: A brief summary of the school's general performance level.
2.  **Key Strengths (School-Wide)**: Identify 2-3 key strengths of the school. These could be subjects where many students excel school-wide, consistently high-performing classes, or strong overall achievement.
3.  **Areas for Concern (School-Wide)**: Identify 2-3 school-wide areas that might need attention. This could be subjects with widespread challenges, significant disparities between classes not explained by curriculum differences, or overall low performance.
4.  **Actionable Advice for School Administration**: Provide 2-3 DETAILED, practical, and actionable pieces of advice for school leadership, written in PARAGRAPH FORM. Each piece of advice should aim to improve learning outcomes, address weaknesses, or build on strengths at a strategic level.
    These suggestions should include relevant MODERN TEACHING STRATEGIES or PROFESSIONAL DEVELOPMENT themes that could benefit the school (e.g., implementing school-wide data analysis workshops for teachers, fostering inter-departmental collaboration for cross-curricular projects, or investing in teacher training for new pedagogical approaches).
    Where appropriate, also recommend specific, publicly available AUDIO-VISUAL WEBSITES, EDUCATIONAL PLATFORMS, or types of ONLINE RESOURCES that could enhance teaching and learning across the school. For instance, suggest platforms for managing digital assignments like Google Classroom (classroom.google.com), resources for STEM education like PhET Interactive Simulations (phet.colorado.edu), or online libraries/databases accessible to students and staff. Be specific with well-known platform names or describe the type of resource.
    If no specific advice, return an empty array.
5.  **Inter-Class Observations**: Briefly comment on any notable performance variations or trends observed between different classes. Highlight if some classes are significantly outperforming or underperforming compared to the school average or their peers, suggesting areas for further investigation by the school.

Focus on constructive, strategic feedback suitable for school leadership. Be specific where possible, referencing subject names, class patterns, or school-wide data.
Format the output as JSON matching the GenerateSchoolInsightsOutputSchema.
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

const generateSchoolInsightsFlow = sirAi.defineFlow(
  {
    name: 'generateSchoolInsightsFlow',
    inputSchema: GenerateSchoolInsightsInputSchema,
    outputSchema: GenerateSchoolInsightsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error('AI failed to generate school insights. The model may not have returned the expected output format, or the input was insufficient.');
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

