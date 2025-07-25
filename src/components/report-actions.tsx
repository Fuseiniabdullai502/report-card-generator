
'use client';

import type { ReportData } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, User, Edit } from 'lucide-react'; // Using MessageSquare for WhatsApp-like icon
import { useToast } from "@/hooks/use-toast";

interface ReportActionsProps {
  report: ReportData;
  onEditReport: (report: ReportData) => void;
}

export default function ReportActions({ report, onEditReport }: ReportActionsProps) {
  const { toast } = useToast();

  const handleEmailParent = () => {
    if (!report.parentEmail) {
      toast({ title: "Missing Email", description: "Parent email is not provided for this student.", variant: "destructive" });
      return;
    }

    const subject = `Report Card: ${report.studentName} - ${report.academicTerm}, ${report.academicYear}`;
    const body = `Dear Parent/Guardian,\n\nHere is a summary of the report card for ${report.studentName} (${report.className}) for ${report.academicTerm}, ${report.academicYear} from ${report.schoolName}.\n\nOverall Performance: ${report.performanceSummary}\nStrengths: ${report.strengths}\nAreas for Improvement: ${report.areasForImprovement}\nOverall Average: ${report.overallAverage !== undefined && report.overallAverage !== null ? report.overallAverage.toFixed(2) + '%' : 'N/A'}\nRank: ${report.rank || 'N/A'}\n\nYou can view and print the full report from the Report Card Generator application if available, or contact the school for the complete version.\n\nSincerely,\n${report.schoolName}`;
    
    const mailtoLink = `mailto:${report.parentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  const handleWhatsAppParent = () => {
    if (!report.parentPhoneNumber) {
      toast({ title: "Missing Phone Number", description: "Parent phone number is not provided for this student.", variant: "destructive" });
      return;
    }
    // Basic cleaning: remove non-digits, keep + if it's the first char
    let phoneNumber = report.parentPhoneNumber.replace(/[^\d+]/g, '');
    if (phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber.substring(1).replace(/\+/g, '');
    } else {
        phoneNumber = phoneNumber.replace(/\+/g, '');
    }


    const message = `Hello! Report for ${report.studentName} (${report.className}) from ${report.schoolName} (${report.academicTerm}, ${report.academicYear}):\nAvg: ${report.overallAverage !== undefined && report.overallAverage !== null ? report.overallAverage.toFixed(2) + '%' : 'N/A'}\nRank: ${report.rank || 'N/A'}\nSummary: ${report.performanceSummary.substring(0, 100) + '...'}\nView full report in the app or contact us.`;
    
    const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappLink, '_blank');
  };

  return (
    <div className="p-3 mb-2 border border-dashed border-primary/50 rounded-md bg-primary/5 shadow-sm no-print">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold text-primary flex items-center">
          <User className="mr-2 h-4 w-4" />
          Share Report for: {report.studentName || 'N/A'} (Entry #{report.studentEntryNumber || 'N/A'})
        </h4>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditReport(report)}
            title="Load this report into the form for editing"
          >
            <Edit className="mr-2 h-4 w-4" /> Edit Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEmailParent}
            disabled={!report.parentEmail}
            title={!report.parentEmail ? "Parent email not available" : "Email report summary to parent"}
          >
            <Mail className="mr-2 h-4 w-4" /> Email Parent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsAppParent}
            disabled={!report.parentPhoneNumber}
            title={!report.parentPhoneNumber ? "Parent phone number not available" : "Send report summary via WhatsApp"}
          >
            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Parent
          </Button>
        </div>
      </div>
       <p className="text-xs text-muted-foreground italic">
        These actions will open your default email/WhatsApp client with a pre-filled message. Automated sending is not directly supported.
      </p>
    </div>
  );
}
