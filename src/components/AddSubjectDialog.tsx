"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookPlus } from "lucide-react";

interface AddSubjectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddSubject: (newSubject: string) => void;
}

export default function AddSubjectDialog({
  isOpen,
  onOpenChange,
  onAddSubject,
}: AddSubjectDialogProps) {
  const [subjectName, setSubjectName] = useState("");

  const handleAdd = () => {
    if (subjectName.trim()) {
      onAddSubject(subjectName.trim());
      setSubjectName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <BookPlus className="mr-2 h-5 w-5" />
            Add New Subject
          </DialogTitle>
          <DialogDescription>
            Enter the name of the new subject you want to add to the list for
            the Quick Entry table.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="subject-name">Subject Name</Label>
          <Input
            id="subject-name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="e.g., Further Mathematics"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleAdd} disabled={!subjectName.trim()}>
            Add Subject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
