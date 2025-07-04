'use client';

import { useState, useEffect, FormEvent } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, UserPlus, CheckCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteInviteAction } from '@/app/actions';

interface UserData {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: any;
}

interface InviteData {
  id: string;
  email: string;
  status: 'pending' | 'completed';
  createdAt: any;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteToDelete, setInviteToDelete] = useState<InviteData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const invitesQ = query(collection(db, 'invites'), orderBy('createdAt', 'desc'));

    const unsubUsers = onSnapshot(usersQ, (snap) => {
      setUsers(
        snap.docs.map((d) => ({
          id: d.id,
          email: d.data().email ?? 'unknown',
          role: d.data().role ?? 'user',
          createdAt: d.data().createdAt ?? null,
        }))
      );
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setIsLoading(false);
    });

    const unsubInv = onSnapshot(invitesQ, (snap) => {
      setInvites(
        snap.docs.map((d) => ({
          id: d.id,
          email: d.data().email ?? 'unknown',
          status: d.data().status ?? 'pending',
          createdAt: d.data().createdAt ?? null,
        }))
      );
    }, (error) => {
      console.error("Error fetching invites:", error);
    });

    return () => {
      unsubUsers();
      unsubInv();
    };
  }, []);

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      setIsSendingInvite(false);
      return;
    }

    try {
      // Check if user already exists in the 'users' collection
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', email));
      const userSnapshot = await getDocs(userQuery);
      if (!userSnapshot.empty) {
        toast({ title: 'User Exists', description: `A user with the email ${email} is already registered.`, variant: 'destructive' });
        setIsSendingInvite(false);
        return;
      }
      
      // Check if a pending invite already exists for this email
      const invitesRef = collection(db, 'invites');
      const inviteQuery = query(invitesRef, where('email', '==', email), where('status', '==', 'pending'));
      const inviteSnapshot = await getDocs(inviteQuery);
      if (!inviteSnapshot.empty) {
        toast({ title: 'Invite Exists', description: `A pending invite for ${email} already exists.`, variant: 'destructive' });
        setIsSendingInvite(false);
        return;
      }
      
      await addDoc(collection(db, 'invites'), {
        email,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'User Authorized',
        description: `User with email ${email} has been authorized. You can now ask them to register.`,
      });
      setInviteEmail('');
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: 'Authorization Failed',
        description: 'Failed to authorize the user. Please check your Firestore security rules and internet connection.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleDeleteInvite = async () => {
    if (!inviteToDelete) return;

    setIsDeleting(true);
    const result = await deleteInviteAction({ inviteId: inviteToDelete.id });

    if (result.success) {
      toast({
        title: 'Invite Deleted',
        description: `The invite for ${inviteToDelete.email} has been removed.`,
      });
    } else {
      toast({
        title: 'Deletion Failed',
        description: result.message,
        variant: 'destructive',
      });
    }
    setIsDeleting(false);
    setInviteToDelete(null); // This will also close the dialog
  };

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus /> Authorize New User
            </CardTitle>
            <CardDescription>
              Enter an email address to authorize a new user. You must then notify them yourself so they can visit the registration page to create an account. No email is sent from this system.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSendInvite}>
            <CardContent>
              <Input
                name="email"
                type="email"
                placeholder="teacher@school.com"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSendingInvite}>
                {isSendingInvite ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2" />}
                Authorize User
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User & Invite Status</CardTitle>
            <CardDescription>List of all registered users and pending authorizations.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status / Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.email}</TableCell>
                      <TableCell
                        className={`capitalize font-semibold ${
                          u.role === 'admin' ? 'text-blue-600' : 'text-green-600'
                        }`}
                      >
                        {u.role}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                  {invites
                    .filter((i) => i.status === 'pending')
                    .map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell className="capitalize italic text-yellow-600">
                          Pending Authorization
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => setInviteToDelete(invite)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {users.length === 0 && invites.filter((i) => i.status === 'pending').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No users or pending authorizations found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      <AlertDialog open={!!inviteToDelete} onOpenChange={(open) => !open && setInviteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invite
              for <strong>{inviteToDelete?.email}</strong> and they will not be able to register.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInviteToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvite} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
