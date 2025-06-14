
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
import { format } from "date-fns";

type User = {
  id: string;
  email: string;
};

type EditState = {
  userId: string;
  roleId: string;
} | null;

const UserRoleManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);

  // State for editing roles
  const [editState, setEditState] = useState<EditState>(null);
  const [editNewRole, setEditNewRole] = useState<string>("");

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

  const getUserRolesFull = (user_id: string) => {
    // Returns an array of UserRole for the given user
    return userRoles.filter((ur) => ur.user_id === user_id);
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

  // ----- EDIT ROLE HANDLING -----
  const startEdit = (userId: string, oldRoleId: string) => {
    setEditState({ userId, roleId: oldRoleId });
    setEditNewRole(oldRoleId); // default to the current role
  };

  const cancelEdit = () => {
    setEditState(null);
    setEditNewRole("");
  };

  const saveEdit = async () => {
    if (!editState || !editNewRole) return;
    const { userId, roleId: oldRoleId } = editState;
    if (oldRoleId === editNewRole) {
      cancelEdit();
      return;
    }
    setLoading(true);
    try {
      // Remove old role and add new role
      await removeRoleFromUser(userId, oldRoleId);
      const { data: currentUserData } = await supabase.auth.getUser();
      await addRoleToUser(userId, editNewRole, currentUserData?.user?.id || null);
      toast({ title: "Role updated" });
      setUserRoles(await fetchUserRoles());
      cancelEdit();
    } catch (err: any) {
      toast({ title: "Error updating role", description: err.message });
      console.log(`[LOVABLE DEBUG][UserRoleManager] Error editing role:`, err);
      setLoading(false);
    }
    setLoading(false);
  };

  const getRoleNameById = (roleId: string) => {
    return roles.find((r) => r.id === roleId)?.name ?? "Unknown";
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
            <th className="p-2 text-left">Date Assigned</th>
            <th className="p-2 text-center">Add Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            // This returns an array of UserRole {id, user_id, role_id, assigned_by, assigned_at, role}
            const assignedUserRoles = getUserRolesFull(user.id);

            return (
              <tr key={user.id} className="border-b last:border-b-0">
                <td className="p-2">{user.email}</td>
                {/* Roles col */}
                <td className="p-2">
                  {assignedUserRoles.length > 0 ? (
                    assignedUserRoles.map((ur) => (
                      <span
                        key={ur.role.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent mr-2 mb-1"
                      >
                        {/* If in edit mode for this user+role */}
                        {editState &&
                        editState.userId === user.id &&
                        editState.roleId === ur.role.id ? (
                          <>
                            <select
                              className="border rounded p-1 mr-1"
                              disabled={loading}
                              value={editNewRole}
                              onChange={(e) => setEditNewRole(e.target.value)}
                            >
                              {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mr-1"
                              onClick={saveEdit}
                              disabled={loading}
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEdit}
                              disabled={loading}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            {ur.role.name}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(user.id, ur.role.id)}
                              disabled={loading}
                              title="Edit role"
                            >
                              &#9998; {/* Pencil/Edit icon - use unicode or install Lucide icon as needed */}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRole(user.id, ur.role.id)}
                              disabled={loading}
                            >
                              &times;
                            </Button>
                          </>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">none</span>
                  )}
                </td>
                {/* Date assigned col */}
                <td className="p-2">
                  {assignedUserRoles.length > 0
                    ? assignedUserRoles.map((ur) =>
                        ur.assigned_at
                          ? (
                              <div
                                key={ur.role.id}
                                className="text-xs text-muted-foreground ml-0"
                              >
                                {format(new Date(ur.assigned_at), "yyyy-MM-dd HH:mm")}
                              </div>
                            )
                          : (
                              <div key={ur.role.id} className="text-xs ml-0 text-gray-500">
                                N/A
                              </div>
                            )
                      )
                    : <span className="text-muted-foreground">N/A</span>
                  }
                </td>
                {/* Add role col */}
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
                      .filter(
                        (role) => !assignedUserRoles.find((ur) => ur.role.id === role.id)
                      )
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

