import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Filter } from "lucide-react";
import UserTableActions from "@/components/UserTableActions";
import CreateUserDialog from "@/components/CreateUserDialog";
import EditUserDialog from "@/components/EditUserDialog";
import useSupabaseSession from "@/hooks/useSupabaseSession";

interface User {
  id: string;
  email: string;
  phone?: string;
  user_name?: string;
  department?: string;
  manager?: string;
  organization?: string;
  created_by?: string;
}

const departments = [
  "Sales",
  "Marketing",
  "Engineering",
  "HR",
  "Finance",
  "Support",
];

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const { session, user, loading: authLoading } = useSupabaseSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [status, setStatus] = useState("");
  const [organization, setOrganization] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string, email: string, organization: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Redirect to /auth if user is logged out and auth has finished loading
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    console.log("[LOVABLE DEBUG][AdminUsers] useSupabaseSession: session:", session, " user:", user, " loading:", authLoading);
    if (!authLoading && !user) {
      console.warn("[LOVABLE DEBUG][AdminUsers] No user/session detected - you are NOT logged in. Redirect may be required.");
    }
  }, [session, user, authLoading]);

  // Fetch current user's org & admin status
  useEffect(() => {
    if (!user) {
      setMe(null);
      setIsAdmin(false);
      setOrganization(null);
      return;
    }
    async function fetchOrgAndMe() {
      const uid = user.id;
      const email = user.email || "";
      console.log("[LOVABLE DEBUG][AdminUsers] Session user:", uid, email);

      // Fetch user's org from public.users
      const { data, error } = await supabase
        .from("users")
        .select("organization")
        .eq("id", uid)
        .maybeSingle();

      console.log("[DEBUG][AdminUsers] public.users org lookup:", data, error);

      setMe({ id: uid, email, organization: data?.organization ?? null });
      setOrganization(data?.organization ?? null);

      // Check admin role
      const { data: adminData, error: adminErr } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          role_id,
          roles:role_id (
            name
          )
        `)
        .eq("user_id", uid);

      console.log("[DEBUG][AdminUsers] user_roles lookup:", adminData, adminErr);

      const hasAdminRole = !!(adminData && adminData.some((row: any) =>
        row?.roles?.name === "admin"
      ));
      setIsAdmin(hasAdminRole);
      console.log("[DEBUG][AdminUsers] Is admin? ", hasAdminRole);
    }
    fetchOrgAndMe();
  }, [user]);

  // Fetch users list
  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      let query = supabase.from("users").select("*").order("created_at", { ascending: false });
      if (organization) {
        query = query.eq("organization", organization);
      }
      const { data, error } = await query;
      if (error) {
        toast({ title: "Error loading users", description: error.message });
        setUsers([]);
        setLoading(false);
        console.log("[DEBUG][AdminUsers] Error loading users:", error);
        return;
      }
      setUsers(data || []);
      setLoading(false);
      console.log("[DEBUG][AdminUsers] Users fetched:", data);
    }
    if (organization) {
      fetchUsers();
    } else {
      setUsers([]);
      console.log("[DEBUG][AdminUsers] Organization not set, skipping fetchUsers");
    }
  }, [organization]);

  // Filtering logic (unchanged)
  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        search === "" ||
        user.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase());
      const matchesDept = selectedDept === "" || user.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [users, search, selectedDept]);

  const handleUserCreated = () => {
    setLoading(true);
    if (!organization) return;
    supabase.from("users").select("*").eq("organization", organization).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Error loading users", description: error.message });
          setLoading(false);
          return;
        }
        setUsers(data || []);
        setLoading(false);
      });
  };

  // open edit dialog
  const handleEditUser = (user: User) => {
    setEditUser(user);
    setEditDialogOpen(true);
  };

  // re-fetch users after edit
  const handleUserUpdated = () => {
    if (!organization) return;
    setLoading(true);
    supabase.from("users").select("*").eq("organization", organization).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Error loading users", description: error.message });
          setLoading(false);
        } else {
          setUsers(data || []);
          setLoading(false);
        }
      });
  };

  // Debug block (unchanged)
  function DebugBlock() {
    return (
      <div className="mb-4 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded px-4 py-3 text-xs max-w-2xl">
        <div className="mb-1 font-semibold">[DEBUG INFO]</div>
        <div>
          <b>Logged-in User:</b>{" "}
          {me ? `${me.email} (${me.id.slice(0, 8)})` : "(none)"}
        </div>
        <div>
          <b>Organization (for filter):</b> {organization || "(none)"}
        </div>
        <div>
          <b>Is Admin:</b>{" "}
          {isAdmin === null
            ? "checking..."
            : isAdmin
            ? "YES"
            : "NO"}
        </div>
        <div>
          <b>Number of users in filtered org:</b>{" "}
          {users ? users.length : 0}
        </div>
        <div>
          <b>Notes:</b>
          <ul className="list-disc list-inside">
            <li>
              If you do <b>not</b> see users here and "Is Admin" says NO, you don't
              have the admin role (check your{" "}
              <span className="font-mono">public.user_roles</span> table in
              Supabase).
            </li>
            <li>
              If super admin's organization is different than your org, you will
              only see yourself here (organization filter is strict).
            </li>
            <li>
              If "Organization" is blank, your user is not mapped in{" "}
              <span className="font-mono">public.users</span> or has no org set.
            </li>
            <li>
              If issue persists, check{" "}
              <span className="font-mono">public.users</span> and{" "}
              <span className="font-mono">public.user_roles</span> directly in
              Supabase dashboard.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg text-muted-foreground">Checking authentication...</div>
    );
  }

  // If user is not authenticated, don't render anything here; useEffect will redirect to /auth
  if (!user) {
    return null;
  }

  return (
    <div className="p-6 max-w-6xl">
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={editUser}
        departments={departments}
        onUserUpdated={handleUserUpdated}
      />
      <DebugBlock />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <CreateUserDialog onUserCreated={handleUserCreated} departments={departments} organization={organization || undefined} />
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5 bg-muted/30 border rounded-md px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or email..."
            className="w-[180px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Department:</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Table */}
      <div className="rounded-md border shadow bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>User Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-center w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <span className="text-muted-foreground">Loading...</span>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <span className="text-muted-foreground">No users found.</span>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id.slice(0, 8)}</TableCell>
                  <TableCell>{user.user_name ?? "--"}</TableCell>
                  <TableCell>{user.department ?? "--"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || "--"}</TableCell>
                  <TableCell>{user.manager || "--"}</TableCell>
                  <TableCell className="text-center">
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
// NOTE: This file is now too long! Consider refactoring after confirming fix!
