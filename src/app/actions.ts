
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
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import type { CustomUser, PlainUser } from '@/components/auth-provider';
import { calculateOverallAverage, calculateSubjectFinalMark } from '@/lib/calculations';
import { type ReportData, ReportDataSchema, type SubjectEntry, SubjectEntrySchema } from '@/lib/schemas';
import { auth, db } from '@/lib/firebase';
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
  const data = doc.data();
  const report = ReportDataSchema.partial().parse({
    id: doc.id,
    teacherId: data.teacherId,
    studentEntryNumber: data.studentEntryNumber,
    studentName: data.studentName,
    className: data.className,
    shsProgram: data.shsProgram,
    gender: data.gender,
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
    hobbies: data.hobbies || [],
    teacherFeedback: data.teacherFeedback,
    instructorContact: data.instructorContact,
    subjects: data.subjects.map((s: any) => SubjectEntrySchema.partial().parse(s)),
    promotionStatus: data.promotionStatus,
    studentPhotoDataUri: data.studentPhotoDataUri,
    headMasterSignatureDataUri: data.headMasterSignatureDataUri,
    createdAt: data.createdAt?.toDate()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
  });

  report.overallAverage = calculateOverallAverage(report.subjects as SubjectEntry[]);
  
  return report as ReportData;
};


export async function getReportsAction(user: PlainUser): Promise<{ success: boolean, reports?: ReportData[], error?: string }> {
  try {
    const dbAdmin = admin.firestore();
    let query: Query = dbAdmin.collection('reports');

    if (user.role === 'user') {
      query = query.where('teacherId', '==', user.uid);
    } else if (user.role === 'public_user') {
      query = query.where('teacherId', '==', user.uid);
    } else if (user.role === 'admin') {
      if (!user.schoolName) throw new Error("School admin's scope is not defined.");
      query = query.where('schoolName', '==', user.schoolName);
    } else if (user.role === 'big-admin') {
      if (!user.district) throw new Error("District admin's scope is not defined.");
      query = query.where('district', '==', user.district);
    }
    // super-admin has no where clause, gets all reports

    const snapshot = await query.get();
    const reports = snapshot.docs.map(serializeReport);

    return { success: true, reports };
  } catch (error: any) {
    let errorMessage = "An unknown error occurred while fetching reports.";
    if (error.code === 'FAILED_PRECONDITION' && error.message.includes('requires an index')) {
      errorMessage = `A Firestore index is required for this query. Please create the index in your Firebase console. Details: ${error.message}`;
    } else {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}



// --- User & Invite Management Actions ---

const RegisterUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  telephone: z.string().optional(),
});


export async function registerUserAction(input: z.infer<typeof RegisterUserSchema>): Promise<{ success: boolean, message: string }> {
    try {
        const { email, password, name, telephone } = RegisterUserSchema.parse(input);
        
        // 1. Check for a pending invite for this email
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where("email", "==", email), where("status", "==", "pending"));
        const inviteSnapshot = await getDocs(q);

        if (inviteSnapshot.empty) {
            return { success: false, message: "Registration failed. Your email has not been authorized. Please contact an administrator." };
        }

        const inviteDoc = inviteSnapshot.docs[0];
        const inviteData = inviteDoc.data();

        // 2. Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. Create the user document in Firestore with data from the invite
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            name: name,
            telephone: telephone || null,
            role: inviteData.role || 'user',
            status: 'active',
            region: inviteData.region || null,
            district: inviteData.district || null,
            circuit: inviteData.circuit || null,
            schoolName: inviteData.schoolName || null,
            classNames: inviteData.classNames || null,
            schoolLevels: inviteData.schoolLevels || null,
            schoolCategory: inviteData.schoolCategory || null,
            createdAt: serverTimestamp()
        });

        // 4. Update the invite status to 'completed'
        await updateDoc(inviteDoc.ref, {
            status: 'completed',
            registeredAt: serverTimestamp(),
            registeredUserId: user.uid
        });
        
        return { success: true, message: "Registration successful! You are now being redirected." };

    } catch (error: any) {
        console.error("Registration Error:", error);
        let message = 'An unexpected error occurred during registration.';
        if (error.code === 'auth/email-already-in-use') {
            message = 'This email address is already registered. Please log in instead.';
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

    const inviteQuery = query(invitesRef, where("email", "==", data.email));
    const userQuery = query(usersRef, where("email", "==", data.email));

    const [inviteSnapshot, userSnapshot] = await Promise.all([getDocs(inviteQuery), getDocs(userQuery)]);

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


const serializeUser = (user: DocumentData): UserData => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
  telephone: user.telephone || null,
  role: user.role,
  status: user.status,
  region: user.region || null,
  district: user.district || null,
  circuit: user.circuit || null,
  schoolName: user.schoolName || null,
  classNames: user.classNames || null,
  schoolLevels: user.schoolLevels || null,
  schoolCategory: user.schoolCategory || null,
  createdAt: user.createdAt?.toDate()?.toISOString() || null,
});

const serializeInvite = (invite: DocumentData): InviteData => ({
  id: invite.id,
  email: invite.email,
  status: invite.status,
  role: invite.role || null,
  region: invite.region || null,
  district: invite.district || null,
  circuit: invite.circuit || null,
  schoolName: invite.schoolName || null,
  classNames: invite.classNames || null,
  schoolLevels: invite.schoolLevels || null,
  schoolCategory: invite.schoolCategory || null,
  createdAt: invite.createdAt?.toDate()?.toISOString() || null,
});


export async function getUsersAction(
  user: PlainUser
): Promise<{ success: boolean; users?: UserData[]; error?: string }> {
  try {
    const dbAdmin = admin.firestore();
    let query: Query = dbAdmin.collection('users');

    if (user.role === 'big-admin') {
      if (!user.district) throw new Error("District admin's scope is not defined.");
      query = query.where('district', '==', user.district);
    } else if (user.role === 'admin') {
      if (!user.schoolName) throw new Error("Admin's scope is not defined.");
      query = query.where('schoolName', '==', user.schoolName);
    } else if (user.role === 'user' || user.role === 'public_user') {
       return { success: false, error: 'Permission denied.' };
    }

    const snapshot = await query.get();
    let users = snapshot.docs.map(doc => serializeUser({ id: doc.id, ...doc.data() }));

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
    let query: Query = dbAdmin.collection('invites');

    if (user.role === 'big-admin') {
        if (!user.district) throw new Error("District admin's scope is not defined.");
        query = query.where('district', '==', user.district);
    } else if (user.role === 'admin') {
        if (!user.schoolName) throw new Error("Admin's scope is not defined.");
        query = query.where('schoolName', '==', user.schoolName);
    } else if (user.role === 'user' || user.role === 'public_user') {
       return { success: false, error: 'Permission denied.' };
    }
    
    const snapshot = await query.where('status', '==', 'pending').get();
    const invites = snapshot.docs.map(doc => serializeInvite({ id: doc.id, ...doc.data() }));
    return { success: true, invites };
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
    // The user document being gone is sufficient to block access.
    
    return { success: true };
  } catch (error: any) {
    console.error("Delete user error:", error);
    return { success: false, message: error.message || "Could not delete user." };
  }
}

    