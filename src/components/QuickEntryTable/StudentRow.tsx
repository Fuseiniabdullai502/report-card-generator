"use client";

import React, { useMemo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Wand2, CheckCircle, Trash2, Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";
import { Progress } from "@/components/ui/progress";
import type { ReportData } from "@/lib/schemas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SaveStatus = "idle" | "saving" | "saved";

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

type Props = {
  student: ReportData;
  index: number;
  subjectOrder: string[];
  savingStatus: Record<string, SaveStatus>;
  imageUploadStatus: Record<string, "uploading" | null>;
  isAiEditing: Record<string, boolean>;
  fileInputRef: (el: HTMLInputElement | null) => void;
  onTriggerFile: () => void;
  onMarkChange: (id: string, subject: string, type: "continuousAssessment" | "examinationMark", val: string) => void;
  onFieldChange: <K extends keyof ReportData>(id: string, field: K, value: ReportData[K]) => void;
  onFieldBlur: (id: string, updatedFields: Partial<ReportData>) => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>, id: string) => void;
  onAiEditImage: (student: ReportData) => void;
  onDelete: (student: ReportData) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, studentIndex: number, colId: string) => void;
};

function handleNumberInput(raw: string, cb: (value: string) => void, min = 0, max = 100) {
  if (raw === "") {
    cb("");
    return;
  }
  const n = Number(raw);
  if (Number.isNaN(n)) return;
  cb(String(clamp(n, min, max)));
}

