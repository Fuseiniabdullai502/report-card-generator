
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
import admin from '@/lib/firebase-admin';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import type { CustomUser } from '@/components/auth-provider';
import { calculateOverallAverage, calculateSubjectFinalMark } from '@/lib/calculations';
import { type ReportData } from '@/lib/schemas';
import { auth, db } from '@/lib/firebase';


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

// Updated registerUserAction: now reads role and scope from the invite
export async function registerUserAction(data: {
  email: string;
  password: string;
  name: string;
  telephone: string;
}): Promise<{ success: boolean; message: string }> {
  const { email, password, name, telephone } = data;
  const trimmedEmail = email.trim().toLowerCase();

  try {
    const isSuperAdminRegistering =
      trimmedEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();

    let role: CustomUser['role'] = 'user';
    let userScopeData: any = {
      region: null,
      district: null,
      circuit: null,
      schoolName: null,
      classNames: null,
    };
    let inviteDocId: string | null = null;

    if (!isSuperAdminRegistering) {
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
      
      const inviteDoc = inviteSnapshot.docs[0];
      inviteDocId = inviteDoc.id;
      const inviteData = inviteDoc.data();
      
      // Prevent registration if role is not assigned
      if (!inviteData.role) {
          return {
              success: false,
              message: 'Your invitation is pending role assignment. Please contact an administrator.',
          };
      }

      role = inviteData.role;
      userScopeData = {
        region: inviteData.region ?? null,
        district: inviteData.district ?? null,
        circuit: inviteData.circuit ?? null,
        schoolName: inviteData.schoolName ?? null,
        classNames: inviteData.classNames ?? null,
      };

    } else {
      role = 'super-admin';
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );
    const newUser = userCredential.user;

    // Create user document in Firestore with role and scope from the invite
    await setDoc(doc(db, 'users', newUser.uid), {
      email: trimmedEmail,
      name: name,
      telephone: telephone,
      role: role,
      status: 'active',
      ...userScopeData,
      createdAt: serverTimestamp(),
    });

    // If it was a regular user, update their invite to 'completed' using ADMIN SDK
    if (inviteDocId) {
      const inviteDocRef = admin.firestore().collection('invites').doc(inviteDocId);
      await inviteDocRef.update({ 
          status: 'completed', 
          completedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    }

    return { success: true, message: 'Registration successful! You will now be redirected to the dashboard.' };

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
             errorMessage = 'A database index is needed to find your invite. Please ask an administrator to check the browser\'s developer console for a link to create the required index for the "invites" collection on the "email" and "status" fields. This is a one-time setup.';
             break;
        case 'permission-denied':
            errorMessage = `A permission error occurred. This can happen if security rules are too restrictive or if an operation needs to be moved to a secure backend function. Error: ${error.message}`;
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


// Action for creating a detailed invite with optional role
const CreateInviteActionInputSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['big-admin', 'admin', 'user']).optional(),
  region: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  circuit: z.string().optional().nullable(),
  schoolName: z.string().optional().nullable(),
  classNames: z.array(z.string()).optional().nullable(),
});


export async function createInviteAction(
  data: z.infer<typeof CreateInviteActionInputSchema>,
  currentUser: CustomUser
): Promise<{ success: boolean; message: string }> {
  try {
    // Guard clause for extra safety
    if (!currentUser.role || !['super-admin', 'big-admin', 'admin'].includes(currentUser.role)) {
        throw new Error('You do not have permission to invite users.');
    }
    const validatedData = CreateInviteActionInputSchema.parse(data);
    const { email, role, ...scopesFromClient } = validatedData;
    const normalizedEmail = email.trim().toLowerCase();

    // No need for this check since role can never be 'super-admin'
    // Permission checks for who can invite whom
    if (role) {
      if (currentUser.role === 'big-admin' && role === 'big-admin') {
        throw new Error("A 'big-admin' cannot invite another 'big-admin'.");
      }
      if (currentUser.role === 'admin' && role !== 'user') {
        throw new Error("An 'admin' can only invite users with the 'user' role.");
      }
    }
    
    // Check if user already exists in Firebase Auth
    try {
        await admin.auth().getUserByEmail(normalizedEmail);
        // If the above line does not throw, the user exists.
        return { success: false, message: `A user with the email ${normalizedEmail} is already registered.` };
    } catch (error: any) {
        // We expect 'auth/user-not-found'. If it's anything else, it's an actual error.
        if (error.code !== 'auth/user-not-found') {
            console.error("Error checking for existing user in Auth:", error);
            throw new Error('An unexpected error occurred while checking for an existing user.');
        }
        // If user is not found, we can proceed.
    }

    // Check for existing pending invite in Firestore using ADMIN SDK
    const invitesRef = admin.firestore().collection('invites');
    const inviteQuery = invitesRef
      .where('email', '==', normalizedEmail)
      .where('status', '==', 'pending');
    const inviteSnapshot = await inviteQuery.get();
    
    if (!inviteSnapshot.empty) {
      return { success: false, message: `A pending invite for ${normalizedEmail} already exists.` };
    }
    
    // SERVER-SIDE SCOPE ENFORCEMENT
    let finalScope: any = {};
    if (role) { 
        if (currentUser.role === 'super-admin') {
            if (role === 'big-admin') {
                finalScope = { region: scopesFromClient.region || null, district: scopesFromClient.district || null, circuit: null, schoolName: null, classNames: null };
            } else if (role === 'admin') {
                finalScope = { region: scopesFromClient.region || null, district: scopesFromClient.district || null, circuit: scopesFromClient.circuit || null, schoolName: scopesFromClient.schoolName || null, classNames: null };
            } else { // user
                finalScope = { region: scopesFromClient.region || null, district: scopesFromClient.district || null, circuit: scopesFromClient.circuit || null, schoolName: scopesFromClient.schoolName || null, classNames: scopesFromClient.classNames || null };
            }
        } else if (currentUser.role === 'big-admin') {
            if (!currentUser.region || !currentUser.district) throw new Error("Your account ('big-admin') is not configured with a region and district.");
            finalScope = {
                region: currentUser.region,
                district: currentUser.district,
                circuit: (role === 'admin' || role === 'user') ? (scopesFromClient.circuit || null) : null,
                schoolName: (role === 'admin' || role === 'user') ? (scopesFromClient.schoolName || null) : null,
                classNames: role === 'user' ? (scopesFromClient.classNames || null) : null,
            };
        } else if (currentUser.role === 'admin') {
            if (!currentUser.schoolName) throw new Error("Your account ('admin') is not configured with a school name.");
            finalScope = {
                region: currentUser.region,
                district: currentUser.district,
                circuit: currentUser.circuit,
                schoolName: currentUser.schoolName,
                classNames: role === 'user' ? (scopesFromClient.classNames || null) : null,
            };
        }
    }

    // Create invite using ADMIN SDK
    await invitesRef.add({
      email: normalizedEmail,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      role: role || null,
      ...finalScope,
    });

    return { success: true, message: `User with email ${normalizedEmail} has been invited${role ? ` as a '${role}'` : ''}. They can now register once a role is assigned.` };

  } catch (error: any) {
    console.error('Error in createInviteAction:', error);
    let errorMessage = 'An unexpected error occurred during authorization.';
    if (error.message && error.message.toLowerCase().includes('firebase admin sdk') && error.message.toLowerCase().includes('initialize')) {
        errorMessage = `SERVER CONFIGURATION ERROR: The Firebase Admin SDK failed to initialize. See README.md for instructions.`;
    }
    else if (error.code === 'failed-precondition' && error.message && error.message.includes('index')) {
        errorMessage = `A database index is needed. Please check the browser's developer console for a link to create it.`;
    } 
    else if (error instanceof z.ZodError) {
      errorMessage = "Invalid input: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } 
    else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage };
  }
}

// Action for updating a pending invite's role and scope
const UpdateInviteActionSchema = z.object({
  inviteId: z.string().min(1, "Invite ID is required"),
  role: z.enum(['big-admin', 'admin', 'user']),
  region: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  circuit: z.string().optional().nullable(),
  schoolName: z.string().optional().nullable(),
  classNames: z.array(z.string()).optional().nullable(),
});

export async function updateInviteAction(
  data: z.infer<typeof UpdateInviteActionSchema>,
  currentUser: CustomUser
): Promise<{ success: boolean; message: string }> {
  try {
    if (!currentUser.role || !['super-admin', 'big-admin', 'admin'].includes(currentUser.role)) {
      throw new Error("You do not have permission to perform this action.");
    }
    
    const validatedData = UpdateInviteActionSchema.parse(data);
    const { inviteId, role, ...scopes } = validatedData;
    
    if (currentUser.role === 'big-admin' && (role === 'big-admin')) { throw new Error("A 'big-admin' cannot assign 'big-admin' roles."); }
    if (currentUser.role === 'admin' && role !== 'user') { throw new Error("An 'admin' can only assign the 'user' role."); }
    
    const inviteDocRef = admin.firestore().collection('invites').doc(inviteId);
    
    const updateData: any = { role };
    // Scope enforcement logic (same as create/update user actions)
    if (currentUser.role === 'super-admin') {
      if (role === 'big-admin') { updateData.region = scopes.region; updateData.district = scopes.district; updateData.schoolName = null; updateData.circuit = null; updateData.classNames = null; }
      else if (role === 'admin') { updateData.region = scopes.region; updateData.district = scopes.district; updateData.circuit = scopes.circuit; updateData.schoolName = scopes.schoolName; updateData.classNames = null; }
      else { updateData.region = scopes.region; updateData.district = scopes.district; updateData.circuit = scopes.circuit; updateData.schoolName = scopes.schoolName; updateData.classNames = scopes.classNames; }
    } else if (currentUser.role === 'big-admin') {
      if (!currentUser.region || !currentUser.district) throw new Error("Current user ('big-admin') has an incomplete scope.");
      updateData.region = currentUser.region; updateData.district = currentUser.district;
      updateData.schoolName = (role === 'admin' || role === 'user') ? scopes.schoolName : null;
      updateData.circuit = (role === 'admin' || role === 'user') ? scopes.circuit : null;
      updateData.classNames = role === 'user' ? scopes.classNames : null;
    } else if (currentUser.role === 'admin') {
      if (!currentUser.schoolName) throw new Error("Current user ('admin') has an incomplete scope.");
      updateData.region = currentUser.region; updateData.district = currentUser.district; updateData.circuit = currentUser.circuit; updateData.schoolName = currentUser.schoolName;
      updateData.classNames = role === 'user' ? scopes.classNames : null;
    }
    
    await inviteDocRef.update(updateData);
    
    return { success: true, message: "Invite details updated successfully." };
  } catch (error: any) {
    console.error('Error updating invite:', error);
    let errorMessage = 'An unexpected error occurred while updating the invite.';
    if (error instanceof z.ZodError) { errorMessage = "Invalid input for updating invite: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', '); } 
    else if (error.message) { errorMessage = error.message; }
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
    
    await admin.firestore().collection('invites').doc(inviteId).delete();
    
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

// Action for deleting a user (super-admin only)
const DeleteUserActionInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required.'),
});

export async function deleteUserAction(
  data: { userId: string },
  currentUser: CustomUser
): Promise<{ success: boolean; message: string }> {
  if (currentUser.role !== 'super-admin') {
      throw new Error("You do not have permission to perform this action.");
  }
  try {
    const { userId } = DeleteUserActionInputSchema.parse(data);

    // Delete from Firestore first
    await admin.firestore().collection('users').doc(userId).delete();

    // Then delete from Firebase Auth
    await admin.auth().deleteUser(userId);

    return { success: true, message: 'User successfully deleted.' };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    let errorMessage = 'An unexpected error occurred while deleting the user.';
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for deleting user: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage };
  }
}


// Action for updating user status
const UpdateUserStatusActionInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required.'),
  status: z.enum(['active', 'inactive']),
});

