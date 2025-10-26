
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import type { CustomUser } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { Loader2, Settings, X, FilePlus, BookOpenCheck, FileUp, Trash2, Printer, ChevronDown, FileDown } from 'lucide-react';
import ReportForm from '@/components/report-form';
import ReportPreview from '@/components/report-preview';
import ReportActions from '@/components/report-actions';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { defaultReportData } from '@/lib/schemas';
import type { ReportData } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';
import { calculateOverallAverage } from '@/lib/calculations';
import ImportStudentsDialog from '@/components/import-students-dialog';
import ExportGradesheetDialog from '@/components/ExportGradesheetDialog';
import ImportGradesheetDialog from '@/components/ImportGradesheetDialog';
import AddHobbyDialog from '@/components/AddHobbyDialog';
import AddSubjectDialog from '@/components/AddSubjectDialog';
import QuickEntryTable from '@/components/QuickEntryTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/datepicker';
import { shsProgramOptions } from '@/lib/curriculum';
import SignaturePad from '@/components/signature-pad';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const academicTermOptions = ["First Term", "Second Term", "Third Term", "First Semester", "Second Semester"];
const academicYearOptions = ["2024/2025", "2025/2026", "2026/2027", "2027/2028", "2028/2029", "2029/2030"];
const templateOptions = [
    { id: 'default', name: 'Default Professional' },
    { id: 'professionalBlue', name: 'Professional Blue' },
    { id: 'elegantGreen', name: 'Elegant Green' },
    { id: 'minimalistGray', name: 'Minimalist Gray' },
    { id: 'academicRed', name: 'Academic Red' },
    { id: 'creativeTeal', name: 'Creative Teal' },
];

