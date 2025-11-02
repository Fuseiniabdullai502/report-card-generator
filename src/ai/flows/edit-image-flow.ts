
'use server';
/**
 * @fileOverview An AI flow for editing images.
 *
 * - editImage - A function that takes an image and a prompt and returns an edited image.
 * - EditImageInput - The input type for the editImage function.
 * - EditImageOutput - The return type for the editImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EditImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "The image to edit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('The instructions for how to edit the image.'),
});
export type EditImageInput = z.infer<typeof EditImageInputSchema>;

const EditImageOutputSchema = z.object({
  editedPhotoDataUri: z.string().describe('The edited image as a data URI.'),
});
export type EditImageOutput = z.infer<typeof EditImageOutputSchema>;

export async function editImage(input: EditImageInput): Promise<EditImageOutput> {
  return editImageFlow(input);
}

const editImageFlow = ai.defineFlow(
  {
    name: 'editImageFlow',
    inputSchema: EditImageInputSchema,
    outputSchema: EditImageOutputSchema,
  },
  async (input: EditImageInput) => {
    const { photoDataUri, prompt } = input;

    const { media } = await ai.generate({
      model: 'gemini-2.5-flash-image-preview',
      prompt: [
        { media: { url: photoDataUri } },
        { text: prompt },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url) {
      throw new Error('AI did not return an edited image.');
    }

    return { editedPhotoDataUri: media.url };
  }
);