export async function updateUserStatusAction(
  data: { userId: string; status: 'active' | 'inactive' }
): Promise<{ success: boolean; message: string }> {
  try {
    const { userId, status } = UpdateUserStatusActionInputSchema.parse(data);
    
    const userDocRef = admin.firestore().collection('users').doc(userId);
    await userDocRef.update({ status });
    
    return { success: true, message: `User status updated to ${status}.` };
  } catch (error: any) {
    console.error('Error updating user status:', error);
    let errorMessage = 'An unexpected error occurred.';
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage };
  }
}


// Action for updating a user's role and scope
const UpdateUserRoleAndScopeActionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(['big-admin', 'admin', 'user']),
  region: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  circuit: z.string().optional().nullable(),
  schoolName: z.string().optional().nullable(),
  classNames: z.array(z.string()).optional().nullable(),
});

export async function updateUserRoleAndScopeAction(
  data: z.infer<typeof UpdateUserRoleAndScopeActionSchema>,
  currentUser: CustomUser
): Promise<{ success: boolean; message: string }> {
  try {
    if (!currentUser.role || !['super-admin', 'big-admin', 'admin'].includes(currentUser.role)) {
      throw new Error("You do not have permission to perform this action.");
    }
    
    const validatedData = UpdateUserRoleAndScopeActionSchema.parse(data);
    const { userId, role, ...scopes } = validatedData;
    
    // Permission checks
    if (currentUser.role === 'big-admin' && (role === 'big-admin')) {
      throw new Error("A 'big-admin' cannot assign 'big-admin' or 'super-admin' roles.");
    }
    if (currentUser.role === 'admin' && role !== 'user') {
      throw new Error("An 'admin' can only assign the 'user' role.");
    }
    
    const userDocRef = admin.firestore().collection('users').doc(userId);
    
    // SERVER-SIDE SCOPE ENFORCEMENT
    const updateData: any = { role };

    if (currentUser.role === 'big-admin') {
      if (!currentUser.region || !currentUser.district) throw new Error("Current user ('big-admin') has an incomplete scope.");
      updateData.region = currentUser.region;
      updateData.district = currentUser.district;
      updateData.schoolName = (role === 'admin' || role === 'user') ? scopes.schoolName : null;
      updateData.circuit = (role === 'admin' || role === 'user') ? scopes.circuit : null;
      updateData.classNames = role === 'user' ? scopes.classNames : null;

    } else if (currentUser.role === 'admin') {
      if (!currentUser.schoolName) throw new Error("Current user ('admin') has an incomplete scope.");
      updateData.region = currentUser.region;
      updateData.district = currentUser.district;
      updateData.circuit = currentUser.circuit;
      updateData.schoolName = currentUser.schoolName;
      updateData.classNames = role === 'user' ? scopes.classNames : null;

    } else { // super-admin
      if (role === 'big-admin') {
        if (!scopes.region?.trim()) throw new Error("A region must be specified for a 'big-admin'.");
        if (!scopes.district?.trim()) throw new Error("A district must be specified for a 'big-admin'.");
        updateData.region = scopes.region;
        updateData.district = scopes.district;
        updateData.schoolName = null;
        updateData.circuit = null;
        updateData.classNames = null;
      } else if (role === 'admin') {
        if (!scopes.schoolName?.trim()) throw new Error("A school name must be specified for an 'admin'.");
        updateData.region = scopes.region;
        updateData.district = scopes.district;
        updateData.circuit = scopes.circuit;
        updateData.schoolName = scopes.schoolName;
        updateData.classNames = null;
      } else { // 'user' role
        updateData.region = scopes.region;
        updateData.district = scopes.district;
        updateData.circuit = scopes.circuit;
        updateData.schoolName = scopes.schoolName;
        updateData.classNames = scopes.classNames;
      }
    }
    
    await userDocRef.update(updateData);
    
    return { success: true, message: "User role and scope updated successfully." };
  } catch (error: any) {
    console.error('Error updating user role:', error);
    let errorMessage = 'An unexpected error occurred while updating the user role.';
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for updating role: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage };
  }
}