function SessionControls({ sessionDefaults, onSessionChange, user }: { sessionDefaults: Partial<ReportData>, onSessionChange: (newDefaults: Partial<ReportData>) => void, user: CustomUser }) {
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState(sessionDefaults.schoolLogoDataUri || '');

  const handleDateChange = (date: Date | undefined) => {
    onSessionChange({ ...sessionDefaults, reopeningDate: date ? date.toISOString() : null });
  };
  
  const handleSaveSignature = (signature: string) => {
    onSessionChange({ ...sessionDefaults, headMasterSignatureDataUri: signature });
    setIsSignaturePadOpen(false);
  };
  
  const handleSaveLogo = () => {
    onSessionChange({ ...sessionDefaults, schoolLogoDataUri: logoUrl });
    setIsLogoModalOpen(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="space-y-1">
          <Label htmlFor="session-schoolName">School Name</Label>
          <Input id="session-schoolName" value={sessionDefaults.schoolName || ''} onChange={(e) => onSessionChange({ ...sessionDefaults, schoolName: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-className">Class Name</Label>
          <Select value={sessionDefaults.className || ''} onValueChange={(value) => onSessionChange({ ...sessionDefaults, className: value })}>
            <SelectTrigger id="session-className"><SelectValue placeholder="Select class..." /></SelectTrigger>
            <SelectContent>
              {user.classNames?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-shsProgram">SHS Program (if applicable)</Label>
          <Select value={sessionDefaults.shsProgram || ''} onValueChange={(value) => onSessionChange({ ...sessionDefaults, shsProgram: value })}>
            <SelectTrigger id="session-shsProgram"><SelectValue placeholder="Select SHS program..." /></SelectTrigger>
            <SelectContent>
                {shsProgramOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-academicYear">Academic Year</Label>
          <Select value={sessionDefaults.academicYear || ''} onValueChange={(value) => onSessionChange({ ...sessionDefaults, academicYear: value })}>
            <SelectTrigger id="session-academicYear"><SelectValue placeholder="Select year..." /></SelectTrigger>
            <SelectContent>
              {academicYearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-academicTerm">Academic Term</Label>
          <Select value={sessionDefaults.academicTerm || ''} onValueChange={(value) => onSessionChange({ ...sessionDefaults, academicTerm: value })}>
            <SelectTrigger id="session-academicTerm"><SelectValue placeholder="Select term..." /></SelectTrigger>
            <SelectContent>
              {academicTermOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-totalSchoolDays">Total School Days</Label>
          <Input id="session-totalSchoolDays" type="number" value={sessionDefaults.totalSchoolDays ?? ''} onChange={(e) => onSessionChange({ ...sessionDefaults, totalSchoolDays: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-reopeningDate">Next Term Reopening Date</Label>
          <DatePicker value={sessionDefaults.reopeningDate ? new Date(sessionDefaults.reopeningDate) : null} onChange={handleDateChange} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-template">Report Template</Label>
          <Select value={sessionDefaults.selectedTemplateId || 'default'} onValueChange={(value) => onSessionChange({ ...sessionDefaults, selectedTemplateId: value })}>
            <SelectTrigger id="session-template"><SelectValue /></SelectTrigger>
            <SelectContent>
              {templateOptions.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex flex-col justify-end">
            <Button variant="outline" onClick={() => setIsLogoModalOpen(true)}>Set School Logo</Button>
        </div>
        <div className="space-y-1 flex flex-col justify-end">
          <Button variant="outline" onClick={() => setIsSignaturePadOpen(true)}>Set Headmaster Signature</Button>
        </div>
      </div>
      
      <Dialog open={isSignaturePadOpen} onOpenChange={setIsSignaturePadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Headmaster's Signature</DialogTitle><DialogDescription>Draw the signature below. It will be applied to all reports in this session.</DialogDescription></DialogHeader>
          <SignaturePad onSave={handleSaveSignature} initialDataUrl={sessionDefaults.headMasterSignatureDataUri} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isLogoModalOpen} onOpenChange={setIsLogoModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set School Logo</DialogTitle><DialogDescription>Enter the URL of the school's logo. This will be applied to all reports in this session.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="logo-url" className="text-right">Logo URL</Label>
                  <Input id="logo-url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="col-span-3"/>
              </div>
            </div>
          <DialogFooter><Button onClick={handleSaveLogo}>Save Logo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function AppContent({ user }: { user: CustomUser }) {
  const [showSessionControls, setShowSessionControls] = useState(false);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [currentEditingReport, setCurrentEditingReport] = useState<ReportData | null>(null);
  const [sessionDefaults, setSessionDefaults] = useState<Partial<ReportData>>({
    schoolName: user.schoolName ?? '',
    region: user.region ?? '',
    district: user.district ?? '',
    circuit: user.circuit ?? '',
    className: user.classNames?.[0] ?? '',
  });

  const isEditing = !!currentEditingReport;

  const handleSaveReport = async (reportData: ReportData) => {
    // This is a placeholder for the actual save logic.
    // In a real app, this would save to a database.
  };

  const handleResetForm = () => {
    setCurrentEditingReport(null);
  };

  return (
    <>
      <header className="mb-4 no-print">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Report Card Generator</h1>
          <Button onClick={() => setShowSessionControls(!showSessionControls)} variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Session Controls
          </Button>
        </div>
        {showSessionControls && (
          <div className="mt-4 p-4 border rounded-lg bg-card animate-fade-in">
            <SessionControls
              sessionDefaults={sessionDefaults}
              onSessionChange={setSessionDefaults}
              user={user}
            />
          </div>
        )}
      </header>

      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
        <ReportForm
            initialData={currentEditingReport || { ...defaultReportData, ...sessionDefaults, id: uuidv4(), studentEntryNumber: reports.length + 1 }}
            isEditing={isEditing}
            onFormUpdate={(updatedData) => {
                if(isEditing) {
                    // update the state for the report being edited
                }
            }}
            sessionDefaults={sessionDefaults}
            onSaveReport={handleSaveReport}
            onResetForm={handleResetForm}
          />
        </div>
        <div className="flex flex-col">
          {/* Dashboard/Preview area will go here */}
        </div>
      </div>
    </>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-body bg-background text-foreground relative">
      <AppContent user={user} />
      <footer className="text-center mt-12 py-6 text-sm text-muted-foreground border-t no-print">
        <p>&copy; {new Date().getFullYear()} Report Card Generator. Professionally designed for educators.</p>
      </footer>
    </div>
  );
}
