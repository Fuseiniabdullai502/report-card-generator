'use client';

import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { verifyInviteAction, completeInviteAction } from '@/app/actions';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Redirect if user is already logged in
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Show a loading screen while auth state is resolving or if a redirect is imminent
  if (authLoading || user) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
    }

    setIsLoading(true);

    try {
      const isAdminRegistering = email.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();

      // Step 1: For regular users, verify the invite BEFORE creating the auth user.
      if (!isAdminRegistering) {
        const inviteCheck = await verifyInviteAction(email);
        if (!inviteCheck.success) {
          throw new Error("Registration failed. You must be invited by an administrator.");
        }
      }
      
      // Step 2: Now that checks have passed, create the user in Firebase Auth.
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newFirebaseUser = userCredential.user;

      // Determine the role.
      const role = isAdminRegistering ? 'admin' : 'user';

      // Step 3: Create the user document in Firestore.
      await setDoc(doc(db, 'users', newFirebaseUser.uid), {
        email: newFirebaseUser.email,
        role: role,
        createdAt: serverTimestamp(),
      });
      
      // Step 4: If it was a regular user, complete their invite.
      if (!isAdminRegistering) {
          await completeInviteAction(email, newFirebaseUser.uid);
      }
      
      // Registration successful, redirect to home page.
      // AuthProvider will pick up the new user state and their role from the document we just created.
      router.push('/');

    } catch (err) {
      let errorMessage = "An unknown error occurred during registration.";
      if (err instanceof Error && (err as any).code) {
        const errorCode = (err as any).code;
        switch (errorCode) {
          case 'auth/email-already-in-use':
            errorMessage = "This email is already in use. Please log in or use a different email.";
            break;
          case 'auth/invalid-email':
            errorMessage = "Please enter a valid email address.";
            break;
          case 'auth/weak-password':
            errorMessage = "Password is too weak. It must be at least 6 characters.";
            break;
          default:
            errorMessage = (err as any).message; // Use the actual message from the error object
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline text-primary">Create Your Account</CardTitle>
          <CardDescription>Enter your details to register. You must be invited by an admin unless you are the admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@school.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Must be at least 6 characters"
                  required
                  className="pr-10"
                />
                 <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
               <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                 <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <UserPlus className="mr-2" />}
              Register
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <p>Already have an account?&nbsp;</p>
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Log In
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