// Define types for server-side data fetching
interface UserForAdmin {
  id: string;
  email: string;
  name: string;
  telephone: string;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user';
  status: 'active' | 'inactive';
  region?: string | null;
  district?: string | null;
  circuit?: string | null;
  schoolName?: string | null;
  classNames?: string[] | null;
  createdAt: string | null;
}

interface InviteForAdmin {
  id: string;
  email: string;
  status: 'pending' | 'completed';
  role?: 'big-admin' | 'admin' | 'user' | null; // role is now optional
  region?: string | null;
  district?: string | null;
  circuit?: string | null;
  schoolName?: string | null;
  classNames?: string[] | null;
  createdAt: string | null;
}


export async function getUsersAction(currentUser: CustomUser): Promise<{ success: boolean; users?: UserForAdmin[]; error?: string }> {
  try {
    if (!currentUser.role || !['super-admin', 'big-admin', 'admin'].includes(currentUser.role)) {
      throw new Error("You do not have permission to view this data.");
    }

    let usersQuery: Query = admin.firestore().collection('users');

    if (currentUser.role === 'big-admin') {
      if (!currentUser.district) throw new Error("Big-admin scope error: district not defined for your account.");
      usersQuery = usersQuery.where('district', '==', currentUser.district);
    } else if (currentUser.role === 'admin') {
      if (!currentUser.schoolName) throw new Error("Admin scope error: schoolName not defined for your account.");
      usersQuery = usersQuery.where('schoolName', '==', currentUser.schoolName);
    }

    const usersSnapshot = await usersQuery.get();

    const users = usersSnapshot.docs
      .filter((doc: DocumentData) => {
        const data = doc.data();
        if (doc.id === currentUser.uid) return false;
        if (currentUser.role === 'big-admin') return ['admin', 'user'].includes(data.role);
        if (currentUser.role === 'admin') return data.role === 'user';
        return true;
      })
      .map((doc: DocumentData) => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email,
          name: data.name,
          telephone: data.telephone,
          role: data.role,
          status: data.status,
          region: data.region,
          district: data.district,
          circuit: data.circuit,
          schoolName: data.schoolName,
          classNames: data.classNames,
          createdAt: data.createdAt?.toDate().toISOString() ?? null,
        };
      })
      .sort((a: UserForAdmin, b: UserForAdmin) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
      });
      
    return { success: true, users: users as UserForAdmin[] };
  } catch (error: any) {
    console.error('Error fetching users via server action:', error);
    return { success: false, error: error.message };
  }
}


