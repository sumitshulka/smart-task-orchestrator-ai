import React from "react";
import { MoreVertical, User, Edit, UserCheck, UserX } from "lucide-react";
import EditUserDialog from "./EditUserDialog";
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
}

const UserTableActions: React.FC<UserTableActionsProps> = ({ user, onEdit }) => {
  // Handlers: just alert for now; you can implement modals per need
  function handleEditUser() {
    onEdit(user);
  }
  function handleEditRole() {
    alert("Edit Role: " + (user.user_name || user.id));
  }
  function handleToggleActive() {
    alert(`${user.is_active ? "Deactivate" : "Activate"}: ${user.user_name || user.id}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 px-0">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[160px]">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserTableActions;
