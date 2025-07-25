
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
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// User now includes user_name (nullable)
type User = {
  id: string;
  user_name?: string | null;
  email: string;
  department?: string;
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

  // Filtering state
  const [filterEmail, setFilterEmail] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterRoleId, setFilterRoleId] = useState("");

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
      } else {
        setSessionUserId(null);
        setSessionUserEmail(null);
      }

      // Fetch users from the public.users table, include user_name!
      const { data: usersData, error: userError } = await supabase
        .from("users")
        .select("id, user_name, email, department");
      if (userError) {
        toast({ title: "Error loading users", description: userError.message });
      } else {
        setUsers(usersData ?? []);
      }
      try {
        const _roles = await fetchRoles();
        setRoles(_roles);

        const _userRoles = await fetchUserRoles();
        setUserRoles(_userRoles);
      } catch (err: any) {
        toast({ title: "Error", description: err.message });
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
      setLoading(false);
    }
    setLoading(false);
  };

  // FILTERING - compute filtered users
  const filteredUsers = users.filter(user => {
    // Email filter (simple substring)
    if (filterEmail && !user.email.toLowerCase().includes(filterEmail.toLowerCase())) {
      return false;
    }
    // Department filter
    if (filterDepartment && user.department !== filterDepartment) {
      return false;
    }
    // Role filter (user must have at least one assigned role which matches filterRoleId)
    if (filterRoleId) {
      const assigned = getUserRolesFull(user.id);
      if (!assigned.some(ur => ur.role?.id === filterRoleId)) {
        return false;
      }
    }
    return true;
  });

  // Used for department filter dropdown
  const allDepartments = Array.from(
    new Set(users.map((user) => user.department).filter(Boolean))
  );
  // Used for showing all options for roles filter
  const roleOptions = roles;

  // Get role name by id utility
  const getRoleNameById = (roleId: string) => {
    return roles.find((r) => r.id === roleId)?.name ?? "Unknown";
  };

  return (
    <div className="p-6 max-w-3xl ml-0">
      <h1 className="text-2xl font-bold mb-6">User Role Management</h1>
      {/* FILTERS */}
      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs mb-1 font-medium text-muted-foreground">Email</div>
          <Input
            value={filterEmail}
            onChange={e => setFilterEmail(e.target.value)}
            placeholder="Search by email"
            className="w-48"
          />
        </div>
        {allDepartments.length > 0 && (
          <div>
            <div className="text-xs mb-1 font-medium text-muted-foreground">Department</div>
            <select
              className="border rounded p-2 w-40 text-sm"
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {allDepartments.map(dep =>
                <option key={dep} value={dep}>{dep}</option>
              )}
            </select>
          </div>
        )}
        {roleOptions.length > 0 && (
          <div>
            <div className="text-xs mb-1 font-medium text-muted-foreground">Role</div>
            <select
              className="border rounded p-2 w-40 text-sm"
              value={filterRoleId}
              onChange={e => setFilterRoleId(e.target.value)}
            >
              <option value="">All Roles</option>
              {roleOptions.map(r =>
                <option key={r.id} value={r.id}>{r.name}</option>
              )}
            </select>
          </div>
        )}
        <Button
          variant="ghost"
          className="mt-5"
          size="sm"
          onClick={() => {
            setFilterEmail("");
            setFilterDepartment("");
            setFilterRoleId("");
          }}
        >
          Clear Filters
        </Button>
      </div>
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
          {filteredUsers.map((user) => {
            const assignedUserRoles = getUserRolesFull(user.id);

            return (
              <tr key={user.id} className="border-b last:border-b-0">
                {/* USER COL - show user_name, then email, then department */}
                <td className="p-2">
                  <div className="font-medium text-base">
                    {user.user_name ? user.user_name : user.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user.email}
                  </div>
                  {user.department && (
                    <div className="text-xs text-muted-foreground">
                      Dept: {user.department}
                    </div>
                  )}
                </td>
                {/* Roles col */}
                <td className="p-2">
                  {assignedUserRoles.length > 0 ? (
                    assignedUserRoles.map((ur) =>
                      ur.role ? (
                        <span
                          key={ur.role.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent mr-2 mb-1"
                        >
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
                                &#9998;
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
                      ) : (
                        // `ur.role` is null (possibly data inconsistency), so render fallback
                        <span
                          key={ur.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive mr-2 mb-1"
                          title="This role no longer exists"
                        >
                          Unknown/Deleted role
                        </span>
                      )
                    )
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
                                key={ur.role?.id ?? ur.id}
                                className="text-xs text-muted-foreground ml-0"
                              >
                                {format(new Date(ur.assigned_at), "yyyy-MM-dd HH:mm")}
                              </div>
                            )
                          : (
                              <div key={ur.role?.id ?? ur.id} className="text-xs ml-0 text-gray-500">
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
                        (role) => !assignedUserRoles.find((ur) => ur.role && ur.role.id === role.id)
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

