
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
import {
  generateDistrictInsights,
  type GenerateDistrictInsightsInput,
  type GenerateDistrictInsightsOutput,
} from '@/ai/flows/generate-district-insights-flow';
import {
  generateBulkStudentFeedback,
  type GenerateBulkStudentFeedbackInput,
  type GenerateBulkStudentFeedbackOutput,
} from '@/ai/flows/generate-bulk-student-feedback-flow';
import { z } from 'zod';
import admin from '@/lib/firebase-admin';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { collection, addDoc, serverTimestamp, query as clientQuery, where as clientWhere, getDocs as clientGetDocs, doc, setDoc, deleteDoc, updateDoc, writeBatch, Timestamp, getDoc } from 'firebase/firestore';
import type { CustomUser, PlainUser } from '@/components/auth-provider';
import { calculateOverallAverage, calculateSubjectFinalMark } from '@/lib/calculations';
import { ReportDataSchema, type ReportData, type SubjectEntry, SubjectEntrySchema } from '@/lib/schemas';
import { db } from '@/lib/firebase';
import type { UserData, InviteData } from '@/types';


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

// Schemas for AI District Insights
const ActionDistrictSubjectPerformanceStatSchema = z.object({
  subjectName: z.string(),
  numBelowAverage: z.number(),
  numAverage: z.number(),
  numAboveAverage: z.number(),
  districtAverageForSubject: z.number().nullable(),
});

const ActionDistrictGenderPerformanceStatSchema = z.object({
  gender: z.string(),
  count: z.number(),
  averageScore: z.number().nullable(),
});

const ActionDistrictSchoolSummarySchema = z.object({
  schoolName: z.string(),
  schoolAverage: z.number().nullable(),
  numberOfStudents: z.number(),
});

const GenerateDistrictInsightsActionInputSchema = z.object({
  districtName: z.string(),
  academicTerm: z.string(),
  overallDistrictAverage: z.number().nullable(),
  totalStudentsInDistrict: z.number(),
  numberOfSchoolsRepresented: z.number(),
  schoolSummaries: z.array(ActionDistrictSchoolSummarySchema),
  overallSubjectStatsForDistrict: z.array(ActionDistrictSubjectPerformanceStatSchema),
  overallGenderStatsForDistrict: z.array(ActionDistrictGenderPerformanceStatSchema),
});

export async function getAiDistrictInsightsAction(
  input: GenerateDistrictInsightsInput
): Promise<{ success: boolean; insights?: GenerateDistrictInsightsOutput; error?: string }> {
  try {
    const validatedInput = GenerateDistrictInsightsActionInputSchema.parse(input);
    const result = await generateDistrictInsights(validatedInput);
    return { success: true, insights: result };
  } catch (error) {
    console.error("Error generating AI district insights:", error);
    let errorMessage = "Failed to generate AI district insights. Please try again.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for AI district insights: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// Schemas for Bulk AI Feedback
const ActionStudentFeedbackDataSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  className: z.string(),
  performanceSummary: z.string(),
  areasForImprovement: z.string(),
  strengths: z.string(),
});

const GenerateBulkStudentFeedbackActionInputSchema = z.object({
  students: z.array(ActionStudentFeedbackDataSchema),
});

