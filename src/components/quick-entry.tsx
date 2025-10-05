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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, UserPlus, Upload, CheckCircle, Trash2, Wand2, FileUp, Download, PlusCircle, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import type { CustomUser } from './auth-provider';
import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { batchUpdateStudentScoresAction, deleteReportAction, getAiReportInsightsAction, getBulkAiTeacherFeedbackAction, editImageWithAiAction } from '@/app/actions';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import type { GenerateReportInsightsInput, GenerateReportInsightsOutput } from '@/ai/flows/generate-performance-summary';
import { getSubjectsForClass, type ShsProgram } from '@/lib/curriculum';
import { resizeImage, fileToBase64 } from '@/lib/utils';
import QuickEntryToolbar from './quick-entry-toolbar';
import GradesheetView from './gradesheet-view';
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

  const handleMarkChange = (reportId: string, subjectName: string, markType: "continuousAssessment" | "examinationMark", value: string) => {
    const numericValue = value === '' || value === '-' ? null : Number(value);

    if (markType === 'continuousAssessment' && numericValue !== null && numericValue > 60) {
        toast({ title: "Invalid CA Mark", description: `CA for ${subjectName} cannot exceed 60.`, variant: "destructive" });
        return;
    }
    if (markType === 'examinationMark' && numericValue !== null && numericValue > 100) {
        toast({ title: "Invalid Exam Mark", description: `Exam for ${subjectName} cannot exceed 100.`, variant: "destructive" });
        return;
    }

    setStudentsInClass(prevStudents => 
        prevStudents.map(student => {
            if (student.id === reportId) {
                let subjectFound = false;
                const newSubjects = student.subjects.map(sub => {
                    if (sub.subjectName === subjectName) {
                        subjectFound = true;
                        return { ...sub, [markType]: numericValue };
                    }
                    return sub;
                });
                if (!subjectFound) {
                    newSubjects.push({ subjectName, continuousAssessment: markType === 'continuousAssessment' ? numericValue : null, examinationMark: markType === 'examinationMark' ? numericValue : null });
                }
                return { ...student, subjects: newSubjects };
            }
            return student;
        })
    );
};

const handleFieldChange = (reportId: string, field: keyof ReportData, value: any) => {
    setStudentsInClass(prevStudents => 
        prevStudents.map(student => {
            if (student.id === reportId) {
                return { ...student, [field]: value };
            }
            return student;
        })
    );
};

