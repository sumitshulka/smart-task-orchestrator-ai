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
import DownloadSampleExcel from "@/components/DownloadSampleExcel";
import BulkUserUploadDialog from "@/components/BulkUserUploadDialog";
import { useUserList } from "@/hooks/useUserList";

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

  // Fetch all users for mapping manager IDs to names for display
  const { users: allSimpleUsers, loading: usersListLoading } = useUserList();

  // Redirect to /auth if user is logged out and auth has finished loading
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      // User not logged in; possible redirect in previous effect
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

      // Fetch user's org from public.users
      const { data, error } = await supabase
        .from("users")
        .select("organization")
        .eq("id", uid)
        .maybeSingle();

      setMe({ id: uid, email, organization: data?.organization ?? null });
      setOrganization(data?.organization ?? null);

      // Check admin role
      const { data: adminData } = await supabase
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

      const hasAdminRole = !!(adminData && adminData.some((row: any) =>
        row?.roles?.name === "admin"
      ));
      setIsAdmin(hasAdminRole);
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
        return;
      }
      setUsers(data || []);
      setLoading(false);
    }
    if (organization) {
      fetchUsers();
    } else {
      setUsers([]);
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

  // Helper to get manager's display name/email from manager id
  function getManagerDisplay(managerId: string | undefined) {
    if (!managerId) return "--";
    const m = allSimpleUsers.find(u => u.id === managerId);
    if (m) {
      return m.user_name ? `${m.user_name} (${m.email})` : m.email;
    }
    return managerId; // fallback to id if not found
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
        onUserUpdated={handleUserUpdated}
      />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-3">
          <DownloadSampleExcel />
          <BulkUserUploadDialog />
          <CreateUserDialog onUserCreated={handleUserCreated} organization={organization || undefined} />
        </div>
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
            {[...new Set(users.map((u) => u.department).filter(Boolean))].map((d) => (
              <option key={d} value={d as string}>{d}</option>
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
                  <TableCell>{getManagerDisplay(user.manager)}</TableCell>
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