export async function getBulkAiTeacherFeedbackAction(
  input: GenerateBulkStudentFeedbackInput
): Promise<{ success: boolean; feedbacks?: { studentId: string; feedback: string }[]; error?: string }> {
  try {
    const validatedInput = GenerateBulkStudentFeedbackActionInputSchema.parse(input);
    const result = await generateBulkStudentFeedback(validatedInput);
    if(result.feedbacks) {
      return { success: true, feedbacks: result.feedbacks };
    }
    return { success: false, error: 'AI did not return any feedback.'};
  } catch (error) {
    let errorMessage = "Failed to generate bulk AI feedback.";
    if (error instanceof z.ZodError) {
      errorMessage = "Invalid input for bulk feedback: " + error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// --- Report Data Actions ---

const ReportIdSchema = z.object({
  reportId: z.string().min(1),
});

export async function deleteReportAction(
  input: { reportId: string }
): Promise<{ success: boolean; message?: string }> {
  try {
    const { reportId } = ReportIdSchema.parse(input);
    await deleteDoc(doc(db, 'reports', reportId));
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting report:", error);
    return { success: false, message: error.message || "Could not delete report." };
  }
}

const ScoreUpdateSchema = z.object({
  reportId: z.string(),
  subjects: z.array(SubjectEntrySchema),
});

const BatchScoreUpdateSchema = z.object({
  updates: z.array(ScoreUpdateSchema),
});


export async function batchUpdateStudentScoresAction(
  input: { updates: { reportId: string; subjects: SubjectEntry[] }[] }
): Promise<{ success: boolean, error?: string }> {
  const validation = BatchScoreUpdateSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: "Invalid data format for batch update." };
  }
  
  const { updates } = validation.data;
  const batch = writeBatch(db);

  updates.forEach(update => {
    const reportRef = doc(db, "reports", update.reportId);
    batch.update(reportRef, { subjects: update.subjects });
  });

  try {
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update scores." };
  }
}


const TeacherFeedbackUpdateSchema = z.object({
  reportId: z.string(),
  feedback: z.string(),
});

const BatchTeacherFeedbackUpdateSchema = z.object({
  updates: z.array(TeacherFeedbackUpdateSchema),
});


export async function batchUpdateTeacherFeedbackAction(
    input: { updates: { reportId: string; feedback: string }[] }
): Promise<{ success: boolean, error?: string }> {
    const validation = BatchTeacherFeedbackUpdateSchema.safeParse(input);
    if (!validation.success) {
        return { success: false, error: "Invalid data format for batch feedback update." };
    }

    const { updates } = validation.data;
    const batch = writeBatch(db);

    updates.forEach(update => {
        const reportRef = doc(db, "reports", update.reportId);
        batch.update(reportRef, { teacherFeedback: update.feedback, updatedAt: serverTimestamp() });
    });

    try {
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to update teacher feedback." };
    }
}

const serializeReport = (doc: DocumentData): ReportData => {
  const data = doc.data() || {};
  
  const reportForValidation: Partial<ReportData> = {
    id: doc.id,
    teacherId: data.teacherId,
    studentEntryNumber: data.studentEntryNumber,
    studentName: data.studentName,
    className: data.className,
    shsProgram: data.shsProgram,
    gender: data.gender,
    country: data.country,
    schoolName: data.schoolName,
    schoolCategory: data.schoolCategory,
    region: data.region,
    district: data.district,
    circuit: data.circuit,
    schoolLogoDataUri: data.schoolLogoDataUri,
    academicYear: data.academicYear,
    academicTerm: data.academicTerm,
    reopeningDate: data.reopeningDate,
    selectedTemplateId: data.selectedTemplateId,
    daysAttended: data.daysAttended,
    totalSchoolDays: data.totalSchoolDays,
    parentEmail: data.parentEmail,
    parentPhoneNumber: data.parentPhoneNumber,
    performanceSummary: data.performanceSummary,
    strengths: data.strengths,
    areasForImprovement: data.areasForImprovement,
    hobbies: Array.isArray(data.hobbies) ? data.hobbies : [],
    teacherFeedback: data.teacherFeedback,
    instructorContact: data.instructorContact,
    subjects: Array.isArray(data.subjects) ? data.subjects.map((s: any) => ({
      subjectName: s.subjectName || '',
      continuousAssessment: s.continuousAssessment,
      examinationMark: s.examinationMark,
    })) : [],
    promotionStatus: data.promotionStatus,
    studentPhotoUrl: data.studentPhotoUrl,
    headMasterSignatureDataUri: data.headMasterSignatureDataUri,
    createdAt: data.createdAt?.toDate()?.toISOString(),
    updatedAt: data.updatedAt?.toDate()?.toISOString(),
  };

  const parsed = ReportDataSchema.parse(reportForValidation);
  const average = calculateOverallAverage(parsed.subjects);
  parsed.overallAverage = average === null ? undefined : average;
  return parsed;
};

export async function getReportsAction(user: PlainUser): Promise<{ success: boolean; reports?: ReportData[]; error?: string }> {
  if (!user) {
    return { success: false, error: 'User is not authenticated.' };
  }

  try {
    // Use the client-side db for this action as it's called from client components
    const reportsCollection = collection(db, 'reports');
    let q;

    switch (user.role) {
      case 'super-admin':
        q = clientQuery(reportsCollection);
        break;
      case 'big-admin':
        if (!user.district) throw new Error("District admin's scope is not defined.");
        q = clientQuery(reportsCollection, clientWhere('district', '==', user.district));
        break;
      case 'admin':
        if (!user.schoolName) throw new Error("School admin's scope is not defined.");
        q = clientQuery(reportsCollection, clientWhere('schoolName', '==', user.schoolName));
        break;
      case 'user':
      case 'public_user':
        q = clientQuery(reportsCollection, clientWhere('teacherId', '==', user.uid));
        break;
      default:
        return { success: false, error: 'Invalid user role for fetching reports.' };
    }

    const snapshot = await clientGetDocs(q);
    const reports = snapshot.docs.map(serializeReport);

    return { success: true, reports };

  } catch (error: any) {
    const code = error?.code ?? "UNKNOWN";
    const msg = String(error?.message || "");
    const isIndexError = msg.includes("requires an index") || code === 'failed-precondition';

    let errorMessage: string;
    if (isIndexError) {
      errorMessage = `INDEX_REQUIRED: ${msg}`;
    } else if (code === 'permission-denied') {
      errorMessage = `PERMISSION_DENIED: Your security rules are blocking this query. Please check the rules for the 'reports' collection.`;
    }
    else {
      errorMessage = `${code}: ${msg}`;
    }

    console.error("[getReportsAction] ERROR", { code, msg, isIndexError });
    return { success: false, error: errorMessage };
  }
}



// --- User & Invite Management Actions ---

const RegisterUserSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  telephone: z.string().optional(),
  country: z.string().optional(),
  schoolCategory: z.enum(['public', 'private']).optional(),
});