export async function getInvitesAction(currentUser: CustomUser): Promise<{ success: boolean; invites?: InviteForAdmin[]; error?: string }> {
   if (!currentUser.role || !['super-admin', 'big-admin', 'admin'].includes(currentUser.role)) {
      throw new Error("You do not have permission to view this data.");
    }

  try {
    const invitesSnapshot = await admin.firestore().collection('invites').get();
    const invites = invitesSnapshot.docs.map((doc: DocumentData) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        status: data.status,
        role: data.role,
        region: data.region,
        district: data.district,
        circuit: data.circuit,
        schoolName: data.schoolName,
        classNames: data.classNames,
        createdAt: data.createdAt?.toDate().toISOString() ?? null,
      };
    })
    .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });

    return { success: true, invites: invites as InviteForAdmin[] };
  } catch (error: any) {
    console.error('Error fetching invites via server action:', error);
    return { success: false, error: error.message };
  }
}


export async function getReportsForAdminAction(user: CustomUser): Promise<{ success: boolean; reports?: ReportData[], error?: string }> {
  try {
    if (!user || !user.role || !['super-admin', 'big-admin'].includes(user.role)) {
      throw new Error("You do not have permission to view this data.");
    }

    const reportsCollectionRef = admin.firestore().collection('reports');
    let q: Query;

    if (user.role === 'super-admin') {
      q = reportsCollectionRef;
    } else if (user.role === 'big-admin' && user.district) {
      q = reportsCollectionRef.where('district', '==', user.district);
    } else {
      // Should not happen if the initial check passes, but good for safety
      return { success: true, reports: [] };
    }
    
    const snapshot = await q.get();
    const fetchedReports = snapshot.docs.map((doc: DocumentData) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        // Convert Firestore Timestamps to serializable strings or Dates
        createdAt: data.createdAt?.toDate() || null, 
        updatedAt: data.updatedAt?.toDate() || null,
      } as ReportData;
    });

    return { success: true, reports: fetchedReports };
  } catch (error: any) {
    console.error("Error fetching reports for admin:", error);
    return { success: false, error: error.message };
  }
}


