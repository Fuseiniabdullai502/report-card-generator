
import { genkit, type Plugin as GenkitPlugin, type Genkit as GenkitInstance } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

let aiInstance: GenkitInstance;

try {
  // Attempt to initialize with Google AI
  const mainPlugins: GenkitPlugin[] = [googleAI()];
  aiInstance = genkit({
    plugins: mainPlugins,
  });
  console.log("Genkit initialized successfully with GoogleAI plugin as 'ai'.");
} catch (error) {
  console.error(
    'CRITICAL: Failed to initialize Genkit with GoogleAI plugin. AI features will NOT work. This is often due to a missing or invalid GOOGLE_API_KEY in the environment.',
    error
  );
  // Create a proxy object that throws a clear error when any method is called.
  const errorMessage =
    'AI features are disabled. The Genkit GoogleAI plugin failed to initialize, which is commonly caused by a missing or invalid GOOGLE_API_KEY environment variable. Please check your setup and server logs.';

  aiInstance = new Proxy({}, {
    get(target, prop, receiver) {
      // For any property access on the 'ai' object, throw a clear error.
      // This ensures that server actions will fail with a meaningful message.
      throw new Error(errorMessage);
    }
  }) as GenkitInstance;

  console.warn("Genkit has been set to a 'faulty' state. Any calls to AI functions will throw an explicit error.");
}

export const ai = aiInstance;
