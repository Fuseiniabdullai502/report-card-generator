'use server';

import { generateStudentFeedback, type GenerateStudentFeedbackInput } from '@/ai/flows/generate-student-feedback';
import { 
  generateReportInsights, 
  type GenerateReportInsightsInput, 
  type GenerateReportInsightsOutput
} from '@/ai/flows/generate-performance-summary'; 
import { editImage, type EditImageInput, type EditImageOutput } from '@/ai/flows/edit-image-flow';
import { 
  generateClassInsights, 
  type GenerateClassInsightsInput, 
  type GenerateClassInsightsOutput 
} from '@/ai/flows/generate-class-insights-flow';
import {
  generateSchoolInsights,
  type GenerateSchoolInsightsInput,
  type GenerateSchoolInsightsOutput,
} from '@/ai/flows/generate-school-insights-flow';
import { z } from 'zod';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';


// Schema for student feedback generation
const StudentFeedbackActionInputSchema = z.object({
  studentName: z.string(),
  className: z.string(),
  performanceSummary: z.string(),
  areasForImprovement: z.string(),
  strengths: z.string(),
});

export async function getAiFeedbackAction(
  input: GenerateStudentFeedbackInput
): Promise<{ success: boolean; feedback?: string; error?: string }> {
  try {
    const validatedInput = StudentFeedbackActionInputSchema.parse(input);
    const result = await generateStudentFeedback(validatedInput);
    return { success: true, feedback: result.feedback };
  } catch (error) {
    console.error("Error generating AI feedback:", error);
    let errorMessage = "Failed to generate AI feedback. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI feedback: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// Schema for subject entries in actions
const ActionFlowSubjectEntrySchema = z.object({
  subjectName: z.string(),
  continuousAssessment: z.number().nullable().optional(),
  examinationMark: z.number().nullable().optional(),
});

// Schema for previous term performance data in actions
const ActionPreviousTermPerformanceSchema = z.object({
  termName: z.string(),
  subjects: z.array(ActionFlowSubjectEntrySchema),
  overallAverage: z.number().nullable().optional(),
});

// Schema for AI Report Insights generation in actions
const ActionGenerateReportInsightsInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  className: z.string().describe('The name of the class.'),
  currentAcademicTerm: z.string().describe('The academic term for the report.'),
  daysAttended: z.number().nullable().optional().describe('Number of days the student attended school.'),
  totalSchoolDays: z.number().nullable().optional().describe('Total number of school days in the term.'),
  subjects: z.array(ActionFlowSubjectEntrySchema).describe('An array of subjects with their marks for the current term. CA is out of 60, Exam is out of 100.'),
  previousTermsData: z.array(ActionPreviousTermPerformanceSchema).optional().describe("Performance data from previous terms for comparison."),
});


export async function getAiReportInsightsAction(
  input: GenerateReportInsightsInput 
): Promise<{ success: boolean; insights?: GenerateReportInsightsOutput; error?: string }> {
  try {
    const validatedInput = ActionGenerateReportInsightsInputSchema.parse(input);
    const result = await generateReportInsights(validatedInput);
    return { success: true, insights: result };
  } catch (error) {
    console.error("Error generating AI report insights:", error);
    let errorMessage = "Failed to generate AI insights. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI insights: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message; 
    }
    return { success: false, error: errorMessage };
  }
}

const EditImageActionInputSchema = z.object({
    photoDataUri: z.string().min(1, "Image data URI is required."),
    prompt: z.string().min(1, "Edit prompt is required."),
});

export async function editImageWithAiAction(
    input: EditImageInput
): Promise<{ success: boolean; editedPhotoDataUri?: string; error?: string }> {
    try {
        const validatedInput = EditImageActionInputSchema.parse(input);
        const result = await editImage(validatedInput);
        return { success: true, editedPhotoDataUri: result.editedPhotoDataUri };
    } catch (error) {
        console.error("Error editing image with AI:", error);
        let errorMessage = "Failed to edit image with AI. Please try again.";
        if (error instanceof z.ZodError) {
            errorMessage = "Invalid input for AI image editing: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        return { success: false, error: errorMessage };
    }
}

// Schema for AI Class Insights
const ActionSubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  numBelowAverage: z.number(),
  numAverage: z.number(),
  numAboveAverage: z.number(),
  classAverageForSubject: z.number().nullable(),
});

const ActionGenderPerformanceStatSchema = z.object({
  gender: z.string(),
  count: z.number(),
  averageScore: z.number().nullable(),
});

const GenerateClassInsightsActionInputSchema = z.object({
  className: z.string(),
  academicTerm: z.string(),
  overallClassAverage: z.number().nullable(),
  totalStudents: z.number(),
  subjectStats: z.array(ActionSubjectPerformanceStatSchema),
  genderStats: z.array(ActionGenderPerformanceStatSchema),
});


