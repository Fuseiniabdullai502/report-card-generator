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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, CheckCircle, Trash2, Users, Hourglass, Edit } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deleteInviteAction, updateUserStatusAction, updateUserRoleAndScopeAction } from '@/app/actions';
import { ghanaRegionsAndDistricts } from '@/lib/ghana-regions-districts';

interface UserData {
  id: string;
  email: string;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user';
  status: 'active' | 'inactive';
  district?: string | null;
  schoolName?: string | null;
  createdAt: any;
}

interface InviteData {
  id: string;
  email: string;
  status: 'pending' | 'completed';
  createdAt: any;
}

const allDistricts = [...new Set(Object.values(ghanaRegionsAndDistricts).flat())].sort();

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  
  const [inviteToDelete, setInviteToDelete] = useState<InviteData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const invitesQ = query(collection(db, 'invites'), orderBy('createdAt', 'desc'));

    let usersLoaded = false;
    let invitesLoaded = false;

    const checkLoadingDone = () => {
      if (usersLoaded && invitesLoaded) {
        setIsLoading(false);
      }
    };

    const unsubUsers = onSnapshot(usersQ, (snap) => {
      setUsers(
        snap.docs.map((d) => ({
          id: d.id,
          email: d.data().email ?? 'unknown',
          role: d.data().role ?? 'user',
          status: d.data().status ?? 'active',
          district: d.data().district,
          schoolName: d.data().schoolName,
          createdAt: d.data().createdAt ?? null,
        }))
      );
      usersLoaded = true;
      checkLoadingDone();
    }, (error) => {
      console.error("Error fetching users:", error);
      usersLoaded = true;
      checkLoadingDone();
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
      invitesLoaded = true;
      checkLoadingDone();
    }, (error) => {
      console.error("Error fetching invites:", error);
      invitesLoaded = true;
      checkLoadingDone();
    });

    return () => {
      unsubUsers();
      unsubInv();
    };
  }, []);
  
  useEffect(() => {
    if (editingUser) {
      setIsEditUserDialogOpen(true);
    } else {
      setIsEditUserDialogOpen(false);
    }
  }, [editingUser]);

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      setIsSendingInvite(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', email));
      const userSnapshot = await getDocs(userQuery);
      if (!userSnapshot.empty) {
        toast({ title: 'User Exists', description: `A user with the email ${email} is already registered.`, variant: 'destructive' });
        setIsSendingInvite(false);
        return;
      }
      
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
      toast({ title: 'Invite Deleted', description: `The invite for ${inviteToDelete.email} has been removed.` });
    } else {
      toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    setIsDeleting(false);
    setInviteToDelete(null);
  };
  
  const handleStatusChange = async (userId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const originalUsers = [...users];
    setUsers(users => users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    const result = await updateUserStatusAction({ userId, status: newStatus });
    if (!result.success) {
      toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
      setUsers(originalUsers);
    } else {
        toast({ title: 'Status Updated', description: `User has been set to ${newStatus}.` });
    }
  };

  const totalUsers = users.length;
  const pendingInvitesCount = invites.filter(i => i.status === 'pending').length;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card className="border-primary/50 shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Total Registered Users</CardTitle>
            <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
            <div className="text-4xl font-bold text-foreground">{isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : totalUsers}</div>
            <p className="text-xs text-muted-foreground">All users with access to the system.</p>
            </CardContent>
        </Card>
        <Card className="border-amber-500/50 shadow-lg hover:shadow-amber-500/20 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Pending Invites</CardTitle>
            <Hourglass className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
            <div className="text-4xl font-bold text-foreground">{isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : pendingInvitesCount}</div>
            <p className="text-xs text-muted-foreground">Users authorized but not yet registered.</p>
            </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus /> Authorize New User</CardTitle>
            <CardDescription>Authorize a user, then assign them a role in the management table.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSendInvite}>
            <CardContent><Input name="email" type="email" placeholder="teacher@school.com" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></CardContent>
            <CardFooter><Button type="submit" disabled={isSendingInvite}>{isSendingInvite ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2" />}Authorize User</Button></CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User & Invite Management</CardTitle>
            <CardDescription>Manage roles, status, and pending invites.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Email</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className={`capitalize font-semibold ${u.role === 'super-admin' ? 'text-red-500' : u.role === 'big-admin' ? 'text-purple-600' : u.role === 'admin' ? 'text-blue-600' : 'text-green-600'}`}>Role: {u.role}</span>
                          <span className={`capitalize font-semibold ${u.status === 'active' ? 'text-green-500' : 'text-destructive'}`}>Status: {u.status}</span>
                          {u.role === 'big-admin' && <span className="text-xs text-muted-foreground">District: {u.district}</span>}
                          {u.role === 'admin' && <span className="text-xs text-muted-foreground">School: {u.schoolName}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {u.role !== 'super-admin' && <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingUser(u)}><Edit className="h-4 w-4" /></Button>}
                        {u.role !== 'super-admin' && <Switch id={`switch-${u.id}`} checked={u.status === 'active'} onCheckedChange={() => handleStatusChange(u.id, u.status)} aria-label={`Toggle status for ${u.email}`} />}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invites.filter((i) => i.status === 'pending').map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell className="italic text-yellow-600 text-sm">Pending Invite</TableCell>
                        <TableCell className="text-right"><Button variant="destructive" size="sm" onClick={() => setInviteToDelete(invite)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></TableCell>
                      </TableRow>
                  ))}
                  {(users.length === 0 && invites.filter((i) => i.status === 'pending').length === 0) && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No users or pending authorizations found.</TableCell></TableRow>
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
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the invite for <strong>{inviteToDelete?.email}</strong> and they will not be able to register.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInviteToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvite} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingUser && <EditUserDialog user={editingUser} onOpenChange={() => setEditingUser(null)} allDistricts={allDistricts} />}
    </>
  );
}

function EditUserDialog({ user, onOpenChange, allDistricts }: { user: UserData, onOpenChange: (open: boolean) => void, allDistricts: string[] }) {
    const [role, setRole] = useState(user.role);
    const [district, setDistrict] = useState(user.district || '');
    const [schoolName, setSchoolName] = useState(user.schoolName || '');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateUserRoleAndScopeAction({
            userId: user.id,
            role: role as 'big-admin' | 'admin' | 'user',
            district: role === 'big-admin' ? district : null,
            schoolName: role === 'admin' ? schoolName : null,
        });

        if(result.success) {
            toast({ title: "User Updated", description: result.message });
            onOpenChange(false);
        } else {
            toast({ title: "Update Failed", description: result.message, variant: 'destructive' });
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={!!user} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit User: {user.email}</DialogTitle>
                    <DialogDescription>Update the role and permissions for this user.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={role} onValueChange={(value) => setRole(value as UserData['role'])}>
                            <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">User (Instructor, limited to own classroom)</SelectItem>
                                <SelectItem value="admin">Admin (Limited to one school)</SelectItem>
                                <SelectItem value="big-admin">Big Admin (Limited to one district)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {role === 'big-admin' && (
                        <div className="space-y-2">
                            <Label htmlFor="district">District</Label>
                            <Select value={district || ''} onValueChange={setDistrict}>
                                <SelectTrigger id="district"><SelectValue placeholder="Select a district" /></SelectTrigger>
                                <SelectContent>
                                    {allDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {role === 'admin' && (
                        <div className="space-y-2">
                            <Label htmlFor="schoolName">School Name</Label>
                            <Input id="schoolName" value={schoolName || ''} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter school name" />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