export async function registerUserAction(input: z.infer<typeof RegisterUserSchema>): Promise<{ success: boolean, message: string }> {
    try {
        const { uid, email, name, telephone, country, schoolCategory } = RegisterUserSchema.parse(input);
        
        const invitesRef = collection(db, 'invites');
        const q = clientQuery(invitesRef, clientWhere("email", "==", email), clientWhere("status", "==", "pending"));
        const inviteSnapshot = await clientGetDocs(q);

        const userDocRef = doc(db, 'users', uid);
        
        if (!inviteSnapshot.empty) {
            // Invited User Flow
            const inviteDoc = inviteSnapshot.docs[0];
            const inviteData = inviteDoc.data();

            await setDoc(userDocRef, {
                uid: uid,
                email: email,
                name: name,
                telephone: telephone || null,
                role: inviteData.role || 'user', // Role from invite
                status: 'active',
                country: country || null,
                region: inviteData.region || null,
                district: inviteData.district || null,
                circuit: inviteData.circuit || null,
                schoolName: inviteData.schoolName || null,
                classNames: inviteData.classNames || null,
                schoolLevels: inviteData.schoolLevels || null,
                schoolCategory: schoolCategory || inviteData.schoolCategory || null,
                createdAt: serverTimestamp()
            });

            await updateDoc(inviteDoc.ref, {
                status: 'completed',
                registeredAt: serverTimestamp(),
                registeredUserId: uid
            });
            return { success: true, message: "Registration successful! You have been registered with your assigned role." };
        } else {
            // Public User Flow
            await setDoc(userDocRef, {
                uid: uid,
                email: email,
                name: name,
                telephone: telephone || null,
                role: 'public_user', // Assign public_user role
                status: 'active',
                country: country || null,
                schoolCategory: schoolCategory || null,
                createdAt: serverTimestamp(),
            });
            return { success: true, message: "Registration successful! Welcome to the Report Card Generator." };
        }

    } catch (error: any) {
        console.error("Registration Error:", error);
        let message = 'An unexpected error occurred during registration.';
        if (error.code === 'auth/email-already-in-use') {
            message = 'This email address is already registered. Please log in instead.';
        }
        return { success: false, message };
    }
}

