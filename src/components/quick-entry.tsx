
"use client";

import React, { useState, useEffect, useMemo, ChangeEvent, KeyboardEvent } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, UserPlus, FileUp, Download, Wand2, CheckCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, addDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import type { CustomUser } from './auth-provider';
import { getSubjectsForClass, type ShsProgram } from '@/lib/curriculum';
import { batchUpdateStudentScoresAction, deleteReportAction, getAiReportInsightsAction, getBulkAiTeacherFeedbackAction, editImageWithAiAction } from '@/app/actions';

// ⬇️ New components
import QuickEntryToolbar from './quick-entry-toolbar';
import QuickEntryTable from './QuickEntryTable';

// ⬇️ Existing dialogs reused
import ExportGradesheetDialog from "./ExportGradesheetDialog";
import ImportGradesheetDialog from "./ImportGradesheetDialog";
import AddSubjectDialog from "./AddSubjectDialog";
import AddHobbyDialog from "./AddHobbyDialog";

interface QuickEntryProps {
  allReports: ReportData[];
  user: CustomUser;
  onDataRefresh: () => void;
  shsProgram?: string | null;
  subjectOrder: string[];
  setSubjectOrder: (order: string[]) => void;
}

export function QuickEntry({
  allReports,
  user,
  onDataRefresh,
  shsProgram,
  subjectOrder,
  setSubjectOrder,
}: QuickEntryProps) {
  const { toast } = useToast();

  // --- State
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [studentsInClass, setStudentsInClass] = useState<ReportData[]>([]);
  const [subjectsForClass, setSubjectsForClass] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // save status per student
  const [savingStatus, setSavingStatus] = useState<Record<string, "idle" | "saving" | "saved">>({});
  const [imageUploadStatus, setImageUploadStatus] = useState<Record<string, "uploading" | null>>({});
  const [isAiEditing, setIsAiEditing] = useState<Record<string, boolean>>({});
  const [studentToDelete, setStudentToDelete] = useState<ReportData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  // Dialog states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCustomSubjectDialogOpen, setIsCustomSubjectDialogOpen] = useState(false);
  const [isCustomHobbyDialogOpen, setIsCustomHobbyDialogOpen] = useState(false);

  // --- Derived
  const availableClasses = useMemo(() => {
    if (user.role === "user" && user.classNames) {
      return user.classNames.sort();
    }
    return [...new Set(allReports.map((r) => r.className).filter(Boolean) as string[])].sort();
  }, [allReports, user]);

  useEffect(() => {
    if (availableClasses.length > 0 && !selectedClass) {
      setSelectedClass(availableClasses[0]);
    } else if (availableClasses.length === 0) {
      setSelectedClass("");
    }
  }, [availableClasses, selectedClass]);

  // load students + subjects whenever class changes
  useEffect(() => {
    if (!selectedClass) {
      setStudentsInClass([]);
      setSubjectsForClass([]);
      setSubjectOrder([]);
      return;
    }

    const reports = allReports.filter((r) => r.className === selectedClass);
    setStudentsInClass(reports.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "")));

    const curriculumSubjects = getSubjectsForClass(selectedClass, shsProgram as ShsProgram | undefined);
    const subjectsFromReports = new Set<string>();
    reports.forEach((r) => r.subjects?.forEach((s) => s.subjectName && subjectsFromReports.add(s.subjectName)));
    const allPossible = [...new Set([...curriculumSubjects, ...Array.from(subjectsFromReports)])].sort();
    setSubjectsForClass(allPossible);

    // restore saved order
    const savedOrderKey = `subjectOrder_${selectedClass}`;
    const saved = localStorage.getItem(savedOrderKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const valid = parsed.filter((s: string) => allPossible.includes(s));
        const newSubjects = allPossible.filter((s) => !valid.includes(s));
        setSubjectOrder([...valid, ...newSubjects]);
      } catch {
        setSubjectOrder(allPossible);
      }
    } else {
      setSubjectOrder(allPossible);
    }
  }, [selectedClass, allReports, shsProgram, setSubjectOrder]);

  // --- Handlers for table inputs
  const handleMarkChange = (
    studentId: string,
    subject: string,
    type: "continuousAssessment" | "examinationMark",
    val: string
  ) => {
    setStudentsInClass((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              subjects: s.subjects.map((sub) =>
                sub.subjectName === subject
                  ? { ...sub, [type]: val === "" ? null : Number(val) }
                  : sub
              ),
            }
          : s
      )
    );
  };

  const handleFieldChange = (
    studentId: string,
    field: keyof ReportData,
    value: any
  ) => {
    setStudentsInClass((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, [field]: value } : s
      )
    );
  };

  const handleFieldBlur = async (
    studentId: string,
    updatedFields: Partial<ReportData>
  ) => {
    await saveData(studentId, updatedFields);
  };

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    studentId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploadStatus((p) => ({ ...p, [studentId]: "uploading" }));

    try {
      // Unique path for each student’s photo
      const storageRef = ref(storage, `student_photos/${studentId}/${file.name}`);
      await uploadBytes(storageRef, file);

      // Get the public download URL
      const downloadUrl = await getDownloadURL(storageRef);

      // Save to Firestore
      await saveData(studentId, { studentPhotoUrl: downloadUrl });

      // Update local state
      setStudentsInClass((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, studentPhotoUrl: downloadUrl } : s
        )
      );

      setImageUploadStatus((p) => ({ ...p, [studentId]: null }));

      toast({
        title: "Upload Complete",
        description: "Student photo uploaded successfully.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload Failed",
        description: "Could not upload student photo.",
        variant: "destructive",
      });
      setImageUploadStatus((p) => ({ ...p, [studentId]: null }));
    }
  };

  const handleAiEditImage = async (student: ReportData) => {
    setIsAiEditing((p) => ({ ...p, [student.id]: true }));
    try {
      const result = await editImageWithAiAction({
        photoDataUri: student.studentPhotoUrl!,
        prompt: "brighten and enhance photo for passport",
      });

      if (result.success && result.editedPhotoDataUri) {
         await saveData(student.id, { studentPhotoUrl: result.editedPhotoDataUri });
         setStudentsInClass((prev) => prev.map((s) => s.id === student.id ? { ...s, studentPhotoUrl: result.editedPhotoDataUri } : s));
         toast({
            title: "AI Edit Complete",
            description: `${student.studentName}'s photo enhanced.`,
         });
      } else {
         toast({
            title: "AI Edit Failed",
            description: result.error,
            variant: "destructive",
         });
      }
    } catch {
      toast({
        title: "AI Edit Failed",
        description: "Could not process student photo.",
        variant: "destructive",
      });
    } finally {
      setIsAiEditing((p) => ({ ...p, [student.id]: false }));
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    
    const result = await deleteReportAction({ reportId: studentToDelete.id });

    if (result.success) {
        toast({ title: 'Student Deleted', description: `Report for ${studentToDelete.studentName} has been removed.` });
        onDataRefresh(); 
    } else {
        toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    
    setIsDeleting(false);
    setStudentToDelete(null);
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, studentIndex: number, colId: string) => {
      // This is a placeholder for keyboard navigation, can be expanded later
  };

  const handleImportedData = async (dataToImport: { studentName: string, subjects: SubjectEntry[] }[]) => {
      // This is a placeholder for import logic, can be expanded later
  };


  // --- Handlers
  const saveData = async (id: string, fields: Partial<ReportData>) => {
    if (id.startsWith("temp-")) return;
    setSavingStatus((p) => ({ ...p, [id]: "saving" }));
    try {
      await updateDoc(doc(db, "reports", id), fields);
      setSavingStatus((p) => ({ ...p, [id]: "saved" }));
      setTimeout(() => setSavingStatus((p) => ({ ...p, [id]: "idle" })), 2000);
    } catch {
      toast({ title: "Save Failed", description: "Could not save data.", variant: "destructive" });
      setSavingStatus((p) => ({ ...p, [id]: "idle" }));
    }
  };

  const handleAddNewStudent = async () => {
    if (!newStudentName.trim() || !selectedClass) return;
    setIsAddingStudent(true);

    const highestEntryNum = allReports.reduce((max, r) => r.studentEntryNumber > max ? r.studentEntryNumber : max, 0);

    const newStudent: Omit<ReportData, "id"> = {
      studentEntryNumber: highestEntryNum + 1,
      studentName: newStudentName.trim(),
      className: selectedClass,
      gender: "",
      selectedTemplateId: 'default',
      studentPhotoUrl: null,
      subjects: subjectOrder.map((s) => ({
        subjectName: s,
        continuousAssessment: null,
        examinationMark: null,
      })),
      teacherId: user.uid,
      performanceSummary: "",
      strengths: "",
      areasForImprovement: "",
      hobbies: [],
    };

    try {
      await addDoc(collection(db, "reports"), { ...newStudent, createdAt: serverTimestamp() });
      toast({ title: "Student Added", description: `${newStudent.studentName} added to ${selectedClass}.` });
      setNewStudentName("");
      onDataRefresh();
    } catch {
      toast({ title: "Error", description: "Could not add student.", variant: "destructive" });
    } finally {
      setIsAddingStudent(false);
    }
  };

  // --- Bulk AI actions
  const handleBulkInsights = async () => {
    if (studentsInClass.length === 0) {
      toast({ title: "No Students", description: "Nothing to process.", variant: "destructive" });
      return;
    }
    toast({ title: "Generating Insights...", description: `AI is processing ${studentsInClass.length} students.` });
    const batch = writeBatch(db);
    for (const s of studentsInClass) {
      const res = await getAiReportInsightsAction({
        studentName: s.studentName || "",
        className: s.className,
        currentAcademicTerm: s.academicTerm || "",
        subjects: s.subjects,
        previousTermsData: [], // Quick Entry does not have access to history
      });
      if (res.success && res.insights) {
        batch.update(doc(db, "reports", s.id), {
          performanceSummary: res.insights.performanceSummary,
          strengths: res.insights.strengths,
          areasForImprovement: res.insights.areasForImprovement,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
    onDataRefresh();
    toast({ title: "Insights Complete", description: "AI-generated insights applied." });
  };

  const handleBulkFeedback = async () => {
    if (studentsInClass.length === 0) return;
    const result = await getBulkAiTeacherFeedbackAction({
      students: studentsInClass.map((s) => ({
        studentId: s.id,
        studentName: s.studentName,
        className: s.className,
        performanceSummary: s.performanceSummary,
        strengths: s.strengths,
        areasForImprovement: s.areasForImprovement,
      })),
    });
    if (result.success && result.feedbacks) {
        const batch = writeBatch(db);
        result.feedbacks.forEach(fb => {
          const reportRef = doc(db, 'reports', fb.studentId);
          batch.update(reportRef, { teacherFeedback: fb.feedback });
        });
        await batch.commit();
      toast({ title: "Feedback Ready", description: "AI feedback applied." });
      onDataRefresh();
    } else {
      toast({ title: "Feedback Failed", description: result.error, variant: "destructive" });
    }
  };

  // --- Render
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Quick Data Entry</CardTitle>
          <CardDescription>
            Enter scores & data quickly. Changes save automatically. On mobile, scroll left/right to view all subjects.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <QuickEntryToolbar
            selectedClass={selectedClass}
            setSelectedClass={setSelectedClass}
            availableClasses={availableClasses}
            studentsInClass={studentsInClass}
            subjectsForClass={subjectsForClass}
            subjectOrder={subjectOrder}
            setSubjectOrder={setSubjectOrder}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onOpenAddSubject={() => setIsCustomSubjectDialogOpen(true)}
          />

          <QuickEntryTable
            students={studentsInClass}
            subjectOrder={subjectOrder}
            searchQuery={searchQuery}
            savingStatus={savingStatus}
            imageUploadStatus={imageUploadStatus}
            isAiEditing={isAiEditing}
            onMarkChange={handleMarkChange}
            onFieldChange={handleFieldChange}
            onFieldBlur={handleFieldBlur}
            onUploadImage={handleUploadImage}
            onAiEditImage={handleAiEditImage}
            onDelete={(student) => setStudentToDelete(student)}
            onKeyDown={handleKeyDown}
          />
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between">
          {/* Add student */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Input
              placeholder="Enter student name..."
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNewStudent()}
            />
            <Button onClick={handleAddNewStudent} disabled={isAddingStudent}>
              {isAddingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          {/* Import/Export */}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} disabled={studentsInClass.length === 0}>
              <FileUp className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)} disabled={studentsInClass.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkInsights} disabled={studentsInClass.length === 0}>
              <Wand2 className="h-4 w-4 mr-2 text-accent" /> Bulk Insights
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkFeedback} disabled={studentsInClass.length === 0}>
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Bulk Feedback
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the report for <strong>{studentToDelete?.studentName}</strong> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStudentToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStudent} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isExportDialogOpen && <ExportGradesheetDialog isOpen={isExportDialogOpen} onOpenChange={setIsExportDialogOpen} subjects={subjectOrder} students={studentsInClass} className={selectedClass} />}
      {isImportDialogOpen && <ImportGradesheetDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onImport={handleImportedData} className={selectedClass} />}
      {isCustomSubjectDialogOpen && <AddSubjectDialog isOpen={isCustomSubjectDialogOpen} onOpenChange={setIsCustomSubjectDialogOpen} onAddSubject={(newSubject: string) => {
        if (!subjectsForClass.includes(newSubject)) {
          setSubjectsForClass(prev => [...prev, newSubject].sort());
        }
      }} />}
      {isCustomHobbyDialogOpen && <AddHobbyDialog isOpen={isCustomHobbyDialogOpen} onOpenChange={setIsCustomHobbyDialogOpen} />}
    </>
  );
}
