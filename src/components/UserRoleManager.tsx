
import React, { useEffect, useState } from "react";
import {
  fetchRoles,
  fetchUserRoles,
  addRoleToUser,
  removeRoleFromUser,
  Role,
  UserRole,
} from "@/integrations/supabase/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

type User = {
  id: string;
  email: string;
};

const UserRoleManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      // Fetch all users from auth (via RPC or Admin API)
      const { data: usersData, error: userError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (userError) {
        toast({ title: "Error loading users", description: userError.message });
      } else {
        setUsers(usersData?.users?.map((u: any) => ({ id: u.id, email: u.email })) ?? []);
      }
      try {
        setRoles(await fetchRoles());
        setUserRoles(await fetchUserRoles());
      } catch (err: any) {
        toast({ title: "Error", description: err.message });
      }
      setLoading(false);
    }
    fetchInitialData();
  }, []);

  const getUserRoles = (user_id: string) => {
    return userRoles.filter((ur) => ur.user_id === user_id).map((ur) => ur.role);
  };

  const handleAssignRole = async (user_id: string, role_id: string) => {
    setLoading(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      await addRoleToUser(user_id, role_id, currentUserData?.user?.id || null);
      toast({ title: "Role assigned" });
      setUserRoles(await fetchUserRoles());
    } catch (err: any) {
      toast({ title: "Error assigning role", description: err.message });
    }
    setLoading(false);
  };

  const handleRemoveRole = async (user_id: string, role_id: string) => {
    setLoading(true);
    try {
      await removeRoleFromUser(user_id, role_id);
      toast({ title: "Role removed" });
      setUserRoles(await fetchUserRoles());
    } catch (err: any) {
      toast({ title: "Error removing role", description: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">User Role Management</h1>
      {loading && <div className="text-muted-foreground mb-4">Loading...</div>}
      <table className="w-full border text-sm rounded-md shadow bg-background">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">User</th>
            <th className="p-2 text-left">Roles</th>
            <th className="p-2 text-center">Add Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const assignedRoles = getUserRoles(user.id);
            return (
              <tr key={user.id} className="border-b last:border-b-0">
                <td className="p-2">{user.email}</td>
                <td className="p-2">
                  {assignedRoles.length > 0 ? (
                    assignedRoles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent mr-2 mb-1"
                      >
                        {role.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRole(user.id, role.id)}
                          disabled={loading}
                        >
                          &times;
                        </Button>
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">none</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  <select
                    className="border rounded p-1"
                    disabled={loading}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleAssignRole(user.id, e.target.value);
                    }}
                  >
                    <option value="">Select role</option>
                    {roles
                      .filter((role) => !assignedRoles.find((ar) => ar.id === role.id))
                      .map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UserRoleManager;