const GoogleUserSchema = z.object({
  uid: z.string(),
  email: z.string().email().optional().nullable(),
  displayName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
});

export async function handleGoogleSignInAction(
  googleUser: z.infer<typeof GoogleUserSchema>
): Promise<{ success: boolean; message: string }> {
  try {
    const validatedUser = GoogleUserSchema.parse(googleUser);
    const { uid, email, displayName, phoneNumber } = validatedUser;

    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // This is a new public user
      await setDoc(userDocRef, {
        uid: uid,
        email: email,
        name: displayName || 'Public User',
        telephone: phoneNumber || null,
        role: 'public_user',
        status: 'active',
        createdAt: serverTimestamp(),
      });
      return { success: true, message: 'Welcome! Your public account has been created.' };
    } else {
      // This is a returning user. Check if their account is active.
      const userData = userDocSnap.data();
      if (userData.status === 'inactive') {
        return { success: false, message: 'This account has been deactivated by an administrator.' };
      }
      return { success: true, message: 'Welcome back!' };
    }
  } catch (error: any) {
    console.error('Google Sign-In DB Action Error:', error);
    let message = 'An unknown error occurred on the server during Google sign-in.';
    if (error instanceof z.ZodError) {
      message = "Invalid user data received from client.";
    } else {
      message = error.message || 'Google sign-in failed on the server.';
    }
    return { success: false, message };
  }
}


const checkPermissions = (currentUser: PlainUser, targetRole?: string, targetScope?: Partial<PlainUser>) => {
  if (currentUser.role === 'super-admin') return true;

  if (currentUser.role === 'big-admin') {
    if (targetRole && (targetRole === 'super-admin' || targetRole === 'big-admin')) return false; // Big admin cannot create other big admins or super admins
    if (targetScope?.district && targetScope.district !== currentUser.district) return false; // Must be within the same district
    return true;
  }

  if (currentUser.role === 'admin') {
     if (targetRole && targetRole !== 'user') return false; // Admin can only create users
     if (targetScope?.schoolName && targetScope.schoolName !== currentUser.schoolName) return false; // Must be within the same school
     return true;
  }
  
  return false; // Users and public users cannot perform these actions
};


const CreateInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['big-admin', 'admin', 'user']).optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  circuit: z.string().optional(),
  schoolName: z.string().optional(),
  classNames: z.array(z.string()).optional(),
  schoolLevels: z.array(z.string()).optional(),
  schoolCategory: z.enum(['public', 'private']).optional(),
});


