import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface User {
  id: string;
  email: string;
  user_name?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface UserRole {
  role_id: string;
  role: Role;
}

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onRolesUpdated?: () => void;
}

export default function EditUserRoleDialog({
  open,
  onOpenChange,
  user,
  onRolesUpdated,
}: EditUserRoleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  useEffect(() => {
    if (open && user) {
      loadData();
    }
  }, [open, user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [roles, userRolesData] = await Promise.all([
        apiClient.getRoles(),
        apiClient.getUserRoles(user.id)
      ]);
      
      setAvailableRoles(roles);
      setUserRoles(userRolesData);
    } catch (error) {
      console.error('Failed to load role data:', error);
      toast({
        title: 'Error loading roles',
        description: 'Failed to load role information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async () => {
    if (!user || !selectedRoleId) return;
    
    setSaving(true);
    try {
      await apiClient.assignUserRole(user.id, selectedRoleId);
      toast({
        title: 'Role assigned',
        description: 'Role has been successfully assigned to the user',
      });
      setSelectedRoleId("");
      await loadData();
      onRolesUpdated?.();
    } catch (error) {
      console.error('Failed to assign role:', error);
      toast({
        title: 'Error assigning role',
        description: 'Failed to assign role to user',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };





  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Role for {user.user_name || user.email}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4">Loading roles...</div>
          ) : (
            <>
              {/* Current Role */}
              <div>
                <h4 className="text-sm font-medium mb-2">Current Role</h4>
                {userRoles.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No role assigned</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {userRoles[0].role.name}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Change Role */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {userRoles.length === 0 ? 'Assign Role' : 'Change Role'}
                </h4>
                <div className="flex gap-2">
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAssignRole}
                    disabled={!selectedRoleId || saving}
                    size="sm"
                  >
                    {saving ? 'Updating...' : (userRoles.length === 0 ? 'Assign' : 'Change')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}