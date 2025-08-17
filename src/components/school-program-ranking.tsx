

'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trophy, Printer, FileText } from 'lucide-react';
import type { StudentRankingData } from '@/app/actions';
import Image from 'next/image';

interface SchoolProgramRankingDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  rankingData: StudentRankingData[];
  schoolName: string;
  className: string;
  programName: string;
}

export default function SchoolProgramRankingDialog({
  isOpen,
  onOpenChange,
  rankingData,
  schoolName,
  className,
  programName,
}: SchoolProgramRankingDialogProps) {

  const handlePrint = () => {
    // A simplified print approach. For better results, use @media print CSS rules.
    const printContent = document.getElementById('school-program-ranking-card');
    if (printContent) {
        const title = document.title;
        document.title = `${schoolName} - ${className} ${programName} Ranking`;
        const body = document.body.innerHTML;
        document.body.innerHTML = printContent.innerHTML;
        window.print();
        document.body.innerHTML = body;
        document.title = title;
    }
  };
  
  const reportTitle = `Student Ranking for ${className} - ${programName}`;
  const reportDescription = `Ranking of students in ${className} (${programName} program) at ${schoolName} based on their overall average.`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div id="school-program-ranking-card" className="relative">
          {/* Watermark */}
          {schoolName && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                  <p 
                    className="font-bold text-gray-500/10 dark:text-gray-400/10 transform -rotate-45 select-none"
                    style={{
                        fontSize: 'clamp(2rem, 15vw, 8rem)',
                        lineHeight: '1.2',
                        wordBreak: 'break-word',
                    }}
                  >
                      {schoolName}
                  </p>
              </div>
          )}
          <div className="relative z-10">
            <DialogHeader>
              <div className="school-ranking-print-header hidden print:block mb-4">
                  <div className="flex justify-center mb-2">
                      <Image src="https://upload.wikimedia.org/wikipedia/commons/5/59/Coat_of_arms_of_Ghana.svg" alt="Ghana Coat of Arms" width={60} height={60} />
                  </div>
                  <h2 className="text-lg font-bold">{schoolName}</h2>
                  <h3 className="text-base font-semibold">{reportTitle}</h3>
                  <p className="text-xs">Generated on: {new Date().toLocaleDateString()}</p>
              </div>
              <div className="print:hidden">
                <DialogTitle className="flex items-center text-primary">
                  <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
                  {reportTitle}
                </DialogTitle>
                <DialogDescription>
                  {reportDescription}
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="py-4">
              {rankingData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Rank</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="text-right">Overall Average (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-bold text-lg">{item.rank}</TableCell>
                        <TableCell className="font-medium">{item.studentName}</TableCell>
                        <TableCell className="text-right font-semibold">{item.average.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Students Found</h3>
                    <p className="text-muted-foreground">
                        No student reports were found for this class and program to generate a ranking.
                    </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={handlePrint} disabled={rankingData.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
