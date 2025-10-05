

'use client';

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


interface QuickEntryProps {
  allReports: ReportData[];
  user: CustomUser;
  onDataRefresh: () => void;
  shsProgram?: string | null;
  subjectOrder: string[];
  setSubjectOrder: (order: string[]) => void;
}

export function QuickEntry({ allReports, user, onDataRefresh, shsProgram, subjectOrder, setSubjectOrder }: QuickEntryProps) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [studentsInClass, setStudentsInClass] = useState<ReportData[]>([]);
  const [subjectsForClass, setSubjectsForClass] = useState<string[]>([]);
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const { toast } = useToast();
  
  const [newStudentName, setNewStudentName] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<ReportData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isExportGradesheetDialogOpen, setIsExportGradesheetDialogOpen] = useState(false);
  const [isImportGradesheetDialogOpen, setIsImportGradesheetDialogOpen] = useState(false);
  const [isGeneratingBulkInsights, setIsGeneratingBulkInsights] = useState(false);
  const [isCustomSubjectDialogOpen, setIsCustomSubjectDialogOpen] = useState(false);
  const [customSubjectInputValue, setCustomSubjectInputValue] = useState("");

  const [isApplyingBulkFeedback, setIsApplyingBulkFeedback] = useState(false);

  const [imageUploadStatus, setImageUploadStatus] = useState<Record<string, 'uploading' | null>>({});
  const [isAiEditing, setIsAiEditing] = useState<Record<string, boolean>>({});

  const availableClasses = useMemo(() => {
    if (user.role === 'user' && user.classNames) {
        return user.classNames.sort();
    }
    return [...new Set(allReports.map(r => r.className).filter(Boolean) as string[])].sort();
  }, [allReports, user.role, user.classNames]);

  useEffect(() => {
    if (availableClasses.length > 0 && !selectedClass) {
      setSelectedClass(availableClasses[0]);
    } else if (availableClasses.length === 0) {
      setSelectedClass('');
    }
  }, [availableClasses, selectedClass]);
  
  useEffect(() => {
    if (selectedClass) {
      const reports = allReports.filter(r => r.className === selectedClass);
      setStudentsInClass(reports.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '')));

      const curriculumSubjects = getSubjectsForClass(selectedClass, shsProgram as ShsProgram | undefined);
      const subjectsFromReports = new Set<string>();
      reports.forEach(report => {
        report.subjects?.forEach(sub => {
          if (sub.subjectName) subjectsFromReports.add(sub.subjectName);
        });
      });
      const allPossibleSubjects = [...new Set([...curriculumSubjects, ...Array.from(subjectsFromReports)])].sort();
      setSubjectsForClass(allPossibleSubjects);
      
      const savedOrderKey = `subjectOrder_${selectedClass}`;
      try {
        const savedOrder = localStorage.getItem(savedOrderKey);
        if (savedOrder) {
          const parsedOrder = JSON.parse(savedOrder);
          const validOrder = parsedOrder.filter((s: string) => allPossibleSubjects.includes(s));
          const newSubjects = allPossibleSubjects.filter(s => !validOrder.includes(s));
          setSubjectOrder([...validOrder, ...newSubjects]);
        } else {
          setSubjectOrder(allPossibleSubjects);
        }
      } catch (e) {
          console.error("Failed to parse subject order from localStorage", e);
          setSubjectOrder(allPossibleSubjects);
      }
    } else {
      setStudentsInClass([]);
      setSubjectsForClass([]);
      setSubjectOrder([]);
    }
  }, [selectedClass, allReports, shsProgram, setSubjectOrder]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return studentsInClass;
    return studentsInClass.filter(student =>
      student.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [studentsInClass, searchQuery]);
  
    const saveData = async (reportId: string, updatedFields: Partial<ReportData>) => {
        if (reportId.startsWith('temp-')) return;
        
        setSavingStatus(prev => ({ ...prev, [reportId]: 'saving' }));
        try {
          const reportRef = doc(db, 'reports', reportId);
          await updateDoc(reportRef, updatedFields);
          setSavingStatus(prev => ({ ...prev, [reportId]: 'saved' }));
          setTimeout(() => {
            setSavingStatus(prev => ({ ...prev, [reportId]: 'idle' }));
          }, 2000);
        } catch (error) {
          console.error("Failed to save data:", error);
          toast({ title: 'Save Failed', description: 'Could not save changes to the database.', variant: 'destructive' });
          setSavingStatus(prev => ({ ...prev, [reportId]: 'idle' }));
        }
    };

    const handleFieldBlur = (reportId: string, updatedFields: Partial<ReportData>) => {
        saveData(reportId, updatedFields);
    };

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


    const handleAddNewStudent = async () => {
        if (!newStudentName.trim()) return;
        if (!selectedClass) {
            toast({ title: 'No Class Selected', description: 'Please select a class before adding a student.', variant: 'destructive' });
            return;
        }

        setIsAddingStudent(true);
        
        const classTemplate = studentsInClass[0]; 
        
        const newStudentData: Omit<ReportData, 'id'> = {
            studentName: newStudentName.trim(),
            className: selectedClass,
            gender: '',
            studentPhotoDataUri: null,
            subjects: subjectOrder.map(s => ({ subjectName: s, continuousAssessment: null, examinationMark: null })),
            teacherId: user.uid,
            studentEntryNumber: (allReports.reduce((max, r) => Math.max(r.studentEntryNumber || 0, max), 0) || 0) + 1,
            academicYear: classTemplate?.academicYear || '',
            academicTerm: classTemplate?.academicTerm || '',
            schoolName: classTemplate?.schoolName || user.schoolName || '',
            region: classTemplate?.region || user.region || '',
            district: classTemplate?.district || user.district || '',
            circuit: classTemplate?.circuit || user.circuit || '',
            shsProgram: classTemplate?.shsProgram || shsProgram || '',
            performanceSummary: '',
            strengths: '',
            areasForImprovement: '',
            selectedTemplateId: classTemplate?.selectedTemplateId || 'default',
            hobbies: [],
        };
        
        try {
            await addDoc(collection(db, 'reports'), {
                ...newStudentData,
                createdAt: serverTimestamp(),
            });
            
            toast({ title: 'Student Added', description: `${newStudentData.studentName} has been added to ${selectedClass}.` });
            setNewStudentName('');
            onDataRefresh();
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not add the new student to the database.', variant: 'destructive' });
        } finally {
            setIsAddingStudent(false);
        }
    };

    const handleAddStudentKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddNewStudent();
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
      setIsImportGradesheetDialogOpen(false);
  };
  
    const handleGenerateBulkInsights = async () => {
    if (studentsInClass.length === 0) {
      toast({
        title: "No Students",
        description: "There are no students in the selected class to generate insights for.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBulkInsights(true);
    toast({
      title: "Generating Bulk Insights...",
      description: `Please wait while AI generates insights for ${studentsInClass.length} students. This may take a moment.`,
    });

    try {
      const insightPromises = studentsInClass.map(student => {
        const aiInput: GenerateReportInsightsInput = {
          studentName: student.studentName || 'Unnamed Student',
          className: student.className,
          currentAcademicTerm: student.academicTerm || '',
          daysAttended: student.daysAttended,
          totalSchoolDays: student.totalSchoolDays,
          subjects: student.subjects,
        };
        return getAiReportInsightsAction(aiInput).then(result => ({
          studentId: student.id,
          result,
        }));
      });

      const results = await Promise.all(insightPromises);

      const successfulInsights: {studentId: string, result: { success: boolean; insights?: GenerateReportInsightsOutput; error?: string; }}[] = results.filter(r => r.result.success);
      const failedInsights = results.filter(r => !r.result.success);

      if (successfulInsights.length > 0) {
        const batch = writeBatch(db);
        successfulInsights.forEach(({ studentId, result }) => {
          const reportRef = doc(db, 'reports', studentId);
          batch.update(reportRef, {
            performanceSummary: result.insights?.performanceSummary || '',
            strengths: result.insights?.strengths || '',
            areasForImprovement: result.insights?.areasForImprovement || '',
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();

        toast({
          title: "Bulk Insights Complete",
          description: `${successfulInsights.length} student reports have been updated with AI-generated insights.`,
        });
      }

      if (failedInsights.length > 0) {
        toast({
          title: "Some Insights Failed",
          description: `Could not generate insights for ${failedInsights.length} students. Please check your connection and API key.`,
          variant: "destructive",
        });
        console.error("Failed insights:", failedInsights);
      }
      onDataRefresh();
    } catch (error) {
      console.error("Error generating bulk insights:", error);
      toast({
        title: "An Error Occurred",
        description: "A network or server error occurred during the bulk generation process.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBulkInsights(false);
    }
  };

  const handleApplyBulkAIFeedback = async () => {
    if (studentsInClass.length === 0) {
      toast({ title: 'No Students in Class', description: 'There are no students in the selected class to generate AI feedback for.', variant: 'destructive' });
      return;
    }

    setIsApplyingBulkFeedback(true);
    toast({ title: "Generating Bulk AI Feedback...", description: `Please wait while AI generates feedback for ${studentsInClass.length} students.` });

    const studentsToProcess = [...studentsInClass];

    const studentsNeedingInsights = studentsToProcess.filter(s => !s.performanceSummary || !s.strengths || !s.areasForImprovement);
    if (studentsNeedingInsights.length > 0) {
      toast({ title: "Generating Prerequisite Insights...", description: `AI is generating performance summaries for ${studentsNeedingInsights.length} students first.` });

      await Promise.all(studentsNeedingInsights.map(async (student) => {
        const insightsResult = await getAiReportInsightsAction({
          studentName: student.studentName,
          className: student.className,
          currentAcademicTerm: student.academicTerm || '',
          subjects: student.subjects,
        });
        if (insightsResult.success && insightsResult.insights) {
          student.performanceSummary = insightsResult.insights.performanceSummary || '';
          student.strengths = insightsResult.insights.strengths || '';
          student.areasForImprovement = insightsResult.insights.areasForImprovement || '';
        }
      }));
    }

    const feedbackInput = {
      students: studentsToProcess.map(s => ({
        studentId: s.id,
        studentName: s.studentName,
        className: s.className,
        performanceSummary: s.performanceSummary,
        strengths: s.strengths,
        areasForImprovement: s.areasForImprovement,
      })),
    };

    const result = await getBulkAiTeacherFeedbackAction(feedbackInput);
    if (result.success) {
      toast({ title: 'Bulk AI Feedback Complete', description: `AI-generated feedback has been applied to ${result.feedbacks?.length || 0} students.` });
      onDataRefresh();
    } else {
      toast({ title: 'Bulk AI Feedback Failed', description: result.error, variant: 'destructive' });
    }

    setIsApplyingBulkFeedback(false);
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

  return (
    <>
      <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                      <CardTitle className='text-2xl'>Quick Data Entry</CardTitle>
                      <CardDescription>
                          Rapidly enter scores and other data. Changes are saved automatically. Press Enter to move to the next student.
                      </CardDescription>
                  </div>
              </div>
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
                onFieldBlur={handleFieldBlur}
                onUploadImage={handleImageUpload}
                onAiEditImage={handleAiEditImage}
                onDelete={setStudentToDelete}
                onKeyDown={handleKeyDown}
            />
          </CardContent>
          <CardFooter className="border-t pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-end gap-2 w-full sm:w-auto">
                <div className="flex-grow">
                  <Label htmlFor="new-student-name" className="text-xs text-muted-foreground">Add New Student to "{selectedClass || '...'}"</Label>
                  <Input
                    id="new-student-name"
                    placeholder="Type name and press Enter..."
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyDown={handleAddStudentKeyDown}
                    disabled={!selectedClass || isAddingStudent}
                  />
                </div>
                <Button onClick={handleAddNewStudent} disabled={!selectedClass || !newStudentName.trim() || isAddingStudent}>
                    {isAddingStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> : <UserPlus className="mr-2 h-4 w-4 text-accent" />}
                    Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsImportGradesheetDialogOpen(true)}
                  disabled={studentsInClass.length === 0}
                >
                    <FileUp className="mr-2 h-4 w-4 text-blue-500" />
                    Import
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsExportGradesheetDialogOpen(true)}
                  disabled={studentsInClass.length === 0}
                >
                    <Download className="mr-2 h-4 w-4 text-green-600" />
                    Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateBulkInsights}
                  disabled={isGeneratingBulkInsights || studentsInClass.length === 0}
                  title="Generate AI insights for all students in the current class"
                >
                  {isGeneratingBulkInsights ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4 text-accent" />
                  )}
                  Bulk Insights
                </Button>
              </div>
          </CardFooter>
      </Card>
      
       <Card className="mt-6">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wand2 className="text-accent"/> Bulk AI Teacher Feedback</CardTitle>
            <CardDescription>Click the button to generate and apply unique, AI-powered feedback for each student in the class based on their performance data.</CardDescription>
        </CardHeader>
        <CardFooter>
            <Button 
                onClick={handleApplyBulkAIFeedback} 
                disabled={isApplyingBulkFeedback || studentsInClass.length === 0}
            >
                {isApplyingBulkFeedback ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Generate & Apply AI Feedback to All Students
            </Button>
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
        <Dialog open={isCustomSubjectDialogOpen} onOpenChange={setIsCustomSubjectDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Subject</DialogTitle>
                    <DialogDescription>
                        Add a new subject to the list of available subjects for class: {selectedClass || "..."}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="custom-subject-input">Subject Name</Label>
                    <Input 
                        id="custom-subject-input"
                        value={customSubjectInputValue}
                        onChange={(e) => setCustomSubjectInputValue(e.target.value)}
                        placeholder="e.g., Further Mathematics"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={() => {
                        if (customSubjectInputValue.trim()) {
                            const newSubject = customSubjectInputValue.trim();
                            if (!subjectsForClass.includes(newSubject)) {
                                setSubjectsForClass(prev => [...prev, newSubject].sort());
                                setSubjectOrder([...subjectOrder, newSubject]);
                            }
                        }
                        setCustomSubjectInputValue('');
                        setIsCustomSubjectDialogOpen(false);
                    }}>Add Subject</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      {isExportGradesheetDialogOpen && (
        <ExportGradesheetDialog
            isOpen={isExportGradesheetDialogOpen}
            onOpenChange={setIsExportGradesheetDialogOpen}
            subjects={subjectOrder}
            students={studentsInClass}
            className={selectedClass}
        />
      )}
      {isImportGradesheetDialogOpen && (
        <ImportGradesheetDialog
            isOpen={isImportGradesheetDialogOpen}
            onOpenChange={setIsImportGradesheetDialogOpen}
            onImport={handleImportedData}
            className={selectedClass}
        />
      )}
    </>
  );
}


function ExportGradesheetDialog({ isOpen, onOpenChange, subjects, students, className }: { isOpen: boolean, onOpenChange: (open: boolean) => void, subjects: string[], students: ReportData[], className: string }) {
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedSubjects(subjects);
        }
    }, [isOpen, subjects]);

    const handleSubjectSelection = (subject: string, checked: boolean) => {
        setSelectedSubjects(prev => checked ? [...prev, subject] : prev.filter(s => s !== subject));
    };

    const handleExport = () => {
        const dataForSheet = students.map(student => ({
            'Student Name': student.studentName,
            ...selectedSubjects.reduce((acc, subject) => {
                const subjectData = student.subjects.find(s => s.subjectName === subject);
                acc[`${subject} CA (60)`] = subjectData?.continuousAssessment ?? '';
                acc[`${subject} Exam (100)`] = subjectData?.examinationMark ?? '';
                return acc;
            }, {} as Record<string, string | number>)
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        
        if (worksheet['B2']) {
             worksheet['!protect'] = {};
        }
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `${className} Grades`);

        const cols = [{ wch: 30 }]; 
        selectedSubjects.forEach(subject => {
            cols.push({ wch: subject.length + 10 }); 
            cols.push({ wch: subject.length + 12 }); 
        });
        worksheet['!cols'] = cols;
        
        XLSX.writeFile(workbook, `${className}_Gradesheet_${new Date().toISOString().split('T')[0]}.xlsx`);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Export Gradesheet</DialogTitle>
                    <DialogDescription>Select the subjects to include in the Excel export for offline editing.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label className="font-semibold">Subjects</Label>
                    <ScrollArea className="h-60 mt-2 border rounded-md p-4">
                        <div className="space-y-2">
                            {subjects.map(subject => (
                                <div key={subject} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`subject-check-${subject}`}
                                        checked={selectedSubjects.includes(subject)}
                                        onCheckedChange={(checked) => handleSubjectSelection(subject, Boolean(checked))}
                                    />
                                    <Label htmlFor={`subject-check-${subject}`} className="font-normal cursor-pointer">
                                        {subject}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleExport} disabled={selectedSubjects.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export ({selectedSubjects.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ImportGradesheetDialog({ isOpen, onOpenChange, onImport, className }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onImport: (data: any[]) => void, className: string }) {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = () => {
        if (!file) {
            toast({ title: 'No File Selected', description: 'Please select an Excel file to import.', variant: 'destructive' });
            return;
        }
        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                const dataToImport = json.map(row => {
                    const studentName = row['Student Name'];
                    if (!studentName) return null;

                    const subjects: SubjectEntry[] = [];
                    Object.keys(row).forEach(key => {
                        if (key !== 'Student Name') {
                            const matchCA = key.match(/(.+) CA \(60\)/);
                            const matchExam = key.match(/(.+) Exam \(100\)/);
                            const subjectName = matchCA?.[1] || matchExam?.[1];

                            if (subjectName) {
                                let subject = subjects.find(s => s.subjectName === subjectName);
                                if (!subject) {
                                    subject = { subjectName, continuousAssessment: null, examinationMark: null };
                                    subjects.push(subject);
                                }
                                const value = row[key] === '' || row[key] === undefined ? null : Number(row[key]);
                                if (Number.isNaN(value)) {
                                    // Handle non-numeric values gracefully if needed, here we just nullify
                                } else {
                                    if (matchCA) subject.continuousAssessment = value;
                                    if (matchExam) subject.examinationMark = value;
                                }
                            }
                        }
                    });
                    return { studentName, subjects };
                }).filter(Boolean);

                onImport(dataToImport as any);
            } catch (error) {
                console.error("Error processing Excel file:", error);
                toast({ title: 'Import Error', description: 'Failed to read or process the Excel file. Please ensure it is in the correct format.', variant: 'destructive' });
            } finally {
                setIsProcessing(false);
                setFile(null); // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Gradesheet for "{className}"</DialogTitle>
                    <DialogDescription>
                        Select the completed Excel gradesheet. The system will match student names and update their scores.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="gradesheet-file">Excel File</Label>
                        <Input id="gradesheet-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Instructions:</p>
                        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 mt-1">
                            <li>Ensure the "Student Name" column in your Excel file exactly matches the names in the class list.</li>
                            <li>Only columns for CA and Exam marks will be imported.</li>
                            <li>Empty cells in the Excel file will be ignored.</li>
                        </ul>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleImport} disabled={!file || isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Process and Import
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
