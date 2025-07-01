
'use client';

import { useState, useEffect } from 'react';
import { useActionState, useFormStatus } from 'react-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { inviteUserAction } from '@/app/actions';
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2" />}
      Send Invite
    </Button>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // now correctly imported
  const [formState, formAction] = useActionState(inviteUserAction, {
    success: false,
    message: '',
  });

  useEffect(() => {
    if (formState.message) {
      toast({
        title: formState.success ? 'Success' : 'Error',
        description: formState.message,
        variant: formState.success ? 'default' : 'destructive',
      });
    }
  }, [formState, toast]);

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
    });

    return () => {
      unsubUsers();
      unsubInv();
    };
  }, []);

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
        {/* make sure this action actually fires now */}
        <form key="invite-form" action={formAction}>
          <CardContent>
            <Input name="email" type="email" placeholder="teacher@school.com" required />
          </CardContent>
          <CardFooter>
            <SubmitButton />
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
