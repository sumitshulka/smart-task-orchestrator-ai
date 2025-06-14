import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Filter } from "lucide-react";
import UserTableActions from "@/components/UserTableActions";
import CreateUserDialog from "@/components/CreateUserDialog";

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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [status, setStatus] = useState("");
  const [organization, setOrganization] = useState<string | null>(null); // Filtering by org
  const [me, setMe] = useState<{id: string, email: string, organization: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // On component mount, immediately log the session
  useEffect(() => {
    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log("[LOVABLE DEBUG] getSession() called on mount:", session, error);

      // Log localStorage tokens as well
      try {
        const tokenData = window.localStorage.getItem("supabase.auth.token");
        console.log("[LOVABLE DEBUG] window.localStorage.supabase.auth.token:", tokenData);
      } catch (e) {
        console.log("[LOVABLE DEBUG] localStorage access failed:", e);
      }
    })();
  }, []);

  // Fetch the current admin's org for scoping
  useEffect(() => {
    async function fetchOrgAndMe() {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log("[DEBUG] Supabase auth.getSession() (in fetchOrgAndMe):", session, error);

      if (error) {
        setMe(null);
        setIsAdmin(false);
        setOrganization(null);
        return;
      }
      if (session?.user) {
        const uid = session.user.id;
        const email = session.user.email || "";
        console.log("[LOVABLE DEBUG] Session user:", uid, email);

        // look up their org from public.users, fallback to null (see table RLS)
        const { data } = await supabase
          .from("users")
          .select("organization")
          .eq("id", uid)
          .maybeSingle();

        console.log("[DEBUG] public.users org lookup:", data);

        setMe({ id: uid, email, organization: data?.organization ?? null });
        setOrganization(data?.organization ?? null);

        // Check if current user is admin (via public.user_roles + public.roles)
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

        console.log("[DEBUG] public.user_roles for user:", adminData, adminErr);

        // adminData is an array, each having roles
        const hasAdminRole = !!(adminData && adminData.some((row: any) => {
          // row.roles is an object with name
          return row?.roles?.name === "admin";
        }));
        setIsAdmin(hasAdminRole);
        console.log("[DEBUG] Is admin? ", hasAdminRole);
      } else {
        setMe(null);
        setIsAdmin(false);
        setOrganization(null);
        console.log("[LOVABLE DEBUG] No user in session!");
      }
    }
    fetchOrgAndMe();
  }, []);

  // Fetch users from public.users
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
        console.log("[DEBUG] Error loading users:", error);
        return;
      }
      setUsers(data || []);
      setLoading(false);
      console.log("[DEBUG] Users fetched:", data);
    }
    if (organization) {
      fetchUsers();
    } else {
      setUsers([]);
      console.log("[DEBUG] Organization not set, skipping fetchUsers");
    }
  }, [organization]);

  // Filtering logic
  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        search === "" ||
        user.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase());
      const matchesDept = selectedDept === "" || user.department === selectedDept;
      // Status (active/inactive) is not tracked in public.users, so disabled for now
      return matchesSearch && matchesDept;
    });
  }, [users, search, selectedDept]);

  // Enhance: Allow parent to refresh user list after create
  const handleUserCreated = () => {
    // just re-fetch from DB
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

  // DEBUGGING OUTPUT
  function DebugBlock() {
    return (
      <div className="mb-4 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded px-4 py-3 text-xs max-w-2xl">
        <div className="mb-1 font-semibold">[DEBUG INFO]</div>
        <div><b>Logged-in User:</b> {me ? `${me.email} (${me.id.slice(0, 8)})` : "(none)"}</div>
        <div><b>Organization (for filter):</b> {organization || "(none)"}</div>
        <div><b>Is Admin:</b> {isAdmin === null ? "checking..." : isAdmin ? "YES" : "NO"}</div>
        <div><b>Number of users in filtered org:</b> {users ? users.length : 0}</div>
        <div>
          <b>Notes:</b>
          <ul className="list-disc list-inside">
            <li>If you do <b>not</b> see users here and "Is Admin" says NO, you don't have the admin role (check your <span className="font-mono">public.user_roles</span> table in Supabase).</li>
            <li>If super admin's organization is different than your org, you will only see yourself here (organization filter is strict).</li>
            <li>If "Organization" is blank, your user is not mapped in <span className="font-mono">public.users</span> or has no org set.</li>
            <li>If issue persists, check <span className="font-mono">public.users</span> and <span className="font-mono">public.user_roles</span> directly in Supabase dashboard.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl"> {/* removed mx-auto so it aligns left */}
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
                    <UserTableActions user={user} />
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

// NOTE: This file is getting long (over 200 LOC). Consider asking me to refactor for maintainability!
