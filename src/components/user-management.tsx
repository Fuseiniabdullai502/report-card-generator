'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, MailPlus, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { inviteUserAction } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface AppUser {
  uid: string;
  email: string;
  role: 'admin' | 'instructor';
  createdAt: Timestamp;
}

interface Invite {
  id: string;
  email: string;
  role: 'admin' | 'instructor';
  createdAt: Timestamp;
}

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'instructor' | 'admin'>('instructor');
  const { toast } = useToast();

  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const invitesQuery = query(collection(db, 'invites'), orderBy('createdAt', 'desc'));

    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as AppUser));
      setUsers(usersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Could not fetch users.", variant: "destructive" });
      setIsLoading(false);
    });

    const unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
      const invitesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Invite));
      setInvites(invitesData);
    }, (error) => {
      console.error("Error fetching invites:", error);
      toast({ title: "Error", description: "Could not fetch pending invites.", variant: "destructive" });
    });

    return () => {
      unsubscribeUsers();
      unsubscribeInvites();
    };
  }, [toast]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail) {
        toast({ title: "Email required", description: "Please enter an email to send an invite.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const result = await inviteUserAction({ email: newInviteEmail, role: newInviteRole });

    if (result.success) {
      toast({ title: "Invite Sent", description: `An invite has been sent to ${newInviteEmail}.` });
      setNewInviteEmail('');
      setNewInviteRole('instructor');
    } else {
      toast({ title: "Invite Failed", description: result.error, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2"/>Existing Users</CardTitle>
            <CardDescription>List of all registered users and their roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Date Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.uid}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>{user.createdAt?.toDate().toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <div>
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><UserPlus className="mr-2"/>Invite New User</CardTitle>
                    <CardDescription>Send an invitation for a new user to register.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>How Invites Work</AlertTitle>
                        <AlertDescription className="text-xs">
                        The invited user will receive no email. They must register using the exact email address you invite. Their role will be set automatically upon registration.
                        </AlertDescription>
                    </Alert>
                    <form onSubmit={handleInviteSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" type="email" value={newInviteEmail} onChange={e => setNewInviteEmail(e.target.value)} placeholder="new.teacher@school.com"/>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="role">Role</Label>
                            <Select value={newInviteRole} onValueChange={(value: 'instructor' | 'admin') => setNewInviteRole(value)}>
                                <SelectTrigger id="role">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="instructor">Instructor</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Send Invite
                        </Button>
                    </form>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><MailPlus className="mr-2"/>Pending Invites</CardTitle>
                </CardHeader>
                <CardContent>
                    {invites.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites.map(invite => (
                                <TableRow key={invite.id}>
                                    <TableCell>{invite.email}</TableCell>
                                    <TableCell>
                                    <Badge variant="outline">{invite.role}</Badge>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground">No pending invites.</p>
                    )}
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  );
}
