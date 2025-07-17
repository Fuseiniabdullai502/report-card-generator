import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import type { GenkitConfig } from 'genkit'; // Use this or your own type

let aiInstance: any;

try {
  const mainPlugins = [googleAI()];

  aiInstance = genkit({
    plugins: mainPlugins,
  });

  console.log("Genkit initialized successfully with GoogleAI plugin as 'ai'.");

} catch (error) {
  console.error(
    'CRITICAL: Failed to initialize Genkit with GoogleAI plugin. AI features will NOT work. This is often due to a missing or invalid GOOGLE_API_KEY in the environment.',
    error
  );

  const errorMessage =
    'AI features are disabled. The Genkit GoogleAI plugin failed to initialize, which is commonly caused by a missing or invalid GOOGLE_API_KEY environment variable. Please check your setup and server logs.';

  aiInstance = new Proxy({}, {
    get() {
      throw new Error(errorMessage);
    }
  });

  console.warn("Genkit has been set to a 'faulty' state. Any calls to AI functions will throw an explicit error.");
}

export const ai = aiInstance;