export async function createInviteAction(
  input: z.infer<typeof CreateInviteSchema>,
  currentUser: PlainUser
): Promise<{ success: boolean; message: string }> {
  try {
    const data = CreateInviteSchema.parse(input);
    
    if (!checkPermissions(currentUser, data.role, data)) {
      return { success: false, message: 'Permission denied. You do not have the required privileges to create this invite.' };
    }
    
    const invitesRef = collection(db, 'invites');
    const usersRef = collection(db, 'users');

    const inviteQuery = clientQuery(invitesRef, clientWhere("email", "==", data.email));
    const userQuery = clientQuery(usersRef, clientWhere("email", "==", data.email));

    const [inviteSnapshot, userSnapshot] = await Promise.all([clientGetDocs(inviteQuery), clientGetDocs(userQuery)]);

    if (!userSnapshot.empty) {
      return { success: false, message: "This email address is already registered to a user." };
    }
    if (!inviteSnapshot.empty) {
        const existingInvite = inviteSnapshot.docs[0].data();
        if(existingInvite.status === 'pending') {
            return { success: false, message: "An active invite for this email already exists." };
        }
    }

    await addDoc(invitesRef, {
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
      invitedBy: currentUser.uid,
    });

    return { success: true, message: `Invite sent successfully to ${data.email}.` };
  } catch (error: any) {
    console.error("Create invite error:", error);
    return { success: false, message: error.message || 'Could not create invite.' };
  }
}

export async function deleteInviteAction(
  input: { inviteId: string }
): Promise<{ success: boolean; message?: string }> {
  try {
    await deleteDoc(doc(db, 'invites', input.inviteId));
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || 'Could not delete invite.' };
  }
}

export async function updateUserStatusAction(
  input: { userId: string; status: 'active' | 'inactive' }
): Promise<{ success: boolean; message?: string }> {
  try {
    const userRef = doc(db, 'users', input.userId);
    await updateDoc(userRef, { status: input.status });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || 'Could not update user status.' };
  }
}


const UpdateInviteSchema = CreateInviteSchema.extend({
  inviteId: z.string(),
});

export async function updateInviteAction(
  input: z.infer<typeof UpdateInviteSchema>,
  currentUser: PlainUser
): Promise<{ success: boolean; message: string }> {
   try {
    const data = UpdateInviteSchema.parse(input);
     if (!checkPermissions(currentUser, data.role, data)) {
      return { success: false, message: 'Permission denied.' };
    }
    
    const inviteRef = doc(db, 'invites', data.inviteId);
    await updateDoc(inviteRef, { ...data, updatedAt: serverTimestamp() });
    return { success: true, message: 'Invite updated successfully.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Could not update invite.' };
  }
}

const UpdateUserRoleAndScopeSchema = z.object({
  userId: z.string(),
  role: z.enum(['big-admin', 'admin', 'user', 'public_user']),
  region: z.string().optional(),
  district: z.string().optional(),
  circuit: z.string().optional(),
  schoolName: z.string().optional(),
  classNames: z.array(z.string()).optional(),
  schoolLevels: z.array(z.string()).optional(),
  schoolCategory: z.enum(['public', 'private']).optional(),
  country: z.string().optional(),
});


export async function updateUserRoleAndScopeAction(
  input: z.infer<typeof UpdateUserRoleAndScopeSchema>,
  currentUser: PlainUser
): Promise<{ success: boolean; message: string }> {
  try {
    const data = UpdateUserRoleAndScopeSchema.parse(input);
     if (!checkPermissions(currentUser, data.role, data)) {
      return { success: false, message: 'Permission denied to assign this role or scope.' };
    }
    const userRef = doc(db, 'users', data.userId);
    await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
    return { success: true, message: 'User updated successfully.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Could not update user.' };
  }
}


const serializeUser = (userDoc: DocumentData): UserData => {
  const data = userDoc.data();
  return {
    id: userDoc.id,
    email: data.email,
    name: data.name || null,
    telephone: data.telephone || null,
    role: data.role,
    status: data.status,
    country: data.country || null,
    region: data.region || null,
    district: data.district || null,
    circuit: data.circuit || null,
    schoolName: data.schoolName || null,
    classNames: data.classNames || null,
    schoolLevels: data.schoolLevels || null,
    schoolCategory: data.schoolCategory || null,
    createdAt: data.createdAt?.toDate()?.toISOString() || null,
  };
}


