
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { STUDENT_PROFILES_STORAGE_KEY } from '@/lib/schemas';
import type { ReportData } from '@/lib/schemas'; // For student profile type
import { User, Users, ArrowRightLeft, CheckSquare, XSquare } from 'lucide-react';

interface StudentProfile {
  studentName: string;
  studentPhotoUrl?: string;
  className?: string;
  gender?: string;
}

interface ImportStudentsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (selectedStudentNames: string[], destinationClass: string) => void;
}

const classLevels = [
  "KG1", "KG2",
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6",
  "JHS1", "JHS2", "JHS3",
  "SHS1", "SHS2", "SHS3",
  "Level 100", "Level 200", "Level 300", "Level 400", "Level 500", "Level 600", "Level 700"
];


export default function ImportStudentsDialog({ isOpen, onOpenChange, onImport }: ImportStudentsDialogProps) {
  const [allStudentProfiles, setAllStudentProfiles] = useState<Record<string, StudentProfile>>({});
  const [sourceClasses, setSourceClasses] = useState<string[]>([]);
  const [destinationClasses, setDestinationClasses] = useState<string[]>(classLevels); // Start with predefined

  const [selectedSourceClass, setSelectedSourceClass] = useState<string>('');
  const [selectedDestinationClass, setSelectedDestinationClass] = useState<string>('');
  const [eligibleStudents, setEligibleStudents] = useState<StudentProfile[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      try {
        const storedProfilesRaw = localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
        const profiles: Record<string, StudentProfile> = storedProfilesRaw ? JSON.parse(storedProfilesRaw) : {};
        setAllStudentProfiles(profiles);

        const uniqueSourceClasses = Array.from(new Set(Object.values(profiles).map(p => p.className).filter(Boolean) as string[])).sort();
        setSourceClasses(uniqueSourceClasses);
        
        // Combine predefined and unique classes from profiles for destination
        const uniqueProfileClasses = Array.from(new Set(Object.values(profiles).map(p => p.className).filter(Boolean) as string[]));
        const allPossibleDestClasses = Array.from(new Set([...classLevels, ...uniqueProfileClasses])).sort();
        setDestinationClasses(allPossibleDestClasses);


      } catch (e) {
        console.error("Error loading student profiles from localStorage:", e);
        setAllStudentProfiles({});
        setSourceClasses([]);
      }
      // Reset selections when dialog opens
      setSelectedSourceClass('');
      setSelectedDestinationClass('');
      setEligibleStudents([]);
      setSelectedStudents({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedSourceClass) {
      const students = Object.values(allStudentProfiles)
        .filter(p => p.className === selectedSourceClass)
        .sort((a, b) => a.studentName.localeCompare(b.studentName));
      setEligibleStudents(students);
      setSelectedStudents({}); // Reset selection when source class changes
    } else {
      setEligibleStudents([]);
    }
  }, [selectedSourceClass, allStudentProfiles]);

  const handleStudentSelectionChange = (studentName: string, checked: boolean) => {
    setSelectedStudents(prev => ({ ...prev, [studentName]: checked }));
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedStudents: Record<string, boolean> = {};
    eligibleStudents.forEach(student => {
      newSelectedStudents[student.studentName] = checked;
    });
    setSelectedStudents(newSelectedStudents);
  };

  const selectedStudentNames = useMemo(() => {
    return Object.entries(selectedStudents)
      .filter(([, isSelected]) => isSelected)
      .map(([studentName]) => studentName);
  }, [selectedStudents]);

  const isAllSelected = eligibleStudents.length > 0 && selectedStudentNames.length === eligibleStudents.length;

  const handleSubmit = () => {
    if (selectedStudentNames.length > 0 && selectedDestinationClass) {
      onImport(selectedStudentNames, selectedDestinationClass);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center text-primary">
            <ArrowRightLeft className="mr-2 h-5 w-5" />
            Import Promoted Students
          </DialogTitle>
          <DialogDescription>
            Select students from their previous class and import their core details (Name, Gender, Photo) to their new class for the current academic session.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 py-4 flex-1 min-h-0">
          <div className="space-y-4">
            <div>
              <Label htmlFor="sourceClass" className="text-sm font-medium flex items-center">
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />Source Class (Promoting From)
              </Label>
              <Select value={selectedSourceClass} onValueChange={setSelectedSourceClass}>
                <SelectTrigger id="sourceClass">
                  <SelectValue placeholder="Select previous class" />
                </SelectTrigger>
                <SelectContent>
                  {sourceClasses.length > 0 ? (
                    sourceClasses.map(cls => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">No classes with profiles found in local storage.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="destinationClass" className="text-sm font-medium flex items-center">
                 <Users className="mr-2 h-4 w-4 text-muted-foreground" />Destination Class (Promoting To)
              </Label>
              <Select value={selectedDestinationClass} onValueChange={setSelectedDestinationClass}>
                <SelectTrigger id="destinationClass">
                  <SelectValue placeholder="Select new class" />
                </SelectTrigger>
                <SelectContent>
                  {destinationClasses.map(cls => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-col min-h-0">
            <Label className="text-sm font-medium mb-2 flex items-center">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />Students in Source Class
            </Label>
            {selectedSourceClass ? (
              eligibleStudents.length > 0 ? (
                <>
                <div className="flex items-center space-x-2 mb-2 border p-2 rounded-md bg-muted/50">
                    <Checkbox
                        id="selectAllStudents"
                        checked={isAllSelected}
                        onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                    />
                    <Label htmlFor="selectAllStudents" className="text-xs font-medium">
                        {isAllSelected ? "Deselect All" : "Select All"} ({selectedStudentNames.length} / {eligibleStudents.length} selected)
                    </Label>
                </div>
                <ScrollArea className="flex-1 border rounded-md p-2">
                  <div className="space-y-2">
                    {eligibleStudents.map(student => (
                      <div key={student.studentName} className="flex items-center space-x-3 p-2 rounded hover:bg-muted/30 transition-colors">
                        <Checkbox
                          id={`student-${student.studentName}`}
                          checked={selectedStudents[student.studentName] || false}
                          onCheckedChange={(checked) => handleStudentSelectionChange(student.studentName, Boolean(checked))}
                        />
                        {student.studentPhotoUrl && (
                          <img src={student.studentPhotoUrl} alt={student.studentName} className="h-8 w-8 rounded-full object-cover" data-ai-hint="student portrait" />
                        )}
                        <div className="flex flex-col">
                           <Label htmlFor={`student-${student.studentName}`} className="text-xs font-medium cursor-pointer">
                            {student.studentName}
                           </Label>
                           {student.gender && <span className="text-xs text-muted-foreground">{student.gender}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                </>
              ) : (
                <div className="flex-1 border rounded-md p-4 flex items-center justify-center text-muted-foreground text-sm">
                  No students found in "{selectedSourceClass}".
                </div>
              )
            ) : (
              <div className="flex-1 border rounded-md p-4 flex items-center justify-center text-muted-foreground text-sm">
                Select a source class to see eligible students.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline"><XSquare className="mr-2 h-4 w-4"/>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={selectedStudentNames.length === 0 || !selectedDestinationClass || !selectedSourceClass}>
           <CheckSquare className="mr-2 h-4 w-4"/> Import Selected ({selectedStudentNames.length}) Students
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
