
'use client';

import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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

export default function QuickEntry({ allReports, user, onDataRefresh }: QuickEntryProps) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [studentsInClass, setStudentsInClass] = useState<ReportData[]>([]);
  const [subjectsForClass, setSubjectsForClass] = useState<string[]>([]);
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const { toast } = useToast();

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
      const reports = allReports.filter(r => r.className === selectedClass);
      setStudentsInClass(reports);

      const subjects = new Set<string>();
      reports.forEach(report => {
        report.subjects?.forEach(sub => {
          if (sub.subjectName) subjects.add(sub.subjectName);
        });
      });
      const sortedSubjects = Array.from(subjects).sort();
      setSubjectsForClass(sortedSubjects);
      if (sortedSubjects.length > 0 && !selectedSubject) {
        setSelectedSubject(sortedSubjects[0]);
      } else if (sortedSubjects.length === 0) {
        setSelectedSubject('');
      }
    } else {
      setStudentsInClass([]);
      setSubjectsForClass([]);
      setSelectedSubject('');
    }
  }, [selectedClass, allReports, selectedSubject]);
  
  const debouncedSave = useDebouncedCallback(async (reportId: string, updatedFields: Partial<ReportData>) => {
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

  const addNewStudent = async () => {
    if (!selectedClass) {
        toast({ title: 'No Class Selected', description: 'Please select a class before adding a student.', variant: 'destructive' });
        return;
    }
    const lastReport = allReports[allReports.length - 1];
    try {
      await addDoc(collection(db, 'reports'), {
        studentName: 'New Student',
        className: selectedClass,
        gender: '',
        studentPhotoDataUri: null,
        subjects: subjectsForClass.map(s => ({ subjectName: s, continuousAssessment: null, examinationMark: null })),
        teacherId: user.uid,
        createdAt: serverTimestamp(),
        // Carry over session-like data from another student in the same class
        academicYear: studentsInClass[0]?.academicYear || '',
        academicTerm: studentsInClass[0]?.academicTerm || '',
        schoolName: studentsInClass[0]?.schoolName || '',
        region: studentsInClass[0]?.region || '',
        district: studentsInClass[0]?.district || '',
        circuit: studentsInClass[0]?.circuit || '',
      });
      toast({ title: 'Student Added', description: 'A new student entry has been added to the class list. You may need to refresh.' });
      onDataRefresh();
    } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Could not add a new student.', variant: 'destructive' });
    }
  };

  const getSubjectForStudent = (student: ReportData, subjectName: string): SubjectEntry => {
    return student.subjects?.find(s => s.subjectName === subjectName) || { subjectName, continuousAssessment: null, examinationMark: null };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Data Entry</CardTitle>
        <CardDescription>
          Rapidly enter student information, CA scores, and exam scores for an entire class. Changes are saved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-auto sm:flex-1">
                <Label htmlFor="class-select" className="text-xs text-muted-foreground">Class</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button id="class-select" variant="outline" className="w-full justify-between">
                            <span className="flex items-center gap-2">
                                <Folder className="h-4 w-4" />
                                {selectedClass || 'Select a class...'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                        <ScrollArea className="h-48">
                            {availableClasses.map(c => <DropdownMenuItem key={c} onSelect={() => setSelectedClass(c)}>{c}</DropdownMenuItem>)}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="w-full sm:w-auto sm:flex-1">
                <Label htmlFor="subject-select" className="text-xs text-muted-foreground">Subject</Label>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button id="subject-select" variant="outline" className="w-full justify-between" disabled={!selectedClass}>
                            <span className="flex items-center gap-2">
                                <Book className="h-4 w-4" />
                                {selectedSubject || 'Select a subject...'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                         <ScrollArea className="h-48">
                            {subjectsForClass.length > 0 ? (
                                subjectsForClass.map(s => <DropdownMenuItem key={s} onSelect={() => setSelectedSubject(s)}>{s}</DropdownMenuItem>)
                            ) : (
                                <DropdownMenuItem disabled>No subjects for this class</DropdownMenuItem>
                            )}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
             <div className="w-full sm:w-auto">
                <Button onClick={addNewStudent} className="w-full"><UserPlus className="mr-2"/> Add Student</Button>
            </div>
        </div>
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead className="w-[80px]">Photo</TableHead>
                    <TableHead className="min-w-[200px]">Student Name</TableHead>
                    <TableHead className="min-w-[120px]">Gender</TableHead>
                    <TableHead className="text-center min-w-[120px]">CA Score ({selectedSubject})</TableHead>
                    <TableHead className="text-center min-w-[120px]">Exam Score ({selectedSubject})</TableHead>
                    <TableHead className="w-[50px]">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {studentsInClass.map((student, index) => {
                        const subjectData = getSubjectForStudent(student, selectedSubject);
                        return (
                            <TableRow key={student.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>
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
                                <TableCell>
                                    <Input
                                        value={student.studentName || ''}
                                        onChange={(e) => handleFieldChange(student.id, 'studentName', e.target.value)}
                                        className="border-none"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={student.gender}
                                        onValueChange={(value) => handleFieldChange(student.id, 'gender', value)}
                                    >
                                        <SelectTrigger className="border-none"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {genderOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    {selectedSubject && (
                                        <Input
                                            type="number"
                                            value={subjectData.continuousAssessment ?? ''}
                                            onChange={(e) => handleMarkChange(student.id, selectedSubject, 'continuousAssessment', e.target.value)}
                                            placeholder="CA Mark"
                                            className="text-center"
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    {selectedSubject && (
                                        <Input
                                            type="number"
                                            value={subjectData.examinationMark ?? ''}
                                            onChange={(e) => handleMarkChange(student.id, selectedSubject, 'examinationMark', e.target.value)}
                                            placeholder="Exam Mark"
                                            className="text-center"
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    {savingStatus[student.id] === 'saving' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                                    {savingStatus[student.id] === 'saved' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
