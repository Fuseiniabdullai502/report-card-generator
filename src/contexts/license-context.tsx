
'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";

// WARNING: This is a basic client-side license key check for demonstration purposes only.
// It is NOT secure for a production environment as keys are exposed in the client-side code.
// For a real application, license key validation MUST be done on a secure backend server.
const VALID_LICENSE_KEYS = [
  "FREE-TRIAL-XYZ", 
  "SCHOOL-A-123", 
  "TEACHER-PRO-789",
  "RCG-ULTIMATE-001"
]; // Example keys

interface LicenseContextType {
  isLicensed: boolean;
  isLoadingLicense: boolean;
  validateAndSetLicense: (key: string) => Promise<boolean>;
  clearLicense: () => void;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

const LICENSE_STORAGE_KEY = 'report-card-generator-license-key';

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [isLicensed, setIsLicensed] = useState<boolean>(false);
  const [isLoadingLicense, setIsLoadingLicense] = useState<boolean>(true);
  const { toast } = useToast();

  const validateAndStoreKey = useCallback(async (key: string): Promise<boolean> => {
    // Simulate network delay for a more realistic feel if this were a backend call
    // await new Promise(resolve => setTimeout(resolve, 500));
    
    if (VALID_LICENSE_KEYS.includes(key.trim())) {
      try {
        localStorage.setItem(LICENSE_STORAGE_KEY, key.trim());
        setIsLicensed(true);
        toast({ title: "License Activated", description: "Application unlocked successfully." });
        return true;
      } catch (error) {
        console.error("Error saving license to localStorage:", error);
        toast({ title: "Storage Error", description: "Could not save license information.", variant: "destructive" });
        setIsLicensed(false); // Ensure it's not licensed if storage fails
        return false;
      }
    } else {
      setIsLicensed(false);
      toast({ title: "Invalid License Key", description: "The provided license key is not valid.", variant: "destructive" });
      return false;
    }
  }, [toast]);

  useEffect(() => {
    setIsLoadingLicense(true);
    try {
      const storedKey = localStorage.getItem(LICENSE_STORAGE_KEY);
      if (storedKey && VALID_LICENSE_KEYS.includes(storedKey)) {
        setIsLicensed(true);
      } else {
        setIsLicensed(false);
        // If there's an invalid or no key, ensure it's cleared from storage
        // This handles cases where VALID_LICENSE_KEYS might have changed or a stored key is no longer valid
        if (storedKey) localStorage.removeItem(LICENSE_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error accessing localStorage for license:", error);
      setIsLicensed(false); 
    } finally {
      setIsLoadingLicense(false);
    }
  }, []);

  const validateAndSetLicense = async (key: string): Promise<boolean> => {
    setIsLoadingLicense(true);
    const success = await validateAndStoreKey(key);
    setIsLoadingLicense(false);
    return success;
  };

  const clearLicense = useCallback(() => {
    try {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
    } catch (error) {
      console.error("Error removing license from localStorage:", error);
    }
    setIsLicensed(false);
    toast({ title: "License Deactivated", description: "License has been cleared. Please restart or refresh."});
  }, [toast]);

  return (
    <LicenseContext.Provider value={{ isLicensed, isLoadingLicense, validateAndSetLicense, clearLicense }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense(): LicenseContextType {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
