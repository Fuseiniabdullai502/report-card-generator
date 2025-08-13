
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
import { Loader2, UserPlus, Upload, Save, CheckCircle, Search, Trash2, BookOpen, Edit, Download, FileUp, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import type { CustomUser } from './auth-provider';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import NextImage from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { batchUpdateStudentScoresAction, deleteReportAction } from '@/app/actions';
import * as XLSX from 'xlsx';
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';

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

  // New state for focused entry mode
  const [focusedSubject, setFocusedSubject] = useState<string>('');
  const [scoreType, setScoreType] = useState<ScoreType>('continuousAssessment');
  const [isExportGradesheetDialogOpen, setIsExportGradesheetDialogOpen] = useState(false);
  const [isImportGradesheetDialogOpen, setIsImportGradesheetDialogOpen] = useState(false);
  const [isTableVisible, setIsTableVisible] = useState(false);


  const availableClasses = useMemo(() => {
    return [...new Set(allReports.map(r => r.className).filter(Boolean) as string[])].sort();
  }, [allReports]);

  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.includes(selectedClass)) {
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

      const subjects = new Set<string>();
      reports.forEach(report => {
        report.subjects?.forEach(sub => {
          if (sub.subjectName) subjects.add(sub.subjectName);
        });
      });
      const sortedSubjects = Array.from(subjects).sort();
      setSubjectsForClass(sortedSubjects);
      
      // Reset focused subject if it's not in the new list of subjects
      if (sortedSubjects.length > 0 && !sortedSubjects.includes(focusedSubject)) {
        setFocusedSubject(sortedSubjects[0]);
      } else if (sortedSubjects.length === 0) {
        setFocusedSubject('');
      }

    } else {
      setStudentsInClass([]);
      setSubjectsForClass([]);
      setFocusedSubject('');
    }
  }, [selectedClass, allReports, focusedSubject]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return studentsInClass;
    return studentsInClass.filter(student =>
      student.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [studentsInClass, searchQuery]);
  
  const debouncedSave = useDebouncedCallback(async (reportId: string, updatedFields: Partial<ReportData>) => {
    if (reportId.startsWith('temp-')) return;
    
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
    setSavingStatus(prev => ({ ...prev, [reportId]: 'saving' }));
    const numericValue = value === '' ? null : Number(value);

    const updatedStudents = studentsInClass.map(student => {
      if (student.id === reportId) {
        let subjectFound = false;
        const newSubjects = student.subjects.map(sub => {
          if (sub.subjectName === subjectName) {
            subjectFound = true;
            return { ...sub, [markType]: numericValue };
          }
          return sub;
        });

        // If the subject doesn't exist for this student, add it.
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
        setStudentsInClass(updatedStudents);
        debouncedSave(reportId, { subjects: studentToUpdate.subjects });
    }
  };

  const handleScoreKeyDown = (e: KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const nextIndex = currentIndex + 1;
        if (nextIndex < filteredStudents.length) {
            const nextStudent = filteredStudents[nextIndex];
            const nextInput = document.getElementById(`score-input-${nextStudent.id}`);
            nextInput?.focus();
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
        const tempId = `temp-${Date.now()}`;
        const newStudentData: ReportData = {
            id: tempId,
            studentName: newStudentName.trim(),
            className: selectedClass,
            gender: '',
            studentPhotoDataUri: null,
            subjects: subjectsForClass.map(s => ({ subjectName: s, continuousAssessment: null, examinationMark: null })),
            teacherId: user.uid,
            studentEntryNumber: (allReports[allReports.length-1]?.studentEntryNumber || 0) + 1,
            academicYear: studentsInClass[0]?.academicYear || '',
            academicTerm: studentsInClass[0]?.academicTerm || '',
            schoolName: studentsInClass[0]?.schoolName || '',
            region: studentsInClass[0]?.region || '',
            district: studentsInClass[0]?.district || '',
            circuit: studentsInClass[0]?.circuit || '',
            performanceSummary: '',
            strengths: '',
            areasForImprovement: '',
        };
        
        setStudentsInClass(prev => [...prev, newStudentData].sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '')));
        setNewStudentName('');

        try {
            const { id, ...dataToSave } = newStudentData;
            const docRef = await addDoc(collection(db, 'reports'), {
                ...dataToSave,
                createdAt: serverTimestamp(),
            });

            setStudentsInClass(prev => prev.map(s => s.id === tempId ? { ...s, id: docRef.id } : s));
            onDataRefresh(); // Refresh parent data
            
            toast({ title: 'Student Added', description: `${newStudentData.studentName} has been added to the class.` });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not add the new student to the database.', variant: 'destructive' });
            setStudentsInClass(prev => prev.filter(s => s.id !== tempId));
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
            onDataRefresh(); // Refresh parent component's data
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

          // Merge subjects
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
          onDataRefresh(); // Refresh data from parent
      } else {
          toast({ title: 'Import Failed', description: result.error, variant: 'destructive' });
      }
      setIsImportGradesheetDialogOpen(false);
  };


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Data Entry</CardTitle>
          <CardDescription>
            Select a subject and score type to rapidly enter data. Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1">
                  <Label htmlFor="class-select" className="text-xs text-muted-foreground">Select a Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger id="class-select" className="w-full">
                          <SelectValue placeholder="Select a class..." />
                      </SelectTrigger>
                      <SelectContent>
                          {availableClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          {availableClasses.length === 0 && <SelectItem value="" disabled>No classes found</SelectItem>}
                      </SelectContent>
                  </Select>
              </div>
               <div className="md:col-span-1">
                  <Label htmlFor="subject-select" className="text-xs text-muted-foreground">Select Subject for Entry</Label>
                  <Select value={focusedSubject} onValueChange={setFocusedSubject} disabled={!selectedClass || subjectsForClass.length === 0}>
                      <SelectTrigger id="subject-select" className="w-full">
                          <SelectValue placeholder="Select a subject..." />
                      </SelectTrigger>
                      <SelectContent>
                          {subjectsForClass.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          {subjectsForClass.length === 0 && <SelectItem value="" disabled>No subjects for this class</SelectItem>}
                      </SelectContent>
                  </Select>
              </div>
              <div className="md:col-span-1">
                  <Label htmlFor="score-type-select" className="text-xs text-muted-foreground">Select Score Type</Label>
                  <Select value={scoreType} onValueChange={(v) => setScoreType(v as ScoreType)} disabled={!focusedSubject}>
                      <SelectTrigger id="score-type-select" className="w-full">
                          <SelectValue placeholder="Select score type..." />
                      </SelectTrigger>
                      <SelectContent>
                          {scoreTypeOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div className="md:col-span-1">
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
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsTableVisible(!isTableVisible)} disabled={studentsInClass.length === 0}>
                {isTableVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {isTableVisible ? 'Hide' : 'Show'} Gradesheet ({filteredStudents.length})
            </Button>
          </div>
          {isTableVisible && (
            <div className="overflow-x-auto relative border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead className="min-w-[200px]">Student Name</TableHead>
                            <TableHead className="min-w-[150px] text-center">
                              {focusedSubject ? `${focusedSubject} - ${scoreType === 'continuousAssessment' ? 'CA (60)' : 'Exam (100)'}` : 'Score'}
                            </TableHead>
                            <TableHead className="w-[50px] text-center">Status</TableHead>
                            <TableHead className="w-[80px] text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.map((student, index) => {
                            const subjectData = student.subjects.find(s => s.subjectName === focusedSubject);
                            const score = subjectData ? subjectData[scoreType] : null;

                            return (
                                <TableRow key={student.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">
                                        {student.studentName || ''}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            id={`score-input-${student.id}`}
                                            type="number"
                                            value={score ?? ''}
                                            onChange={(e) => handleMarkChange(student.id, focusedSubject, scoreType, e.target.value)}
                                            onKeyDown={(e) => handleScoreKeyDown(e, index)}
                                            placeholder="Enter score"
                                            className="text-center"
                                            disabled={!focusedSubject}
                                        />
                                    </TableCell>
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
                              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                No students found. {searchQuery ? 'Try adjusting your search.' : 'Select a class or add a new student.'}
                              </TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-grow w-full sm:w-auto">
              <div className="flex-grow">
                <Label htmlFor="new-student-name" className="text-xs text-muted-foreground">Add New Student to "{selectedClass || '...'}"</Label>
                <Input
                  id="new-student-name"
                  placeholder="Type student name and press Enter..."
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={handleAddStudentKeyDown}
                  disabled={!selectedClass || isAddingStudent}
                />
              </div>
              <Button onClick={handleAddNewStudent} disabled={!selectedClass || !newStudentName.trim() || isAddingStudent} className="self-end">
                  {isAddingStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Add
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto self-end">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-initial"
                onClick={() => setIsImportGradesheetDialogOpen(true)}
                disabled={studentsInClass.length === 0}
              >
                  <FileUp className="mr-2 h-4 w-4" />
                  Import
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-initial"
                onClick={() => setIsExportGradesheetDialogOpen(true)}
                disabled={studentsInClass.length === 0}
              >
                  <Download className="mr-2 h-4 w-4" />
                  Export
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
            subjects={subjectsForClass}
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
                acc[`${subject} CA (60)`] = '';
                acc[`${subject} Exam (100)`] = '';
                return acc;
            }, {} as Record<string, string>)
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        
        // Make worksheet editable and set focus on the first data cell
        if (worksheet['B2']) { // Check if the first data cell exists
            worksheet['!protect'] = {
                sheet: false, // unprotected
            };
        }
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `${className} Grades`);

        // Auto-size columns
        const cols = [{ wch: 30 }]; // Student Name column width
        selectedSubjects.forEach(subject => {
            cols.push({ wch: subject.length + 10 }); // CA column
            cols.push({ wch: subject.length + 12 }); // Exam column
        });
        worksheet['!cols'] = cols;
        
        XLSX.writeFile(workbook, `${className}_Gradesheet_${new Date().toISOString().split('T')[0]}.xlsx`);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Export Blank Gradesheet</DialogTitle>
                    <CardDescription>Select the subjects to include in the Excel export.</CardDescription>
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
                                const value = row[key] === '' ? null : Number(row[key]);
                                if (matchCA) subject.continuousAssessment = value;
                                if (matchExam) subject.examinationMark = value;
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
