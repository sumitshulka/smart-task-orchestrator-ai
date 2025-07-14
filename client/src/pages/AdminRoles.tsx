import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function AdminRoles() {
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useQuery({
    queryKey: ['/api/roles'],
    queryFn: () => apiClient.getRoles(),
  });

  const { data: userRoles } = useQuery({
    queryKey: ['/api/user-roles'],
    queryFn: async () => {
      const response = await fetch('/api/user-roles');
      return response.json();
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: RoleFormData) => apiClient.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setIsCreateOpen(false);
      toast({ title: 'Role created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create role', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RoleFormData> }) => 
      apiClient.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setIsEditOpen(false);
      toast({ title: 'Role updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update role', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      toast({ title: 'Role deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete role', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const createForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const editForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onCreateSubmit = (data: RoleFormData) => {
    createRoleMutation.mutate(data);
  };

  const onEditSubmit = (data: RoleFormData) => {
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, data });
    }
  };

  const handleEdit = (role: any) => {
    setSelectedRole(role);
    editForm.reset({
      name: role.name,
      description: role.description || '',
    });
    setIsEditOpen(true);
  };

  const handleDelete = (roleId: string) => {
    if (confirm('Are you sure you want to delete this role?')) {
      deleteRoleMutation.mutate(roleId);
    }
  };

  const getUserCountForRole = (roleId: string) => {
    return userRoles?.filter((ur: any) => ur.role_id === roleId).length || 0;
  };

  if (isLoading) {
    return <div className="p-6">Loading roles...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Manage system roles and permissions</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter role name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter role description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={createRoleMutation.isPending}>
                    {createRoleMutation.isPending ? 'Creating...' : 'Create Role'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles?.map((role: any) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{role.name}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {role.description || 'No description'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{getUserCountForRole(role.id)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(role.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(role)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(role.id)}
                      disabled={getUserCountForRole(role.id) > 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter role name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter role description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={updateRoleMutation.isPending}>
                  {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}