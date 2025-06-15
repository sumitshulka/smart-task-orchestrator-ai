import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Plus, Filter, Info } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserTableActions from "@/components/UserTableActions";
import EditUserDialog from "@/components/EditUserDialog";
import BulkUserUploadDialog from "@/components/BulkUserUploadDialog";
import DownloadSampleExcel from "@/components/DownloadSampleExcel";
import { useQuery } from "@tanstack/react-query";
import useSupabaseSession from "@/hooks/useSupabaseSession";

interface User {
  id: string;
  user_name?: string;
  email: string;
  is_active?: boolean;
  department?: string;
  phone?: string;
  manager?: string;
}

const AdminUsers: React.FC = () => {
  const [search, setSearch] = React.useState("");
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<User | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [debugInfo, setDebugInfo] = React.useState<any>({});
  const [rawSupabaseData, setRawSupabaseData] = React.useState<any[]>([]);

  // For checking session info and admin status
  const { user, loading: sessionLoading } = useSupabaseSession();

  // Fetch users using react-query (React Query v5 format)
  const { isLoading, refetch, error: queryError, data: supabaseData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Error loading users", description: error.message });
        throw error;
      }
      // Debug: log data for admin
      console.log("[AdminUsers][SUPABASE] users returned from Supabase:", data);
      setRawSupabaseData(data); // Capture the raw livedata for diagnostics below
      return data || [];
    },
    meta: {
      onSuccess: (data: User[]) => {
        setUsers(data);
        // Set debug info
        setDebugInfo((prev: any) => ({
          ...prev,
          userCount: data.length,
          userSample: data[0] || null,
        }));
      },
      onError: (err: any) => {
        setDebugInfo((prev: any) => ({
          ...prev,
          fetchError: err.message,
        }));
      },
    },
  });

  // Fetch and show admin/manager/roles info using helpers
  React.useEffect(() => {
    const fetchDebug = async () => {
      if (!user) return;
      let adminStatus = false;
      let respDebug: any = {};
      try {
        const { data: resp, error: err } = await supabase.rpc("is_admin", {
          _user_id: user.id,
        });
        if (!err) {
          adminStatus = (resp === true);
        }
        respDebug.isAdmin = adminStatus;
      } catch (e) {
        respDebug = { isAdmin: false, isAdminCheckError: (e as any).message };
      }

      // User's roles
      let roleNames: string[] = [];
      try {
        const { data: userRoles, error: rolesErr } = await supabase
          .from("user_roles")
          .select("role_id,roles(name)")
          .eq("user_id", user.id);
        if (!rolesErr && userRoles) {
          roleNames = userRoles.map((r: any) => r.roles?.name).filter(Boolean);
        }
      } catch (e) { /* ignore */ }

      setDebugInfo((d: any) => ({
        ...d,
        userEmail: user.email,
        userId: user.id,
        isAdmin: adminStatus,
        userRoles: roleNames,
        // Leftover info
        ...respDebug,
      }));

      // 2. Manager status
      try {
        const { data: isManager, error: mErr } = await supabase.rpc("is_manager", {
          _user_id: user.id,
        });
        if (!mErr) {
          setDebugInfo((d: any) => ({
            ...d,
            isManager: isManager === true,
          }));
        }
      } catch (e) { }
    };
    if (user) fetchDebug();
  }, [user]);

  const fetchUsersAndUpdate = () => {
    refetch();
  };

  // Add deep debug logging
  React.useEffect(() => {
    console.log("[AdminUsers deep debug] users from Supabase:", users);
    console.log("[AdminUsers deep debug] search:", search);
  }, [users, search]);

  const filteredUsers = React.useMemo(() => {
    const searchTerm = (search ?? "").toLowerCase();
    return users.filter((user) => {
      const uname = typeof user.user_name === "string" ? user.user_name.toLowerCase() : "";
      const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
      return uname.includes(searchTerm) || email.includes(searchTerm);
    });
  }, [users, search]);

  function handleCreateUser() {
    setCreateDialogOpen(true);
  }
  function handleEditUser(user: User) {
    setEditUser(user);
    setEditDialogOpen(true);
  }

  // --- Debug UI Section
  function DebugSection() {
    if (sessionLoading) return null;
    return (
      <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 text-xs rounded py-2 px-3 mb-4">
        <div className="flex gap-2 items-center mb-1">
          <Info className="w-4 h-4" />
          <span className="font-semibold">Debug Panel</span>
        </div>
        <div>
          <b>Logged-in Email/ID:</b> {debugInfo.userEmail || "(none)"} ({debugInfo.userId?.slice?.(0,8) || ""})
        </div>
        <div>
          <b>Roles from <span className="font-mono">user_roles</span>:</b> {debugInfo.userRoles && debugInfo.userRoles.length > 0 ? debugInfo.userRoles.join(", ") : "(none or not loaded)"}
        </div>
        <div>
          <b>Is Admin (via <span className="font-mono">is_admin</span> RPC):</b> {debugInfo.isAdmin === true ? "YES" : debugInfo.isAdmin === false ? "NO" : "checking..."}
          {debugInfo.isAdminCheckError && (
            <span className="text-red-600 ml-2">[Admin check error: {debugInfo.isAdminCheckError}]</span>
          )}
        </div>
        <div>
          <b>Is Manager / Team Manager:</b> {debugInfo.isManager === true ? "YES" : "NO"}
        </div>
        <div>
          <b>Users loaded from Supabase:</b> {debugInfo.userCount ?? "(?)"}
          <span className="ml-2">(users.length: {users.length}, filteredUsers.length: {filteredUsers.length})</span>
          {debugInfo.userSample && (
            <span className="ml-2 text-gray-400">(Sample user: {debugInfo.userSample.email})</span>
          )}
        </div>
        <div>
          <b>Current search:</b> <span className="font-mono">{JSON.stringify(search)}</span>
        </div>
        <div>
          <b>Supabase users (raw):</b>
          <details>
            <summary>Expand</summary>
            <pre style={{ maxHeight: 120, overflowY: "auto" }}>
              {JSON.stringify(users, null, 2)}
            </pre>
          </details>
        </div>
        <div>
          <b>Filtered Users:</b>
          <details>
            <summary>Expand</summary>
            <pre style={{ maxHeight: 120, overflowY: "auto" }}>
              {JSON.stringify(filteredUsers, null, 2)}
            </pre>
          </details>
        </div>
        {debugInfo.fetchError && (
          <div className="text-red-600">Supabase Fetch Error: {debugInfo.fetchError}</div>
        )}
        {(!isLoading && (!rawSupabaseData || rawSupabaseData.length === 0)) && (
          <div className="text-red-700 font-semibold my-2">
            No users were loaded from Supabase.<br />
            Possible causes:
            <ul className="list-disc ml-4">
              <li>There are no users in the <span className="font-mono">public.users</span> table.</li>
              <li>Current RLS policy may be preventing data for your user (even admins).</li>
              <li>Your admin user may not actually have the correct "admin" role record in <span className="font-mono">user_roles</span>.</li>
              <li>Check for typos or data inconsistencies.</li>
            </ul>
          </div>
        )}
        <div>
          <b>Notes:</b>{" "}
          {debugInfo.isAdmin === false && (
            <span>
              You only see users you manage or are on your team. Contact an admin to review permissions.
            </span>
          )}
          {debugInfo.isAdmin === true && (!users || users.length === 0) && (
            <span>
              No users found, even as admin. This may mean there are no users in the database, or a backend/RLS policy error.
            </span>
          )}
          {debugInfo.isAdmin === true && users.length > 0 && filteredUsers.length === 0 && (
            <span className="text-red-500 font-semibold">You are admin, users are present (users.length: {users.length}), but filter/search returns no users! Check the search/filter string and confirm user fields. Try <button className="underline text-blue-800 ml-2" onClick={() => setSearch("")}>Show All Users</button></span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl w-full">
      {/* Debug Section */}
      <DebugSection />
      {/* Dialogs */}
      <EditUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserUpdated={fetchUsersAndUpdate}
        user={undefined} // Supply undefined for user prop
      />
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={editUser}
        onUserUpdated={fetchUsersAndUpdate}
      />
      {/* Bulk Upload Dialog */}
      <BulkUserUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUsersUploaded={fetchUsersAndUpdate}
      />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-3 flex-wrap">
          <DownloadSampleExcel />
          <Button onClick={() => setBulkUploadOpen(true)}>Bulk Upload</Button>
          <Button onClick={handleCreateUser}>
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5 bg-muted/30 border rounded-md px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="w-[180px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="ghost" className="ml-2" size="sm" onClick={() => setSearch("")}>
            Clear
          </Button>
        </div>
      </div>
      {/* Table */}
      <div className="border rounded shadow bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <span className="text-muted-foreground">Loading users...</span>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="flex flex-col gap-2 items-start">
                    <span className="text-muted-foreground">
                      {users.length === 0
                        ? "No users found in the system."
                        : "No users match your search/filter."}
                    </span>
                    {debugInfo.isAdmin && users.length > 0 && (
                      <span className="text-red-700">
                        (Admin mode) users are in DB but filter/search is hiding them. Try clearing the search bar to see all users.
                      </span>
                    )}
                    {!debugInfo.isAdmin && (
                      <span className="text-muted-foreground">
                        If you believe this is a mistake, contact your admin to verify your roles/permissions.
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.user_name || "--"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.department || "--"}</TableCell>
                  <TableCell className="text-right">
                    <UserTableActions user={user} onEdit={handleEditUser} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminUsers;
