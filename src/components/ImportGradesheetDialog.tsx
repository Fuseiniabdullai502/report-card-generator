"use client";

import React from "react";
import type { SubjectEntry } from "@/lib/schemas";

interface ImportGradesheetDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (dataToImport: { studentName: string, subjects: SubjectEntry[] }[]) => void;
  className: string;
}

export default function ImportGradesheetDialog({ isOpen, onOpenChange, onImport, className }: ImportGradesheetDialogProps) {
  // This is a placeholder component.
  // The full implementation would include a dialog to import grades from Excel.
  return null;
}