const serializeInvite = (inviteDoc: DocumentData): InviteData => {
  const data = inviteDoc.data();
  return {
    id: inviteDoc.id,
    email: data.email,
    status: data.status,
    role: data.role || null,
    region: data.region || null,
    district: data.district || null,
    circuit: data.circuit || null,
    schoolName: data.schoolName || null,
    classNames: data.classNames || null,
    schoolLevels: data.schoolLevels || null,
    schoolCategory: data.schoolCategory || null,
    createdAt: data.createdAt?.toDate()?.toISOString() || null,
  };
};


export async function getUsersAction(
  user: PlainUser
): Promise<{ success: boolean; users?: UserData[]; error?: string }> {
  try {
    const dbAdmin = admin.firestore();
    let q: Query = dbAdmin.collection('users');

    if (user.role === 'big-admin') {
      if (!user.district) throw new Error("District admin's scope is not defined.");
      q = q.where('district', '==', user.district);
    } else if (user.role === 'admin') {
      if (!user.schoolName) throw new Error("Admin's scope is not defined.");
      q = q.where('schoolName', '==', user.schoolName);
    } else if (user.role === 'user' || user.role === 'public_user') {
       return { success: false, error: 'Permission denied.' };
    }

    const snapshot = await q.get();
    let users = snapshot.docs.map(serializeUser);

    // Only super-admins can see public_users
    if (user.role !== 'super-admin') {
        users = users.filter(u => u.role !== 'public_user');
    }

    return { success: true, users };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getInvitesAction(
  user: PlainUser
): Promise<{ success: boolean; invites?: InviteData[]; error?: string }> {
  try {
    const dbAdmin = admin.firestore();
    let q: Query = dbAdmin.collection('invites').where('status', '==', 'pending');
    
    const snapshot = await q.get();
    const allPendingInvites = snapshot.docs.map(serializeInvite);

    let filteredInvites: InviteData[];

    if (user.role === 'super-admin') {
      filteredInvites = allPendingInvites;
    } else if (user.role === 'big-admin') {
      if (!user.district) throw new Error("District admin's scope is not defined.");
      filteredInvites = allPendingInvites.filter(invite => invite.district === user.district);
    } else if (user.role === 'admin') {
      if (!user.schoolName) throw new Error("Admin's scope is not defined.");
      filteredInvites = allPendingInvites.filter(invite => invite.schoolName === user.schoolName);
    } else {
      return { success: false, error: 'Permission denied.' };
    }

    return { success: true, invites: filteredInvites };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


const DeleteUserActionSchema = z.object({
  userId: z.string(),
});

export async function deleteUserAction(
  input: z.infer<typeof DeleteUserActionSchema>,
  currentUser: PlainUser
): Promise<{ success: boolean; message?: string }> {
  try {
    const { userId } = DeleteUserActionSchema.parse(input);

    if (currentUser.role !== 'super-admin') {
      return { success: false, message: "Permission denied. Only super admins can delete users." };
    }
    
    const dbAdmin = admin.firestore();
    await dbAdmin.collection('users').doc(userId).delete();
    // Note: This does not delete the user from Firebase Auth to prevent re-registration issues.
    
    return { success: true };
  } catch (error: any) {
    console.error("Delete user error:", error);
    return { success: false, message: error.message || "Could not delete user." };
  }
}

// Action to get population stats for admin dashboards
export async function getSystemWideStatsAction(): Promise<{ success: boolean, stats?: any, error?: string }> {
    try {
        const reportsSnapshot = await admin.firestore().collection('reports').get();
        const schools = new Set(reportsSnapshot.docs.map(doc => doc.data().schoolName).filter(Boolean));
        const publicSchools = new Set(reportsSnapshot.docs.filter(doc => doc.data().schoolCategory === 'public').map(doc => doc.data().schoolName).filter(Boolean));
        const privateSchools = new Set(reportsSnapshot.docs.filter(doc => doc.data().schoolCategory === 'private').map(doc => doc.data().schoolName).filter(Boolean));
        const maleCount = reportsSnapshot.docs.filter(doc => doc.data().gender === 'Male').length;
        const femaleCount = reportsSnapshot.docs.filter(doc => doc.data().gender === 'Female').length;
        const schoolLevelCounts: Record<string, number> = {};
        const usersSnapshot = await admin.firestore().collection('users').get();
        usersSnapshot.docs.forEach(doc => {
            const levels = doc.data().schoolLevels;
            if (Array.isArray(levels)) {
                levels.forEach(level => {
                    schoolLevelCounts[level] = (schoolLevelCounts[level] || 0) + 1;
                });
            }
        });

        return {
            success: true,
            stats: {
                schoolCount: schools.size,
                publicSchoolCount: publicSchools.size,
                privateSchoolCount: privateSchools.size,
                totalStudents: reportsSnapshot.size,
                maleCount,
                femaleCount,
                schoolLevelCounts,
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getDistrictStatsAction(district: string): Promise<{ success: boolean, stats?: any, error?: string }> {
    try {
        const reportsSnapshot = await admin.firestore().collection('reports').where('district', '==', district).get();
        const schools = new Set(reportsSnapshot.docs.map(doc => doc.data().schoolName).filter(Boolean));
        const publicSchools = new Set(reportsSnapshot.docs.filter(doc => doc.data().schoolCategory === 'public').map(doc => doc.data().schoolName).filter(Boolean));
        const privateSchools = new Set(reportsSnapshot.docs.filter(doc => doc.data().schoolCategory === 'private').map(doc => doc.data().schoolName).filter(Boolean));
        const maleCount = reportsSnapshot.docs.filter(doc => doc.data().gender === 'Male').length;
        const femaleCount = reportsSnapshot.docs.filter(doc => doc.data().gender === 'Female').length;
        const schoolLevelCounts: Record<string, number> = {};
        const usersSnapshot = await admin.firestore().collection('users').where('district', '==', district).get();
        usersSnapshot.docs.forEach(doc => {
            const levels = doc.data().schoolLevels;
            if (Array.isArray(levels)) {
                levels.forEach(level => {
                    schoolLevelCounts[level] = (schoolLevelCounts[level] || 0) + 1;
                });
            }
        });

        return {
            success: true,
            stats: {
                schoolCount: schools.size,
                publicSchoolCount: publicSchools.size,
                privateSchoolCount: privateSchools.size,
                totalStudents: reportsSnapshot.size,
                maleCount,
                femaleCount,
                schoolLevelCounts,
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSchoolStatsAction(schoolName: string): Promise<{ success: boolean, stats?: any, error?: string }> {
    try {
        const reportsSnapshot = await admin.firestore().collection('reports').where('schoolName', '==', schoolName).get();
        const classes = new Set(reportsSnapshot.docs.map(doc => doc.data().className).filter(Boolean));
        const maleCount = reportsSnapshot.docs.filter(doc => doc.data().gender === 'Male').length;
        const femaleCount = reportsSnapshot.docs.filter(doc => doc.data().gender === 'Female').length;
        return {
            success: true,
            stats: {
                classCount: classes.size,
                totalStudents: reportsSnapshot.size,
                maleCount,
                femaleCount,
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export type SchoolRankingData = { schoolName: string; studentCount: number; average: number; rank: string };

export async function getDistrictClassRankingAction(
    { district, className, academicYear, academicTerm, subjectName, schoolCategory }: { district: string; className: string; academicYear: string | null, academicTerm: string | null, subjectName: string | null, schoolCategory: 'public' | 'private' | null }
): Promise<{ success: boolean, ranking?: SchoolRankingData[], error?: string }> {
    try {
        let q: Query = admin.firestore().collection('reports')
            .where('district', '==', district)
            .where('className', '==', className);

        if (academicYear) q = q.where('academicYear', '==', academicYear);
        if (academicTerm) q = q.where('academicTerm', '==', academicTerm);
        if (schoolCategory) q = q.where('schoolCategory', '==', schoolCategory);
        
        const snapshot = await q.get();
        const reports = snapshot.docs.map(doc => serializeReport(doc));

        const schools = new Map<string, { scores: number[], count: number }>();
        reports.forEach(report => {
            if (!report.schoolName!) {
                return;
            }
            if (!schools.has(report.schoolName!)) {
                schools.set(report.schoolName!, { scores: [], count: 0 });
            }
            const schoolData = schools.get(report.schoolName!)!;
            schoolData.count++;
            const average = subjectName
              ? calculateSubjectFinalMark(report.subjects.find(s => s.subjectName === subjectName)!)
              : report.overallAverage;

            if (average !== null && average !== undefined) {
                schoolData.scores.push(average);
            }
        });

        const performance = Array.from(schools.entries()).map(([schoolName, data]) => ({
            schoolName,
            studentCount: data.count,
            average: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
        }));
        
        performance.sort((a, b) => b.average - a.average);

        const getOrdinalSuffix = (n: number) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };

        let lastScore = -1;
        let lastRank = 0;
        const rankedPerformance: SchoolRankingData[] = performance.map((item, index) => {
            const rank = item.average === lastScore ? lastRank : index + 1;
            lastScore = item.average;
            lastRank = rank;
            return {
                ...item,
                rank: `${rank}${getOrdinalSuffix(rank)}`,
            };
        });
        
        return { success: true, ranking: rankedPerformance };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export type StudentRankingData = { studentName: string; average: number; rank: string };

export async function getSchoolProgramRankingAction(
  { schoolName, className, shsProgram, subjectName }: { schoolName: string; className: string; shsProgram: string; subjectName: string | null }
): Promise<{ success: boolean; ranking?: StudentRankingData[]; error?: string }> {
    try {
        const q = admin.firestore().collection('reports')
            .where('schoolName', '==', schoolName)
            .where('className', '==', className)
            .where('shsProgram', '==', shsProgram);
        
        const snapshot = await q.get();
        const reports = snapshot.docs.map(doc => serializeReport(doc));

        const performance = reports.map(report => {
            const average = subjectName
                ? calculateSubjectFinalMark(report.subjects.find(s => s.subjectName === subjectName)!)
                : report.overallAverage;
            return {
                studentName: report.studentName,
                average: average ?? 0,
            };
        });
        
        performance.sort((a, b) => b.average - a.average);
        
        const getOrdinalSuffix = (n: number) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };
        
        let lastScore = -1;
        let lastRank = 0;
        const rankedPerformance: StudentRankingData[] = performance.map((item, index) => {
            const rank = item.average === lastScore ? lastRank : index + 1;
            lastScore = item.average;
            lastRank = rank;
            return {
                ...item,
                rank: `${rank}${getOrdinalSuffix(rank)}`,
            };
        });

        return { success: true, ranking: rankedPerformance };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export type PopulationStats = {
  schoolCount: number;
  publicSchoolCount: number;
  privateSchoolCount: number;
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
  schoolLevelCounts: Record<string, number>;
}

export async function getReportsForAdminAction(user: PlainUser): Promise<{ success: boolean; reports?: ReportData[]; error?: string }> {
  if (!user || (user.role !== 'super-admin' && user.role !== 'big-admin')) {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    const dbAdmin = admin.firestore();
    let q: Query = dbAdmin.collection('reports');

    if (user.role === 'big-admin') {
      if (!user.district) throw new Error("District admin's scope is not defined.");
      q = q.where('district', '==', user.district);
    }
    // No .where() for super-admin means all reports are fetched.

    const snapshot = await q.get();
    const reports = snapshot.docs.map(serializeReport);
    return { success: true, reports };
  } catch (error: any) {
    return { success: false, error: `Failed to fetch reports for admin: ${error.message}` };
  }
}

    