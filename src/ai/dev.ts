
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-student-feedback.ts';
import '@/ai/flows/generate-performance-summary.ts'; // This will now refer to generateReportInsights
import '@/ai/flows/edit-image-flow.ts';
import '@/ai/flows/interpret-subject-command-flow.ts'; // Added new flow for subject commands
// import '@/ai/flows/generate-class-insights-flow.ts'; // Removed
