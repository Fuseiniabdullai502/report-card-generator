// components/ReportForm/ReportForm.tsx
"use client";

import React, {
  useState,
  useTransition,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";

import {
  type ReportData,
  type SubjectEntry,
  ReportDataSchema,
  STUDENT_PROFILES_STORAGE_KEY,
} from "@/lib/schemas";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAiFeedbackAction,
  getAiReportInsightsAction,
  editImageWithAiAction,
} from "@/app/actions";
import type { GenerateReportInsightsInput } from "@/ai/flows/generate-performance-summary";

import {
  Loader2,
  Sparkles,
  Wand2,
  User,
  ClipboardList,
  ThumbsUp,
  Activity,
  BookOpenText,
  ListChecks,
  FileOutput,
  PlusCircle,
  Trash2,
  Edit,
  Bot,
  CalendarCheck2,
  ImageUp,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Trash,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { calculateOverallAverage } from "@/lib/calculations";
import { resizeImage, fileToBase64 } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getClassLevel, getSubjectsForClass, type ShsProgram } from "@/lib/curriculum";

/* -------------------- Constants & lists -------------------- */
const ADD_CUSTOM_SUBJECT_VALUE = "--add-custom-subject--";
const ADD_CUSTOM_HOBBY_VALUE = "--add-custom-hobby--";

const tertiaryLevelClasses = [
  "Level 100",
  "Level 200",
  "Level 300",
  "Level 400",
  "Level 500",
  "Level 600",
  "Level 700",
];
const genderOptions = ["Male", "Female"];
const promotionStatusOptions = ["Promoted", "Repeated", "Graduated", "Under Review"];
const predefinedSubjectsList = [
  "Mathematics",
  "English Language",
  "Science",
  "Computing",
  "Religious and Moral Education",
  "Creative Arts",
  "Geography",
  "Economics",
  "Biology",
  "Elective Mathematics",
];
const predefinedHobbiesList = [
  "Reading",
  "Sports (General)",
  "Music",
  "Art & Craft",
  "Debating",
  "Coding/Programming",
  "Gardening",
  "Volunteering",
  "Cooking/Baking",
  "Drama/Theater",
];

/* -------------------- Small components -------------------- */

const AiErrorDescription = ({ errorMessage }: { errorMessage: string }) => {
  return (
    <div className="text-xs">
      <p className="mb-2 font-mono bg-destructive/20 p-2 rounded">{errorMessage}</p>
      <p className="font-semibold">Common Troubleshooting Steps:</p>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>Ensure your `GOOGLE_API_KEY` in the `.env` file is correct and that you've restarted your server.</li>
        <li>Your API key may need to be linked to a Google Cloud project with billing enabled (a free tier is available).</li>
        <li>In your Google Cloud project, ensure the "Vertex AI API" is enabled.</li>
        <li>
          For a detailed guide, check the Genkit setup in the <code className="bg-destructive/20 p-1 rounded">README.md</code> file.
        </li>
      </ul>
    </div>
  );
};

/* -------------------- Props -------------------- */
interface ReportFormProps {
  onFormUpdate: (data: ReportData) => void;
  initialData: ReportData;
  sessionDefaults: Partial<ReportData>;
  isEditing?: boolean;
  reportPrintListForHistory?: ReportData[];
  onSaveReport: (data: ReportData) => Promise<void>;
  onResetForm: () => void;
}

/* -------------------- Utility helpers -------------------- */
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const DEBOUNCE_MS = 300;

