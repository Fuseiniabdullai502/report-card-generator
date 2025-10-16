"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookPlus as BookPlusIcon,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Search as SearchIcon,
} from "lucide-react";
import type { ReportData } from "@/lib/schemas";

type ToolbarProps = {
  selectedClass: string;
  setSelectedClass: (v: string) => void;
  availableClasses: string[];
  studentsInClass: ReportData[];
  subjectsForClass: string[];
  subjectOrder: string[];
  setSubjectOrder: (order: string[]) => void;

  // Search state is kept in parent (so the table can filter)
  searchQuery: string;
  setSearchQuery: (v: string) => void;

  // Opens your “Add New Subject” dialog (handled in QuickEntryDialogs)
  onOpenAddSubject?: () => void;
};

export default function QuickEntryToolbar({
  selectedClass,
  setSelectedClass,
  availableClasses,
  studentsInClass,
  subjectsForClass,
  subjectOrder,
  setSubjectOrder,
  searchQuery,
  setSearchQuery,
  onOpenAddSubject,
}: ToolbarProps) {
  // save order per class
  const handleSubjectOrderChange = (newOrder: string[]) => {
    setSubjectOrder(newOrder);
    if (selectedClass) {
      try {
        localStorage.setItem(
          `subjectOrder_${selectedClass}`,
          JSON.stringify(newOrder)
        );
      } catch {
        /* no-op */
      }
    }
  };

  const moveSubject = (index: number, direction: "up" | "down") => {
    const newOrder = [...subjectOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [
        newOrder[targetIndex],
        newOrder[index],
      ];
      handleSubjectOrderChange(newOrder);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
      {/* Class select */}
      <div className="lg:col-span-1">
        <Label htmlFor="class-select" className="text-xs text-muted-foreground">
          Select a Class
        </Label>
        <div className="flex items-center gap-2">
          <Select
            value={selectedClass}
            onValueChange={setSelectedClass}
          >
            <SelectTrigger id="class-select" className="w-full">
              <SelectValue placeholder="Select a class..." />
            </SelectTrigger>
            <SelectContent>
              {availableClasses.length > 0 ? (
                availableClasses.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  No classes found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {selectedClass && (
            <div className="text-xs sm:text-sm font-semibold text-primary whitespace-nowrap">
              (Total: {studentsInClass.length})
            </div>
          )}
        </div>
      </div>

      {/* Subject manager */}
      <div className="lg:col-span-1">
        <Label className="text-xs text-muted-foreground">
          Manage & Order Subjects
        </Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full"
              disabled={!selectedClass}
            >
              <BookPlusIcon className="mr-2 h-4 w-4 text-purple-500" />
              Manage Subjects
              <ChevronDown className="ml-auto h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
            <DropdownMenuLabel>Visible Subjects</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-60">
              {subjectsForClass.map((subject) => {
                const visible = subjectOrder.includes(subject);
                const idx = subjectOrder.indexOf(subject);
                return (
                  <div key={subject} className="flex items-center pr-2">
                    <DropdownMenuCheckboxItem
                      className="flex-1"
                      checked={visible}
                      onCheckedChange={(checked) => {
                        const newOrder = checked
                          ? [...subjectOrder, subject]
                          : subjectOrder.filter((s) => s !== subject);
                        handleSubjectOrderChange(newOrder);
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {subject}
                    </DropdownMenuCheckboxItem>
                    {/* Up/Down reorder (disabled when hidden) */}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveSubject(idx, "up")}
                        disabled={!visible || idx === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveSubject(idx, "down")}
                        disabled={!visible || idx === subjectOrder.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </ScrollArea>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onOpenAddSubject?.();
              }}
            >
              <BookPlusIcon className="mr-2 h-4 w-4" />
              Add New Subject to List…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="sm:col-span-2 lg:col-span-2">
        <Label
          htmlFor="search-student"
          className="text-xs text-muted-foreground"
        >
          Search Student
        </Label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-student"
            placeholder="Type to search by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            disabled={!selectedClass}
          />
        </div>
      </div>
    </div>
  );
}