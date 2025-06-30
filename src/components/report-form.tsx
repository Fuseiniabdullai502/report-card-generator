
'use client';

import { type ReportData, type SubjectEntry, ReportDataSchema } from '@/lib/schemas';
import React, { useState, useTransition, useEffect, useMemo, ChangeEvent, FormEvent } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAiFeedbackAction, getAiReportInsightsAction, editImageWithAiAction } from '@/app/actions';
import type { GenerateReportInsightsInput } from '@/ai/flows/generate-performance-summary';
import { Loader2, Sparkles, Wand2, User, Users, ClipboardList, ThumbsUp, Activity, CheckSquare, BookOpenText, ListChecks, FileOutput, PlusCircle, Trash2, Edit3, Bot, CalendarCheck2, CalendarDays, VenetianMask, Type, Medal, ImageUp, UploadCloud, X, Phone, ChevronLeft, ChevronRight, Signature, Building, Smile, ChevronDown, Mail, History, ListPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calculateOverallAverage } from '@/lib/calculations';

interface ReportFormProps {
  onFormUpdate: (data: ReportData) => void;
  initialData: ReportData;
  reportPrintListForHistory?: ReportData[];
  onSaveReport: (data: ReportData) => Promise<void>;
  onResetForm: () => void;
}

export const STUDENT_PROFILES_STORAGE_KEY = 'studentProfilesReportCardApp_v1';

const ADD_CUSTOM_SUBJECT_VALUE = "--add-custom-subject--";
const ADD_CUSTOM_HOBBY_VALUE = "--add-custom-hobby--";

const tertiaryLevelClasses = ["Level 100", "Level 200", "Level 300", "Level 400", "Level 500", "Level 600", "Level 700"];
const genderOptions = ["Male", "Female"];
const promotionStatusOptions = ["Promoted", "Repeated", "Graduated", "Under Review"];
const predefinedSubjectsList = ["Mathematics", "English Language", "Science", "Computing", "Religious and Moral Education", "Creative Arts", "Geography", "Economics", "Biology", "Elective Mathematics"];
const predefinedHobbiesList = ["Reading", "Sports (General)", "Music", "Art & Craft", "Debating", "Coding/Programming", "Gardening", "Volunteering", "Cooking/Baking", "Drama/Theater"];

