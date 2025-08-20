

'use client';

import React, { useState, useEffect, useMemo, ChangeEvent, KeyboardEvent } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Loader2, UserPlus, Upload, Save, CheckCircle, Search, Trash2, BookOpen, Edit, Download, FileUp, Eye, EyeOff, Wand2, BookPlus, PlusCircle, VenetianMask, CalendarCheck2, ChevronDown, BookPlus as BookPlusIcon, MessageSquare, Image as ImageIcon, Smile, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import type { CustomUser } from './auth-provider';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import NextImage from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { batchUpdateStudentScoresAction, deleteReportAction, getAiReportInsightsAction, batchUpdateTeacherFeedbackAction, getBulkAiTeacherFeedbackAction, editImageWithAiAction } from '@/app/actions';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import type { GenerateReportInsightsInput, GenerateReportInsightsOutput } from '@/ai/flows/generate-performance-summary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { getSubjectsForClass, type ShsProgram } from '@/lib/curriculum';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { resizeImage } from '@/lib/utils';


interface QuickEntryProps {
  allReports: ReportData[];
  user: CustomUser;
  onDataRefresh: () => void;
  shsProgram?: string | null;
  subjectOrder: string[];
  setSubjectOrder: (order: string[]) => void;
}

const scoreTypeOptions = [
    { value: 'continuousAssessment', label: 'Continuous Assessment (CA)' },
    { value: 'examinationMark', label: 'Examination Mark (Exam)' }
];
type ScoreType = 'continuousAssessment' | 'examinationMark';

