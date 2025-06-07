
'use client';

import { useState } from 'react';
import ReportForm from '@/components/report-form';
import ReportPreview from '@/components/report-preview';
import type { ReportData } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Printer, BookMarked, FileText, Eye, ListPlus, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { defaultReportData } from '@/lib/schemas'; // Assuming you might add default data structure

export default function Home() {
  // State for the report currently being edited in the form
  const [currentEditingReport, setCurrentEditingReport] = useState<ReportData | null>(JSON.parse(JSON.stringify(defaultReportData)));
  // State for the list of reports to be printed/previewed
  const [reportPrintList, setReportPrintList] = useState<ReportData[]>([]);
  const { toast } = useToast();

  const handleFormUpdate = (data: ReportData) => {
    setCurrentEditingReport(data);
  };

  const handleAddToList = () => {
    if (currentEditingReport) {
      // Basic validation check, ideally from schema, before adding
      if (!currentEditingReport.studentName || !currentEditingReport.className) {
        toast({
          title: "Incomplete Report",
          description: "Please ensure student name and class are filled before adding to the list.",
          variant: "destructive",
        });
        return;
      }
      setReportPrintList(prevList => [...prevList, { ...currentEditingReport, id: `report-${Date.now()}-${Math.random()}` }]); // Add a unique key if not present
      toast({
        title: "Report Added to List",
        description: `${currentEditingReport.studentName}'s report is ready for batch preview.`,
      });
      // Optionally reset form or currentEditingReport for the next entry
      setCurrentEditingReport(JSON.parse(JSON.stringify(defaultReportData))); // Reset form to default/empty
    } else {
       toast({
        title: "No Report Data",
        description: "Please fill the form to add a report to the list.",
        variant: "destructive",
      });
    }
  };

  const handleClearList = () => {
    setReportPrintList([]);
    toast({
      title: "Print List Cleared",
      description: "All reports have been removed from the preview list.",
    });
  }

  const handlePrint = () => {
    if (reportPrintList.length > 0) {
      window.print();
    } else {
      toast({
        title: "No Reports in List",
        description: "Please add reports to the list before printing.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-body bg-background text-foreground">
      <header className="mb-8 text-center no-print relative">
        <div className="flex items-center justify-center gap-3">
         <BookMarked className="h-10 w-10 text-primary" />
         <h1 className="text-4xl font-headline font-bold text-primary">Report Card Generator</h1>
        </div>
        <p className="text-muted-foreground mt-2">Easily create, customize, and print student report cards.</p>
        <div className="absolute top-0 right-0">
          <ThemeToggleButton />
        </div>
      </header>

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-8">
        <section className="lg:col-span-2 no-print space-y-4">
          <ReportForm onFormUpdate={handleFormUpdate} initialData={currentEditingReport || defaultReportData} />
          <Button onClick={handleAddToList} className="w-full" variant="outline">
            <ListPlus className="mr-2 h-4 w-4" />
            Add Current Report to Print List
          </Button>
        </section>

        <section className="lg:col-span-3 flex flex-col">
          <Card className="shadow-lg flex-grow flex flex-col bg-card text-card-foreground">
            <CardHeader className="no-print">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Eye className="h-6 w-6 text-primary" />
                  <CardTitle className="font-headline text-2xl">Report Print Preview ({reportPrintList.length} {reportPrintList.length === 1 ? 'Report' : 'Reports'})</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleClearList} disabled={reportPrintList.length === 0} variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear List
                  </Button>
                  <Button onClick={handlePrint} disabled={reportPrintList.length === 0} variant="outline" size="sm">
                    <Printer className="mr-2 h-4 w-4" />
                    Print All ({reportPrintList.length})
                  </Button>
                </div>
              </div>
              <CardDescription>This area shows all reports added to the print list. Each will attempt to print on a new page.</CardDescription>
            </CardHeader>
            <CardContent id="report-preview-container" className="flex-grow rounded-b-lg overflow-auto p-0 md:p-2 bg-gray-100 dark:bg-gray-800">
              {reportPrintList.length > 0 ? (
                reportPrintList.map((reportData, index) => (
                  <ReportPreview key={reportData.id || `report-${index}`} data={reportData} />
                ))
              ) : (
                <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8 bg-card">
                  <FileText className="h-24 w-24 mb-6 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-xl font-semibold mb-2">No Reports in Print List</h3>
                  <p>Fill out the form, then click "Add Current Report to Print List" to see reports here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="text-center mt-12 py-6 text-sm text-muted-foreground border-t no-print">
        <p>&copy; {new Date().getFullYear()} Report Card Generator. Professionally designed for educators.</p>
      </footer>
    </div>
  );
}
