
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-student-feedback.ts';
import '@/ai/flows/generate-performance-summary.ts';
import '@/ai/flows/edit-image-flow.ts';
import '@/ai/flows/generate-class-insights-flow.ts';
import '@/ai/flows/generate-school-insights-flow.ts';
import '@/ai/flows/generate-bulk-student-feedback-flow.ts'; // Added new flow
