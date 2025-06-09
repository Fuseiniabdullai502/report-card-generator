
'use server';
/**
 * @fileOverview A Genkit flow for interpreting subject-related voice commands.
 *
 * - interpretSubjectCommand - A function that takes transcribed text and returns a structured command.
 * - InterpretSubjectCommandInput - The input type for the interpretSubjectCommand function.
 * - InterpretSubjectCommandOutput - The return type for the interpretSubjectCommand function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// NOT EXPORTED
const InterpretSubjectCommandInputSchema = z.object({
  transcribedText: z.string().describe('The transcribed voice command from the user.'),
});
export type InterpretSubjectCommandInput = z.infer<typeof InterpretSubjectCommandInputSchema>;

// NOT EXPORTED
const InterpretSubjectCommandOutputSchema = z.object({
  action: z.enum(["updateCurrent", "addSubject", "removeSubject", "unknown"])
    .describe("The primary action identified from the command: 'updateCurrent' to modify the current subject, 'addSubject' to create a new one, 'removeSubject' to delete the current one, or 'unknown' if not interpretable."),
  updates: z.object({
    subjectName: z.string().optional().describe("The subject name to set for the current subject, if mentioned."),
    caMark: z.number().min(1).max(60).optional().describe("The CA mark (1-60) to set for the current subject, if mentioned."),
    examMark: z.number().min(1).max(100).optional().describe("The Exam mark (1-100) to set for the current subject, if mentioned."),
  }).optional().describe("Details for updating the current subject; only present if action is 'updateCurrent'."),
});
export type InterpretSubjectCommandOutput = z.infer<typeof InterpretSubjectCommandOutputSchema>;

export async function interpretSubjectCommand(
  input: InterpretSubjectCommandInput
): Promise<InterpretSubjectCommandOutput> {
  return interpretSubjectCommandFlow(input);
}

const interpretSubjectCommandPrompt = ai.definePrompt({
  name: 'interpretSubjectCommandPrompt',
  input: {schema: InterpretSubjectCommandInputSchema},
  output: {schema: InterpretSubjectCommandOutputSchema},
  prompt: `You are an AI assistant helping a teacher input subject marks via voice for the *currently visible subject entry*.
Interpret the transcribed text to identify if the user wants to update the current subject's details, add a new subject, or remove the current subject.

Transcribed Text: '{{{transcribedText}}}'

Identify the primary intent:
1.  **updateCurrent**: If the user is providing a subject name, CA mark (Continuous Assessment, out of 60), or Exam mark (out of 100) for the current subject.
    - Extract \`subjectName\` (string) if mentioned.
    - Extract \`caMark\` (number between 1-60) if mentioned.
    - Extract \`examMark\` (number between 1-100) if mentioned.
    If multiple details are mentioned for 'updateCurrent' (e.g., "Mathematics CA 40 exam 70"), include all of them in the 'updates' object.
2.  **addSubject**: If the user explicitly says 'add subject', 'new subject', 'create subject', or similar.
3.  **removeSubject**: If the user explicitly says 'remove subject', 'delete subject', 'clear subject', or similar for the current subject.
4.  **unknown**: If the command is unclear, not related to these actions, or if extracted marks are outside valid ranges.

Output the result in the specified Zod schema format.
If the action is 'updateCurrent', provide the values to update in the 'updates' object.
If CA or Exam marks are mentioned, ensure they are numbers. Convert spoken numbers (e.g., "fifty") to digits (e.g., 50). If a mark is outside the valid range (CA 1-60, Exam 1-100), consider the command 'unknown' or omit the specific invalid mark.

Examples:
- Text: "set subject to Mathematics" -> action: "updateCurrent", updates: { subjectName: "Mathematics" }
- Text: "CA mark fifty five" -> action: "updateCurrent", updates: { caMark: 55 }
- Text: "exam 85" -> action: "updateCurrent", updates: { examMark: 85 }
- Text: "subject is Physics, CA mark is 45, exam score 72" -> action: "updateCurrent", updates: { subjectName: "Physics", caMark: 45, examMark: 72 }
- Text: "add new subject" -> action: "addSubject"
- Text: "remove this subject" -> action: "removeSubject"
- Text: "what is the weather" -> action: "unknown"
- Text: "set exam to 120" -> action: "unknown" (or action: "updateCurrent", updates: {} if only invalid mark is present and schema allows empty updates) - Prefer "unknown" if values are invalid.
`,
});

const interpretSubjectCommandFlow = ai.defineFlow(
  {
    name: 'interpretSubjectCommandFlow',
    inputSchema: InterpretSubjectCommandInputSchema,
    outputSchema: InterpretSubjectCommandOutputSchema,
  },
  async input => {
    const {output} = await interpretSubjectCommandPrompt(input);
    if (!output) {
        // Fallback or error handling if the model doesn't return the expected output.
        return { action: "unknown" };
    }
    // Additional validation if needed, e.g. ensuring marks are within range if not strictly enforced by model/schema.
    if (output.action === "updateCurrent" && output.updates) {
        if (output.updates.caMark !== undefined && (output.updates.caMark < 1 || output.updates.caMark > 60)) {
            // Invalid CA mark, treat as unknown or clear the specific mark
            delete output.updates.caMark; 
            // if no other updates, maybe set action to unknown
            if (Object.keys(output.updates).length === 0) output.action = "unknown";

        }
        if (output.updates.examMark !== undefined && (output.updates.examMark < 1 || output.updates.examMark > 100)) {
            delete output.updates.examMark;
            if (Object.keys(output.updates).length === 0 && !output.updates.subjectName) output.action = "unknown";
        }
    }
    return output;
  }
);

