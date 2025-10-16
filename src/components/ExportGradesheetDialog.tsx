"use client";

import React from "react";
import type { ReportData } from "@/lib/schemas";

interface ExportGradesheetDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  subjects: string[];
  students: ReportData[];
  className: string;
}

export default function ExportGradesheetDialog({ isOpen, onOpenChange, subjects, students, className }: ExportGradesheetDialogProps) {
  // This is a placeholder component.
  // The full implementation would include a dialog to export grades to Excel.
  return null;
}
