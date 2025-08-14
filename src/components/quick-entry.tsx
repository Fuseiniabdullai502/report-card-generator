
'use client';

import React, { useState, useEffect, useMemo, ChangeEvent, KeyboardEvent } from 'react';
import { useDebouncedCallback } from 'use-debounce';
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
import { Loader2, UserPlus, Upload, Save, CheckCircle, Search, Trash2, BookOpen, Edit, Download, FileUp, Eye, EyeOff, Wand2, BookCopy, PlusCircle, VenetianMask, CalendarCheck2, ChevronDown, BookPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import type { CustomUser } from './auth-provider';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import NextImage from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { batchUpdateStudentScoresAction, deleteReportAction, getAiReportInsightsAction } from '@/app/actions';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogClose, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import type { GenerateReportInsightsInput } from '@/ai/flows/generate-performance-summary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { getSubjectsForClass } from '@/lib/curriculum';


interface QuickEntryProps {
  allReports: ReportData[];
  user: CustomUser;
  onDataRefresh: () => void;
}

const scoreTypeOptions = [
    { value: 'continuousAssessment', label: 'Continuous Assessment (CA)' },
    { value: 'examinationMark', label: 'Examination Mark (Exam)' }
];
type ScoreType = 'continuousAssessment' | 'examinationMark';


export function QuickEntry({ allReports, user, onDataRefresh }: QuickEntryProps) {
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
      const reports = allReports
        .filter(r => r.className === selectedClass)
        .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
      setStudentsInClass(reports);

      const curriculumSubjects = getSubjectsForClass(selectedClass);
      
      const subjectsFromReports = new Set<string>();
      reports.forEach(report => {
        report.subjects?.forEach(sub => {
          if (sub.subjectName) subjectsFromReports.add(sub.subjectName);
        });
      });
      
      const allPossibleSubjects = [...new Set([...curriculumSubjects, ...Array.from(subjectsFromReports)])].sort();
      setSubjectsForClass(allPossibleSubjects);

    } else {
      setStudentsInClass([]);
      setSubjectsForClass([]);
    }
  }, [selectedClass, allReports]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return studentsInClass;
    return studentsInClass.filter(student =>
      student.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [studentsInClass, searchQuery]);
  
  const debouncedSave = useDebouncedCallback(async (reportId: string, updatedFields: Partial<ReportData>) => {
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
  }, 1000);

  const handleMarkChange = (reportId: string, subjectName: string, markType: ScoreType, value: string) => {
    const numericValue = value === '' ? null : Number(value);

    setStudentsInClass(prevStudents => {
        const updatedStudents = prevStudents.map(student => {
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
                newSubjects.push({
                    subjectName: subjectName,
                    continuousAssessment: markType === 'continuousAssessment' ? numericValue : null,
                    examinationMark: markType === 'examinationMark' ? numericValue : null,
                });
            }
            return { ...student, subjects: newSubjects };
          }
          return student;
        });
        
        const studentToUpdate = updatedStudents.find(s => s.id === reportId);
        if(studentToUpdate){
            debouncedSave(reportId, { subjects: studentToUpdate.subjects });
        }
        
        return updatedStudents;
    });
  };
  
    const handleFieldChange = (reportId: string, field: keyof ReportData, value: string | number | null) => {
        setStudentsInClass(prevStudents => {
            const updatedStudents = prevStudents.map(student => {
                if (student.id === reportId) {
                    return { ...student, [field]: value };
                }
                return student;
            });

            const studentToUpdate = updatedStudents.find(s => s.id === reportId);
            if (studentToUpdate) {
                debouncedSave(reportId, { [field]: value });
            }

            return updatedStudents;
        });
    };


    const handleAddNewStudent = async () => {
        if (!newStudentName.trim()) return;
        if (!selectedClass) {
            toast({ title: 'No Class Selected', description: 'Please select a class before adding a student.', variant: 'destructive' });
            return;
        }

        setIsAddingStudent(true);
        
        const classTemplate = studentsInClass[0]; 
        const curriculumSubjects = getSubjectsForClass(selectedClass);
        
        const newStudentData: Omit<ReportData, 'id'> = {
            studentName: newStudentName.trim(),
            className: selectedClass,
            gender: '',
            studentPhotoDataUri: null,
            subjects: activeSubjectsInClass.map(s => ({ subjectName: s, continuousAssessment: null, examinationMark: null })),
            teacherId: user.uid,
            studentEntryNumber: (allReports.reduce((max, r) => Math.max(r.studentEntryNumber || 0, max), 0) || 0) + 1,
            academicYear: classTemplate?.academicYear || '',
            academicTerm: classTemplate?.academicTerm || '',
            schoolName: classTemplate?.schoolName || user.schoolName || '',
            region: classTemplate?.region || user.region || '',
            district: classTemplate?.district || user.district || '',
            circuit: classTemplate?.circuit || user.circuit || '',
            performanceSummary: '',
            strengths: '',
            areasForImprovement: '',
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

      const successfulInsights = results.filter(r => r.result.success);
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

  const handleBatchSubjectChange = async (subject: string, checked: boolean) => {
    if (studentsInClass.length === 0) return;
    
    const batch = writeBatch(db);
    studentsInClass.forEach(student => {
      const reportRef = doc(db, 'reports', student.id);
      let newSubjects: SubjectEntry[];
      if (checked) {
        if (!student.subjects.find(s => s.subjectName === subject)) {
          newSubjects = [...student.subjects, { subjectName: subject, continuousAssessment: null, examinationMark: null }];
          batch.update(reportRef, { subjects: newSubjects });
        }
      } else {
        newSubjects = student.subjects.filter(s => s.subjectName !== subject);
        batch.update(reportRef, { subjects: newSubjects });
      }
    });

    try {
      await batch.commit();
      toast({ title: `Subjects Updated`, description: `Successfully ${checked ? 'added' : 'removed'} "${subject}" for ${studentsInClass.length} students.` });
      onDataRefresh();
    } catch (error) {
      console.error("Error batch updating subjects:", error);
      toast({ title: "Update Failed", description: "Could not update subjects for the class.", variant: "destructive" });
    }
  };

  const activeSubjectsInClass = useMemo(() => {
    const activeSubjects = new Set<string>();
    studentsInClass.forEach(student => {
      student.subjects.forEach(sub => {
        if(sub.subjectName) activeSubjects.add(sub.subjectName);
      });
    });
    return subjectsForClass.filter(s => activeSubjects.has(s));
  }, [studentsInClass, subjectsForClass]);


  return (
    <>
      <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                      <CardTitle className='text-2xl'>Quick Data Entry</CardTitle>
                      <CardDescription>
                          Rapidly enter scores and other data. Changes are saved automatically.
                      </CardDescription>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-1">
                    <Label htmlFor="class-select" className="text-xs text-muted-foreground">Select a Class</Label>
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
                </div>

                <div className="lg:col-span-1">
                    <Label className="text-xs text-muted-foreground">Add/Remove Subjects for Class</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full" disabled={!selectedClass}>
                          <BookPlus className="mr-2 h-4 w-4 text-purple-500" />
                          Manage Subjects
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                          <DropdownMenuLabel>Available Subjects</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <ScrollArea className="h-60">
                            {subjectsForClass.map(subject => (
                              <DropdownMenuCheckboxItem
                                key={subject}
                                checked={activeSubjectsInClass.includes(subject)}
                                onCheckedChange={(checked) => handleBatchSubjectChange(subject, Boolean(checked))}
                              >
                                {subject}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </ScrollArea>
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
                            <TableHead className="w-[40px] sticky left-0 bg-muted z-20">#</TableHead>
                            <TableHead className="min-w-[180px] sticky left-10 bg-muted z-20">Student Name</TableHead>
                            <TableHead className="min-w-[120px]"><VenetianMask className="inline-block mr-1 h-4 w-4"/>Gender</TableHead>
                            <TableHead className="min-w-[150px]"><CalendarCheck2 className="inline-block mr-1 h-4 w-4"/>Days Attended</TableHead>
                            {activeSubjectsInClass.map(subject => (
                              <TableHead key={subject} colSpan={2} className="text-center border-l min-w-[150px]">
                                {subject}
                              </TableHead>
                            ))}
                            <TableHead className="w-[50px] text-center">Status</TableHead>
                            <TableHead className="w-[80px] text-center">Actions</TableHead>
                        </TableRow>
                         <TableRow>
                            <TableHead className="sticky left-0 bg-muted z-20"></TableHead>
                            <TableHead className="sticky left-10 bg-muted z-20"></TableHead>
                            <TableHead></TableHead>
                            <TableHead></TableHead>
                            {activeSubjectsInClass.map(subject => (
                              <React.Fragment key={`${subject}-sub`}>
                                <TableHead className="text-center border-l">CA (60)</TableHead>
                                <TableHead className="text-center">Exam (100)</TableHead>
                              </React.Fragment>
                            ))}
                            <TableHead></TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.map((student, index) => {
                            return (
                                <TableRow key={student.id}>
                                    <TableCell className="sticky left-0 bg-background z-20">{index + 1}</TableCell>
                                    <TableCell className="font-medium sticky left-10 bg-background z-20">
                                        {student.studentName || ''}
                                    </TableCell>
                                    <TableCell>
                                      <Select value={student.gender || ''} onValueChange={(value) => handleFieldChange(student.id, 'gender', value)}>
                                          <SelectTrigger className="h-9 w-[100px]">
                                              <SelectValue placeholder="Select..."/>
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
                                            value={student.daysAttended ?? ''}
                                            onChange={(e) => handleFieldChange(student.id, 'daysAttended', e.target.value === '' ? null : Number(e.target.value))}
                                            placeholder="e.g., 85"
                                            className="text-center h-9 w-[100px]"
                                        />
                                    </TableCell>
                                     {activeSubjectsInClass.map(subjectName => {
                                        const subjectData = student.subjects.find(s => s.subjectName === subjectName);
                                        return (
                                          <React.Fragment key={`${student.id}-${subjectName}`}>
                                            <TableCell className="border-l p-1">
                                              <Input
                                                type="number"
                                                placeholder="-"
                                                className="text-center min-w-[60px] h-9"
                                                value={subjectData?.continuousAssessment ?? ''}
                                                onChange={(e) => handleMarkChange(student.id, subjectName, 'continuousAssessment', e.target.value)}
                                              />
                                            </TableCell>
                                            <TableCell className="p-1">
                                               <Input
                                                type="number"
                                                placeholder="-"
                                                className="text-center min-w-[60px] h-9"
                                                value={subjectData?.examinationMark ?? ''}
                                                onChange={(e) => handleMarkChange(student.id, subjectName, 'examinationMark', e.target.value)}
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
                              <TableCell colSpan={activeSubjectsInClass.length * 2 + 6} className="text-center h-24 text-muted-foreground">
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

      {isExportGradesheetDialogOpen && (
        <ExportGradesheetDialog
            isOpen={isExportGradesheetDialogOpen}
            onOpenChange={setIsExportGradesheetDialogOpen}
            subjects={activeSubjectsInClass}
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
            worksheet['!protect'] = {
                sheet: false,
            };
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
