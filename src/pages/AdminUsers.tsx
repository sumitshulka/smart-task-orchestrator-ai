
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

  // Fetch the current admin's org for scoping
  useEffect(() => {
    async function fetchOrg() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // look up their org from public.users, fallback to null (see table RLS)
        const { data } = await supabase
          .from("users")
          .select("organization")
          .eq("id", session.user.id)
          .maybeSingle();
        setOrganization(data?.organization ?? null);
      }
    }
    fetchOrg();
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
        return;
      }
      setUsers(data || []);
      setLoading(false);
    }
    if (organization) {
      fetchUsers();
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
        {/* Status filter is hidden, uncomment if you add user status */}
        {/* <div className="flex items-center gap-2">
          <span className="text-sm">Status:</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div> */}
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
