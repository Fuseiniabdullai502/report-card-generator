"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { Table, TableBody, TableHeader, TableHead, TableRow, TableCell } from "@/components/ui/table";
import type { ReportData } from "@/lib/schemas";
import StudentRow, { SaveStatus } from "./StudentRow";

type Props = {
  students: ReportData[];
  subjectOrder: string[];
  searchQuery: string;
  savingStatus: Record<string, SaveStatus>;
  imageUploadStatus: Record<string, "uploading" | null>;
  isAiEditing: Record<string, boolean>;
  onMarkChange: (id: string, subject: string, type: "continuousAssessment" | "examinationMark", val: string) => void;
  onFieldChange: <K extends keyof ReportData>(id: string, field: K, value: ReportData[K]) => void;
  onFieldBlur: (id: string, updatedFields: Partial<ReportData>) => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>, id: string) => void;
  onAiEditImage: (student: ReportData) => void;
  onDelete: (student: ReportData) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, studentIndex: number, colId: string) => void;
};

function useDebouncedSave(onSave: (id: string, fields: Partial<ReportData>) => void, ms = 700) {
  const timers = useRef<Record<string, number | undefined>>({});
  return useCallback((id: string, fields: Partial<ReportData>) => {
    if (timers.current[id]) window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => {
      onSave(id, fields);
      delete timers.current[id];
    }, ms);
  }, [onSave, ms]);
}

export default function QuickEntryTable({
  students,
  subjectOrder,
  searchQuery,
  savingStatus,
  imageUploadStatus,
  isAiEditing,
  onMarkChange,
  onFieldChange,
  onFieldBlur,
  onUploadImage,
  onAiEditImage,
  onDelete,
  onKeyDown,
}: Props) {
  const filtered = useMemo(() => students.filter((s) => (s.studentName || "").toLowerCase().includes((searchQuery || "").toLowerCase())), [students, searchQuery]);

  // file refs map
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const triggerFile = useCallback((id: string) => fileRefs.current[id]?.click(), []);

  const debouncedSave = useDebouncedSave(onFieldBlur, 700);

  return (
    <div className="w-full max-w-full overflow-x-auto border rounded-lg">
      <Table className="text-xs sm:text-sm">
        <TableHeader className="sticky top-0 bg-muted z-10">
          <TableRow>
            <TableHead className="w-[120px] sticky left-0 bg-muted z-20">Photo</TableHead>
            <TableHead className="min-w-[150px] sticky left-[120px] bg-muted z-20">Name</TableHead>
            <TableHead className="min-w-[80px]">Gender</TableHead>
            <TableHead className="min-w-[100px]">Days Attended</TableHead>
            {subjectOrder.map((s) => <TableHead key={s} colSpan={2} className="text-center border-l min-w-[100px]">{s}</TableHead>)}
            <TableHead className="w-[50px] text-center">Status</TableHead>
            <TableHead className="w-[60px] text-center">Actions</TableHead>
          </TableRow>

          <TableRow>
            <TableHead className="sticky left-0 bg-muted z-20"></TableHead>
            <TableHead className="sticky left-[120px] bg-muted z-20"></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            {subjectOrder.map((s) => (
              <React.Fragment key={`${s}-headers`}>
                <TableHead className="text-center border-l">CA</TableHead>
                <TableHead className="text-center border-l">Exam</TableHead>
              </React.Fragment>
            ))}
            <TableHead></TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filtered.map((student, index) => (
            <StudentRow
              key={student.id}
              student={student}
              index={index}
              subjectOrder={subjectOrder}
              savingStatus={savingStatus}
              imageUploadStatus={imageUploadStatus}
              isAiEditing={isAiEditing}
              fileInputRef={(el) => (fileRefs.current[student.id] = el)}
              onTriggerFile={() => triggerFile(student.id)}
              onMarkChange={onMarkChange}
              onFieldChange={onFieldChange}
              onFieldBlur={(id, fields) => debouncedSave(id, fields)}
              onUploadImage={onUploadImage}
              onAiEditImage={onAiEditImage}
              onDelete={onDelete}
              onKeyDown={onKeyDown}
            />
          ))}

          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={subjectOrder.length * 2 + 6} className="text-center h-20 text-muted-foreground">No students found.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
    