export async function getAiClassInsightsAction(
  input: GenerateClassInsightsInput
): Promise<{ success: boolean; insights?: GenerateClassInsightsOutput; error?: string }> {
  try {
    const validatedInput = GenerateClassInsightsActionInputSchema.parse(input);
    const result = await generateClassInsights(validatedInput);
    return { success: true, insights: result };
  } catch (error) {
    console.error("Error generating AI class insights:", error);
    let errorMessage = "Failed to generate AI class insights. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI class insights: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// Schemas for AI School Insights
const ActionSchoolSubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  numBelowAverage: z.number(),
  numAverage: z.number(),
  numAboveAverage: z.number(),
  schoolAverageForSubject: z.number().nullable(),
});

const ActionSchoolGenderPerformanceStatSchema = z.object({
  gender: z.string(),
  count: z.number(),
  averageScore: z.number().nullable(),
});

const ActionClassSummarySchema = z.object({
  className: z.string(),
  classAverage: z.number().nullable(),
  numberOfStudents: z.number(),
});

const GenerateSchoolInsightsActionInputSchema = z.object({
  schoolName: z.string(),
  academicTerm: z.string(),
  overallSchoolAverage: z.number().nullable(),
  totalStudentsInSchool: z.number(),
  numberOfClassesRepresented: z.number(),
  classSummaries: z.array(ActionClassSummarySchema),
  overallSubjectStatsForSchool: z.array(ActionSchoolSubjectPerformanceStatSchema),
  overallGenderStatsForSchool: z.array(ActionSchoolGenderPerformanceStatSchema),
});

export async function getAiSchoolInsightsAction(
  input: GenerateSchoolInsightsInput
): Promise<{ success: boolean; insights?: GenerateSchoolInsightsOutput; error?: string }> {
  try {
    const validatedInput = GenerateSchoolInsightsActionInputSchema.parse(input);
    const result = await generateSchoolInsights(validatedInput);
    return { success: true, insights: result };
  } catch (error) {
    console.error("Error generating AI school insights:", error);
    let errorMessage = "Failed to generate AI school insights. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI school insights: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// New single action for user registration
export async function registerUserAction(data: {
  email: string;
  password: string;
}): Promise<{ success: boolean; message: string }> {
  const { email, password } = data;
  const trimmedEmail = email.trim().toLowerCase();

  try {
    const isAdminRegistering =
      trimmedEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();

    // For non-admins, check for a pending invite first.
    if (!isAdminRegistering) {
      const invitesRef = collection(db, 'invites');
      const inviteQuery = query(
        invitesRef,
        where('email', '==', trimmedEmail),
        where('status', '==', 'pending')
      );
      const inviteSnapshot = await getDocs(inviteQuery);

      if (inviteSnapshot.empty) {
        return {
          success: false,
          message: 'Registration failed. You must be invited by an administrator.',
        };
      }
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );
    const newUser = userCredential.user;
    const role = isAdminRegistering ? 'admin' : 'user';

    // Create user document in Firestore
    await setDoc(doc(db, 'users', newUser.uid), {
      email: trimmedEmail,
      role: role,
      createdAt: serverTimestamp(),
    });

    // If it was a regular user, update their invite to 'completed'
    if (!isAdminRegistering) {
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('email', '==', trimmedEmail), where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const inviteDoc = querySnapshot.docs[0];
            await setDoc(doc(db, 'invites', inviteDoc.id), { status: 'completed', completedAt: serverTimestamp() }, { merge: true });
        }
    }

    return { success: true, message: 'Registration successful!' };

  } catch (error: any) {
    console.error('Registration Error:', error);

    let errorMessage = 'An unexpected error occurred during registration.';
    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already in use. Please log in or use a different email.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. It must be at least 6 characters.';
          break;
        case 'failed-precondition':
             errorMessage = 'This is likely due to a missing Firestore index. Please check your browser\'s developer console for a link to create the required index for the "invites" collection on the "email" and "status" fields.';
             break;
        default:
          errorMessage = error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, message: errorMessage };
  }
}

// Action for deleting an invite
const DeleteInviteActionInputSchema = z.object({
  inviteId: z.string().min(1, 'Invite ID is required.'),
});

export async function deleteInviteAction(
  data: { inviteId: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const { inviteId } = DeleteInviteActionInputSchema.parse(data);
    
    await deleteDoc(doc(db, 'invites', inviteId));
    
    return { success: true, message: 'Invite successfully deleted.' };
  } catch (error: any) {
    console.error('Error deleting invite:', error);
    let errorMessage = 'An unexpected error occurred while deleting the invite.';
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for deleting invite: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage };
  }
}