function StudentRow({
  student,
  index,
  subjectOrder,
  savingStatus,
  imageUploadStatus,
  isAiEditing,
  fileInputRef,
  onTriggerFile,
  onMarkChange,
  onFieldChange,
  onFieldBlur,
  onUploadImage,
  onAiEditImage,
  onDelete,
  onKeyDown,
}: Props) {
  const isProcessing = imageUploadStatus[student.id] === "uploading" || !!isAiEditing[student.id];

  const subjectsByName = useMemo(() => {
    const map = new Map(student.subjects.map((s) => [s.subjectName, s]));
    return map;
  }, [student.subjects]);

  return (
    <TableRow key={student.id} className="text-xs sm:text-sm">
      {/* Photo */}
      <TableCell className="sticky left-0 bg-background z-20">
        <div className="flex flex-col gap-2">
          {student.studentPhotoUrl ? (
            <div className="relative w-10 h-14 sm:w-12 sm:h-16">
              <NextImage src={student.studentPhotoUrl} alt={student.studentName ? `${student.studentName} photo` : "student photo"} fill className="rounded object-cover border" />
            </div>
          ) : (
            <div className="w-10 h-14 sm:w-12 sm:h-16 bg-muted flex items-center justify-center rounded">
              <ImageIcon className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
            </div>
          )}

          <input ref={fileInputRef} type="file" id={`photo-${student.id}`} className="sr-only" accept="image/*" onChange={(e) => onUploadImage(e, student.id)} disabled={isProcessing} aria-label={`Upload photo for ${student.studentName || "student"}`} />

          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={onTriggerFile} disabled={isProcessing} aria-label={`Choose photo for ${student.studentName || "student"}`} title={`Upload photo for ${student.studentName || "student"}`}>
              <Upload className="h-4 w-4" />
            </Button>

            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onAiEditImage(student)} disabled={!student.studentPhotoUrl || isProcessing} aria-label={`AI edit photo for ${student.studentName || "student"}`}>
              {isAiEditing[student.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            </Button>
          </div>

          {imageUploadStatus[student.id] === "uploading" && <Progress value={100} className="h-1 w-full animate-pulse" aria-label="Image uploading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100} />}
        </div>
      </TableCell>

      {/* Name */}
      <TableCell className="sticky left-[120px] bg-background z-20">
        <label htmlFor={`studentName-${student.id}`} className="sr-only">Student name</label>
        <Input id={`studentName-${student.id}`} value={student.studentName ?? ""} onChange={(e) => onFieldChange(student.id, "studentName", e.target.value)} onKeyDown={(e) => onKeyDown(e, index, "studentName")} onBlur={() => onFieldBlur(student.id, { studentName: student.studentName })} className="h-8 text-xs sm:h-9 sm:text-sm" aria-label={`Name for student ${student.studentName || index + 1}`} disabled={savingStatus[student.id] === "saving"} />
      </TableCell>

      {/* Gender */}
      <TableCell>
        <label htmlFor={`gender-${student.id}`} className="sr-only">Gender</label>
        <Select value={student.gender || ""} onValueChange={(value) => { onFieldChange(student.id, "gender", value); onFieldBlur(student.id, { gender: value }); }}>
          <SelectTrigger id={`gender-${student.id}`} className="h-9 w-[100px]" aria-label={`Gender for ${student.studentName || index + 1}`}>
            <SelectValue placeholder="Select gender..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Days */}
      <TableCell>
        <label htmlFor={`daysAttended-${student.id}`} className="sr-only">Days attended</label>
        <Input type="number" id={`daysAttended-${student.id}`} value={student.daysAttended ?? ""} onChange={(e) => onFieldChange(student.id, "daysAttended", e.target.value === "" ? null : Number(e.target.value))} onKeyDown={(e) => onKeyDown(e, index, "daysAttended")} onBlur={() => onFieldBlur(student.id, { daysAttended: student.daysAttended })} className="h-8 text-xs sm:h-9 sm:text-sm text-center w-[80px]" min={0} aria-label={`Days attended for ${student.studentName || index + 1}`} disabled={savingStatus[student.id] === "saving"} />
      </TableCell>

      {/* Subjects */}
      {subjectOrder.map((sub) => {
        const subjectData = subjectsByName.get(sub);
        return (
          <React.Fragment key={`${student.id}-${sub}`}>
            <TableCell className="border-l p-1">
              <label htmlFor={`${sub}-ca-${student.id}`} className="sr-only">{sub} continuous assessment</label>
              <Input type="number" id={`${sub}-ca-${student.id}`} placeholder="-" value={subjectData?.continuousAssessment ?? ""} onChange={(e) => handleNumberInput(e.target.value, (val) => onMarkChange(student.id, sub, "continuousAssessment", val), 0, 60)} onKeyDown={(e) => onKeyDown(e, index, `${sub}-ca`)} onBlur={() => onFieldBlur(student.id, { subjects: student.subjects })} className="text-center h-8 w-[60px] text-xs sm:h-9 sm:text-sm" min={0} max={60} disabled={savingStatus[student.id] === "saving"} aria-label={`${sub} continuous assessment for ${student.studentName || index + 1}`} />
            </TableCell>
            <TableCell className="border-l p-1">
              <label htmlFor={`${sub}-exam-${student.id}`} className="sr-only">{sub} exam</label>
              <Input type="number" placeholder="-" id={`${sub}-exam-${student.id}`} value={subjectData?.examinationMark ?? ""} onChange={(e) => handleNumberInput(e.target.value, (val) => onMarkChange(student.id, sub, "examinationMark", val))} onKeyDown={(e) => onKeyDown(e, index, `${sub}-exam`)} onBlur={() => onFieldBlur(student.id, { subjects: student.subjects })} className="text-center h-8 w-[60px] text-xs sm:h-9 sm:text-sm" min={0} max={100} disabled={savingStatus[student.id] === "saving"} aria-label={`${sub} exam for ${student.studentName || index + 1}`} />
            </TableCell>
          </React.Fragment>
        );
      })}

      {/* Status */}
      <TableCell>
        <div className="flex justify-center" aria-live="polite">
          {savingStatus[student.id] === "saving" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
          {savingStatus[student.id] === "saved" && <CheckCircle className="h-4 w-4 text-green-500" aria-hidden />}
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="text-center">
        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => onDelete(student)} aria-label={`Delete ${student.studentName || "student"}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default React.memo(StudentRow);
