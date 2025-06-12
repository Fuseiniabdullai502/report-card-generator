
import { genkit, type GenkitPlugin, type Genkit as GenkitInstance } from 'genkit'; // Updated Genkit import for type
import { googleAI } from '@genkit-ai/googleai';

let initializedAi: GenkitInstance;

try {
  // Attempt to initialize with Google AI
  const mainPlugins: GenkitPlugin[] = [googleAI()];
  initializedAi = genkit({
    plugins: mainPlugins,
    model: 'googleai/gemini-2.0-flash', // This model is from the googleAI plugin
  });
  console.log("Genkit initialized successfully with GoogleAI plugin.");
} catch (error) {
  console.error(
    'CRITICAL: Failed to initialize Genkit with GoogleAI plugin. AI features will NOT work. This is often due to missing or invalid GOOGLE_API_KEY or other Google AI credentials in the environment.',
    error
  );
  // Fallback: Initialize Genkit with no plugins.
  // This allows the server to start for non-AI parts of the app.
  // Operations requiring a model will likely fail later with clearer errors.
  try {
    initializedAi = genkit({
      plugins: [], // No plugins
      // No default model is specified here; operations will need to specify one or will fail.
    });
    console.warn("Genkit initialized with NO plugins due to a critical error with the GoogleAI plugin. All AI operations that rely on the GoogleAI plugin or a default model will likely fail.");
  } catch (fallbackError) {
    const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    console.error("CRITICAL: Failed to initialize Genkit even with a fallback (no plugins). The application's AI system is non-functional.", fallbackError);
    // If even a minimal Genkit initialization fails, rethrow to prevent server startup with a broken AI core.
    throw new Error(`Genkit core initialization failed: ${errorMessage}. AI system is down.`);
  }
}

export const ai = initializedAi;
