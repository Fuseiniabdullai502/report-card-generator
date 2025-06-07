
'use client';

import type {ReportData, SubjectEntry} from '@/lib/schemas';
import {ReportDataSchema} from '@/lib/schemas';
import {zodResolver} from '@hookform/resolvers/zod';
import {useForm, type SubmitHandler, useFieldArray} from 'react-hook-form';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {getAiFeedbackAction, getAiPerformanceSummaryAction} from '@/app/actions';
import {useState, useTransition} from 'react';
import {Loader2, Sparkles, Wand2, User, Users, ClipboardList, ThumbsUp, Activity, CheckSquare, BookOpenText, ListChecks, FileOutput, PlusCircle, Trash2, Edit3, Bot } from 'lucide-react';
import {useToast} from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface ReportFormProps {
  onFormUpdate: (data: ReportData) => void;
  initialData?: Partial<ReportData>;
}

const NONE_VALUE_KEY = "--none--";

const classLevels = [
  "KG1", "KG2",
  "BASIC 1", "BASIC 2", "BASIC 3", "BASIC 4", "BASIC 5", "BASIC 6",
  "JHS1", "JHS2", "JHS3",
  "SHS1", "SHS2", "SHS3",
  "LEVEL 100", "LEVEL 200", "LEVEL 300", "LEVEL 400", "LEVEL 500", "LEVEL 600", "LEVEL 700"
];

export default function ReportForm({ onFormUpdate, initialData }: ReportFormProps) {
  const [isTeacherFeedbackAiLoading, startTeacherFeedbackAiTransition] = useTransition();
  const [isPerformanceSummaryAiLoading, startPerformanceSummaryAiTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<ReportData>({
    resolver: zodResolver(ReportDataSchema),
    defaultValues: {
      studentName: initialData?.studentName || '',
      className: initialData?.className || '',
      schoolName: initialData?.schoolName || 'Springfield Elementary',
      academicYear: initialData?.academicYear || '2023-2024',
      performanceSummary: initialData?.performanceSummary || '',
      strengths: initialData?.strengths || '',
      areasForImprovement: initialData?.areasForImprovement || '',
      teacherFeedback: initialData?.teacherFeedback || '',
      subjects: initialData?.subjects?.length ? initialData.subjects as SubjectEntry[] : [{ subjectName: '', continuousAssessment: null, examinationMark: null }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subjects"
  });

  const handleGenerateAiPerformanceSummary = async () => {
    const { studentName, className, subjects } = form.getValues();
    if (!studentName || !className || !subjects || subjects.some(s => !s.subjectName)) {
      toast({
        title: "Missing Information",
        description: "Please fill in student name, class name, and ensure all subjects have names before generating AI performance summary.",
        variant: "destructive",
      });
      form.trigger(['studentName', 'className', 'subjects']);
      return;
    }

    startPerformanceSummaryAiTransition(async () => {
      try {
        // Ensure subject marks are numbers or null
        const formattedSubjects = subjects.map(s => ({
            ...s,
            continuousAssessment: s.continuousAssessment ? Number(s.continuousAssessment) : null,
            examinationMark: s.examinationMark ? Number(s.examinationMark) : null,
        }));

        const result = await getAiPerformanceSummaryAction({
          studentName,
          className,
          subjects: formattedSubjects,
        });

        if (result.success && result.performanceSummary) {
          form.setValue('performanceSummary', result.performanceSummary);
          toast({
            title: "AI Performance Summary Generated",
            description: "The performance summary has been populated.",
            variant: "default",
          });
        } else {
          toast({
            title: "Error Generating Summary",
            description: result.error || "An unknown error occurred.",
            variant: "destructive",
          });
        }
      } catch (error) {
         toast({
            title: "Error Generating Summary",
            description: "An unexpected error occurred while generating the summary.",
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
    onFormUpdate(data);
     toast({
        title: "Preview Updated",
        description: "The report preview has been updated with the latest information.",
      });
  };

  return (
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
                        <Input placeholder="e.g., Jane Doe" {...field} />
                      </FormControl>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                          <FormControl>
                            <Input placeholder="e.g., Mathematics" {...field} />
                          </FormControl>
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
                              value={field.value === null ? NONE_VALUE_KEY : (field.value !== undefined ? String(field.value) : undefined)}
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
                              value={field.value === null ? NONE_VALUE_KEY : (field.value !== undefined ? String(field.value) : undefined)}
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
               <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Overall Performance & Feedback</h3>
              <FormField
                control={form.control}
                name="performanceSummary"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center mb-1">
                        <FormLabel className="flex items-center"><ClipboardList className="mr-2 h-4 w-4 text-primary" />Performance Summary</FormLabel>
                        <Button
                            type="button"
                            onClick={handleGenerateAiPerformanceSummary}
                            disabled={isPerformanceSummaryAiLoading}
                            variant="outline"
                            size="sm"
                        >
                            {isPerformanceSummaryAiLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                            <Bot className="mr-2 h-4 w-4" />
                            )}
                            Generate Summary with AI
                        </Button>
                    </div>
                    <FormControl>
                      <Textarea placeholder="Describe the student's overall performance, or generate one with AI using subject marks." {...field} rows={3} />
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
                        <Textarea placeholder="List the student's key strengths..." {...field} rows={3} />
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
                        <Textarea placeholder="Identify areas where the student can improve..." {...field} rows={3} />
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
                        disabled={isTeacherFeedbackAiLoading}
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
                      <Textarea placeholder="AI-generated feedback will appear here, or write your own. You can edit it as needed." {...field} rows={4} className="border-accent focus:ring-accent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
            
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || isPerformanceSummaryAiLoading || isTeacherFeedbackAiLoading}>
              <CheckSquare className="mr-2 h-4 w-4" /> Update Preview
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

