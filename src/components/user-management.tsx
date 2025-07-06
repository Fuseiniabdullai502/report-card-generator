'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
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
import {
    deleteInviteAction, 
    updateUserStatusAction, 
    updateUserRoleAndScopeAction, 
    authorizeUserAction,
    getUsersAction,
    getInvitesAction
} from '@/app/actions';
import { ghanaRegions, ghanaRegionsAndDistricts } from '@/lib/ghana-regions-districts';

interface UserData {
  id: string;
  email: string;
  role: 'super-admin' | 'big-admin' | 'admin' | 'user';
  status: 'active' | 'inactive';
  region?: string | null;
  district?: string | null;
  circuit?: string | null;
  schoolName?: string | null;
  className?: string | null;
  createdAt: Date | null;
}

interface InviteData {
  id: string;
  email: string;
  status: 'pending' | 'completed';
  createdAt: Date | null;
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
  
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersResult, invitesResult] = await Promise.all([
        getUsersAction(),
        getInvitesAction(),
      ]);

      if (usersResult.success && usersResult.users) {
        setUsers(usersResult.users.map(u => ({...u, className: u.className, createdAt: u.createdAt ? new Date(u.createdAt) : null })));
      } else {
        toast({ title: 'Error Fetching Users', description: usersResult.error, variant: 'destructive' });
      }

      if (invitesResult.success && invitesResult.invites) {
        setInvites(invitesResult.invites.map(i => ({...i, createdAt: i.createdAt ? new Date(i.createdAt) : null })));
      } else {
        toast({ title: 'Error Fetching Invites', description: invitesResult.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Failed to load management data', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);

    const email = inviteEmail.trim().toLowerCase();
    
    if (!email || !email.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      setIsSendingInvite(false);
      return;
    }

    const result = await authorizeUserAction({ email });

    if (result.success) {
      toast({ title: 'User Authorized', description: result.message });
      setInviteEmail('');
      fetchData(); // Refetch data to show the new invite
    } else {
      toast({ title: 'Authorization Failed', description: result.message, variant: 'destructive' });
    }

    setIsSendingInvite(false);
  };

  const handleDeleteInvite = async () => {
    if (!inviteToDelete) return;
    setIsDeleting(true);
    const result = await deleteInviteAction({ inviteId: inviteToDelete.id });
    if (result.success) {
      toast({ title: 'Invite Deleted', description: `The invite for ${inviteToDelete.email} has been removed.` });
      fetchData(); // Refetch to update the list
    } else {
      toast({ title: 'Deletion Failed', description: result.message, variant: 'destructive' });
    }
    setIsDeleting(false);
    setInviteToDelete(null);
  };
  
  const handleStatusChange = async (userId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const result = await updateUserStatusAction({ userId, status: newStatus });
    if (result.success) {
        toast({ title: 'Status Updated', description: `User has been set to ${newStatus}.` });
        fetchData(); // Refetch to update the list
    } else {
      toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
    }
  };

  const totalUsers = users.length;
  const pendingInvitesCount = invites.filter(i => i.status === 'pending').length;

  return (
    <>
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
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
        
        {/* Authorize User Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus /> Authorize New User</CardTitle>
            <CardDescription>Authorize a user by email. You can then assign them a specific role and scope in the management table below.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSendInvite}>
            <CardContent><Input name="email" type="email" placeholder="teacher@school.com" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></CardContent>
            <CardFooter><Button type="submit" disabled={isSendingInvite}>{isSendingInvite ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2" />}Authorize User</Button></CardFooter>
          </form>
        </Card>

        {/* User & Invite Management Card */}
        <Card>
          <CardHeader>
            <CardTitle>User & Invite Management</CardTitle>
            <CardDescription>Manage roles, status, and pending invites for all system users.</CardDescription>
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
                          {u.role === 'big-admin' && u.district && <span className="text-xs text-muted-foreground">District: {u.district} ({u.region})</span>}
                          {u.role === 'admin' && u.schoolName && <span className="text-xs text-muted-foreground">School: {u.schoolName} ({u.region} / {u.district} / {u.circuit})</span>}
                          {u.role === 'user' && (u.region || u.district || u.circuit || u.schoolName || u.className) && <span className="text-xs text-muted-foreground">Scope: {[u.region, u.district, u.circuit, u.schoolName, u.className].filter(Boolean).join(' / ')}</span>}
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

      {editingUser && <EditUserDialog user={editingUser} onOpenChange={() => setEditingUser(null)} onUserUpdated={fetchData} />}
    </>
  );
}

function EditUserDialog({ user, onOpenChange, onUserUpdated }: { user: UserData, onOpenChange: (open: boolean) => void, onUserUpdated: () => void }) {
    const [role, setRole] = useState(user.role);
    const [region, setRegion] = useState(user.region || '');
    const [district, setDistrict] = useState(user.district || '');
    const [circuit, setCircuit] = useState(user.circuit || '');
    const [schoolName, setSchoolName] = useState(user.schoolName || '');
    const [className, setClassName] = useState(user.className || '');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

    useEffect(() => {
        if (region) {
            setAvailableDistricts(ghanaRegionsAndDistricts[region]?.sort() || []);
        } else {
            setAvailableDistricts([]);
        }
    }, [region]);

    // When role changes, reset fields that are not applicable to avoid sending stale data
    useEffect(() => {
        if (role === 'big-admin') {
            setSchoolName('');
            setCircuit('');
            setClassName('');
        } else if (role === 'admin') {
             setClassName('');
        } else if (role === 'user') {
            // Keep all fields as they are now relevant
        }
    }, [role]);

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateUserRoleAndScopeAction({
            userId: user.id,
            role: role as 'big-admin' | 'admin' | 'user',
            region: (role === 'big-admin' || role === 'admin' || role === 'user') ? region : null,
            district: (role === 'big-admin' || role === 'admin' || role === 'user') ? district : null,
            circuit: (role === 'admin' || role === 'user') ? circuit : null,
            schoolName: (role === 'admin' || role === 'user') ? schoolName : null,
            className: role === 'user' ? className : null,
        });

        if(result.success) {
            toast({ title: "User Updated", description: result.message });
            onUserUpdated(); // Refetch data in the parent component
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
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="region">Region</Label>
                                <Select value={region} onValueChange={(val) => { setRegion(val); setDistrict(''); }}>
                                    <SelectTrigger id="region"><SelectValue placeholder="Select a region"/></SelectTrigger>
                                    <SelectContent>
                                        {ghanaRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="district">District/Municipal</Label>
                                <Select value={district} onValueChange={setDistrict} disabled={!region}>
                                    <SelectTrigger id="district"><SelectValue placeholder="Select a district"/></SelectTrigger>
                                    <SelectContent>
                                        {availableDistricts.length > 0 ? (
                                            availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)
                                        ) : (
                                            <SelectItem value="-" disabled>Select a region first</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    {role === 'admin' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="admin-region">Region</Label>
                                <Select value={region} onValueChange={(val) => { setRegion(val); setDistrict(''); }}>
                                    <SelectTrigger id="admin-region"><SelectValue placeholder="Select a region"/></SelectTrigger>
                                    <SelectContent>
                                        {ghanaRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin-district">District/Municipal</Label>
                                <Select value={district} onValueChange={setDistrict} disabled={!region}>
                                    <SelectTrigger id="admin-district"><SelectValue placeholder="Select a district"/></SelectTrigger>
                                    <SelectContent>
                                        {availableDistricts.length > 0 ? (
                                            availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)
                                        ) : (
                                            <SelectItem value="-" disabled>Select a region first</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="admin-circuit">Circuit</Label>
                                <Input id="admin-circuit" value={circuit} onChange={(e) => setCircuit(e.target.value)} placeholder="e.g., Kalpohin" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="schoolName">School Name</Label>
                                <Input id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter school name" />
                            </div>
                        </>
                    )}

                    {role === 'user' && (
                       <>
                            <div className="space-y-2">
                                <Label htmlFor="user-region">Region</Label>
                                <Select value={region} onValueChange={(val) => { setRegion(val); setDistrict(''); }}>
                                    <SelectTrigger id="user-region"><SelectValue placeholder="Select a region"/></SelectTrigger>
                                    <SelectContent>
                                        {ghanaRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="user-district">District/Municipal</Label>
                                <Select value={district} onValueChange={setDistrict} disabled={!region}>
                                    <SelectTrigger id="user-district"><SelectValue placeholder="Select a district"/></SelectTrigger>
                                    <SelectContent>
                                        {availableDistricts.length > 0 ? (
                                            availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)
                                        ) : (
                                            <SelectItem value="-" disabled>Select a region first</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="user-circuit">Circuit</Label>
                                <Input id="user-circuit" value={circuit} onChange={(e) => setCircuit(e.target.value)} placeholder="Enter user's circuit" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="user-schoolName">School Name</Label>
                                <Input id="user-schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter user's school" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="user-className">Class Name</Label>
                                <Input id="user-className" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Enter user's class" />
                            </div>
                        </>
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
