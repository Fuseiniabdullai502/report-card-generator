'use client';

import { useState, useEffect, FormEvent } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
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
import { Loader2, Send, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
      await addDoc(collection(db, 'invites'), {
        email,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Success',
        description: `Invite sent to ${email}. They can now register.`,
      });
      setInviteEmail('');
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: 'Failed to send invite',
        description: 'This is likely a Firestore security rule issue. Please ensure your rules allow an admin to create documents in the "invites" collection.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingInvite(false);
    }
  };


  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus /> Invite New User
          </CardTitle>
          <CardDescription>
            Enter the email address of the user you want to invite. They will be able to register after receiving the invite.
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
              {isSendingInvite ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2" />}
              Send Invite
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User & Invite Status</CardTitle>
          <CardDescription>List of all registered users and pending invitations.</CardDescription>
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
                  </TableRow>
                ))}
                {invites
                  .filter((i) => i.status === 'pending')
                  .map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell className="capitalize italic text-yellow-600">
                        Pending Invite
                      </TableCell>
                    </TableRow>
                  ))}
                {users.length === 0 && invites.filter((i) => i.status === 'pending').length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No users or invites found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