/* -------------------- Component -------------------- */
export default function ReportForm({
  onFormUpdate,
  initialData,
  sessionDefaults,
  isEditing = false,
  reportPrintListForHistory,
  onSaveReport,
  onResetForm,
}: ReportFormProps) {
  // Controlled by parent
  const formData = initialData;

  // UI / transitions
  const [isTeacherFeedbackAiLoading, startTeacherFeedbackAiTransition] = useTransition();
  const [isReportInsightsAiLoading, startReportInsightsAiTransition] = useTransition();
  const [isImageEditingAiLoading, startImageEditingAiTransition] = useTransition();
  const [imageUploadProgress, setImageUploadProgress] = useState<"uploading" | null>(null);
  const { toast } = useToast();

  // Custom entries state
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [isCustomSubjectDialogOpen, setIsCustomSubjectDialogOpen] = useState(false);
  const [customSubjectInputValue, setCustomSubjectInputValue] = useState("");
  const [currentCustomSubjectTargetIndex, setCurrentCustomSubjectTargetIndex] = useState<number | null>(null);

  const [customHobbies, setCustomHobbies] = useState<string[]>([]);
  const [isCustomHobbyDialogOpen, setIsCustomHobbyDialogOpen] = useState(false);
  const [customHobbyInputValue, setCustomHobbyInputValue] = useState("");

  // Subject entry UI: compact table vs pager
  const [showCompactSubjectTable, setShowCompactSubjectTable] = useState(true);

  // subject list navigation (keeps for backward compatibility)
  const [currentVisibleSubjectIndex, setCurrentVisibleSubjectIndex] = useState(0);

  // confirm clear dialog
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // file input ref for better reliability
  const studentPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // debounce timers for onFormUpdate
  const updateTimers = useRef<Record<string, number | undefined>>({});
  const debouncedUpdate = useCallback((next: ReportData, ms = DEBOUNCE_MS) => {
    // use a single key (you could key by id if you want per-row debouncing)
    const key = "form-update";
    if (updateTimers.current[key]) window.clearTimeout(updateTimers.current[key]);
    updateTimers.current[key] = window.setTimeout(() => {
      onFormUpdate(next);
      delete updateTimers.current[key];
    }, ms);
  }, [onFormUpdate]);

  /* -------------------- Auto-populate subjects for class/program on new forms -------------------- */
  useEffect(() => {
    if (isEditing) return; // only for new entries

    const className = sessionDefaults.className;
    if (!className) return;

    const isShsClass = getClassLevel(className) === "SHS";

    if (isShsClass && sessionDefaults.shsProgram) {
      const suggestedSubjects = getSubjectsForClass(className, sessionDefaults.shsProgram as ShsProgram | undefined);
      if (suggestedSubjects.length > 0) {
        const newSubjects: SubjectEntry[] = suggestedSubjects.map((name) => ({
          subjectName: name,
          continuousAssessment: null,
          examinationMark: null,
        }));
        onFormUpdate({ ...formData, subjects: newSubjects });
      }
    } else if (!isShsClass) {
      const suggestedSubjects = getSubjectsForClass(className);
      if (suggestedSubjects.length > 0) {
        const newSubjects: SubjectEntry[] = suggestedSubjects.map((name) => ({
          subjectName: name,
          continuousAssessment: null,
          examinationMark: null,
        }));
        onFormUpdate({ ...formData, subjects: newSubjects });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, sessionDefaults.className, sessionDefaults.shsProgram]); // onFormUpdate/formData intentionally excluded to only trigger on defaults change

  // reset pager when new report ID
  useEffect(() => {
    const currentId = initialData.id;
    const previousId = sessionStorage.getItem("reportFormId");
    if (currentId !== previousId) {
      setCurrentVisibleSubjectIndex(0);
      sessionStorage.setItem("reportFormId", currentId);
    }
  }, [initialData.id]);

  const usedSubjectNames = useMemo(
    () => new Set(formData.subjects.map((s) => s.subjectName).filter(Boolean)),
    [formData.subjects]
  );

  const allAvailableSubjects = useMemo(() => {
    return Array.from(new Set(predefinedSubjectsList.concat(customSubjects))).sort();
  }, [customSubjects]);

  const studentNameHistory = useMemo(() => {
    const namesFromList = reportPrintListForHistory?.map((report) => report.studentName).filter(Boolean) || [];
    let namesFromStorage: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
        if (storedProfilesRaw) {
          const profiles: Record<string, { studentName: string }> = JSON.parse(storedProfilesRaw);
          namesFromStorage = Object.values(profiles).map((p) => p.studentName);
        }
      } catch (e) {
        console.error("Error reading student names from localStorage for history:", e);
      }
    }
    return Array.from(new Set(namesFromList.concat(namesFromStorage)));
  }, [reportPrintListForHistory]);

  const isPromotionStatusApplicable = useMemo(() => {
    if (!formData.academicTerm || !formData.className) return false;
    return formData.academicTerm === "Third Term" && !tertiaryLevelClasses.includes(formData.className);
  }, [formData.academicTerm, formData.className]);

  useEffect(() => {
    if (!isPromotionStatusApplicable) return;
    const overallAverage = calculateOverallAverage(formData.subjects);
    if (overallAverage !== null) {
      const newPromotionStatus = overallAverage >= 50 ? "Promoted" : "Repeated";
      if (formData.promotionStatus !== newPromotionStatus) {
        onFormUpdate({ ...formData, promotionStatus: newPromotionStatus });
      }
    }
    // intentionally not debounced as it's a derived value
  }, [isPromotionStatusApplicable, formData.subjects, formData.promotionStatus, onFormUpdate]);

  /* -------------------- Handlers -------------------- */

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value } as ReportData;
    debouncedUpdate(next);
  };

  const handleSelectChange = (name: keyof ReportData, value: string) => {
    const next = { ...formData, [name]: value } as ReportData;
    debouncedUpdate(next);
  };

  const handleSubjectChange = (index: number, field: keyof SubjectEntry, value: string | number | null) => {
    // handle numeric conversions robustly
    if (field === "continuousAssessment" || field === "examinationMark") {
      if (value === "" || value === null) {
        const updatedSubjects = [...formData.subjects];
        updatedSubjects[index] = { ...updatedSubjects[index], [field]: null };
        debouncedUpdate({ ...formData, subjects: updatedSubjects });
        return;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        toast({ title: "Invalid number", description: "Please enter a valid numeric mark.", variant: "destructive" });
        return;
      }
      if (field === "continuousAssessment" && parsed > 60) {
        toast({ title: "Invalid CA Mark", description: "Continuous Assessment mark cannot exceed 60.", variant: "destructive" });
        return;
      }
      if (field === "examinationMark" && parsed > 100) {
        toast({ title: "Invalid Exam Mark", description: "Examination mark cannot exceed 100.", variant: "destructive" });
        return;
      }
      const updatedSubjects = [...formData.subjects];
      updatedSubjects[index] = { ...updatedSubjects[index], [field]: parsed };
      debouncedUpdate({ ...formData, subjects: updatedSubjects });
      return;
    }

    // subject name
    if (field === "subjectName") {
      const newName = String(value || "").trim();
      const isDuplicate = formData.subjects.some((subject, i) => i !== index && subject.subjectName === newName);
      if (isDuplicate) {
        toast({
          title: "Duplicate Subject",
          description: `The subject "${newName}" has already been selected.`,
          variant: "destructive",
        });
        return;
      }
    }

    const updatedSubjects = [...formData.subjects];
    const valueToSet = field === 'subjectName' ? String(value || '') : value;
    updatedSubjects[index] = { ...updatedSubjects[index], [field]: valueToSet };
    debouncedUpdate({ ...formData, subjects: updatedSubjects });
  };

  const addSubject = () => {
    const newSubjects = [...formData.subjects, { subjectName: "", continuousAssessment: null, examinationMark: null }];
    debouncedUpdate({ ...formData, subjects: newSubjects });
    setCurrentVisibleSubjectIndex(newSubjects.length - 1);
    if (!showCompactSubjectTable) setShowCompactSubjectTable(true);
  };

  const removeSubject = (index: number) => {
    if (formData.subjects.length <= 1) {
      toast({ title: "Cannot Remove", description: "At least one subject is required.", variant: "destructive" });
      return;
    }
    const updatedSubjects = formData.subjects.filter((_, i) => i !== index);
    debouncedUpdate({ ...formData, subjects: updatedSubjects });
    if (currentVisibleSubjectIndex >= updatedSubjects.length && updatedSubjects.length > 0) {
      setCurrentVisibleSubjectIndex(updatedSubjects.length - 1);
    }
  };

  const moveSubject = (from: number, to: number) => {
    if (to < 0 || to >= formData.subjects.length) return;
    const arr = [...formData.subjects];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    debouncedUpdate({ ...formData, subjects: arr });
    setCurrentVisibleSubjectIndex(to);
  };

  const handleHobbyChange = (hobby: string, checked: boolean) => {
    const currentHobbies = formData.hobbies || [];
    const newHobbies = checked ? [...currentHobbies, hobby] : currentHobbies.filter((h) => h !== hobby);
    debouncedUpdate({ ...formData, hobbies: newHobbies });
  };

  const handleAiEditImage = async (photoUrl: string | null | undefined, editPrompt: string) => {
    if (!photoUrl) return;
    startImageEditingAiTransition(async () => {
      const result = await editImageWithAiAction({ photoDataUri: photoUrl, prompt: editPrompt });
      if (result.success && result.editedPhotoDataUri) {
        onFormUpdate({ ...formData, studentPhotoUrl: result.editedPhotoDataUri });
        toast({ title: "AI Image Enhancement Successful", description: "The student photo has been updated." });
      } else {
        toast({
          title: "AI Image Edit Failed",
          description: <AiErrorDescription errorMessage={result.error || "An unknown error occurred."} />,
          variant: "destructive",
          duration: 30000,
        });
      }
    });
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please select an image.", variant: "destructive" });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "File too large",
        description: "Image must be smaller than 5 MB. We will attempt to resize it; choose a smaller photo if possible.",
        variant: "destructive",
      });
      // continue and attempt resizing — user is warned
    }

    setImageUploadProgress("uploading");
    try {
      const resizedFile = await resizeImage(file); // must return File/Blob
      const base64 = await fileToBase64(resizedFile);
      // immediate update as base64 (parent takes final save)
      onFormUpdate({ ...formData, studentPhotoUrl: base64 });
      toast({ title: "Image Ready", description: "Image has been resized and is ready to be saved." });
    } catch (error) {
      console.error("Image processing error:", error);
      toast({ title: "Image Processing Failed", description: "Could not process the image.", variant: "destructive" });
    } finally {
      setImageUploadProgress(null);
      if (input) input.value = "";
    }
  };

  /* -------------------- Submit & AI actions -------------------- */

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validation = ReportDataSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: `Validation Error: ${firstError.path.join(".") || "general"}`,
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }
    onSaveReport(validation.data);
  };

  const handleGenerateAiReportInsights = async () => {
    const { studentName, className, subjects, daysAttended, totalSchoolDays, academicTerm } = formData;

    if (!studentName?.trim()) {
      toast({ title: "Missing Student Name", description: "Please enter the student's name.", variant: "destructive" });
      return;
    }
    if (!className?.trim()) {
      toast({ title: "Missing Class Name", description: "Please select a class in the 'Session Controls' section.", variant: "destructive" });
      return;
    }
    if (!academicTerm?.trim()) {
      toast({ title: "Missing Academic Term", description: "Please select a term in the 'Session Controls' section.", variant: "destructive" });
      return;
    }

    const validSubjects = subjects.filter((s) => s.subjectName && s.subjectName.trim() !== "");
    if (validSubjects.length === 0) {
      toast({ title: "No Valid Subjects", description: "Please add at least one subject with a name.", variant: "destructive" });
      return;
    }

    let previousTermsDataForAI: GenerateReportInsightsInput["previousTermsData"] = [];
    if (reportPrintListForHistory && reportPrintListForHistory.length > 0) {
      previousTermsDataForAI = reportPrintListForHistory
        .filter(
          (report) =>
            report.studentName?.trim().toLowerCase() === formData.studentName?.trim().toLowerCase() &&
            report.academicTerm !== formData.academicTerm
        )
        .map((report) => ({
          termName: report.academicTerm || "Unknown Term",
          subjects: report.subjects.map((s) => ({
            subjectName: s.subjectName,
            continuousAssessment: s.continuousAssessment,
            examinationMark: s.examinationMark,
          })),
          overallAverage: report.overallAverage ?? null,
        }));
    }

    startReportInsightsAiTransition(async () => {
      const aiInput: GenerateReportInsightsInput = {
        studentName,
        className,
        currentAcademicTerm: academicTerm,
        daysAttended: daysAttended === null ? null : Number(daysAttended),
        totalSchoolDays: totalSchoolDays === null ? null : Number(totalSchoolDays),
        subjects: validSubjects.map((s) => ({
          subjectName: s.subjectName,
          continuousAssessment: s.continuousAssessment,
          examinationMark: s.examinationMark,
        })),
        previousTermsData: previousTermsDataForAI!.length > 0 ? previousTermsDataForAI : undefined,
      };
      const result = await getAiReportInsightsAction(aiInput);
      if (result.success && result.insights) {
        onFormUpdate({ ...formData, ...result.insights });
        toast({ title: "AI Insights Generated", description: "Performance summary updated with term-over-term comparison." });
      } else {
        toast({
          title: "AI Insights Generation Failed",
          description: <AiErrorDescription errorMessage={result.error || "An unknown error occurred."} />,
          variant: "destructive",
          duration: 30000,
        });
      }
    });
  };

  const handleGenerateAiTeacherFeedback = async () => {
    const { studentName, className, performanceSummary, strengths, areasForImprovement } = formData;
    if (!studentName?.trim()) {
      toast({ title: "Missing Information", description: "Please provide the Student Name.", variant: "destructive" });
      return;
    }
    if (!className?.trim()) {
      toast({ title: "Missing Information", description: "Please provide the Class Name.", variant: "destructive" });
      return;
    }
    if (!performanceSummary?.trim()) {
      toast({ title: "Missing Information", description: "Please provide the Performance Summary.", variant: "destructive" });
      return;
    }
    if (!strengths?.trim()) {
      toast({ title: "Missing Information", description: "Please provide the Strengths.", variant: "destructive" });
      return;
    }
    if (!areasForImprovement?.trim()) {
      toast({ title: "Missing Information", description: "Please provide the Areas for Improvement.", variant: "destructive" });
      return;
    }
    startTeacherFeedbackAiTransition(async () => {
      const result = await getAiFeedbackAction({ studentName, className, performanceSummary, strengths, areasForImprovement });
      if (result.success && result.feedback) {
        onFormUpdate({ ...formData, teacherFeedback: result.feedback });
        toast({ title: "AI Feedback Generated" });
      } else {
        toast({
          title: "AI Feedback Generation Failed",
          description: <AiErrorDescription errorMessage={result.error || "An unknown error occurred."} />,
          variant: "destructive",
          duration: 30000,
        });
      }
    });
  };

  /* -------------------- Custom subject/hobby add handlers -------------------- */

  const handleAddCustomSubjectToListAndForm = () => {
    const newSubjectName = customSubjectInputValue.trim();
    if (!newSubjectName) return;
    if (currentCustomSubjectTargetIndex !== null) {
      handleSubjectChange(currentCustomSubjectTargetIndex, "subjectName", newSubjectName);
      // add to customSubjects (safe, readable)
      setCustomSubjects((prev) => Array.from(new Set([...prev, newSubjectName])));
      setIsCustomSubjectDialogOpen(false);
      setCustomSubjectInputValue("");
      setCurrentCustomSubjectTargetIndex(null);
    }
  };

  const handleAddCustomHobbyToListAndForm = () => {
    const newHobby = customHobbyInputValue.trim();
    if (!newHobby) return;
    // add to selected hobbies and customHobbies list
    handleHobbyChange(newHobby, true);
    setCustomHobbies((prev) => Array.from(new Set([...prev, newHobby])));
    setIsCustomHobbyDialogOpen(false);
    setCustomHobbyInputValue("");
  };

  /* -------------------- Render -------------------- */

  const isUploading = imageUploadProgress === "uploading";

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Edit className="h-6 w-6 text-primary" />
            <CardTitle className="font-headline text-2xl">
              {isEditing ? `Editing Report` : `Report Details (Entry #${formData.studentEntryNumber})`}
            </CardTitle>
          </div>
          <CardDescription>
            {isEditing ? `Editing report for ${formData.studentName || "..."} in class ${formData.className || "..."}` : `Enter student information, performance, and subject marks for class:`}
            {!isEditing && <span className="font-semibold text-primary"> {formData.className || "N/A"}</span>}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Student Information */}
            <section className="space-y-6">
              <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Student Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studentName" className="flex items-center">
                    <User className="mr-2 h-4 w-4 text-primary" />Student Name
                  </Label>
                  <Input
                    id="studentName"
                    name="studentName"
                    value={formData.studentName || ""}
                    onChange={handleInputChange}
                    placeholder="e.g., Fuseini Abdullai"
                    list="studentNameHistoryDatalist"
                  />
                  <datalist id="studentNameHistoryDatalist">
                    {Array.from(studentNameHistory).map((name, idx) => <option key={idx} value={name} />)}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center"><ChevronDown className="mr-2 h-4 w-4 text-primary" />Gender</Label>
                  <Select value={formData.gender || ""} onValueChange={(v) => handleSelectChange("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {genderOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentEmail" className="flex items-center"><ChevronDown className="mr-2 h-4 w-4 text-primary" />Parent Email</Label>
                  <Input id="parentEmail" name="parentEmail" type="email" value={formData.parentEmail || ""} onChange={handleInputChange} placeholder="parent@example.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentPhoneNumber" className="flex items-center"><ChevronDown className="mr-2 h-4 w-4 text-primary" />Parent Phone Number</Label>
                  <Input id="parentPhoneNumber" name="parentPhoneNumber" type="tel" value={formData.parentPhoneNumber || ""} onChange={handleInputChange} placeholder="+233..." />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daysAttended" className="flex items-center"><CalendarCheck2 className="mr-2 h-4 w-4 text-primary" />Days Attended</Label>
                  <Input id="daysAttended" name="daysAttended" type="number" value={formData.daysAttended ?? ""} onChange={handleInputChange} placeholder="e.g., 85" min={0} />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center"><ChevronDown className="mr-2 h-4 w-4 text-primary" />Hobbies</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="truncate">{formData.hobbies?.join(", ") || "Select Hobbies"}</span>
                        <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      <ScrollArea className="h-[200px]">
                        {Array.from(new Set([...predefinedHobbiesList, ...customHobbies])).sort().map((hobby) => (
                          <DropdownMenuCheckboxItem key={hobby} checked={formData.hobbies?.includes(hobby)} onCheckedChange={(checked) => handleHobbyChange(hobby, checked)}>
                            {hobby}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </ScrollArea>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setIsCustomHobbyDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4 text-accent" />Add New Hobby...
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {isPromotionStatusApplicable && (
                  <div className="space-y-2">
                    <Label className="flex items-center"><ChevronDown className="mr-2 h-4 w-4 text-primary" />Promotion Status</Label>
                    <Select value={formData.promotionStatus || ""} onValueChange={(v) => handleSelectChange("promotionStatus", v)}>
                      <SelectTrigger><SelectValue placeholder="Select promotion status" /></SelectTrigger>
                      <SelectContent>
                        {promotionStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground italic">Note: Status is auto-set from overall average. You can override it.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center"><ImageUp className="mr-2 h-4 w-4 text-primary" />Student Photo</Label>
                  <div className="flex items-center gap-2">
                    <input ref={studentPhotoInputRef} type="file" id="studentPhotoUpload" className="sr-only" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                    <Button type="button" variant="outline" size="sm" onClick={() => studentPhotoInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4 text-blue-500" />}
                      {isUploading ? "Processing..." : "Upload"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAiEditImage(formData.studentPhotoUrl, "Brighten and enhance clarity keeping family features")}
                      disabled={!formData.studentPhotoUrl || isImageEditingAiLoading || isUploading}
                      title="Enhance with AI"
                    >
                      {isImageEditingAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4 text-accent" />}
                      Enhance
                    </Button>
                  </div>

                  {isUploading && <p className="text-xs text-blue-500">Processing image...</p>}
                  {formData.studentPhotoUrl && !isUploading && (
                    <div className="relative w-24 h-32 mt-2 rounded border p-1">
                      <img src={formData.studentPhotoUrl} alt="student" className="object-cover rounded w-full h-full" />
                      {(isImageEditingAiLoading || isUploading) && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {/* Subjects Section (compact table) */}
            <section className="space-y-6">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-lg font-medium text-primary">Subject Marks</h3>
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={() => setShowCompactSubjectTable((s) => !s)}>
                    {showCompactSubjectTable ? "Pager Mode" : "Compact Table"}
                  </Button>
                  <Button type="button" onClick={addSubject} className="flex items-center"><PlusCircle className="mr-2 h-4 w-4" />Add Subject</Button>
                </div>
              </div>

              {showCompactSubjectTable ? (
                <div className="overflow-x-auto">
                  <table className="w-full table-auto border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Subject</th>
                        <th className="text-center p-2">CA (Max 60)</th>
                        <th className="text-center p-2">Exam (Max 100)</th>
                        <th className="text-center p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.subjects.map((sub, idx) => (
                        <tr key={`${sub.subjectName || "sub"}-${idx}`} className="border-t">
                          <td className="p-2 w-8">{idx + 1}</td>
                          <td className="p-2 w-1/2">
                            <Select
                              value={sub.subjectName || "_placeholder_"}
                              onValueChange={(value) => {
                                if (value === ADD_CUSTOM_SUBJECT_VALUE) {
                                  setCurrentCustomSubjectTargetIndex(idx);
                                  setIsCustomSubjectDialogOpen(true);
                                } else {
                                  handleSubjectChange(idx, "subjectName", value === "_placeholder_" ? "" : value);
                                }
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_placeholder_" disabled>Select Subject</SelectItem>
                                {allAvailableSubjects.map((s) => (
                                  <SelectItem key={s} value={s} disabled={usedSubjectNames.has(s) && s !== sub.subjectName}>{s}</SelectItem>
                                ))}
                                <SelectSeparator />
                                <SelectItem value={ADD_CUSTOM_SUBJECT_VALUE}><PlusCircle className="mr-2 h-4 w-4 text-accent" />Add New Subject...</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 w-24">
                            <Input
                              type="number"
                              placeholder="-"
                              value={sub.continuousAssessment ?? ""}
                              onChange={(e) => handleSubjectChange(idx, "continuousAssessment", e.target.value)}
                              min={0}
                              max={60}
                              aria-label={`CA for ${sub.subjectName || `subject ${idx + 1}`}`}
                            />
                          </td>
                          <td className="p-2 w-24">
                            <Input
                              type="number"
                              placeholder="-"
                              value={sub.examinationMark ?? ""}
                              onChange={(e) => handleSubjectChange(idx, "examinationMark", e.target.value)}
                              min={0}
                              max={100}
                              aria-label={`Exam for ${sub.subjectName || `subject ${idx + 1}`}`}
                            />
                          </td>
                          <td className="p-2 w-36">
                            <div className="flex gap-1 justify-end">
                              <Button type="button" variant="outline" size="icon" onClick={() => moveSubject(idx, Math.max(0, idx - 1))} disabled={idx === 0} title="Move up" aria-label="Move subject up">
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" onClick={() => moveSubject(idx, Math.min(formData.subjects.length - 1, idx + 1))} disabled={idx === formData.subjects.length - 1} title="Move down" aria-label="Move subject down">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="destructive" size="icon" onClick={() => removeSubject(idx)} disabled={formData.subjects.length <= 1} title="Remove subject" aria-label="Remove subject">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Pager mode (single subject visible)
                <>
                  <div className="flex items-center justify-between mt-2 mb-4">
                    <Button type="button" variant="outline" size="icon" onClick={() => setCurrentVisibleSubjectIndex((p) => Math.max(0, p - 1))} disabled={currentVisibleSubjectIndex === 0}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">Subject {currentVisibleSubjectIndex + 1} of {formData.subjects.length}</span>
                    <Button type="button" variant="outline" size="icon" onClick={() => setCurrentVisibleSubjectIndex((p) => Math.min(formData.subjects.length - 1, p + 1))} disabled={currentVisibleSubjectIndex >= formData.subjects.length - 1}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {formData.subjects[currentVisibleSubjectIndex] && (
                    <div className="space-y-4 p-4 border rounded-md">
                      <div className="grid grid-cols-1 md:grid-cols-[3fr_1.5fr_1.5fr] gap-4 items-start">
                        <div>
                          <Label>Subject Name</Label>
                          <Select value={formData.subjects[currentVisibleSubjectIndex].subjectName || "_placeholder_"} onValueChange={(value) => {
                            if (value === ADD_CUSTOM_SUBJECT_VALUE) {
                              setCurrentCustomSubjectTargetIndex(currentVisibleSubjectIndex);
                              setIsCustomSubjectDialogOpen(true);
                            } else {
                              handleSubjectChange(currentVisibleSubjectIndex, "subjectName", value === "_placeholder_" ? "" : value);
                            }
                          }}>
                            <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_placeholder_" disabled>Select Subject</SelectItem>
                              {allAvailableSubjects.map((s) => <SelectItem key={s} value={s} disabled={usedSubjectNames.has(s) && s !== formData.subjects[currentVisibleSubjectIndex].subjectName}>{s}</SelectItem>)}
                              <SelectSeparator />
                              <SelectItem value={ADD_CUSTOM_SUBJECT_VALUE}><PlusCircle className="mr-2 h-4 w-4 text-accent" />Add New Subject...</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>CA Mark (Max: 60)</Label>
                          <Input type="number" placeholder="-" value={formData.subjects[currentVisibleSubjectIndex].continuousAssessment ?? ""} onChange={(e) => handleSubjectChange(currentVisibleSubjectIndex, "continuousAssessment", e.target.value)} min={0} max={60} />
                        </div>

                        <div>
                          <Label>Exam Mark (Max: 100)</Label>
                          <Input type="number" placeholder="-" value={formData.subjects[currentVisibleSubjectIndex].examinationMark ?? ""} onChange={(e) => handleSubjectChange(currentVisibleSubjectIndex, "examinationMark", e.target.value)} min={0} max={100} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 mt-2">
                    <Button type="button" variant="destructive" onClick={() => removeSubject(currentVisibleSubjectIndex)} className="flex-1" disabled={formData.subjects.length <= 1}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remove Current Subject
                    </Button>
                    <Button type="button" onClick={addSubject} className="flex-1 bg-primary">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Subject
                    </Button>
                  </div>
                </>
              )}
            </section>

            <Separator />

            {/* Performance & Feedback Section */}
            <section className="space-y-6">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-lg font-medium text-primary">Overall Performance &amp; Feedback</h3>
                <Button type="button" onClick={handleGenerateAiReportInsights} disabled={isReportInsightsAiLoading} variant="outline" size="sm">
                  {isReportInsightsAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4 text-accent" />} Generate AI Insights
                </Button>
              </div>

              <div>
                <Label htmlFor="performanceSummary" className="flex items-center"><ClipboardList className="mr-2 h-4 w-4 text-primary" />Performance Summary</Label>
                <Textarea id="performanceSummary" name="performanceSummary" value={formData.performanceSummary || ""} onChange={handleInputChange} rows={3} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="strengths" className="flex items-center"><ThumbsUp className="mr-2 h-4 w-4 text-green-500" />Strengths</Label>
                  <Textarea id="strengths" name="strengths" value={formData.strengths || ""} onChange={handleInputChange} rows={3} />
                </div>

                <div>
                  <Label htmlFor="areasForImprovement" className="flex items-center"><Activity className="mr-2 h-4 w-4 text-yellow-500" />Areas for Improvement</Label>
                  <Textarea id="areasForImprovement" name="areasForImprovement" value={formData.areasForImprovement || ""} onChange={handleInputChange} rows={3} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label className="flex items-center"><Sparkles className="mr-2 h-4 w-4 text-accent" />Teacher's Feedback</Label>
                  <Button type="button" onClick={handleGenerateAiTeacherFeedback} disabled={isTeacherFeedbackAiLoading} variant="outline" size="sm">
                    {isTeacherFeedbackAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4 text-accent" />} Generate AI Feedback
                  </Button>
                </div>
                <Textarea id="teacherFeedback" name="teacherFeedback" value={formData.teacherFeedback || ""} onChange={handleInputChange} rows={4} />
              </div>
            </section>

            <Separator />

            <div className="flex flex-row gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={isReportInsightsAiLoading || isTeacherFeedbackAiLoading}>
                {isEditing ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isEditing ? "Update Report" : "Add Report to List"}
              </Button>

              <Button type="button" variant="destructive" className="flex-1" onClick={() => setIsClearConfirmOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear for New Entry
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* dialogs */}
      <Dialog open={isCustomSubjectDialogOpen} onOpenChange={setIsCustomSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
          <Input value={customSubjectInputValue} onChange={(e) => setCustomSubjectInputValue(e.target.value)} placeholder="e.g., Advanced History" aria-label="New subject name" />
          <DialogFooter>
            <div className="flex gap-2">
              <Button onClick={handleAddCustomSubjectToListAndForm}><PlusCircle className="mr-2 h-4 w-4" />Add Subject</Button>
              <Button variant="outline" onClick={() => { setIsCustomSubjectDialogOpen(false); setCustomSubjectInputValue(""); }}>Cancel</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomHobbyDialogOpen} onOpenChange={setIsCustomHobbyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Hobby</DialogTitle></DialogHeader>
          <Input value={customHobbyInputValue} onChange={(e) => setCustomHobbyInputValue(e.target.value)} placeholder="e.g., Chess Club" aria-label="New hobby name" />
          <DialogFooter>
            <div className="flex gap-2">
              <Button onClick={handleAddCustomHobbyToListAndForm}><PlusCircle className="mr-2 h-4 w-4" />Add Hobby</Button>
              <Button variant="outline" onClick={() => { setIsCustomHobbyDialogOpen(false); setCustomHobbyInputValue(""); }}>Cancel</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clear Form</DialogTitle></DialogHeader>
          <div className="my-4">
            <p>Are you sure you want to clear the form? This will discard unsaved changes.</p>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => { onResetForm(); setIsClearConfirmOpen(false); }}>Yes, clear</Button>
              <Button variant="outline" onClick={() => setIsClearConfirmOpen(false)}>Cancel</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
