import React from "react";
import { MoreVertical, User, Edit, UserCheck, UserX } from "lucide-react";
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
import { Button } from "@/components/ui/button";

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

  function handleEditUser() {
    onEdit(user);
  }
  
  function handleEditRole() {
    setEditRoleDialogOpen(true);
  }
  
  function handleToggleActive() {
    // TODO: Implement user activation/deactivation
    alert(`${user.is_active ? "Deactivate" : "Activate"}: ${user.user_name || user.id}`);
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
            Edit Role
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleToggleActive} className={user.is_active ? "text-destructive" : "text-green-600"}>
            {user.is_active ? (
              <>
                <UserX className="w-4 h-4 mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Activate
              </>
            )}
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
    </>
  );
};

export default UserTableActions;
