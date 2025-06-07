'use client';

import type {ReportData} from '@/lib/schemas';
import {ReportDataSchema} from '@/lib/schemas';
import {zodResolver} from '@hookform/resolvers/zod';
import {useForm, type SubmitHandler} from 'react-hook-form';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {getAiFeedbackAction} from '@/app/actions';
import {useState, useTransition} from 'react';
import {Loader2, Sparkles, Wand2, User, Users, ClipboardList, ThumbsUp, Activity, CheckSquare} from 'lucide-react';
import {useToast} from '@/hooks/use-toast';

interface ReportFormProps {
  onFormUpdate: (data: ReportData) => void;
  initialData?: Partial<ReportData>;
}

export default function ReportForm({ onFormUpdate, initialData }: ReportFormProps) {
  const [isAiLoading, startAiTransition] = useTransition();
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
    },
  });

  const handleGenerateAiFeedback = async () => {
    const { studentName, className, performanceSummary, strengths, areasForImprovement } = form.getValues();
    if (!studentName || !className || !performanceSummary || !strengths || !areasForImprovement) {
      toast({
        title: "Missing Information",
        description: "Please fill in student name, class name, performance summary, strengths, and areas for improvement before generating AI feedback.",
        variant: "destructive",
      });
      // Trigger validation for relevant fields
      form.trigger(['studentName', 'className', 'performanceSummary', 'strengths', 'areasForImprovement']);
      return;
    }

    startAiTransition(async () => {
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
            title: "AI Feedback Generated",
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
        <CardTitle className="font-headline text-2xl">Student & Class Details</CardTitle>
        <CardDescription>Enter the student's information and performance details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="studentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" />Student Name</FormLabel>
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
                    <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-primary" />Class Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Grade 5 Math" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="schoolName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4 text-primary"><path d="M14 22v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4"/><path d="M18 10H6"/><path d="M18 18H6"/><path d="M10 6L12 4l2 2"/><path d="M12 10V4"/></svg>School Name</FormLabel>
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
                    <FormLabel className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4 text-primary"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>Academic Year</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2023-2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="performanceSummary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><ClipboardList className="mr-2 h-4 w-4 text-primary" />Performance Summary</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the student's overall performance..." {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <FormField
              control={form.control}
              name="teacherFeedback"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel className="flex items-center"><Sparkles className="mr-2 h-4 w-4 text-accent" />Teacher's Feedback</FormLabel>
                    <Button
                      type="button"
                      onClick={handleGenerateAiFeedback}
                      disabled={isAiLoading}
                      variant="outline"
                      size="sm"
                    >
                      {isAiLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      Generate AI Feedback
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea placeholder="AI-generated feedback will appear here. You can edit it as needed." {...field} rows={5} className="mt-1 border-accent focus:ring-accent" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              <CheckSquare className="mr-2 h-4 w-4" /> Update Preview
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
