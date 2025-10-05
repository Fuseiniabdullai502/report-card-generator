
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Eye, EyeOff, User, Phone, CheckCircle, ArrowLeft, Globe, Building } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { registerUserAction } from '@/app/actions';
import { useToast } from "@/hooks/use-toast";
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [country, setCountry] = useState('Ghana');
  const [schoolCategory, setSchoolCategory] = useState<'public' | 'private' | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [registrationMode, setRegistrationMode] = useState<"public" | "invited">("public");

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Redirect if user is already logged in
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Show a loading screen while auth state is resolving or if a redirect is imminent
  if (authLoading || (user && !isSuccess)) {
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
    
    if (!name.trim()) {
        setError("Full name is required.");
        return;
    }

    setIsLoading(true);

    try {
      // 1. Create user on the client with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const newUser = userCredential.user;

      // 2. Call the server action with the new user's data to create the DB record
      const result = await registerUserAction({
        uid: newUser.uid,
        email: newUser.email!,
        name,
        telephone,
        country: registrationMode === 'public' ? country : undefined,
        schoolCategory: registrationMode === 'public' ? schoolCategory : undefined,
      });

      if (result.success) {
        toast({
          title: "Registration Complete",
          description: result.message,
        });
        setIsSuccess(true);
        setTimeout(() => router.push('/'), 2000);
      } else {
        setError(result.message || 'Registration failed after user creation. Please contact support.');
        setIsLoading(false);
      }
    } catch (error: any) {
        let message = 'An unexpected error occurred during registration.';
        if (error.code === 'auth/email-already-in-use') {
            message = 'This email address is already registered. Please log in instead.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Please enter a valid email address.';
        }
        setError(message);
        setIsLoading(false);
    }
  };
  
    // Show a full-screen loader while the registration API call is in progress.
  if (isLoading && !isSuccess) {
    return (
      <div className="flex flex-col justify-center items-center h-screen w-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Creating your account...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline text-primary">Create an Account</CardTitle>
          <CardDescription>
            {isSuccess 
              ? "You will be redirected shortly."
              : "Choose your registration type below."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuccess ? (
             <div className="text-center p-4 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
               <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-semibold">Registration Successful!</p>
              <p className="text-sm mt-1">Welcome to the Report Card Generator. Redirecting you to the main application...</p>
            </div>
          ) : (
            <Tabs value={registrationMode} onValueChange={(v) => setRegistrationMode(v as "public" | "invited")}>
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="public">Public Registration</TabsTrigger>
                <TabsTrigger value="invited">Invited User</TabsTrigger>
              </TabsList>
              <TabsContent value="public">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telephone">Telephone</Label>
                      <Input id="telephone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="country-input">Country</Label>
                        <Input
                          id="country-input"
                          list="country-list"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder="Type or select a country"
                        />
                        <datalist id="country-list">
                          <option value="Ghana" />
                          <option value="Nigeria" />
                          <option value="Sierra Leone" />
                          <option value="The Gambia" />
                          <option value="Liberia" />
                        </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schoolCategory">School Type</Label>
                      <Select value={schoolCategory} onValueChange={(v) => setSchoolCategory(v as any)}>
                        <SelectTrigger id="schoolCategory"><SelectValue placeholder="Select..."/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"><Eye className="h-5 w-5"/></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="pr-10" />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"><Eye className="h-5 w-5"/></button>
                      </div>
                    </div>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full">
                    {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <UserPlus className="mr-2" />}
                    Register
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="invited">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name-invited">Full Name</Label>
                      <Input id="name-invited" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telephone-invited">Telephone</Label>
                      <Input id="telephone-invited" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-invited">Invited Email</Label>
                    <Input id="email-invited" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password-invited">Password</Label>
                      <div className="relative">
                        <Input id="password-invited" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10"/>
                         <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword-invited">Confirm Password</Label>
                      <div className="relative">
                        <Input id="confirmPassword-invited" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="pr-10"/>
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full">
                    {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <UserPlus className="mr-2" />}
                    Register as Invited User
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
           {isSuccess ? (
              <Link href="/" className="font-semibold text-primary hover:underline flex items-center">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go to App
              </Link>
           ) : (
            <>
              <p>Already have an account?&nbsp;</p>
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Log In
              </Link>
            </>
           )}
        </CardFooter>
      </Card>
    </main>
  );
}
