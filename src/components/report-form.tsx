
'use client';

import type {ReportData, SubjectEntry} from '@/lib/schemas';
import {ReportDataSchema}from '@/lib/schemas';
import {zodResolver}from '@hookform/resolvers/zod';
import {useForm, type SubmitHandler, useFieldArray} from 'react-hook-form';
import {Button}from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle}from '@/components/ui/card';
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage}from '@/components/ui/form';
import {Input}from '@/components/ui/input';
import {Textarea}from '@/components/ui/textarea';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator}from '@/components/ui/select';
import {getAiFeedbackAction, getAiReportInsightsAction}from '@/app/actions';
import React, {useState, useTransition, useEffect} from 'react'; // Added React import
import {Loader2, Sparkles, Wand2, User, Users, ClipboardList, ThumbsUp, Activity, CheckSquare, BookOpenText, ListChecks, FileOutput, PlusCircle, Trash2, Edit3, Bot, CalendarCheck2, CalendarDays, VenetianMask, Type, Medal } from 'lucide-react';
import {useToast}from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';


interface ReportFormProps {
  onFormUpdate: (data: ReportData) => void;
  initialData?: Partial<ReportData>;
  reportPrintListForHistory?: ReportData[]; // For student name history
}

const NONE_VALUE_KEY = "--none--";
const ADD_CUSTOM_SUBJECT_VALUE = "--add-custom--";