const filteredStudents = useMemo(() => {
    if (!searchQuery) return studentsInClass;
    return studentsInClass.filter(student =>
      student.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [studentsInClass, searchQuery]);
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, studentIndex: number, colId: string) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const currentInput = e.target as HTMLInputElement;
        currentInput.blur(); // Triggers onBlur, which saves the data.
        
        const allColumns = ['studentName', 'gender', 'daysAttended', ...subjectOrder.flatMap(s => [`${s}-ca`, `${s}-exam`])];
        let nextStudentIndex = studentIndex + 1;
        let nextColId = colId;

        if (nextStudentIndex >= filteredStudents.length) {
            nextStudentIndex = 0;
            const currentColIndex = allColumns.indexOf(colId);
            const nextColIndex = currentColIndex + 1;
            nextColId = (nextColIndex < allColumns.length) ? allColumns[nextColIndex] : allColumns[0];
        }
        
        const nextStudentId = filteredStudents[nextStudentIndex]?.id;
        if(nextStudentId){
            const nextInputId = `${nextColId}-${nextStudentId}`;
            const nextInput = document.getElementById(nextInputId) as HTMLInputElement | null;
            nextInput?.focus();
            nextInput?.select();
        }
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

const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    studentId: string
  ) => {
    const input = e.target as HTMLInputElement;
    let file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid File', description: 'Please select an image.', variant: 'destructive' });
      return;
    }

    setImageUploadStatus(prev => ({ ...prev, [studentId]: 'uploading' }));

    try {
      const resizedFile = await resizeImage(file);
      const base64 = await fileToBase64(resizedFile);
      handleFieldChange(studentId, 'studentPhotoDataUri', base64);
      await saveData(studentId, { studentPhotoDataUri: base64 });
      toast({ title: 'Image Uploaded', description: 'The student photo has been updated.' });
    } catch (error) {
      console.error("Image processing or saving error:", error);
      toast({ title: 'Image Upload Failed', description: 'Could not process or save the image.', variant: 'destructive' });
    } finally {
      setImageUploadStatus(prev => ({ ...prev, [studentId]: null }));
      if (input) input.value = '';
    }
  };

  const handleAiEditImage = async (student: ReportData) => {
    const photoUrl = student.studentPhotoDataUri;
    if (!photoUrl) return;

    setIsAiEditing(prev => ({...prev, [student.id]: true}));

    const result = await editImageWithAiAction({ photoDataUri: photoUrl, prompt: "Brighten this photo and enhance its clarity, keeping all original features." });
    if (result.success && result.editedPhotoDataUri) {
        handleFieldChange(student.id, 'studentPhotoDataUri', result.editedPhotoDataUri);
        await saveData(student.id, { studentPhotoDataUri: result.editedPhotoDataUri });
        toast({ title: "AI Image Enhancement Successful", description: "The student photo has been updated." });
    } else {
      toast({ title: "AI Image Edit Failed", description: result.error, variant: "destructive" });
    }
    setIsAiEditing(prev => ({...prev, [student.id]: false}));
  };

  const handleImportedData = async (dataToImport: { studentName: string, subjects: SubjectEntry[] }[]) => {
    const updates = dataToImport.map(importedStudent => {
        const existingStudent = studentsInClass.find(s => s.studentName === importedStudent.studentName);
        if (!existingStudent) return null;

        const existingSubjectsMap = new Map(existingStudent.subjects.map(s => [s.subjectName, s]));
        importedStudent.subjects.forEach(importedSub => {
            existingSubjectsMap.set(importedSub.subjectName, { ...existingSubjectsMap.get(importedSub.subjectName), ...importedSub });
        });

        return {
            reportId: existingStudent.id,
            subjects: Array.from(existingSubjectsMap.values()),
        };
    }).filter(Boolean) as { reportId: string; subjects: SubjectEntry[] }[];

    if (updates.length === 0) {
        toast({ title: 'No Matching Students', description: 'No students in the Excel file matched the students in the selected class.', variant: 'destructive' });
        return;
    }

    const result = await batchUpdateStudentScoresAction({ updates });

    if (result.success) {
        toast({ title: 'Import Successful', description: `${updates.length} student records have been updated.` });
        onDataRefresh();
    } else {
        toast({ title: 'Import Failed', description: result.error, variant: 'destructive' });
    }
    setIsImportDialogOpen(false);
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

    const newStudent: Omit<ReportData, "id"> = {
      studentName: newStudentName.trim(),
      className: selectedClass,
      gender: "",
      studentPhotoDataUri: null,
      subjects: subjectOrder.map((s) => ({
        subjectName: s,
        continuousAssessment: null,
        examinationMark: null,
      })),
      teacherId: user.uid,
      studentEntryNumber: 0,
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

          <GradesheetView
            students={filteredStudents}
            subjectOrder={subjectOrder}
            searchQuery={searchQuery}
            savingStatus={savingStatus}
            imageUploadStatus={imageUploadStatus}
            isAiEditing={isAiEditing}
            onMarkChange={handleMarkChange}
            onFieldChange={handleFieldChange}
            onFieldBlur={saveData}
            onUploadImage={handleImageUpload}
            onAiEditImage={handleAiEditImage}
            onDelete={setStudentToDelete}
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

      {/* Dialogs */}
      <ExportGradesheetDialog isOpen={isExportDialogOpen} onOpenChange={setIsExportDialogOpen} subjects={subjectOrder} students={studentsInClass} className={selectedClass} />
      <ImportGradesheetDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onImport={handleImportedData} className={selectedClass} />
      <AddSubjectDialog isOpen={isCustomSubjectDialogOpen} onOpenChange={setIsCustomSubjectDialogOpen} onAddSubject={(newSubject) => {
        if (!subjectsForClass.includes(newSubject)) {
          setSubjectsForClass(prev => [...prev, newSubject].sort());
        }
      }} />
      <AddHobbyDialog isOpen={isCustomHobbyDialogOpen} onOpenChange={setIsCustomHobbyDialogOpen} />
    </>
  );
}
