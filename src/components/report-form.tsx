'use client';

import { ReportDataSchema, type ReportData, type SubjectEntry } from '@/lib/schemas';
import { zodResolver }from '@hookform/resolvers/zod';
import {useForm, type SubmitHandler, useFieldArray}from 'react-hook-form';
import {Button}from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle}from '@/components/ui/card';
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage}from '@/components/ui/form';
import {Input}from '@/components/ui/input';
import {Textarea}from '@/components/ui/textarea';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator}from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {getAiFeedbackAction, getAiReportInsightsAction, editImageWithAiAction }from '@/app/actions';
import React, {useState, useTransition, useEffect}from 'react';
import NextImage from 'next/image';
import {Loader2, Sparkles, Wand2, User, Users, ClipboardList, ThumbsUp, Activity, CheckSquare, BookOpenText, ListChecks, FileOutput, PlusCircle, Trash2, Edit3, Bot, CalendarCheck2, CalendarDays, VenetianMask, Type, Medal, ImageUp, UploadCloud, X, Phone, ChevronLeft, ChevronRight, Signature, Building, Smile, ChevronDown, Mail, LayoutTemplate } from 'lucide-react';
import {useToast}from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';


interface ReportFormProps {
  onFormUpdate: (data: ReportData) => void;
  initialData?: Partial<ReportData>;
  reportPrintListForHistory?: ReportData[];
}

const ADD_CUSTOM_SUBJECT_VALUE = "--add-custom-subject--";
const ADD_CUSTOM_CLASS_VALUE = "--add-custom-class--";
const ADD_CUSTOM_HOBBY_VALUE = "--add-custom-hobby--";

const classLevels = [
  "KG1", "KG2",
  "BASIC 1", "BASIC 2", "BASIC 3", "BASIC 4", "BASIC 5", "BASIC 6",
  "JHS1", "JHS2", "JHS3",
  "SHS1", "SHS2", "SHS3",
  "LEVEL 100", "LEVEL 200", "LEVEL 300", "LEVEL 400", "LEVEL 500", "LEVEL 600", "LEVEL 700"
];

const tertiaryLevelClasses = [
  "LEVEL 100", "LEVEL 200", "LEVEL 300", "LEVEL 400", "LEVEL 500", "LEVEL 600", "LEVEL 700"
];

const genderOptions = ["Male", "Female"];

const academicTermOptions = [
  "First Term", "Second Term", "Third Term", "First Semester", "Second Semester"
];

const promotionStatusOptions = [
  "Promoted", "Repeated", "Graduated", "Under Review"
];

const predefinedSubjectsList = [
  "Mathematics", "English Language", "Science", "Computing",
  "Religious and Moral Education", "Creative Arts", "Geography",
  "Economics", "Biology", "Elective Mathematics"
];

const predefinedHobbiesList = [
  "Reading", "Sports (General)", "Music", "Art & Craft", "Debating",
  "Coding/Programming", "Gardening", "Volunteering", "Cooking/Baking", "Drama/Theater"
];

const reportTemplateOptions = [
    { id: 'default', name: 'Default Template' },
    { id: 'professionalBlue', name: 'Professional Blue' },
    { id: 'elegantGreen', name: 'Elegant Green' },
    { id: 'minimalistGray', name: 'Minimalist Gray' },
    { id: 'academicRed', name: 'Academic Red' },
    { id: 'creativeTeal', name: 'Creative Teal' },
];

// Helper function to calculate final mark for a single subject from form data
function calculateSubjectFinalMarkForForm(subject: SubjectEntry): number | null {
  const caMarkInput = subject.continuousAssessment;
  const examMarkInput = subject.examinationMark;

  if ((caMarkInput === null || caMarkInput === undefined || Number.isNaN(Number(caMarkInput))) && 
      (examMarkInput === null || examMarkInput === undefined || Number.isNaN(Number(examMarkInput)))) {
    return null; // No valid marks, cannot calculate
  }

  const caVal = (caMarkInput !== null && caMarkInput !== undefined && !Number.isNaN(Number(caMarkInput))) ? Number(caMarkInput) : 0;
  const examVal = (examMarkInput !== null && examMarkInput !== undefined && !Number.isNaN(Number(examMarkInput))) ? Number(examMarkInput) : 0;

  const scaledCaMark = (caVal / 60) * 40;
  const scaledExamMark = (examVal / 100) * 60;
  
  let finalPercentageMark = scaledCaMark + scaledExamMark;
  finalPercentageMark = Math.min(Math.max(finalPercentageMark, 0), 100); // Ensure it's between 0 and 100
  return parseFloat(finalPercentageMark.toFixed(1));
}

