
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, UserPlus, Upload, Save, CheckCircle, ChevronDown, Book, Folder } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ReportData, SubjectEntry } from '@/lib/schemas';
import type { CustomUser } from './auth-provider';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import NextImage from 'next/image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QuickEntryProps {
  allReports: ReportData[];
  user: CustomUser;
  onDataRefresh: () => void;
}

const genderOptions = ["Male", "Female"];

export function QuickEntry({ allReports, user, onDataRefresh }: QuickEntryProps) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [studentsInClass, setStudentsInClass] = useState<ReportData[]>([]);
  const [subjectsForClass, setSubjectsForClass] = useState<string[]>([]);
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const { toast } = useToast();
  
  const [newStudentName, setNewStudentName] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);


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

    } else {
      setStudentsInClass([]);
      setSubjectsForClass([]);
    }
  }, [selectedClass, allReports]);
  
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

  const handleFieldChange = (reportId: string, field: keyof ReportData, value: any) => {
    setSavingStatus(prev => ({ ...prev, [reportId]: 'saving' }));
    const updatedStudents = studentsInClass.map(student =>
      student.id === reportId ? { ...student, [field]: value } : student
    );
    setStudentsInClass(updatedStudents);
    debouncedSave(reportId, { [field]: value });
  };

  const handleMarkChange = (reportId: string, subjectName: string, markType: 'continuousAssessment' | 'examinationMark', value: string) => {
    setSavingStatus(prev => ({ ...prev, [reportId]: 'saving' }));
    const numericValue = value === '' ? null : Number(value);

    const updatedStudents = studentsInClass.map(student => {
      if (student.id === reportId) {
        const newSubjects = student.subjects.map(sub =>
          sub.subjectName === subjectName ? { ...sub, [markType]: numericValue } : sub
        );
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

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, reportId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSavingStatus(prev => ({...prev, [reportId]: 'saving' }));
    toast({ title: 'Uploading...', description: 'Please wait.' });

    try {
      const storageRef = ref(storage, `student_photos/${uuidv4()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      handleFieldChange(reportId, 'studentPhotoDataUri', downloadURL);
      toast({ title: 'Upload Successful', description: 'Student photo has been updated.' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: 'Could not upload image.', variant: 'destructive' });
      setSavingStatus(prev => ({...prev, [reportId]: 'idle' }));
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
            
            toast({ title: 'Student Added', description: `${newStudentData.studentName} has been added to the class.` });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not add the new student to the database.', variant: 'destructive' });
            setStudentsInClass(prev => prev.filter(s => s.id !== tempId));
        } finally {
            setIsAddingStudent(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddNewStudent();
        }
    };


  const getSubjectForStudent = (student: ReportData, subjectName: string): SubjectEntry => {
    const existingSubject = student.subjects?.find(s => s.subjectName === subjectName);
    if (existingSubject) return existingSubject;
    // If subject doesn't exist for this student (e.g., student added before subject), return a blank entry
    return { subjectName, continuousAssessment: null, examinationMark: null };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Data Entry</CardTitle>
        <CardDescription>
          Rapidly enter student information and scores in a spreadsheet-like view. Changes are saved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-auto sm:flex-1">
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
        </div>
        <div className="overflow-x-auto relative border rounded-lg">
            <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                        <TableHead className="w-[50px] sticky left-0 bg-muted z-20">#</TableHead>
                        <TableHead className="w-[80px] sticky left-[50px] bg-muted z-20">Photo</TableHead>
                        <TableHead className="min-w-[200px] sticky left-[130px] bg-muted z-20">Student Name</TableHead>
                        <TableHead className="min-w-[120px]">Gender</TableHead>
                        {subjectsForClass.map(subject => (
                            <TableHead key={subject} colSpan={2} className="text-center border-l">{subject}</TableHead>
                        ))}
                        <TableHead className="w-[50px] text-center">Status</TableHead>
                    </TableRow>
                     <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 bg-muted/50 z-20"></TableHead>
                        <TableHead className="sticky left-[50px] bg-muted/50 z-20"></TableHead>
                        <TableHead className="sticky left-[130px] bg-muted/50 z-20"></TableHead>
                        <TableHead></TableHead>
                        {subjectsForClass.map(subject => (
                            <React.Fragment key={`${subject}-scores`}>
                                <TableHead className="text-center text-xs border-l">CA (60)</TableHead>
                                <TableHead className="text-center text-xs">Exam (100)</TableHead>
                            </React.Fragment>
                        ))}
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {studentsInClass.map((student, index) => {
                        return (
                            <TableRow key={student.id}>
                                <TableCell className="sticky left-0 bg-background z-10">{index + 1}</TableCell>
                                <TableCell className="sticky left-[50px] bg-background z-10">
                                    <div className="relative w-12 h-16">
                                        <input
                                            type="file"
                                            id={`upload-${student.id}`}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, student.id)}
                                        />
                                        <label htmlFor={`upload-${student.id}`} className="cursor-pointer">
                                            {student.studentPhotoDataUri ? (
                                                <NextImage src={student.studentPhotoDataUri} alt="student" layout="fill" className="rounded object-cover" />
                                            ) : (
                                                <div className="w-12 h-16 rounded bg-muted flex items-center justify-center">
                                                    <Upload className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </TableCell>
                                <TableCell className="sticky left-[130px] bg-background z-10">
                                    <Input
                                        value={student.studentName || ''}
                                        onChange={(e) => handleFieldChange(student.id, 'studentName', e.target.value)}
                                        className="border-none bg-transparent"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={student.gender}
                                        onValueChange={(value) => handleFieldChange(student.id, 'gender', value)}
                                    >
                                        <SelectTrigger className="border-none bg-transparent"><SelectValue placeholder="Select..."/></SelectTrigger>
                                        <SelectContent>
                                            {genderOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                {subjectsForClass.map(subjectName => {
                                    const subjectData = getSubjectForStudent(student, subjectName);
                                    return (
                                        <React.Fragment key={`${student.id}-${subjectName}`}>
                                            <TableCell className="border-l">
                                                <Input
                                                    type="number"
                                                    value={subjectData.continuousAssessment ?? ''}
                                                    onChange={(e) => handleMarkChange(student.id, subjectName, 'continuousAssessment', e.target.value)}
                                                    placeholder="CA"
                                                    className="text-center min-w-[70px]"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={subjectData.examinationMark ?? ''}
                                                    onChange={(e) => handleMarkChange(student.id, subjectName, 'examinationMark', e.target.value)}
                                                    placeholder="Exam"
                                                    className="text-center min-w-[70px]"
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
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-6">
          <div className="flex items-end gap-4 w-full">
            <div className="flex-grow">
              <Label htmlFor="new-student-name" className="text-xs text-muted-foreground">Add New Student to "{selectedClass || '...'}"</Label>
              <Input
                id="new-student-name"
                placeholder="Type student name and press Enter..."
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!selectedClass || isAddingStudent}
              />
            </div>
            <Button onClick={handleAddNewStudent} disabled={!selectedClass || !newStudentName.trim() || isAddingStudent}>
                {isAddingStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Add Student
            </Button>
          </div>
      </CardFooter>
    </Card>
  );
}