const predefinedHobbiesList = ["Reading", "Sports (General)", "Music", "Art & Craft", "Debating", "Coding/Programming", "Gardening", "Volunteering", "Cooking/Baking", "Drama/Theater"];
const ADD_CUSTOM_HOBBY_VALUE = "--add-custom-hobby--";

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
  const [isTableVisible, setIsTableVisible] = useState(true);
  const [isGeneratingBulkInsights, setIsGeneratingBulkInsights] = useState(false);
  const [isCustomSubjectDialogOpen, setIsCustomSubjectDialogOpen] = useState(false);
  const [customSubjectInputValue, setCustomSubjectInputValue] = useState("");

  const [isApplyingBulkFeedback, setIsApplyingBulkFeedback] = useState(false);

  const [imageUploadStatus, setImageUploadStatus] = useState<Record<string, number | null>>({});
  const [isAiEditing, setIsAiEditing] = useState<Record<string, boolean>>({});

  const [customHobbies, setCustomHobbies] = useState<string[]>([]);
  const [isCustomHobbyDialogOpen, setIsCustomHobbyDialogOpen] = useState(false);
  const [customHobbyInputValue, setCustomHobbyInputValue] = useState('');
  const [currentHobbyTargetStudentId, setCurrentHobbyTargetStudentId] = useState<string | null>(null);

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
  
  // New useEffect to manage subjectOrder state
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
      
      // Load saved order or initialize it
      const savedOrderKey = `subjectOrder_${selectedClass}`;
      try {
        const savedOrder = localStorage.getItem(savedOrderKey);
        if (savedOrder) {
          const parsedOrder = JSON.parse(savedOrder);
          // Filter out subjects that are no longer relevant
          const validOrder = parsedOrder.filter((s: string) => allPossibleSubjects.includes(s));
          // Add any new subjects that weren't in the saved order
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
          await setDoc(reportRef, updatedFields, { merge: true });
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

    const handleMarkChange = (reportId: string, subjectName: string, markType: ScoreType, value: string) => {
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
            
            const allColumns = ['gender', 'daysAttended', ...subjectOrder.flatMap(s => [`${s}-ca`, `${s}-exam`])];
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


  const handleSubjectOrderChange = (newOrder: string[]) => {
      setSubjectOrder(newOrder);
      if (selectedClass) {
        try {
            localStorage.setItem(`subjectOrder_${selectedClass}`, JSON.stringify(newOrder));
        } catch (e) {
            console.error("Failed to save subject order to localStorage", e);
        }
      }
  };

  const moveSubject = (index: number, direction: 'up' | 'down') => {
      const newOrder = [...subjectOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < newOrder.length) {
          [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
          handleSubjectOrderChange(newOrder);
      }
  };

  const handleAddCustomSubject = () => {
      if (customSubjectInputValue.trim()) {
          const newSubject = customSubjectInputValue.trim();
          if (!subjectsForClass.includes(newSubject)) {
              setSubjectsForClass(prev => [...prev, newSubject].sort());
              handleSubjectOrderChange([...subjectOrder, newSubject]);
          }
      }
      setCustomSubjectInputValue('');
      setIsCustomSubjectDialogOpen(false);
  };

      const dataUriToBlob = (dataUri: string): { blob: Blob, mimeType: string } => {
    const byteString = atob(dataUri.split(',')[1]);
    const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return { blob: new Blob([ab], { type: mimeString }), mimeType: mimeString };
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

    // Resize image if it's too large
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      try {
        toast({ title: "Resizing Image", description: "The selected image is large and is being resized before upload." });
        file = await resizeImage(file);
      } catch (resizeError) {
        console.error("Image resize error:", resizeError);
        toast({ title: 'Resize Failed', description: 'Could not resize the image. Please try a smaller file.', variant: 'destructive' });
        if (input) input.value = '';
        return;
      }
    }

    const storageRef = ref(storage, `student_photos/${studentId}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setImageUploadStatus(prev => ({ ...prev, [studentId]: 0 }));

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
        setImageUploadStatus(prev => ({ ...prev, [studentId]: progress }));
      },
      async (error) => {
        console.error('Image upload error:', error);
        let errorMessage = "Could not save the image. This can happen if the network connection is interrupted.";
        if (typeof error === 'object' && error !== null && 'code' in error) {
            const errorCode = (error as any).code;
            switch (errorCode) {
                case 'storage/unauthorized':
                    errorMessage = "Permission denied. Please check your Firebase Storage security rules to allow writes.";
                    break;
                case 'storage/canceled':
                    errorMessage = "Upload was canceled.";
                    break;
                case 'storage/object-not-found':
                    errorMessage = "Storage not enabled. Please activate Firebase Storage in your project console.";
                    break;
                case 'storage/unknown':
                    errorMessage = "An unknown storage error occurred. Please check the server logs and ensure Storage is enabled.";
                    break;
            }
        }
        toast({ title: 'Upload Failed', description: errorMessage, variant: 'destructive', duration: 10000 });
        setImageUploadStatus(prev => ({ ...prev, [studentId]: null }));
        if (input) input.value = '';
      },
      async () => {
        try {
            const downloadURL = await getDownloadURL(storageRef);
            handleFieldChange(studentId, 'studentPhotoDataUri', downloadURL);
        } catch (err) {
            console.error('Error getting download URL after upload:', err);
            toast({ title: 'Upload Completed (URL Error)', description: 'The file uploaded but a download URL could not be retrieved. Check your Storage rules and permissions.', variant: 'destructive' });
        } finally {
            setImageUploadStatus(prev => ({ ...prev, [studentId]: null }));
            if (input) input.value = '';
        }
      }
    );
  };

  const handleAiEditImage = async (student: ReportData) => {
    const photoUrl = student.studentPhotoDataUri;
    if (!photoUrl) return;

    setIsAiEditing(prev => ({...prev, [student.id]: true}));

    let photoDataUri = photoUrl;
    if (!photoUrl.startsWith('data:')) {
      try {
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        photoDataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        toast({ title: "AI Edit Failed", description: "Could not fetch image to send to AI.", variant: "destructive" });
        setIsAiEditing(prev => ({...prev, [student.id]: false}));
        return;
      }
    }

    const result = await editImageWithAiAction({ photoDataUri, prompt: "Enhance the clarity of this photo, keeping all original features, and place a graduation hat on the student's head." });
    if (result.success && result.editedPhotoDataUri) {
      try {
        const { blob } = dataUriToBlob(result.editedPhotoDataUri);
        const storageRef = ref(storage, `student_photos/${student.id}`);
        await uploadBytesResumable(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        handleFieldChange(student.id, 'studentPhotoDataUri', downloadURL);
      } catch (storageError) {
        toast({ title: "Storage Error", description: "AI edit successful, but failed to save new image.", variant: "destructive" });
      }
    } else {
      toast({ title: "AI Image Edit Failed", description: result.error, variant: "destructive" });
    }
    setIsAiEditing(prev => ({...prev, [student.id]: false}));
  };

  const handleHobbyChange = (studentId: string, hobby: string, checked: boolean) => {
    const student = studentsInClass.find(s => s.id === studentId);
    if (!student) return;

    const currentHobbies = student.hobbies || [];
    const newHobbies = checked
      ? [...currentHobbies, hobby]
      : currentHobbies.filter(h => h !== hobby);
    
    handleFieldChange(studentId, 'hobbies', newHobbies);
  };

    const handleAddCustomHobby = () => {
        if (!currentHobbyTargetStudentId || !customHobbyInputValue.trim()) {
            setIsCustomHobbyDialogOpen(false);
            return;
        }

        const newHobby = customHobbyInputValue.trim();
        handleHobbyChange(currentHobbyTargetStudentId, newHobby, true);
        if (!predefinedHobbiesList.includes(newHobby) && !customHobbies.includes(newHobby)) {
            setCustomHobbies(prev => [...new Set([...prev, newHobby])]);
        }

        setIsCustomHobbyDialogOpen(false);
        setCustomHobbyInputValue('');
        setCurrentHobbyTargetStudentId(null);
    };

    const openCustomHobbyDialog = (studentId: string) => {
        setCurrentHobbyTargetStudentId(studentId);
        setIsCustomHobbyDialogOpen(true);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-1">
                    <Label htmlFor="class-select" className="text-xs text-muted-foreground">Select a Class</Label>
                    <div className='flex items-center gap-2'>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger id="class-select" className="w-full">
                                <SelectValue placeholder="Select a class..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableClasses.length > 0 ? (
                                  availableClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                                ) : (
                                  <SelectItem value="" disabled>No classes found</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {selectedClass && (
                            <div className="text-sm font-bold text-primary whitespace-nowrap">
                                (Total: {studentsInClass.length})
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <Label className="text-xs text-muted-foreground">Manage & Order Subjects</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full" disabled={!selectedClass}>
                          <BookPlusIcon className="mr-2 h-4 w-4 text-purple-500" />
                          Manage Subjects
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                          <DropdownMenuLabel>Visible Subjects</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <ScrollArea className="h-60">
                            {subjectsForClass.map((subject, index) => (
                              <div key={subject} className="flex items-center pr-2">
                                <DropdownMenuCheckboxItem
                                    className="flex-1"
                                    checked={subjectOrder.includes(subject)}
                                    onCheckedChange={(checked) => {
                                        const newOrder = checked
                                            ? [...subjectOrder, subject]
                                            : subjectOrder.filter(s => s !== subject);
                                        handleSubjectOrderChange(newOrder);
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    {subject}
                                </DropdownMenuCheckboxItem>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSubject(subjectOrder.indexOf(subject), 'up')} disabled={subjectOrder.indexOf(subject) === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSubject(subjectOrder.indexOf(subject), 'down')} disabled={subjectOrder.indexOf(subject) === subjectOrder.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </div>
                              </div>
                            ))}
                          </ScrollArea>
                          <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setIsCustomSubjectDialogOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add New Subject to List...
                            </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                
                <div className="lg:col-span-2">
                    <Label htmlFor="search-student" className="text-xs text-muted-foreground">Search Student</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="search-student"
                            placeholder="Type to search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                            disabled={!selectedClass}
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto relative border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow>
                            <TableHead className="w-[150px] sticky left-0 bg-muted z-20"><ImageIcon className="inline-block mr-1 h-4 w-4"/>Photo</TableHead>
                            <TableHead className="min-w-[180px] sticky left-[150px] bg-muted z-20">Student Name</TableHead>
                            <TableHead className="min-w-[120px]"><VenetianMask className="inline-block mr-1 h-4 w-4"/>Gender</TableHead>
                            <TableHead className="min-w-[150px]"><CalendarCheck2 className="inline-block mr-1 h-4 w-4"/>Days Attended</TableHead>
                             <TableHead className="min-w-[180px]"><Smile className="inline-block mr-1 h-4 w-4"/>Hobbies</TableHead>
                            {subjectOrder.map(subject => (
                              <TableHead key={subject} colSpan={2} className="text-center border-l min-w-[150px]">
                                {subject}
                              </TableHead>
                            ))}
                            <TableHead className="w-[50px] text-center">Status</TableHead>
                            <TableHead className="w-[80px] text-center">Actions</TableHead>
                        </TableRow>
                         <TableRow>
                            <TableHead className="sticky left-0 bg-muted z-20"></TableHead>
                            <TableHead className="sticky left-[150px] bg-muted z-20"></TableHead>
                            <TableHead></TableHead>
                            <TableHead></TableHead>
                            <TableHead></TableHead>
                            {subjectOrder.map(subject => (
                              <React.Fragment key={`${subject}-sub`}>
                                <TableHead className="text-center border-l">CA (60)</TableHead>
                                <TableHead className="text-center border-l">Exam (100)</TableHead>
                              </React.Fragment>
                            ))}
                            <TableHead></TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.map((student, index) => {
                            const uploadProgress = imageUploadStatus[student.id];
                            const isImageProcessing = isAiEditing[student.id] || (typeof uploadProgress === 'number');
                            return (
                                <TableRow key={student.id}>
                                    <TableCell className="sticky left-0 bg-background z-20">
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            {student.studentPhotoDataUri ? (
                                                <div className="relative w-12 h-16">
                                                  <NextImage src={student.studentPhotoDataUri} alt={student.studentName || 'Student'} layout='fill' className="rounded object-cover border" />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-16 bg-muted rounded flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground"/></div>
                                            )}
                                            <div className="flex flex-col gap-1">
                                               <input type="file" id={`photo-upload-${student.id}`} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, student.id)} disabled={isImageProcessing} />
                                               <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => document.getElementById(`photo-upload-${student.id}`)?.click()} disabled={isImageProcessing}>
                                                  <Upload className="h-4 w-4"/>
                                               </Button>
                                               <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleAiEditImage(student)} disabled={!student.studentPhotoDataUri || isImageProcessing}>
                                                  {isAiEditing[student.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <Wand2 className="h-4 w-4"/>}
                                               </Button>
                                            </div>
                                        </div>
                                        {imageUploadStatus[student.id] != null && (
                                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                            <div
                                              className="h-full bg-blue-500 transition-all duration-300 ease-in-out relative"
                                              style={{ width: `${imageUploadStatus[student.id]}%` }}
                                            >
                                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-medium sticky left-[150px] bg-background z-20">
                                      <Input
                                          id={`studentName-${student.id}`}
                                          value={student.studentName || ''}
                                          onChange={(e) => handleFieldChange(student.id, 'studentName', e.target.value)}
                                          onBlur={() => handleFieldBlur(student.id, { studentName: student.studentName })}
                                          className="h-9"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Select 
                                        value={student.gender || ''} 
                                        onValueChange={(value) => {
                                            handleFieldChange(student.id, 'gender', value);
                                            saveData(student.id, { gender: value });
                                        }}
                                      >
                                          <SelectTrigger id={`gender-${student.id}`} className="h-9 w-[100px]">
                                              <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                              <SelectItem value="Male">Male</SelectItem>
                                              <SelectItem value="Female">Female</SelectItem>
                                          </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            id={`daysAttended-${student.id}`}
                                            value={student.daysAttended ?? ''}
                                            onChange={(e) => handleFieldChange(student.id, 'daysAttended', e.target.value === '' ? null : Number(e.target.value))}
                                            onKeyDown={(e) => handleKeyDown(e, index, 'daysAttended')}
                                            onBlur={() => handleFieldBlur(student.id, { daysAttended: student.daysAttended })}
                                            placeholder="e.g., 85"
                                            className="text-center h-9 w-[100px]"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="h-9 w-full justify-between">
                                                    <span className="truncate">{student.hobbies?.join(', ') || 'Select...'}</span>
                                                    <ChevronDown className="ml-2 h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-[200px]">
                                                <ScrollArea className="h-60">
                                                    {[...predefinedHobbiesList, ...customHobbies].map(hobby => (
                                                        <DropdownMenuCheckboxItem
                                                            key={hobby}
                                                            checked={student.hobbies?.includes(hobby)}
                                                            onCheckedChange={checked => handleHobbyChange(student.id, hobby, Boolean(checked))}
                                                            onSelect={(e) => e.preventDefault()}
                                                        >
                                                            {hobby}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </ScrollArea>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onSelect={() => openCustomHobbyDialog(student.id)}>
                                                    <PlusCircle className="mr-2 h-4 w-4 text-accent"/>Add New Hobby...
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                     {subjectOrder.map(subjectName => {
                                        const subjectData = student.subjects.find(s => s.subjectName === subjectName);
                                        return (
                                          <React.Fragment key={`${student.id}-${subjectName}`}>
                                            <TableCell className="border-l p-1">
                                              <Input
                                                type="number"
                                                id={`${subjectName}-ca-${student.id}`}
                                                placeholder="-"
                                                className="text-center min-w-[60px] h-9"
                                                value={subjectData?.continuousAssessment ?? ''}
                                                onChange={(e) => handleMarkChange(student.id, subjectName, 'continuousAssessment', e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, `${subjectName}-ca`)}
                                                onBlur={() => handleFieldBlur(student.id, { subjects: student.subjects })}
                                              />
                                            </TableCell>
                                            <TableCell className="border-l p-1">
                                               <Input
                                                type="number"
                                                id={`${subjectName}-exam-${student.id}`}
                                                placeholder="-"
                                                className="text-center min-w-[60px] h-9"
                                                value={subjectData?.examinationMark ?? ''}
                                                onChange={(e) => handleMarkChange(student.id, subjectName, 'examinationMark', e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, `${subjectName}-exam`)}
                                                onBlur={() => handleFieldBlur(student.id, { subjects: student.subjects })}
                                              />
                                            </TableCell>
                                          </React.Fragment>
                                        );
                                      })}
                                    <TableCell>
                                        <div className="flex justify-center">
                                            {savingStatus[student.id] === 'saving' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                                            {savingStatus[student.id] === 'saved' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setStudentToDelete(student)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredStudents.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={subjectOrder.length * 2 + 7} className="text-center h-24 text-muted-foreground">
                                No students found. {searchQuery ? 'Try adjusting your search.' : 'Select a class or add a new student.'}
                              </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
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
                    <Button onClick={handleAddCustomSubject}>Add Subject</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={isCustomHobbyDialogOpen} onOpenChange={setIsCustomHobbyDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Hobby</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="custom-hobby-input">Hobby Name</Label>
                    <Input 
                        id="custom-hobby-input"
                        value={customHobbyInputValue}
                        onChange={(e) => setCustomHobbyInputValue(e.target.value)}
                        placeholder="e.g., Chess Club"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleAddCustomHobby}>Add Hobby</Button>
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
