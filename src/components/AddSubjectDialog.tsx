"use client";

import React from "react";

interface AddSubjectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddSubject: (newSubject: string) => void;
}

export default function AddSubjectDialog({ isOpen, onOpenChange, onAddSubject }: AddSubjectDialogProps) {
  // This is a placeholder component.
  // The full implementation would include a dialog to add a new subject.
  return null;
}
