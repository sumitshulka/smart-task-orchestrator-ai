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
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      // Get current session user before doing anything else
      const { data: userSessionData, error: sessionError } = await supabase.auth.getUser();
      if (userSessionData?.user) {
        setSessionUserId(userSessionData.user.id);
        setSessionUserEmail(userSessionData.user.email);
        console.log(`[LOVABLE DEBUG][UserRoleManager] Session user:`, userSessionData.user.id, userSessionData.user.email);
      } else {
        setSessionUserId(null);
        setSessionUserEmail(null);
        console.log(`[LOVABLE DEBUG][UserRoleManager] No session user!`, sessionError);
      }

      // Fetch users from the public.users table
      const { data: usersData, error: userError } = await supabase
        .from("users")
        .select("id, email");
      if (userError) {
        toast({ title: "Error loading users", description: userError.message });
        console.log(`[LOVABLE DEBUG][UserRoleManager] Error loading users:`, userError);
      } else {
        setUsers(usersData ?? []);
        console.log(`[LOVABLE DEBUG][UserRoleManager] Users loaded:`, usersData);
      }
      try {
        const _roles = await fetchRoles();
        setRoles(_roles);
        console.log(`[LOVABLE DEBUG][UserRoleManager] Roles:`, _roles);

        const _userRoles = await fetchUserRoles();
        setUserRoles(_userRoles);
        console.log(`[LOVABLE DEBUG][UserRoleManager] UserRoles:`, _userRoles);

        // Check if current session user is admin
        const adminRole = _roles.find(r => r.name === "admin");
        const hasAdmin = _userRoles.some(ur => ur.user_id === userSessionData?.user?.id && ur.role_id === adminRole?.id);
        console.log(`[LOVABLE DEBUG][UserRoleManager] Is current user admin?`, hasAdmin, "adminRole.id:", adminRole?.id, "user id:", userSessionData?.user?.id);
      } catch (err: any) {
        toast({ title: "Error", description: err.message });
        console.log(`[LOVABLE DEBUG][UserRoleManager] Error when fetching roles/userRoles:`, err);
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
      console.log(`[LOVABLE DEBUG][UserRoleManager] Error assigning role:`, err);
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
      console.log(`[LOVABLE DEBUG][UserRoleManager] Error removing role:`, err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-3xl ml-0">
      <h1 className="text-2xl font-bold mb-6">User Role Management</h1>
      {sessionUserId && (
        <div className="mb-4 p-2 bg-muted rounded text-xs text-muted-foreground">
          Debug: Session user = {sessionUserId} ({sessionUserEmail})
        </div>
      )}
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
