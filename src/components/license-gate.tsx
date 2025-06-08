
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLicense } from '@/contexts/license-context';
import { KeyRound, ShieldCheck, Loader2, BookMarked } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LicenseGate() {
  const { validateAndSetLicense, isLoadingLicense: isLicenseContextLoading } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a license key.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    await validateAndSetLicense(licenseKey);
    // The context's useEffect will handle setting isLicensed, which will then unmount this component
    // No need to explicitly set isSubmitting false here if successful, as component will unmount
    // If validation fails, isLicensed remains false, and user can try again.
    // Set isSubmitting to false only if validation fails to allow another attempt.
    // However, validateAndSetLicense updates isLicensed, which causes a re-render.
    // If it becomes licensed, this component isn't rendered anymore.
    // If it does not become licensed, then we can set isSubmitting to false.
    // This is slightly tricky because validateAndSetLicense is async and updates context state.
    // For now, rely on the global isLoadingLicense from context.
    setIsSubmitting(false); // Reset after attempt
  };
  
  // Dialog should be always open if this component is rendered
  // The parent component (page.tsx) controls rendering of LicenseGate

  return (
    <Dialog open={true} modal={true}>
      <DialogContent className="sm:max-w-md p-8" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader className="text-center mb-4">
          <div className="flex justify-center items-center mb-3">
            <BookMarked className="h-10 w-10 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold text-primary">Activate Report Card Generator</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Please enter your license key to unlock the application.
            If you have a free trial key, enter it here.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="licenseKey" className="flex items-center text-sm font-medium">
              <KeyRound className="mr-2 h-4 w-4 text-primary" />
              License Key
            </Label>
            <Input
              id="licenseKey"
              type="text"
              placeholder="Enter your license key"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="text-base"
              required
            />
          </div>
          <Button type="submit" className="w-full text-base py-3" disabled={isSubmitting || isLicenseContextLoading}>
            {(isSubmitting || isLicenseContextLoading) ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-5 w-5" />
            )}
            { (isSubmitting || isLicenseContextLoading) ? 'Validating...' : 'Activate Application'}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ensure your key is entered correctly. For support, contact your administrator.
        </p>
      </DialogContent>
    </Dialog>
  );
}