// Helper function to calculate overall average from form data
function calculateOverallAverageForForm(subjects: SubjectEntry[]): number | null {
  if (!subjects || subjects.length === 0) return null;

  let totalScore = 0;
  let validSubjectCount = 0;

  subjects.forEach(subject => {
    if (subject.subjectName && subject.subjectName.trim() !== '') {
      const finalMark = calculateSubjectFinalMarkForForm(subject);
      if (finalMark !== null) {
        totalScore += finalMark;
        validSubjectCount++;
      }
    }
  });

  if (validSubjectCount === 0) return null;
  return parseFloat((totalScore / validSubjectCount).toFixed(2));
}


export default function ReportForm({ onFormUpdate, initialData, reportPrintListForHistory }: ReportFormProps) {
  const [isTeacherFeedbackAiLoading, startTeacherFeedbackAiTransition] = useTransition();
  const [isReportInsightsAiLoading, startReportInsightsAiTransition] = useTransition();
  const [isImageEditingAiLoading, startImageEditingAiTransition] = useTransition();
  const { toast } = useToast();

  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [isCustomSubjectDialogOpen, setIsCustomSubjectDialogOpen] = useState(false);
  const [customSubjectInputValue, setCustomSubjectInputValue] = useState('');
  const [currentCustomSubjectTargetIndex, setCurrentCustomSubjectTargetIndex] = useState<number | null>(null); 

  const [customClassNames, setCustomClassNames] = useState<string[]>([]);
  const [isCustomClassNameDialogOpen, setIsCustomClassNameDialogOpen] = useState(false);
  const [customClassNameInputValue, setCustomClassNameInputValue] = useState('');

  const [customHobbies, setCustomHobbies] = useState<string[]>([]);
  const [isCustomHobbyDialogOpen, setIsCustomHobbyDialogOpen] = useState(false);
  const [customHobbyInputValue, setCustomHobbyInputValue] = useState('');

  const [currentVisibleSubjectIndex, setCurrentVisibleSubjectIndex] = useState(0);


  const studentNameHistory = React.useMemo(() => {
    if (!reportPrintListForHistory) return [];
    const names = reportPrintListForHistory.map(report => report.studentName).filter(Boolean);
    return [...new Set(names)];
  }, [reportPrintListForHistory]);


  const form = useForm<ReportData>({
    resolver: zodResolver(ReportDataSchema),
    defaultValues: {
      studentName: initialData?.studentName || '',
      className: initialData?.className || '',
      gender: initialData?.gender || '',
      schoolName: initialData?.schoolName || 'Springfield Elementary',
      schoolLogoDataUri: initialData?.schoolLogoDataUri || undefined,
      academicYear: initialData?.academicYear || '2023-2024',
      academicTerm: initialData?.academicTerm || 'First Term',
      selectedTemplateId: initialData?.selectedTemplateId || 'default',
      daysAttended: initialData?.daysAttended || null,
      totalSchoolDays: initialData?.totalSchoolDays || null,
      parentEmail: initialData?.parentEmail || '',
      parentPhoneNumber: initialData?.parentPhoneNumber || '',
      performanceSummary: initialData?.performanceSummary || '',
      strengths: initialData?.strengths || '',
      areasForImprovement: initialData?.areasForImprovement || '',
      hobbies: initialData?.hobbies || [],
      teacherFeedback: initialData?.teacherFeedback || '',
      instructorContact: initialData?.instructorContact || '',
      subjects: initialData?.subjects?.length ? initialData.subjects as SubjectEntry[] : [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
      studentEntryNumber: initialData?.studentEntryNumber || undefined,
      promotionStatus: initialData?.promotionStatus || undefined,
      studentPhotoDataUri: initialData?.studentPhotoDataUri || undefined,
      headMasterSignatureDataUri: initialData?.headMasterSignatureDataUri || undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subjects"
  });

  useEffect(() => {
    if (fields.length > 0) {
      if (currentVisibleSubjectIndex >= fields.length) {
        setCurrentVisibleSubjectIndex(fields.length - 1);
      }
    } else {
      if (fields.length === 0) {
        append({ subjectName: '', continuousAssessment: null, examinationMark: null });
        setCurrentVisibleSubjectIndex(0);
      }
    }
  }, [fields.length, currentVisibleSubjectIndex, append]);


  const watchedAcademicTerm = form.watch('academicTerm');
  const watchedClassName = form.watch('className');
  const watchedHobbies = form.watch('hobbies') || [];
  const watchedSubjects = form.watch('subjects');


  const isPromotionStatusApplicable = React.useMemo(() => {
    if (!watchedAcademicTerm || !watchedClassName) return false;
    return watchedAcademicTerm === 'Third Term' && !tertiaryLevelClasses.includes(watchedClassName);
  }, [watchedAcademicTerm, watchedClassName]);

  useEffect(() => {
    if (initialData) {
      form.reset({
        studentName: initialData.studentName || '',
        className: initialData.className || '',
        gender: initialData.gender || '',
        schoolName: initialData.schoolName || 'Springfield Elementary',
        schoolLogoDataUri: initialData.schoolLogoDataUri || undefined,
        academicYear: initialData.academicYear || '2023-2024',
        academicTerm: initialData.academicTerm || 'First Term',
        selectedTemplateId: initialData.selectedTemplateId || 'default',
        daysAttended: initialData.daysAttended === undefined ? null : initialData.daysAttended,
        totalSchoolDays: initialData.totalSchoolDays === undefined ? null : initialData.totalSchoolDays,
        parentEmail: initialData.parentEmail || '',
        parentPhoneNumber: initialData.parentPhoneNumber || '',
        performanceSummary: initialData.performanceSummary || '',
        strengths: initialData.strengths || '',
        areasForImprovement: initialData.areasForImprovement || '',
        hobbies: initialData.hobbies || [],
        teacherFeedback: initialData.teacherFeedback || '',
        instructorContact: initialData.instructorContact || '',
        subjects: initialData.subjects?.length ? initialData.subjects as SubjectEntry[] : [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
        studentEntryNumber: initialData.studentEntryNumber || undefined,
        promotionStatus: initialData.promotionStatus || undefined, // Keep initial if set
        studentPhotoDataUri: initialData.studentPhotoDataUri || undefined,
        headMasterSignatureDataUri: initialData.headMasterSignatureDataUri || undefined,
      });
      setCurrentVisibleSubjectIndex(0);

      if (initialData.className && !classLevels.includes(initialData.className) && !customClassNames.includes(initialData.className)) {
        setCustomClassNames(prev => [...prev, initialData.className!]);
      }
      if (initialData.hobbies) {
        const newCustomHobbies = initialData.hobbies.filter(hobby => !predefinedHobbiesList.includes(hobby) && !customHobbies.includes(hobby));
        if (newCustomHobbies.length > 0) {
          setCustomHobbies(prev => [...prev, ...newCustomHobbies]);
        }
      }
      if (initialData.subjects) {
        const newCustomSubjects = initialData.subjects
          .map(s => s.subjectName)
          .filter(name => name && !predefinedSubjectsList.includes(name) && !customSubjects.includes(name));
        if (newCustomSubjects.length > 0) {
          setCustomSubjects(prev => [...prev, ...newCustomSubjects]);
        }
      }

    }
  }, [initialData, form.reset, form, append, customClassNames, customHobbies, customSubjects]);


  useEffect(() => {
    if (!isPromotionStatusApplicable) {
      form.setValue('promotionStatus', undefined, { shouldDirty: true, shouldValidate: true });
    }
  }, [isPromotionStatusApplicable, form]);

  // Effect to automatically set promotion status for Third Term
  useEffect(() => {
    if (isPromotionStatusApplicable) {
      const currentOverallAverage = calculateOverallAverageForForm(watchedSubjects);

      if (currentOverallAverage !== null) {
        if (currentOverallAverage >= 40) {
          form.setValue('promotionStatus', 'Promoted', { shouldDirty: true, shouldValidate: true });
        } else {
          form.setValue('promotionStatus', 'Repeated', { shouldDirty: true, shouldValidate: true });
        }
      }
      // If average is null (e.g., no marks yet), do nothing, allowing manual selection or existing value.
    }
  }, [isPromotionStatusApplicable, watchedSubjects, form.setValue]);


  const handleAddCustomSubjectToListAndForm = () => {
    if (customSubjectInputValue.trim() === '') {
      toast({
        title: "Invalid Subject Name",
        description: "Custom subject name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (currentCustomSubjectTargetIndex !== null) {
      const newSubjectName = customSubjectInputValue.trim();
      form.setValue(`subjects.${currentCustomSubjectTargetIndex}.subjectName`, newSubjectName);

      if (!predefinedSubjectsList.includes(newSubjectName) && !customSubjects.includes(newSubjectName)) {
        setCustomSubjects(prev => [...prev, newSubjectName]);
      }

      toast({
        title: "Subject Added",
        description: `"${newSubjectName}" has been set for the current subject entry and added to your session list.`,
      });
      setIsCustomSubjectDialogOpen(false);
      setCustomSubjectInputValue('');
      setCurrentCustomSubjectTargetIndex(null);
    }
  };

  const handleAddCustomClassNameToListAndForm = () => {
    const newClassName = customClassNameInputValue.trim();
    if (newClassName === '') {
      toast({
        title: "Invalid Class Name",
        description: "Custom class name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    form.setValue('className', newClassName, { shouldDirty: true, shouldValidate: true });
    if (!classLevels.includes(newClassName) && !customClassNames.includes(newClassName)) {
      setCustomClassNames(prev => [...prev, newClassName]);
    }
    toast({
      title: "Class Added",
      description: `"${newClassName}" has been set and added to your session list.`,
    });
    setIsCustomClassNameDialogOpen(false);
    setCustomClassNameInputValue('');
  };

  const handleAddCustomHobbyToListAndForm = () => {
    const newHobby = customHobbyInputValue.trim();
    if (newHobby === '') {
      toast({
        title: "Invalid Hobby Name",
        description: "Custom hobby name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    
    const currentHobbies = form.getValues('hobbies') || [];
    if (!currentHobbies.includes(newHobby)) {
      form.setValue('hobbies', [...currentHobbies, newHobby], { shouldDirty: true, shouldValidate: true });
    }

    if (!predefinedHobbiesList.includes(newHobby) && !customHobbies.includes(newHobby)) {
      setCustomHobbies(prev => [...prev, ...newHobby]);
    }
    toast({
      title: "Hobby Added",
      description: `"${newHobby}" has been selected and added to your session list.`,
    });
    setIsCustomHobbyDialogOpen(false);
    setCustomHobbyInputValue('');
  };


  const handleGenerateAiReportInsights = async () => {
    const { studentName, className, subjects, daysAttended, totalSchoolDays } = form.getValues();
    if (!studentName || !className || !subjects || subjects.some(s => !s.subjectName)) {
      toast({
        title: "Missing Information",
        description: "Please fill in student name, class name, and ensure all subjects have names before generating AI insights.",
        variant: "destructive",
      });
      form.trigger(['studentName', 'className', 'subjects']);
      return;
    }

    startReportInsightsAiTransition(async () => {
      try {
        const result = await getAiReportInsightsAction({
          studentName,
          className,
          daysAttended,
          totalSchoolDays,
          subjects: subjects.map(s => ({
            subjectName: s.subjectName,
            continuousAssessment: s.continuousAssessment === undefined || s.continuousAssessment === null ? null : Number(s.continuousAssessment),
            examinationMark: s.examinationMark === undefined || s.examinationMark === null ? null : Number(s.examinationMark),
          })),
        });

        if (result.success && result.insights) {
          form.setValue('performanceSummary', result.insights.performanceSummary);
          form.setValue('strengths', result.insights.strengths);
          form.setValue('areasForImprovement', result.insights.areasForImprovement);
          toast({
            title: "AI Insights Generated",
            description: "Performance summary, strengths, and areas for improvement have been populated.",
            variant: "default",
          });
        } else {
          toast({
            title: "Error Generating Insights",
            description: result.error || "An unknown error occurred.",
            variant: "destructive",
          });
        }
      } catch (error) {
         toast({
            title: "Client Error Generating Insights",
            description: error instanceof Error ? error.message : "An unexpected error occurred before calling the AI service.",
            variant: "destructive",
          });
      }
    });
  };


  const handleGenerateAiTeacherFeedback = async () => {
    const { studentName, className, performanceSummary, strengths, areasForImprovement } = form.getValues();
    if (!studentName || !className || !performanceSummary || !strengths || !areasForImprovement) {
      toast({
        title: "Missing Information",
        description: "Please fill in student name, class name, performance summary, strengths, and areas for improvement before generating AI teacher feedback.",
        variant: "destructive",
      });
      form.trigger(['studentName', 'className', 'performanceSummary', 'strengths', 'areasForImprovement']);
      return;
    }

    startTeacherFeedbackAiTransition(async () => {
      try {
        const result = await getAiFeedbackAction({
          studentName,
          className,
          performanceSummary,
          strengths,
          areasForImprovement,
        });
        if (result.success && result.feedback) {
          form.setValue('teacherFeedback', result.feedback);
          toast({
            title: "AI Teacher Feedback Generated",
            description: "Teacher's feedback has been populated.",
            variant: "default",
          });
        } else {
          toast({
            title: "Error Generating Feedback",
            description: result.error || "An unknown error occurred.",
            variant: "destructive",
          });
        }
      } catch (error) {
         toast({
            title: "Error Generating Feedback",
            description: "An unexpected error occurred.",
            variant: "destructive",
          });
      }
    });
  };

  const handleAiEditImage = async (photoDataUri: string, editPrompt: string) => {
    if (!photoDataUri) {
      toast({
        title: "No Image to Edit",
        description: "Please upload a student photo first.",
        variant: "destructive",
      });
      return;
    }

    startImageEditingAiTransition(async () => {
      try {
        const result = await editImageWithAiAction({ photoDataUri, prompt: editPrompt });
        if (result.success && result.editedPhotoDataUri) {
          form.setValue('studentPhotoDataUri', result.editedPhotoDataUri, { shouldDirty: true, shouldValidate: true });
          toast({
            title: "AI Image Edit Successful",
            description: "The student photo has been updated with the AI edit.",
          });
        } else {
          toast({
            title: "AI Image Edit Failed",
            description: result.error || "Could not apply AI edit to the image.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "AI Image Edit Error",
          description: "An unexpected error occurred during AI image editing.",
          variant: "destructive",
        });
      }
    });
  };


  const onSubmit: SubmitHandler<ReportData> = (data) => {
    const promotionStatusApplicableCheck = data.academicTerm === 'Third Term' && data.className && !tertiaryLevelClasses.includes(data.className);
    const processedData = {
      ...data,
      daysAttended: data.daysAttended === '' || data.daysAttended === undefined ? null : Number(data.daysAttended),
      totalSchoolDays: data.totalSchoolDays === '' || data.totalSchoolDays === undefined ? null : Number(data.totalSchoolDays),
      subjects: data.subjects.map(s => ({
        ...s,
        continuousAssessment: s.continuousAssessment === undefined || s.continuousAssessment === null ? null : Number(s.continuousAssessment),
        examinationMark: s.examinationMark === undefined || s.examinationMark === null ? null : Number(s.examinationMark),
      })),
      promotionStatus: promotionStatusApplicableCheck ? data.promotionStatus : undefined,
      studentPhotoDataUri: data.studentPhotoDataUri || undefined,
      headMasterSignatureDataUri: data.headMasterSignatureDataUri || undefined,
      instructorContact: data.instructorContact || '',
      schoolLogoDataUri: data.schoolLogoDataUri || undefined,
      studentEntryNumber: data.studentEntryNumber || undefined,
      hobbies: data.hobbies || [],
      parentEmail: data.parentEmail || '',
      parentPhoneNumber: data.parentPhoneNumber || '',
    };
    onFormUpdate(processedData);
     toast({
        title: "Preview Updated",
        description: "The report preview has been updated with the latest information.",
      });
  };

  const handleAddSubjectAndNavigate = () => {
    const newIndex = fields.length;
    append({ subjectName: '', continuousAssessment: null, examinationMark: null }, { shouldFocus: false });
    setCurrentVisibleSubjectIndex(newIndex);
  };

  const handleRemoveCurrentSubject = () => {
    if (fields.length <= 1) {
      toast({ title: "Cannot Remove", description: "At least one subject is required.", variant: "destructive" });
      return;
    }
    remove(currentVisibleSubjectIndex);
  };

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: keyof Pick<ReportData, 'studentPhotoDataUri' | 'schoolLogoDataUri' | 'headMasterSignatureDataUri'>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const originalDataUri = reader.result as string;

        const allowedMimePattern = /^data:image\/(png|jpeg|gif|svg\+xml);base64,/;
        if (typeof originalDataUri !== 'string' || !allowedMimePattern.test(originalDataUri)) {
          toast({
            title: "Invalid File Type/Format",
            description: "Please upload a valid image (PNG, JPEG, GIF, SVG) in Base64 data URI format. Other formats might not display correctly.",
            variant: "destructive",
          });
          if (event.target) event.target.value = '';
          return;
        }
        
        form.setValue(fieldName, originalDataUri, { shouldDirty: true, shouldValidate: true });
        toast({
          title: "Image Uploaded",
          description: `${fieldName === 'studentPhotoDataUri' ? 'Student photo' : fieldName === 'schoolLogoDataUri' ? 'School logo' : "Head Master's signature"} has been uploaded.`,
        });
      };
      reader.onerror = () => {
        toast({
            title: "File Read Error",
            description: "Could not read the selected file. It might be corrupted or the browser might not support reading it.",
            variant: "destructive",
          });
        if (event.target) event.target.value = '';
      };
      reader.readAsDataURL(file);
    }
    
    if (event.target) { 
        event.target.value = '';
    }
  };

  const handleSubjectInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, inputType: 'ca' | 'exam') => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (inputType === 'ca') {
        const examInput = document.getElementById(`exam_mark_input_${currentVisibleSubjectIndex}`);
        examInput?.focus();
      } else if (inputType === 'exam') {
        if (currentVisibleSubjectIndex < fields.length - 1) {
          const nextSubjectButton = document.getElementById('next_subject_button');
          nextSubjectButton?.focus();
        } else {
          const addSubjectButton = document.getElementById('add_subject_button_main');
          addSubjectButton?.focus();
        }
      }
    }
  };


  return (
    <>
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Edit3 className="h-6 w-6 text-primary" />
          <CardTitle className="font-headline text-2xl">Report Details</CardTitle>
        </div>
        <CardDescription>Enter student information, performance, and subject marks.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            <section className="space-y-6">
              <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Student &amp; School Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="studentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4" />Student Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Jane Doe" {...field} list="studentNameHistoryDatalist" />
                      </FormControl>
                      <datalist id="studentNameHistoryDatalist">
                        {studentNameHistory.map((name, index) => (
                          <option key={`history-${index}`} value={name} />
                        ))}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="className"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4" />Class Name</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === ADD_CUSTOM_CLASS_VALUE) {
                            setCustomClassNameInputValue('');
                            setIsCustomClassNameDialogOpen(true);
                          } else {
                            field.onChange(value);
                          }
                        }}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select or add class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classLevels.map((level) => (
                            <SelectItem key={`predefined-class-${level}`} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                          {customClassNames.map((name) => (
                            <SelectItem key={`custom-class-${name}`} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                          <SelectSeparator />
                          <SelectItem value={ADD_CUSTOM_CLASS_VALUE}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Class...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="selectedTemplateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><LayoutTemplate className="mr-2 h-4 w-4 text-primary" />Report Template</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'default'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {reportTemplateOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><VenetianMask className="mr-2 h-4 w-4" />Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genderOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schoolName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4" />School Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Springfield Elementary" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parentEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4" />Parent Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="e.g., parent@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parentPhoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4" />Parent Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="e.g., +1234567890 (for WhatsApp)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schoolLogoDataUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><ImageUp className="mr-2 h-4 w-4 text-primary" />School Logo</FormLabel>
                      <FormControl>
                        <div>
                          <input
                            type="file"
                            id="schoolLogoUpload"
                            className="hidden"
                            accept="image/png, image/jpeg, image/gif, image/svg+xml"
                            onChange={(e) => handleImageUpload(e, 'schoolLogoDataUri')}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('schoolLogoUpload')?.click()}>
                            <UploadCloud className="mr-2 h-4 w-4" /> Upload Logo
                          </Button>
                          {field.value && (
                            <div className="mt-2 flex items-center gap-2">
                              <NextImage
                                src={field.value}
                                alt="School logo preview"
                                width={60}
                                height={60}
                                className="rounded object-contain border bg-white p-1"
                                data-ai-hint="school logo"
                              />
                              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue('schoolLogoDataUri', undefined, { shouldDirty: true, shouldValidate: true })}>
                                <X className="mr-2 h-4 w-4 text-destructive" /> Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="academicYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>Academic Year</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 2023-2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="academicTerm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Type className="mr-2 h-4 w-4" />Academic Term</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select academic term" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {academicTermOptions.map((term) => (
                            <SelectItem key={term} value={term}>
                              {term}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="daysAttended"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><CalendarCheck2 className="mr-2 h-4 w-4" />Days Attended</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 85" {...field} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} value={field.value === null || field.value === undefined ? '' : String(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalSchoolDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4" />Total School Days</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 90" {...field} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} value={field.value === null || field.value === undefined ? '' : String(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {isPromotionStatusApplicable && (
                  <FormField
                    control={form.control}
                    name="promotionStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Medal className="mr-2 h-4 w-4" />Promotion Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select promotion status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {promotionStatusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="studentPhotoDataUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><ImageUp className="mr-2 h-4 w-4 text-primary" />Student Photo</FormLabel>
                      <FormControl>
                        <div>
                          <input
                            type="file"
                            id="studentPhotoUpload"
                            className="hidden"
                            accept="image/png, image/jpeg, image/gif, image/svg+xml"
                            onChange={(e) => handleImageUpload(e, 'studentPhotoDataUri')}
                          />
                           <div className="flex flex-wrap gap-2 items-start">
                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('studentPhotoUpload')?.click()}>
                              <UploadCloud className="mr-2 h-4 w-4" /> Upload Photo
                            </Button>
                            {field.value && (
                              <>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleAiEditImage(field.value!, "Adjust this image of a person to be a clear portrait, suitable for an ID photo or report card. The subject should be centered, well-proportioned (typically shoulders-up or headshot), and placed on a clean, plain white background. Ensure all original details of the person are retained.")}
                                  disabled={isImageEditingAiLoading}
                                >
                                  {isImageEditingAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4 animate-pulse" />}
                                  Enhance Portrait (AI)
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue('studentPhotoDataUri', undefined, { shouldDirty: true, shouldValidate: true })}>
                                  <X className="mr-2 h-4 w-4 text-destructive" /> Remove
                                </Button>
                              </>
                            )}
                          </div>
                          {field.value && (
                            <div className="mt-2">
                              <NextImage
                                src={field.value}
                                alt="Student photo preview"
                                width={80}
                                height={100}
                                className="rounded object-cover border"
                                data-ai-hint="student portrait"
                              />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="headMasterSignatureDataUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Signature className="mr-2 h-4 w-4 text-primary" />Head Master's Signature</FormLabel>
                      <FormControl>
                        <div>
                          <input
                            type="file"
                            id="headMasterSignatureUpload"
                            className="hidden"
                            accept="image/png, image/jpeg, image/gif, image/svg+xml"
                            onChange={(e) => handleImageUpload(e, 'headMasterSignatureDataUri')}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('headMasterSignatureUpload')?.click()}>
                            <UploadCloud className="mr-2 h-4 w-4" /> Upload Signature
                          </Button>
                          {field.value && (
                            <div className="mt-2 flex items-center gap-2">
                              <NextImage
                                src={field.value}
                                alt="Head Master's signature preview"
                                width={100} 
                                height={50} 
                                className="rounded object-contain border bg-white p-1"
                                data-ai-hint="signature"
                              />
                              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue('headMasterSignatureDataUri', undefined, { shouldDirty: true, shouldValidate: true })}>
                                <X className="mr-2 h-4 w-4 text-destructive" /> Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-6">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-lg font-medium text-primary">Subject Marks</h3>
              </div>
              
              <div className="flex items-center justify-between mt-2 mb-4">
                <Button
                  id="previous_subject_button"
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentVisibleSubjectIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentVisibleSubjectIndex === 0 || fields.length === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous Subject</span>
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  Subject {fields.length > 0 ? currentVisibleSubjectIndex + 1 : 0} of {fields.length}
                </span>
                <Button
                  id="next_subject_button"
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentVisibleSubjectIndex(prev => Math.min(fields.length - 1, prev + 1))}
                  disabled={currentVisibleSubjectIndex >= fields.length - 1 || fields.length === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next Subject</span>
                </Button>
              </div>

              {fields.length > 0 && fields[currentVisibleSubjectIndex] && (
                <div key={fields[currentVisibleSubjectIndex].id} className="space-y-4 p-4 border rounded-md shadow-sm bg-card/50">
                  <div className="grid grid-cols-1 md:grid-cols-[3fr_1.5fr_1.5fr] gap-4 items-start">
                    <FormField
                      control={form.control}
                      name={`subjects.${currentVisibleSubjectIndex}.subjectName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><BookOpenText className="mr-2 h-4 w-4 text-primary" />Subject Name</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              if (value === ADD_CUSTOM_SUBJECT_VALUE) {
                                setCurrentCustomSubjectTargetIndex(currentVisibleSubjectIndex);
                                setCustomSubjectInputValue('');
                                setIsCustomSubjectDialogOpen(true);
                              } else {
                                field.onChange(value); 

                                const currentFieldValue = value;
                                const nextSubjectToAutoPopulateIndex = currentVisibleSubjectIndex + 1;

                                if (currentFieldValue && currentFieldValue !== ADD_CUSTOM_SUBJECT_VALUE && fields[nextSubjectToAutoPopulateIndex]) {
                                    const nextSubjectFieldName = `subjects.${nextSubjectToAutoPopulateIndex}.subjectName` as const;
                                    const isNextSubjectFieldEmpty = !form.getValues(nextSubjectFieldName);

                                    if (isNextSubjectFieldEmpty) {
                                        const existingSubjectNamesInOtherSlots = form.getValues('subjects')
                                            .map((subjectField, i) => i === nextSubjectToAutoPopulateIndex ? null : subjectField.subjectName)
                                            .filter(Boolean) as string[];

                                        let subjectToSet: string | undefined = undefined;

                                        for (const predefinedSub of predefinedSubjectsList) {
                                            if (!existingSubjectNamesInOtherSlots.includes(predefinedSub)) {
                                                subjectToSet = predefinedSub;
                                                break;
                                            }
                                        }
                                        
                                        if (subjectToSet) {
                                            form.setValue(nextSubjectFieldName, subjectToSet, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                                        }
                                    }
                                }
                              }
                            }}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select or add subject" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {predefinedSubjectsList.map((subject) => (
                                <SelectItem key={`predefined-${subject}`} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))}
                              {customSubjects.map((subject) => (
                                <SelectItem key={`custom-${subject}`} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))}
                              <SelectSeparator />
                              <SelectItem value={ADD_CUSTOM_SUBJECT_VALUE}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add New Subject...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`subjects.${currentVisibleSubjectIndex}.continuousAssessment`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><ListChecks className="mr-2 h-4 w-4 text-primary" />CA Mark</FormLabel>
                           <FormControl>
                             <Input 
                               id={`ca_mark_input_${currentVisibleSubjectIndex}`}
                               type="number" 
                               placeholder="1-60" 
                               {...field} 
                               onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} 
                               value={field.value === null || field.value === undefined ? '' : String(field.value)}
                               onKeyDown={(e) => handleSubjectInputKeyDown(e, 'ca')}
                             />
                           </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`subjects.${currentVisibleSubjectIndex}.examinationMark`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><FileOutput className="mr-2 h-4 w-4 text-primary" />Exam Mark</FormLabel>
                          <FormControl>
                             <Input 
                               id={`exam_mark_input_${currentVisibleSubjectIndex}`}
                               type="number" 
                               placeholder="1-100" 
                               {...field} 
                               onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} 
                               value={field.value === null || field.value === undefined ? '' : String(field.value)}
                               onKeyDown={(e) => handleSubjectInputKeyDown(e, 'exam')}
                             />
                           </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                   <Button
                      id={`remove_current_subject_button_${currentVisibleSubjectIndex}`}
                      type="button"
                      variant="destructive"
                      onClick={handleRemoveCurrentSubject}
                      className="w-full mt-4"
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove Current Subject ({fields[currentVisibleSubjectIndex]?.subjectName || 'Unnamed'})
                    </Button>
                </div>
              )}
             
              <Button
                id="add_subject_button_main"
                type="button"
                variant="outline"
                onClick={handleAddSubjectAndNavigate}
                className="w-full"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Subject
              </Button>
              <FormMessage>{form.formState.errors.subjects?.root?.message || form.formState.errors.subjects?.message}</FormMessage>
            </section>

            <Separator />

            <section className="space-y-6">
               <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4 flex justify-between items-center">
                Overall Performance &amp; Feedback
                <Button
                    type="button"
                    onClick={handleGenerateAiReportInsights}
                    disabled={isReportInsightsAiLoading}
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                >
                    {isReportInsightsAiLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <Bot className="mr-2 h-4 w-4 animate-pulse" />
                    )}
                    Generate AI Insights
                </Button>
               </h3>
              <FormField
                control={form.control}
                name="performanceSummary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><ClipboardList className="mr-2 h-4 w-4 text-primary" />Performance Summary</FormLabel>
                    <FormControl>
                      <Textarea placeholder="AI-generated summary based on attendance and subject marks will appear here." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="strengths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><ThumbsUp className="mr-2 h-4 w-4 text-primary" />Strengths</FormLabel>
                      <FormControl>
                        <Textarea placeholder="AI-generated strengths will appear here." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="areasForImprovement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Activity className="mr-2 h-4 w-4 text-primary" />Areas for Improvement</FormLabel>
                      <FormControl>
                        <Textarea placeholder="AI-generated areas for improvement will appear here." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="hobbies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Smile className="mr-2 h-4 w-4 text-primary" />Hobbies / Co-curricular Activities (Optional)</FormLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="truncate max-w-[calc(100%-2rem)]">
                            {watchedHobbies.length > 0 ? watchedHobbies.join(', ') : "Select Hobbies"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                        <ScrollArea className="h-[200px]">
                          {predefinedHobbiesList.map((hobby) => (
                            <DropdownMenuCheckboxItem
                              key={hobby}
                              checked={watchedHobbies.includes(hobby)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                field.onChange(
                                  checked ? [...current, hobby] : current.filter((h) => h !== hobby)
                                );
                              }}
                            >
                              {hobby}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {customHobbies.length > 0 && <DropdownMenuSeparator />}
                          {customHobbies.map((hobby) => (
                             <DropdownMenuCheckboxItem
                              key={hobby}
                              checked={watchedHobbies.includes(hobby)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                field.onChange(
                                  checked ? [...current, hobby] : current.filter((h) => h !== hobby)
                                );
                              }}
                            >
                              {hobby}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </ScrollArea>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => {
                          setCustomHobbyInputValue('');
                          setIsCustomHobbyDialogOpen(true);
                        }}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New Hobby...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teacherFeedback"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center mb-1">
                      <FormLabel className="flex items-center"><Sparkles className="mr-2 h-4 w-4 text-accent animate-pulse" />Teacher's Feedback (Optional)</FormLabel>
                      <Button
                        type="button"
                        onClick={handleGenerateAiTeacherFeedback}
                        disabled={isTeacherFeedbackAiLoading || !form.getValues().performanceSummary || !form.getValues().strengths || !form.getValues().areasForImprovement}
                        variant="outline"
                        size="sm"
                      >
                        {isTeacherFeedbackAiLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4 animate-pulse" />
                        )}
                        Generate AI Feedback
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea placeholder="AI-generated teacher feedback will appear here, or write your own. You can edit it as needed." {...field} rows={4} className="border-accent focus:ring-accent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="instructorContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Instructor's Contact (Email/Phone - Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., teacher@example.com or 555-1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || isReportInsightsAiLoading || isTeacherFeedbackAiLoading || isImageEditingAiLoading }>
              <CheckSquare className="mr-2 h-4 w-4" /> Update Preview
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>

    <Dialog open={isCustomSubjectDialogOpen} onOpenChange={setIsCustomSubjectDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Subject</DialogTitle>
          <DialogDescription>
            Enter the name of the new subject. It will be added to your list for future use in this session.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="customSubjectNameInput" className="text-right">
              Name
            </Label>
            <Input
              id="customSubjectNameInput"
              value={customSubjectInputValue}
              onChange={(e) => setCustomSubjectInputValue(e.target.value)}
              placeholder="e.g., Advanced History"
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCustomSubjectDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCustomSubjectToListAndForm}>Add Subject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isCustomClassNameDialogOpen} onOpenChange={setIsCustomClassNameDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Class Name</DialogTitle>
          <DialogDescription>
            Enter the name of the new class. It will be added to your list for future use in this session.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="customClassNameInput" className="text-right">
              Name
            </Label>
            <Input
              id="customClassNameInput"
              value={customClassNameInputValue}
              onChange={(e) => setCustomClassNameInputValue(e.target.value)}
              placeholder="e.g., Form 1 Gold"
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCustomClassNameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCustomClassNameToListAndForm}>Add Class</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isCustomHobbyDialogOpen} onOpenChange={setIsCustomHobbyDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Hobby</DialogTitle>
          <DialogDescription>
            Enter the name of the new hobby. It will be added to your list for future use in this session.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="customHobbyNameInput" className="text-right">
              Name
            </Label>
            <Input
              id="customHobbyNameInput"
              value={customHobbyInputValue}
              onChange={(e) => setCustomHobbyInputValue(e.target.value)}
              placeholder="e.g., Chess Club"
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCustomHobbyDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCustomHobbyToListAndForm}>Add Hobby</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

    