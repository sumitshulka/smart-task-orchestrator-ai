import React from "react";
import { MoreVertical, User, Edit, UserCheck, UserX, Trash2, AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import EditUserDialog from "./EditUserDialog";
import ResetUserPasswordDialog from "./ResetUserPasswordDialog";
import EditUserRoleDialog from "./EditUserRoleDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

interface UserTableActionsProps {
  user: {
    id: string;
    user_name?: string;
    is_active?: boolean;
    email?: string;
    department?: string;
    phone?: string;
    manager?: string;
  };
  onEdit: (user: UserTableActionsProps["user"]) => void;
  onRefresh?: () => void;
}

const UserTableActions: React.FC<UserTableActionsProps> = ({ user, onEdit, onRefresh }) => {
  // Dialog open states
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = React.useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = React.useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const { toast } = useToast();

  // Deactivate user mutation
  const deactivateUserMutation = useMutation({
    mutationFn: () => apiClient.deactivateUser(user.id),
    onSuccess: () => {
      toast({
        title: "User deactivated",
        description: `${user.user_name || user.email} has been deactivated successfully.`,
      });
      onRefresh?.();
      setDeactivateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to deactivate user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Activate user mutation
  const activateUserMutation = useMutation({
    mutationFn: () => apiClient.activateUser(user.id),
    onSuccess: () => {
      toast({
        title: "User activated",
        description: `${user.user_name || user.email} has been activated successfully.`,
      });
      onRefresh?.();
      setActivateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to activate user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: () => apiClient.deleteUser(user.id),
    onSuccess: (result) => {
      toast({
        title: "User deleted",
        description: `${user.user_name || user.email} and ${result.deletedTasksCount} associated tasks have been moved to the deleted users repository.`,
      });
      onRefresh?.();
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  function handleEditUser() {
    onEdit(user);
  }
  
  function handleEditRole() {
    setEditRoleDialogOpen(true);
  }
  
  function handleDeactivateUser() {
    setDeactivateDialogOpen(true);
  }

  function handleActivateUser() {
    setActivateDialogOpen(true);
  }

  function handleDeleteUser() {
    setDeleteDialogOpen(true);
  }

  function handleResetPassword() {
    setResetDialogOpen(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 px-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-[180px]">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleEditUser}>
            <Edit className="w-4 h-4 mr-2" />
            Edit User
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEditRole}>
            <User className="w-4 h-4 mr-2" />
            Change Role
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.is_active ? (
            <DropdownMenuItem onClick={handleDeactivateUser} className="text-orange-600">
              <UserX className="w-4 h-4 mr-2" />
              Deactivate User
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleActivateUser} className="text-green-600">
              <UserCheck className="w-4 h-4 mr-2" />
              Activate User
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDeleteUser} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete User
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleResetPassword}>
            <span className="inline-flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 15v2m0 4v-2m6.364-1.636A9 9 0 103 12.055M21 12a8.966 8.966 0 01-1.636 5.364"></path></svg>
              Reset Password
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Dialogs */}
      <ResetUserPasswordDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        userId={user.id}
        userEmail={user.email}
      />
      <EditUserRoleDialog
        open={editRoleDialogOpen}
        onOpenChange={setEditRoleDialogOpen}
        user={user}
        onRolesUpdated={onRefresh}
      />

      {/* Deactivate User Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-orange-600" />
              Deactivate User
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="mb-4">
                Are you sure you want to deactivate <strong>{user.user_name || user.email}</strong>?
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm">
                <div className="font-semibold">What happens when you deactivate a user:</div>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>User will not be able to log in to the system</li>
                  <li>Existing tasks will remain active and visible</li>
                  <li>User will not be assigned new tasks</li>
                  <li>User data is preserved and can be reactivated later</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateUserMutation.mutate()}
              disabled={deactivateUserMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {deactivateUserMutation.isPending ? "Deactivating..." : "Deactivate User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete User - Permanent Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="mb-4">
                Are you sure you want to permanently delete <strong>{user.user_name || user.email}</strong>?
              </div>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                <div className="font-semibold">⚠️ This action cannot be undone:</div>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>User account will be permanently removed</li>
                  <li>All user's tasks will be moved to deleted tasks repository</li>
                  <li>User will be removed from all teams and task groups</li>
                  <li>Admin can view deleted data in the Deleted Users section</li>
                  <li>Historical data is preserved for compliance purposes</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserMutation.mutate()}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate User Confirmation Dialog */}
      <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              Activate User
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="mb-4">
                Are you sure you want to activate <strong>{user.user_name || user.email}</strong>?
              </div>
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
                <div className="font-semibold">What happens when you activate a user:</div>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>User will be able to log in to the system</li>
                  <li>User can be assigned new tasks</li>
                  <li>User will have access to all their previous data</li>
                  <li>User can participate in teams and task groups</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activateUserMutation.mutate()}
              disabled={activateUserMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {activateUserMutation.isPending ? "Activating..." : "Activate User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserTableActions;
