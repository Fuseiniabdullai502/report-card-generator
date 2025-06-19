
'use client';

import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LoginButton: React.FC = () => {
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // AuthProvider will handle the redirect or UI update upon successful sign-in
      toast({ title: "Signed In", description: "Successfully signed in with Google."});
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      toast({
        title: "Sign-In Failed",
        description: error.message || "Could not sign in with Google. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button onClick={handleGoogleSignIn} variant="default" size="lg" className="mt-4">
      <LogIn className="mr-2 h-5 w-5" /> Sign in with Google
    </Button>
  );
};

export default LoginButton;
