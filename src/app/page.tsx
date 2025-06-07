
'use client';

import { useState } from 'react';
import ReportForm from '@/components/report-form';
import ReportPreview from '@/components/report-preview';
import type { ReportData } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Printer, BookMarked, FileText, Eye } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggleButton } from '@/components/theme-toggle-button';


export default function Home() {
  const [reportDetails, setReportDetails] = useState<ReportData | null>(null);
  const { toast } = useToast();

  const handleFormUpdate = (data: ReportData) => {
    setReportDetails(data);
  };

  const handlePrint = () => {
    if (reportDetails) {
      window.print();
    } else {
      toast({
        title: "No Report to Print",
        description: "Please generate a report preview first.",
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
        <section className="lg:col-span-2 no-print">
          <ReportForm onFormUpdate={handleFormUpdate} initialData={reportDetails || undefined} />
        </section>

        <section className="lg:col-span-3 flex flex-col">
          <Card className="shadow-lg flex-grow flex flex-col bg-card text-card-foreground">
            <CardHeader className="no-print">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Eye className="h-6 w-6 text-primary" />
                  <CardTitle className="font-headline text-2xl">Report Preview</CardTitle>
                </div>
                <Button onClick={handlePrint} disabled={!reportDetails} variant="outline" size="sm">
                  <Printer className="mr-2 h-4 w-4" />
                  Print Report
                </Button>
              </div>
              <CardDescription>This is how the report card will look when printed.</CardDescription>
            </CardHeader>
            <CardContent id="report-preview-container" className="flex-grow rounded-b-lg overflow-auto">
              {/* The ReportPreview component itself will manage its internal padding for printing. */}
              {/* The container can have padding for screen view if needed, but it will be overridden by print styles. */}
              {reportDetails ? (
                <ReportPreview data={reportDetails} />
              ) : (
                <div className="text-center text-muted-foreground h-full flex flex-col justify-center items-center p-8">
                  <FileText className="h-24 w-24 mb-6 text-gray-300" />
                  <h3 className="text-xl font-semibold mb-2">No Preview Available</h3>
                  <p>Fill out the form on the left and click "Update Preview" to see the report card here.</p>
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
