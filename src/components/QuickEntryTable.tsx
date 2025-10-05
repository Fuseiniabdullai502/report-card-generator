
"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Wand2, CheckCircle, Trash2, Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";
import { Progress } from "@/components/ui/progress";
import type { ReportData } from "@/lib/schemas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type TableProps = {
  students: ReportData[];
  subjectOrder: string[];
  searchQuery: string;

  savingStatus: Record<string, "idle" | "saving" | "saved">;
  imageUploadStatus: Record<string, "uploading" | null>;
  isAiEditing: Record<string, boolean>;

  onMarkChange: (id: string, subject: string, type: "continuousAssessment" | "examinationMark", val: string) => void;
  onFieldChange: (id: string, field: keyof ReportData, value: any) => void;
  onFieldBlur: (id: string, updatedFields: Partial<ReportData>) => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>, id: string) => void;
  onAiEditImage: (student: ReportData) => void;
  onDelete: (student: ReportData) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, studentIndex: number, colId: string) => void;
};

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
}: TableProps) {
  const filtered = students.filter((s) =>
    s.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table className="text-xs sm:text-sm">
        <TableHeader className="sticky top-0 bg-muted z-10">
          <TableRow>
            <TableHead className="w-[120px] sticky left-0 bg-muted z-20">Photo</TableHead>
            <TableHead className="min-w-[150px] sticky left-[120px] bg-muted z-20">Name</TableHead>
            <TableHead className="min-w-[80px]">Gender</TableHead>
            <TableHead className="min-w-[100px]">Days Attended</TableHead>
            {subjectOrder.map((s) => (
              <TableHead key={s} colSpan={2} className="text-center border-l min-w-[100px]">
                {s}
              </TableHead>
            ))}
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
          {filtered.map((student, index) => {
            const isProcessing =
              imageUploadStatus[student.id] === "uploading" || isAiEditing[student.id];
            return (
              <TableRow key={student.id} className="text-xs sm:text-sm">
                {/* Photo */}
                <TableCell className="sticky left-0 bg-background z-20">
                  <div className="flex flex-col gap-2">
                    {student.studentPhotoUrl ? (
                      <div className="relative w-10 h-14 sm:w-12 sm:h-16">
                        <NextImage
                          src={student.studentPhotoUrl}
                          alt={student.studentName || "Student"}
                          layout="fill"
                          className="rounded object-cover border"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-14 sm:w-12 sm:h-16 bg-muted flex items-center justify-center rounded">
                        <ImageIcon className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                      </div>
                    )}

                    <input
                      type="file"
                      id={`photo-${student.id}`}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => onUploadImage(e, student.id)}
                      disabled={isProcessing}
                    />
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() =>
                          document.getElementById(`photo-${student.id}`)?.click()
                        }
                        disabled={isProcessing}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => onAiEditImage(student)}
                        disabled={!student.studentPhotoUrl || isProcessing}
                      >
                        {isAiEditing[student.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {imageUploadStatus[student.id] === "uploading" && (
                      <Progress value={100} className="h-1 w-full animate-pulse" />
                    )}
                  </div>
                </TableCell>

                {/* Name */}
                <TableCell className="sticky left-[120px] bg-background z-20">
                  <Input
                    id={`studentName-${student.id}`}
                    value={student.studentName || ""}
                    onChange={(e) =>
                      onFieldChange(student.id, "studentName", e.target.value)
                    }
                    onKeyDown={(e) => onKeyDown(e, index, "studentName")}
                    onBlur={() => onFieldBlur(student.id, { studentName: student.studentName })}
                    className="h-8 text-xs sm:h-9 sm:text-sm"
                  />
                </TableCell>

                {/* Gender */}
                <TableCell>
                  <Select 
                    value={student.gender || ''} 
                    onValueChange={(value) => {
                        onFieldChange(student.id, 'gender', value);
                        onFieldBlur(student.id, { gender: value });
                    }}
                  >
                      <SelectTrigger id={`gender-${student.id}`} className="h-9 w-[100px]">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                  </Select>
                </TableCell>

                {/* Days */}
                <TableCell>
                  <Input
                    type="number"
                    id={`daysAttended-${student.id}`}
                    value={student.daysAttended ?? ""}
                    onChange={(e) =>
                      onFieldChange(
                        student.id,
                        "daysAttended",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    onKeyDown={(e) => onKeyDown(e, index, "daysAttended")}
                    onBlur={() =>
                      onFieldBlur(student.id, { daysAttended: student.daysAttended })
                    }
                    className="h-8 text-xs sm:h-9 sm:text-sm text-center w-[80px]"
                  />
                </TableCell>

                {/* Subjects */}
                {subjectOrder.map((sub) => {
                  const subjectData = student.subjects.find((s) => s.subjectName === sub);
                  return (
                    <React.Fragment key={`${student.id}-${sub}`}>
                      <TableCell className="border-l p-1">
                        <Input
                          type="number"
                          id={`${sub}-ca-${student.id}`}
                          placeholder="-"
                          value={subjectData?.continuousAssessment ?? ""}
                          onChange={(e) =>
                            onMarkChange(student.id, sub, "continuousAssessment", e.target.value)
                          }
                          onKeyDown={(e) => onKeyDown(e, index, `${sub}-ca`)}
                          onBlur={() => onFieldBlur(student.id, { subjects: student.subjects })}
                          className="text-center h-8 w-[60px] text-xs sm:h-9 sm:text-sm"
                        />
                      </TableCell>
                      <TableCell className="border-l p-1">
                        <Input
                          type="number"
                          placeholder="-"
                          id={`${sub}-exam-${student.id}`}
                          value={subjectData?.examinationMark ?? ""}
                          onChange={(e) =>
                            onMarkChange(student.id, sub, "examinationMark", e.target.value)
                          }
                          onKeyDown={(e) => onKeyDown(e, index, `${sub}-exam`)}
                          onBlur={() => onFieldBlur(student.id, { subjects: student.subjects })}
                          className="text-center h-8 w-[60px] text-xs sm:h-9 sm:text-sm"
                        />
                      </TableCell>
                    </React.Fragment>
                  );
                })}

                {/* Status */}
                <TableCell>
                  <div className="flex justify-center">
                    {savingStatus[student.id] === "saving" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {savingStatus[student.id] === "saved" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onDelete(student)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}

          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={subjectOrder.length * 2 + 6}
                className="text-center h-20 text-muted-foreground"
              >
                No students found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