// Action for fetching district-level statistics
export async function getDistrictStatsAction(district: string): Promise<{
  success: boolean;
  stats?: {
    schoolCount: number;
    maleCount: number;
    femaleCount: number;
    totalStudents: number;
  };
  error?: string;
}> {
  try {
    if (!district) {
      throw new Error("District is required to fetch stats.");
    }
    
    const reportsRef = admin.firestore().collection('reports');
    const reportsQuery = reportsRef.where('district', '==', district);
    const reportsSnapshot = await reportsQuery.get();
    
    if (reportsSnapshot.empty) {
        return { success: true, stats: { schoolCount: 0, maleCount: 0, femaleCount: 0, totalStudents: 0 } };
    }

    const schoolNames = new Set<string>();
    let maleCount = 0;
    let femaleCount = 0;
    
    reportsSnapshot.forEach((doc: DocumentData) => {
      const data = doc.data();
      if (data.schoolName) {
        schoolNames.add(data.schoolName);
      }
      if (data.gender === 'Male') {
        maleCount++;
      } else if (data.gender === 'Female') {
        femaleCount++;
      }
    });
    
    const stats = {
      schoolCount: schoolNames.size,
      maleCount,
      femaleCount,
      totalStudents: reportsSnapshot.size,
    };
    
    return { success: true, stats };

  } catch (error: any) {
    console.error('Error fetching district stats:', error);
    // Provide a more user-friendly error
    let errorMessage = "An unexpected error occurred while fetching district statistics.";
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        errorMessage = `A database index is needed to query reports by 'district'. Please check the browser's developer console for a link to create it. This is a one-time setup.`;
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}


// Action for fetching school-level statistics
export async function getSchoolStatsAction(schoolName: string): Promise<{
  success: boolean;
  stats?: {
    classCount: number;
    maleCount: number;
    femaleCount: number;
    totalStudents: number;
  };
  error?: string;
}> {
  try {
    if (!schoolName) {
      throw new Error("School name is required to fetch stats.");
    }
    
    const reportsRef = admin.firestore().collection('reports');
    const reportsQuery = reportsRef.where('schoolName', '==', schoolName);
    const reportsSnapshot = await reportsQuery.get();
    
    if (reportsSnapshot.empty) {
        return { success: true, stats: { classCount: 0, maleCount: 0, femaleCount: 0, totalStudents: 0 } };
    }

    const classNames = new Set<string>();
    let maleCount = 0;
    let femaleCount = 0;
    
    reportsSnapshot.forEach((doc: DocumentData) => {
      const data = doc.data();
      if (data.className) {
        classNames.add(data.className);
      }
      if (data.gender === 'Male') {
        maleCount++;
      } else if (data.gender === 'Female') {
        femaleCount++;
      }
    });
    
    const stats = {
      classCount: classNames.size,
      maleCount,
      femaleCount,
      totalStudents: reportsSnapshot.size,
    };
    
    return { success: true, stats };

  } catch (error: any) {
    console.error('Error fetching school stats:', error);
    let errorMessage = "An unexpected error occurred while fetching school statistics.";
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        errorMessage = `A database index is needed to query reports by 'schoolName'. Please check the browser's developer console for a link to create it. This is a one-time setup.`;
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// Action for fetching system-wide statistics (super-admin only)
export async function getSystemWideStatsAction(): Promise<{
  success: boolean;
  stats?: {
    schoolCount: number;
    maleCount: number;
    femaleCount: number;
    totalStudents: number;
  };
  error?: string;
}> {
  try {
    const reportsRef = admin.firestore().collection('reports');
    const reportsSnapshot = await reportsRef.get();
    
    if (reportsSnapshot.empty) {
        return { success: true, stats: { schoolCount: 0, maleCount: 0, femaleCount: 0, totalStudents: 0 } };
    }

    const schoolNames = new Set<string>();
    let maleCount = 0;
    let femaleCount = 0;
    
    reportsSnapshot.forEach((doc: DocumentData) => {
      const data = doc.data();
      if (data.schoolName) {
        schoolNames.add(data.schoolName);
      }
      if (data.gender === 'Male') {
        maleCount++;
      } else if (data.gender === 'Female') {
        femaleCount++;
      }
    });
    
    const stats = {
      schoolCount: schoolNames.size,
      maleCount,
      femaleCount,
      totalStudents: reportsSnapshot.size,
    };
    
    return { success: true, stats };

  } catch (error: any) {
    console.error('Error fetching system-wide stats:', error);
    let errorMessage = "An unexpected error occurred while fetching system-wide statistics.";
    if (error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export interface SchoolRankingData {
  schoolName: string;
  studentCount: number;
  average: number;
  rank: string;
}

const DistrictClassRankingInputSchema = z.object({
  district: z.string().min(1, "District is required."),
  className: z.string().min(1, "Class name is required."),
  subjectName: z.string().optional().nullable(),
});

// Action for fetching district-class-level ranking
export async function getDistrictClassRankingAction(input: { district: string; className: string; subjectName?: string | null; }): Promise<{
  success: boolean;
  ranking?: SchoolRankingData[];
  error?: string;
}> {
  try {
    const { district, className, subjectName } = DistrictClassRankingInputSchema.parse(input);
    
    const reportsRef = admin.firestore().collection('reports');
    const reportsQuery = reportsRef
      .where('district', '==', district)
      .where('className', '==', className);
    
    const reportsSnapshot = await reportsQuery.get();
    
    if (reportsSnapshot.empty) {
        return { success: true, ranking: [] };
    }

    const reportsBySchool = new Map<string, any[]>();
    reportsSnapshot.forEach((doc: DocumentData) => {
      const data = doc.data();
      const schoolName = data.schoolName?.trim();
      if (schoolName) {
        if (!reportsBySchool.has(schoolName)) {
          reportsBySchool.set(schoolName, []);
        }
        reportsBySchool.get(schoolName)!.push(data);
      }
    });
    
    const schoolPerformances = Array.from(reportsBySchool.entries()).map(([schoolName, schoolReports]) => {
        const allAverages = schoolReports
          .map(report => {
              if (subjectName) {
                  const subject = report.subjects?.find((s: any) => s.subjectName === subjectName);
                  return subject ? calculateSubjectFinalMark(subject) : null;
              }
              return calculateOverallAverage(report.subjects);
          })
          .filter(avg => avg !== null) as number[];

        const average = allAverages.length > 0
          ? allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length
          : 0;

        return {
          schoolName,
          studentCount: allAverages.length, // Count only students who had a score for the subject/overall
          average,
        };
    }).filter(school => school.studentCount > 0); // Only include schools that had students with relevant scores

    const sortedSchools = schoolPerformances
        .sort((a, b) => b.average - a.average)
        .map((school, index, arr) => {
          const rankNumber = (index > 0 && school.average === arr[index - 1].average)
            ? (arr[index - 1] as any).rankNumber
            : index + 1;
          return { ...school, rankNumber };
        });
    
    const getOrdinalSuffix = (n: number): string => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    };

    const finalRankedSchools = sortedSchools.map((school, index, arr) => {
        const { rankNumber } = school;
        const isTiedWithNext = index < arr.length - 1 && arr[index + 1].rankNumber === rankNumber;
        const isTiedWithPrev = index > 0 && arr[index - 1].rankNumber === rankNumber;
        const isTie = isTiedWithNext || isTiedWithPrev;
        const rankString = `${isTie ? 'T-' : ''}${rankNumber}${getOrdinalSuffix(rankNumber)}`;
        return { ...school, rank: rankString };
    });
    
    return { success: true, ranking: finalRankedSchools };

  } catch (error: any) {
    console.error('Error fetching district-class ranking:', error);
    let errorMessage = "An unexpected error occurred while fetching the ranking.";
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        errorMessage = `A database index is needed. Please check the browser's developer console for a link to create the required index on the 'reports' collection for fields 'district' and 'className'.`;
    } else if (error instanceof z.ZodError) {
        errorMessage = "Invalid input: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
      

    