const classLevels = [
  "KG1", "KG2",
  "BASIC 1", "BASIC 2", "BASIC 3", "BASIC 4", "BASIC 5", "BASIC 6",
  "JHS1", "JHS2", "JHS3",
  "SHS1", "SHS2", "SHS3",
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

export default function ReportForm({ onFormUpdate, initialData, reportPrintListForHistory }: ReportFormProps) {
  const [isTeacherFeedbackAiLoading, startTeacherFeedbackAiTransition] = useTransition();
  const [isReportInsightsAiLoading, startReportInsightsAiTransition] = useTransition();
  const { toast } = useToast();

  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [isCustomSubjectDialogOpen, setIsCustomSubjectDialogOpen] = useState(false);
  const [customSubjectInputValue, setCustomSubjectInputValue] = useState('');
  const [currentCustomSubjectIndex, setCurrentCustomSubjectIndex] = useState<number | null>(null);

  const studentNameHistory = React.useMemo(() => {
    if (!reportPrintListForHistory) return [];
    const names = reportPrintListForHistory.map(report => report.studentName).filter(Boolean);
    return [...new Set(names)]; // Unique names
  }, [reportPrintListForHistory]);


  const form = useForm<ReportData>({
    resolver: zodResolver(ReportDataSchema),
    defaultValues: {
      studentName: initialData?.studentName || '',
      className: initialData?.className || '',
      gender: initialData?.gender || '',
      schoolName: initialData?.schoolName || 'Springfield Elementary',
      academicYear: initialData?.academicYear || '2023-2024',
      academicTerm: initialData?.academicTerm || 'First Term',
      daysAttended: initialData?.daysAttended || null,
      totalSchoolDays: initialData?.totalSchoolDays || null,
      performanceSummary: initialData?.performanceSummary || '',
      strengths: initialData?.strengths || '',
      areasForImprovement: initialData?.areasForImprovement || '',
      teacherFeedback: initialData?.teacherFeedback || '',
      subjects: initialData?.subjects?.length ? initialData.subjects as SubjectEntry[] : [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
      studentEntryNumber: initialData?.studentEntryNumber || undefined,
      promotionStatus: initialData?.promotionStatus || undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subjects"
  });

  const watchedAcademicTerm = form.watch('academicTerm');

  useEffect(() => {
    if (initialData) {
      form.reset({
        studentName: initialData.studentName || '',
        className: initialData.className || '',
        gender: initialData.gender || '',
        schoolName: initialData.schoolName || 'Springfield Elementary',
        academicYear: initialData.academicYear || '2023-2024',
        academicTerm: initialData.academicTerm || 'First Term',
        daysAttended: initialData.daysAttended === undefined ? null : initialData.daysAttended,
        totalSchoolDays: initialData.totalSchoolDays === undefined ? null : initialData.totalSchoolDays,
        performanceSummary: initialData.performanceSummary || '',
        strengths: initialData.strengths || '',
        areasForImprovement: initialData.areasForImprovement || '',
        teacherFeedback: initialData.teacherFeedback || '',
        subjects: initialData.subjects?.length ? initialData.subjects as SubjectEntry[] : [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
        studentEntryNumber: initialData.studentEntryNumber || undefined,
        promotionStatus: initialData.promotionStatus || undefined,
      });
    }
  }, [initialData, form.reset]);

  useEffect(() => {
    if (watchedAcademicTerm !== 'Third Term') {
      form.setValue('promotionStatus', undefined);
    }
  }, [watchedAcademicTerm, form]);


  const handleAddCustomSubjectToListAndForm = () => {
    if (customSubjectInputValue.trim() === '') {
      toast({
        title: "Invalid Subject Name",
        description: "Custom subject name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (currentCustomSubjectIndex !== null) {
      const newSubjectName = customSubjectInputValue.trim();
      form.setValue(`subjects.${currentCustomSubjectIndex}.subjectName`, newSubjectName);

      if (!predefinedSubjectsList.includes(newSubjectName) && !customSubjects.includes(newSubjectName)) {
        setCustomSubjects(prev => [...prev, newSubjectName]);
      }

      toast({
        title: "Custom Subject Added",
        description: `"${newSubjectName}" has been set for the current subject entry and added to your session list.`,
      });
      setIsCustomSubjectDialogOpen(false);
      setCustomSubjectInputValue('');
      setCurrentCustomSubjectIndex(null);
    }
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
        const formattedSubjects = subjects.map(s => ({
            ...s,
            continuousAssessment: s.continuousAssessment ? Number(s.continuousAssessment) : null,
            examinationMark: s.examinationMark ? Number(s.examinationMark) : null,
        }));

        const result = await getAiReportInsightsAction({
          studentName,
          className,
          daysAttended: daysAttended ? Number(daysAttended) : null,
          totalSchoolDays: totalSchoolDays ? Number(totalSchoolDays) : null,
          subjects: formattedSubjects,
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
            title: "Error Generating Insights",
            description: "An unexpected error occurred while generating the insights.",
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

  const onSubmit: SubmitHandler<ReportData> = (data) => {
    const processedData = {
      ...data,
      daysAttended: data.daysAttended === '' || data.daysAttended === undefined ? null : Number(data.daysAttended),
      totalSchoolDays: data.totalSchoolDays === '' || data.totalSchoolDays === undefined ? null : Number(data.totalSchoolDays),
      subjects: data.subjects.map(s => ({
        ...s,
        continuousAssessment: s.continuousAssessment === undefined ? null : s.continuousAssessment,
        examinationMark: s.examinationMark === undefined ? null : s.examinationMark,
      })),
      promotionStatus: watchedAcademicTerm === 'Third Term' ? data.promotionStatus : undefined,
    };
    onFormUpdate(processedData);
     toast({
        title: "Preview Updated",
        description: "The report preview has been updated with the latest information.",
      });
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
              <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Student & School Information</h3>
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
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
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
                      <FormLabel className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M14 22v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4"/><path d="M18 10H6"/><path d="M18 18H6"/><path d="M10 6L12 4l2 2"/><path d="M12 10V4"/></svg>School Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Springfield Elementary" {...field} />
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
                 {watchedAcademicTerm === 'Third Term' && (
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
              </div>
            </section>

            <Separator />

            <section className="space-y-6">
              <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Subject Marks</h3>
              {fields.map((item, index) => (
                <div key={item.id} className="space-y-4 p-4 border rounded-md shadow-sm bg-card/50">
                  <div className="grid grid-cols-1 md:grid-cols-[3fr_1.5fr_1.5fr_auto] gap-4 items-start">
                    <FormField
                      control={form.control}
                      name={`subjects.${index}.subjectName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><BookOpenText className="mr-2 h-4 w-4 text-primary" />Subject Name</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              if (value === ADD_CUSTOM_SUBJECT_VALUE) {
                                setCurrentCustomSubjectIndex(index);
                                setCustomSubjectInputValue('');
                                setIsCustomSubjectDialogOpen(true);
                              } else {
                                field.onChange(value);
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
                                  {subject} (Custom)
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
                      name={`subjects.${index}.continuousAssessment`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><ListChecks className="mr-2 h-4 w-4 text-primary" />CA Mark (1-60)</FormLabel>
                           <Select
                              onValueChange={(value) => field.onChange(value === NONE_VALUE_KEY ? null : (value ? parseInt(value, 10) : null) )}
                              value={field.value === null || field.value === undefined ? NONE_VALUE_KEY : String(field.value)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select CA Mark" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE_VALUE_KEY}><em>None</em></SelectItem>
                                {Array.from({ length: 60 }, (_, i) => i + 1).map((val) => (
                                  <SelectItem key={`ca-${val}`} value={String(val)}>
                                    {val}
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
                      name={`subjects.${index}.examinationMark`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><FileOutput className="mr-2 h-4 w-4 text-primary" />Exam Mark (1-100)</FormLabel>
                          <Select
                              onValueChange={(value) => field.onChange(value === NONE_VALUE_KEY ? null : (value ? parseInt(value, 10) : null) )}
                              value={field.value === null || field.value === undefined ? NONE_VALUE_KEY : String(field.value)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Exam Mark" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                 <SelectItem value={NONE_VALUE_KEY}><em>None</em></SelectItem>
                                {Array.from({ length: 100 }, (_, i) => i + 1).map((val) => (
                                  <SelectItem key={`exam-${val}`} value={String(val)}>
                                    {val}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fields.length > 1 ? remove(index) : toast({ title: "Cannot Remove", description: "At least one subject is required.", variant: "destructive"})}
                      className="mt-auto text-destructive hover:bg-destructive/10 self-center"
                      aria-label="Remove subject"
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ subjectName: '', continuousAssessment: null, examinationMark: null })}
                className="w-full"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Subject
              </Button>
              <FormMessage>{form.formState.errors.subjects?.root?.message || form.formState.errors.subjects?.message}</FormMessage>
            </section>

            <Separator />

            <section className="space-y-6">
               <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4 flex justify-between items-center">
                Overall Performance & Feedback
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
                    <Bot className="mr-2 h-4 w-4" />
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
                name="teacherFeedback"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center mb-1">
                      <FormLabel className="flex items-center"><Sparkles className="mr-2 h-4 w-4 text-accent" />Teacher's Feedback (Optional)</FormLabel>
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
                          <Wand2 className="mr-2 h-4 w-4" />
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
            </section>

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || isReportInsightsAiLoading || isTeacherFeedbackAiLoading}>
              <CheckSquare className="mr-2 h-4 w-4" /> Update Preview
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>

    <Dialog open={isCustomSubjectDialogOpen} onOpenChange={setIsCustomSubjectDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Custom Subject</DialogTitle>
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
    </>
  );
}

