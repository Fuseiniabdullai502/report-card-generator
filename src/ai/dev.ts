
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-student-feedback.ts';
import '@/ai/flows/generate-performance-summary.ts'; // This will now refer to generateReportInsights
