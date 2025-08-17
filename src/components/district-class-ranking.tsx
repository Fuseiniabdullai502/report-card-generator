

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
import type { SchoolRankingData } from '@/app/actions';
import Image from 'next/image';

interface DistrictClassRankingDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  rankingData: SchoolRankingData[];
  districtName: string;
  className: string;
  academicYear?: string | null;
  academicTerm?: string | null;
  subjectName?: string | null;
}

export default function DistrictClassRankingDialog({
  isOpen,
  onOpenChange,
  rankingData,
  districtName,
  className,
  academicYear,
  academicTerm,
  subjectName,
}: DistrictClassRankingDialogProps) {

  const handlePrint = () => {
    // This is a simplified print approach. For more complex needs,
    // a dedicated print-friendly component or CSS adjustments would be better.
    const printContent = document.getElementById('school-ranking-card');
    if (printContent) {
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContents;
      // It's often better to use CSS @media print rules to hide other elements.
    }
  };
  
  const reportTitle = subjectName 
    ? `School Ranking for ${className} - ${subjectName}`
    : `School Performance Ranking for ${className}`;
    
  const reportDescription = subjectName
    ? `Ranking of schools in ${districtName} based on average performance in '${subjectName}' for students in '${className}'.`
    : `Ranking of schools in ${districtName} based on the overall average performance of students in '${className}'.`;

  const termDisplay = academicTerm || "All Terms";
  const yearDisplay = academicYear || "All Years";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <div id="school-ranking-card" className="relative">
          {/* Watermark */}
          {districtName && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                  <p 
                    className="font-bold text-gray-500/5 dark:text-gray-400/5 transform -rotate-45 select-none"
                    style={{
                        fontSize: 'clamp(2rem, 15vw, 8rem)',
                        lineHeight: '1.2',
                        wordBreak: 'break-word',
                    }}
                  >
                      {districtName}
                  </p>
              </div>
          )}
          <div className="relative z-10">
            <DialogHeader>
              <div className="school-ranking-print-header">
                  <div className="flex justify-center mb-2">
                      <Image src="https://upload.wikimedia.org/wikipedia/commons/5/59/Coat_of_arms_of_Ghana.svg" alt="Ghana Coat of Arms" width={60} height={60} />
                  </div>
                  <h2>{districtName} District - {reportTitle}</h2>
                  <p>Academic Session: {yearDisplay}, {termDisplay} | Generated on: {new Date().toLocaleDateString()}</p>
              </div>
              <DialogTitle className="flex items-center text-primary dialog-header-print-hide">
                <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
                {reportTitle}
              </DialogTitle>
              <DialogDescription className="dialog-header-print-hide">
                {reportDescription} ({yearDisplay}, {termDisplay})
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {rankingData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Rank</TableHead>
                      <TableHead>School Name</TableHead>
                      <TableHead className="text-center"># of Students</TableHead>
                      <TableHead className="text-right">{subjectName ? 'Subject' : 'Class'} Average (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingData.map((item) => (
                      <TableRow key={item.schoolName}>
                        <TableCell className="font-bold text-lg">{item.rank}</TableCell>
                        <TableCell className="font-medium">{item.schoolName}</TableCell>
                        <TableCell className="text-center">{item.studentCount}</TableCell>
                        <TableCell className="text-right font-semibold">{item.average.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Data Found</h3>
                    <p className="text-muted-foreground">
                        No reports were found matching your filter criteria to generate a ranking.
                    </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="dialog-footer-print-hide">
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
