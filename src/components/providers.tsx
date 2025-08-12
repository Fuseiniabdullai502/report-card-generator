
'use client';

import React, { useEffect } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/components/auth-provider';
import { setLogLevel } from 'firebase/firestore';

export function Providers({ children }: { children: React.ReactNode }) {
  
  useEffect(() => {
    // This is the correct place for browser-specific code.
<<<<<<< HEAD
    // Enable Firestore debug logging ONLY on the client side during development.
=======
    // Enable Firestore debug logging on the client side.
>>>>>>> 982cbcaf (Error: Element type is invalid: expected a string (for built-in componen)
    if (process.env.NODE_ENV === 'development') {
      setLogLevel('debug');
    }
  }, []);

  return (
    <ThemeProvider
      defaultTheme="light"
      storageKey="report-card-theme"
    >
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