export default function ReportForm({ onFormUpdate, initialData, reportPrintListForHistory, onSaveReport, onResetForm }: ReportFormProps) {
  const [formData, setFormData] = useState<ReportData>(initialData);
  const [isTeacherFeedbackAiLoading, startTeacherFeedbackAiTransition] = useTransition();
  const [isReportInsightsAiLoading, startReportInsightsAiTransition] = useTransition();
  const [isImageEditingAiLoading, startImageEditingAiTransition] = useTransition();
  const { toast } = useToast();

  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [isCustomSubjectDialogOpen, setIsCustomSubjectDialogOpen] = useState(false);
  const [customSubjectInputValue, setCustomSubjectInputValue] = useState('');
  const [currentCustomSubjectTargetIndex, setCurrentCustomSubjectTargetIndex] = useState<number | null>(null);

  const [customHobbies, setCustomHobbies] = useState<string[]>([]);
  const [isCustomHobbyDialogOpen, setIsCustomHobbyDialogOpen] = useState(false);
  const [customHobbyInputValue, setCustomHobbyInputValue] = useState('');

  const [currentVisibleSubjectIndex, setCurrentVisibleSubjectIndex] = useState(0);

  useEffect(() => {
    // Only reset the form state if the ID of the initial data changes.
    // This prevents resets on every keystroke from the parent.
    if (initialData.id !== formData.id) {
        setFormData(initialData);
        setCurrentVisibleSubjectIndex(0); // Reset the subject pager to the first subject
    }
  }, [initialData, formData.id]);


  useEffect(() => {
    onFormUpdate(formData);
  }, [formData, onFormUpdate]);
  
  const studentNameHistory = React.useMemo(() => {
    const namesFromList = reportPrintListForHistory?.map(report => report.studentName).filter(Boolean) || [];
    let namesFromStorage: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
        if (storedProfilesRaw) {
          const profiles: Record<string, { studentName: string }> = JSON.parse(storedProfilesRaw);
          namesFromStorage = Object.values(profiles).map(p => p.studentName);
        }
      } catch (e) {
        console.error("Error reading student names from localStorage for history:", e);
      }
    }
    return [...new Set([...namesFromList, ...namesFromStorage])];
  }, [reportPrintListForHistory]);

  const isPromotionStatusApplicable = React.useMemo(() => {
    if (!formData.academicTerm || !formData.className) return false;
    return formData.academicTerm === 'Third Term' && !tertiaryLevelClasses.includes(formData.className);
  }, [formData.academicTerm, formData.className]);

  useEffect(() => {
    if (isPromotionStatusApplicable) {
      const overallAverage = calculateOverallAverage(formData.subjects);

      if (overallAverage !== null) {
        const newPromotionStatus = overallAverage >= 50 ? 'Promoted' : 'Repeated';
        if (formData.promotionStatus !== newPromotionStatus) {
            setFormData(prev => ({ ...prev, promotionStatus: newPromotionStatus }));
        }
      }
    }
  }, [isPromotionStatusApplicable, formData.subjects, formData.promotionStatus]);
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: keyof ReportData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubjectChange = (index: number, field: keyof SubjectEntry, value: string | number | null) => {
    const updatedSubjects = [...formData.subjects];
    updatedSubjects[index] = { ...updatedSubjects[index], [field]: value };
    setFormData(prev => ({ ...prev, subjects: updatedSubjects }));
  };

  const addSubject = () => {
    const newSubjects = [...formData.subjects, { subjectName: '', continuousAssessment: null, examinationMark: null }];
    setFormData(prev => ({ ...prev, subjects: newSubjects }));
    setCurrentVisibleSubjectIndex(newSubjects.length - 1);
  };
  
  const removeSubject = (index: number) => {
    if (formData.subjects.length <= 1) {
       toast({ title: "Cannot Remove", description: "At least one subject is required.", variant: "destructive" });
      return;
    }
    const updatedSubjects = formData.subjects.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, subjects: updatedSubjects }));
     if (currentVisibleSubjectIndex >= updatedSubjects.length && updatedSubjects.length > 0) {
        setCurrentVisibleSubjectIndex(updatedSubjects.length - 1);
    }
  };

  const handleHobbyChange = (hobby: string, checked: boolean) => {
      const currentHobbies = formData.hobbies || [];
      const newHobbies = checked
          ? [...currentHobbies, hobby]
          : currentHobbies.filter(h => h !== hobby);
      setFormData(prev => ({ ...prev, hobbies: newHobbies }));
  };

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: keyof Pick<ReportData, 'studentPhotoDataUri'>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const originalDataUri = reader.result as string;
        setFormData(prev => ({...prev, [fieldName]: originalDataUri}));
        toast({ title: "Image Uploaded", description: `Student photo uploaded successfully.` });
      };
      reader.readAsDataURL(file);
    }
    if(event.target) event.target.value = '';
  };
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validation = ReportDataSchema.safeParse(formData);
    if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
            title: `Validation Error: ${firstError.path.join('.') || 'general'}`,
            description: firstError.message,
            variant: "destructive",
        });
        return;
    }
    onSaveReport(validation.data);
  };

  // AI Function Handlers
  const handleGenerateAiReportInsights = async () => {
    const { studentName, className, subjects, daysAttended, totalSchoolDays, academicTerm } = formData;
    if (!studentName || !className || !academicTerm || !subjects || subjects.some(s => !s.subjectName)) {
      toast({ title: "Missing Information", description: "Please fill student name, class, term, and subject names.", variant: "destructive" });
      return;
    }

    let previousTermsDataForAI: GenerateReportInsightsInput['previousTermsData'] = [];
    if (reportPrintListForHistory && reportPrintListForHistory.length > 0) {
      previousTermsDataForAI = reportPrintListForHistory
        .filter(report => 
          report.studentName?.trim().toLowerCase() === formData.studentName?.trim().toLowerCase() && 
          report.academicTerm !== formData.academicTerm
        )
        .map(report => ({
          termName: report.academicTerm || 'Unknown Term',
          subjects: report.subjects.map(s => ({
            subjectName: s.subjectName,
            continuousAssessment: s.continuousAssessment,
            examinationMark: s.examinationMark,
          })),
          overallAverage: report.overallAverage ?? null,
        }));
    }

    startReportInsightsAiTransition(async () => {
       const aiInput: GenerateReportInsightsInput = {
          studentName, className, currentAcademicTerm: academicTerm,
          daysAttended: daysAttended === null ? null : Number(daysAttended),
          totalSchoolDays: totalSchoolDays === null ? null : Number(totalSchoolDays),
          subjects: subjects.map(s => ({ subjectName: s.subjectName, continuousAssessment: s.continuousAssessment, examinationMark: s.examinationMark })),
          previousTermsData: previousTermsDataForAI!.length > 0 ? previousTermsDataForAI : undefined,
       };
       const result = await getAiReportInsightsAction(aiInput);
       if (result.success && result.insights) {
          setFormData(prev => ({ ...prev, ...result.insights }));
          toast({ title: "AI Insights Generated", description: "Performance summary updated with term-over-term comparison." });
       } else {
          toast({ title: "Error Generating Insights", description: result.error || "Unknown error.", variant: "destructive" });
       }
    });
  };

  const handleGenerateAiTeacherFeedback = async () => {
    const { studentName, className, performanceSummary, strengths, areasForImprovement } = formData;
    if (!studentName || !className || !performanceSummary || !strengths || !areasForImprovement) {
      toast({ title: "Missing Information", description: "Please fill core performance fields first.", variant: "destructive" });
      return;
    }
    startTeacherFeedbackAiTransition(async () => {
       const result = await getAiFeedbackAction({ studentName, className, performanceSummary, strengths, areasForImprovement });
       if (result.success && result.feedback) {
          setFormData(prev => ({ ...prev, teacherFeedback: result.feedback }));
          toast({ title: "AI Feedback Generated" });
       } else {
          toast({ title: "Error Generating Feedback", description: result.error || "Unknown error.", variant: "destructive" });
       }
    });
  };
  
  const handleAiEditImage = async (photoDataUri: string, editPrompt: string) => {
    if (!photoDataUri) return;
    startImageEditingAiTransition(async () => {
       const result = await editImageWithAiAction({ photoDataUri, prompt: editPrompt });
       if (result.success && result.editedPhotoDataUri) {
          setFormData(prev => ({ ...prev, studentPhotoDataUri: result.editedPhotoDataUri }));
          toast({ title: "AI Image Edit Successful" });
       } else {
          toast({ title: "AI Image Edit Failed", description: result.error || "Unknown error.", variant: "destructive" });
       }
    });
  };
  
  // Custom subject/class/hobby handlers
  const handleAddCustomSubjectToListAndForm = () => {
      if (customSubjectInputValue.trim() === '') return;
      if (currentCustomSubjectTargetIndex !== null) {
          const newSubjectName = customSubjectInputValue.trim();
          handleSubjectChange(currentCustomSubjectTargetIndex, 'subjectName', newSubjectName);
          if (!predefinedSubjectsList.includes(newSubjectName) && !customSubjects.includes(newSubjectName)) {
              setCustomSubjects(prev => [...new Set([...prev, newSubjectName])]);
          }
          setIsCustomSubjectDialogOpen(false);
      }
  };

  const handleAddCustomHobbyToListAndForm = () => {
      const newHobby = customHobbyInputValue.trim();
      if (newHobby === '') return;
      handleHobbyChange(newHobby, true);
      if (!predefinedHobbiesList.includes(newHobby) && !customHobbies.includes(newHobby)) {
          setCustomHobbies(prev => [...new Set([...prev, newHobby])]);
      }
      setIsCustomHobbyDialogOpen(false);
  };
  

  return (
    <>
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Edit3 className="h-6 w-6 text-primary" />
          <CardTitle className="font-headline text-2xl">
            Report Details (Entry #{formData.studentEntryNumber})
          </CardTitle>
        </div>
        <CardDescription>Enter student information, performance, and subject marks for class: <span className="font-semibold text-primary">{formData.className || "N/A"}</span></CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
            <section className="space-y-6">
              <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Student Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Student Name */}
                <div className="space-y-2">
                  <Label htmlFor="studentName" className="flex items-center"><User className="mr-2 h-4 w-4" />Student Name</Label>
                  <Input id="studentName" name="studentName" value={formData.studentName || ''} onChange={handleInputChange} placeholder="e.g., Jane Doe" list="studentNameHistoryDatalist" />
                   <datalist id="studentNameHistoryDatalist">
                    {studentNameHistory.map((name, index) => <option key={`history-${index}`} value={name} />)}
                  </datalist>
                </div>
                {/* Gender */}
                <div className="space-y-2">
                    <Label className="flex items-center"><VenetianMask className="mr-2 h-4 w-4" />Gender</Label>
                    <Select value={formData.gender || ''} onValueChange={value => handleSelectChange('gender', value)}>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                            {genderOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="parentEmail" className="flex items-center"><Mail className="mr-2 h-4 w-4" />Parent Email</Label>
                    <Input id="parentEmail" name="parentEmail" type="email" value={formData.parentEmail || ''} onChange={handleInputChange} placeholder="e.g., parent@example.com" />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="parentPhoneNumber" className="flex items-center"><Phone className="mr-2 h-4 w-4" />Parent Phone Number</Label>
                    <Input id="parentPhoneNumber" name="parentPhoneNumber" type="tel" value={formData.parentPhoneNumber || ''} onChange={handleInputChange} placeholder="e.g., +1234567890 (for WhatsApp)" />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="daysAttended" className="flex items-center"><CalendarCheck2 className="mr-2 h-4 w-4" />Days Attended</Label>
                    <Input id="daysAttended" name="daysAttended" type="number" value={formData.daysAttended ?? ''} onChange={handleInputChange} placeholder="e.g., 85" />
                 </div>
                 <div className="space-y-2">
                    <Label className="flex items-center"><Smile className="mr-2 h-4 w-4"/>Hobbies</Label>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between">
                                <span className="truncate">{formData.hobbies?.join(', ') || 'Select Hobbies'}</span><ChevronDown/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                            <ScrollArea className="h-[200px]">
                            {predefinedHobbiesList.map(hobby => <DropdownMenuCheckboxItem key={hobby} checked={formData.hobbies?.includes(hobby)} onCheckedChange={checked => handleHobbyChange(hobby, checked)}>{hobby}</DropdownMenuCheckboxItem>)}
                            {customHobbies.map(hobby => <DropdownMenuCheckboxItem key={hobby} checked={formData.hobbies?.includes(hobby)} onCheckedChange={checked => handleHobbyChange(hobby, checked)}>{hobby}</DropdownMenuCheckboxItem>)}
                            </ScrollArea>
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem onSelect={() => setIsCustomHobbyDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Add New Hobby...</DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                 </div>
                 {isPromotionStatusApplicable && (
                    <div className="space-y-2">
                        <Label className="flex items-center"><Medal className="mr-2 h-4 w-4" />Promotion Status</Label>
                        <Select value={formData.promotionStatus || ''} onValueChange={value => handleSelectChange('promotionStatus', value)}>
                            <SelectTrigger><SelectValue placeholder="Select promotion status" /></SelectTrigger>
                            <SelectContent>
                                {promotionStatusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground italic">
                            Note: Status is automatically set based on the overall average (&gt;=50% is Promoted). You can override it if needed.
                        </p>
                    </div>
                 )}
                 <div className="space-y-2">
                    <Label className="flex items-center"><ImageUp className="mr-2 h-4 w-4 text-primary" />Student Photo</Label>
                    <input type="file" id="studentPhotoUpload" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'studentPhotoDataUri')} />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('studentPhotoUpload')?.click()}><UploadCloud className="mr-2 h-4 w-4" />Upload Photo</Button>
                    {formData.studentPhotoDataUri && <NextImage src={formData.studentPhotoDataUri} alt="student" width={80} height={100} className="rounded border"/>}
                 </div>
              </div>
            </section>
            
            <Separator/>

            {/* Subjects Section */}
            <section className="space-y-6">
                <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Subject Marks</h3>
                <div className="flex items-center justify-between mt-2 mb-4">
                    <Button type="button" variant="outline" size="icon" onClick={() => setCurrentVisibleSubjectIndex(prev => Math.max(0, prev - 1))} disabled={currentVisibleSubjectIndex === 0}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm font-medium text-muted-foreground">Subject {currentVisibleSubjectIndex + 1} of {formData.subjects.length}</span>
                    <Button type="button" variant="outline" size="icon" onClick={() => setCurrentVisibleSubjectIndex(prev => Math.min(formData.subjects.length - 1, prev + 1))} disabled={currentVisibleSubjectIndex >= formData.subjects.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                </div>

                {formData.subjects.length > 0 && formData.subjects[currentVisibleSubjectIndex] && (
                    <div key={currentVisibleSubjectIndex} className="space-y-4 p-4 border rounded-md">
                        <div className="grid grid-cols-1 md:grid-cols-[3fr_1.5fr_1.5fr] gap-4 items-start">
                            <div className="space-y-2">
                                <Label className="flex items-center"><BookOpenText className="mr-2 h-4 w-4"/>Subject Name</Label>
                                <Select value={formData.subjects[currentVisibleSubjectIndex].subjectName} onValueChange={value => {
                                    if(value === ADD_CUSTOM_SUBJECT_VALUE) {
                                        setCurrentCustomSubjectTargetIndex(currentVisibleSubjectIndex);
                                        setIsCustomSubjectDialogOpen(true);
                                    } else {
                                        handleSubjectChange(currentVisibleSubjectIndex, 'subjectName', value);
                                    }
                                }}>
                                    <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                    <SelectContent>
                                        {predefinedSubjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        {customSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        <SelectItem value={ADD_CUSTOM_SUBJECT_VALUE}><PlusCircle className="mr-2 h-4 w-4"/>Add New Subject...</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center"><ListChecks className="mr-2 h-4 w-4"/>CA Mark</Label>
                                <Input type="number" placeholder="1-60" value={formData.subjects[currentVisibleSubjectIndex].continuousAssessment ?? ''} onChange={e => handleSubjectChange(currentVisibleSubjectIndex, 'continuousAssessment', e.target.value === '' ? null : Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center"><FileOutput className="mr-2 h-4 w-4"/>Exam Mark</Label>
                                <Input type="number" placeholder="1-100" value={formData.subjects[currentVisibleSubjectIndex].examinationMark ?? ''} onChange={e => handleSubjectChange(currentVisibleSubjectIndex, 'examinationMark', e.target.value === '' ? null : Number(e.target.value))} />
                            </div>
                        </div>
                    </div>
                )}
                 <div className="flex gap-4">
                    <Button type="button" variant="destructive" onClick={() => removeSubject(currentVisibleSubjectIndex)} className="flex-1" disabled={formData.subjects.length <= 1}>
                       <Trash2 className="mr-2 h-4 w-4" /> Remove Current Subject
                    </Button>
                    <Button type="button" onClick={addSubject} className="flex-1">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Subject
                    </Button>
                 </div>
            </section>

            <Separator />
            
            {/* Performance & Feedback Section */}
            <section className="space-y-6">
                <div className="flex justify-between items-center border-b pb-2 mb-4">
                    <h3 className="text-lg font-medium text-primary">Overall Performance &amp; Feedback</h3>
                    <Button type="button" onClick={handleGenerateAiReportInsights} disabled={isReportInsightsAiLoading} variant="outline" size="sm">
                        {isReportInsightsAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />} Generate AI Insights
                    </Button>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="performanceSummary" className="flex items-center"><ClipboardList className="mr-2 h-4 w-4"/>Performance Summary</Label>
                    <Textarea id="performanceSummary" name="performanceSummary" value={formData.performanceSummary || ''} onChange={handleInputChange} rows={3} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="strengths" className="flex items-center"><ThumbsUp className="mr-2 h-4 w-4"/>Strengths</Label>
                        <Textarea id="strengths" name="strengths" value={formData.strengths || ''} onChange={handleInputChange} rows={3} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="areasForImprovement" className="flex items-center"><Activity className="mr-2 h-4 w-4"/>Areas for Improvement</Label>
                        <Textarea id="areasForImprovement" name="areasForImprovement" value={formData.areasForImprovement || ''} onChange={handleInputChange} rows={3} />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="teacherFeedback" className="flex items-center"><Sparkles className="mr-2 h-4 w-4 text-accent"/>Teacher's Feedback</Label>
                        <Button type="button" onClick={handleGenerateAiTeacherFeedback} disabled={isTeacherFeedbackAiLoading} variant="outline" size="sm">
                            {isTeacherFeedbackAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Generate AI Feedback
                        </Button>
                    </div>
                    <Textarea id="teacherFeedback" name="teacherFeedback" value={formData.teacherFeedback || ''} onChange={handleInputChange} rows={4} className="border-accent" />
                </div>
            </section>

            <Separator />
            
            <div className="flex flex-row gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={isReportInsightsAiLoading || isTeacherFeedbackAiLoading}>
                <ListPlus className="mr-2 h-4 w-4" />
                Add Report to List
              </Button>
              <Button type="button" variant="destructive" className="flex-1" onClick={onResetForm}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear for New Entry
              </Button>
            </div>
        </form>
      </CardContent>
    </Card>

    {/* Dialogs for custom entries */}
    <Dialog open={isCustomSubjectDialogOpen} onOpenChange={setIsCustomSubjectDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
        <Input value={customSubjectInputValue} onChange={e => setCustomSubjectInputValue(e.target.value)} placeholder="e.g., Advanced History"/>
        <DialogFooter><Button onClick={handleAddCustomSubjectToListAndForm}>Add Subject</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isCustomHobbyDialogOpen} onOpenChange={setIsCustomHobbyDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Hobby</DialogTitle></DialogHeader>
        <Input value={customHobbyInputValue} onChange={e => setCustomHobbyInputValue(e.target.value)} placeholder="e.g., Chess Club"/>
        <DialogFooter><Button onClick={handleAddCustomHobbyToListAndForm}>Add Hobby</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
