import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Filter, Plus, MoreVertical } from "lucide-react";
import UserTableActions from "@/components/UserTableActions";
import CreateUserDialog from "@/components/CreateUserDialog";

interface User {
  id: string;
  email: string;
  phone?: string;
  user_name?: string;
  department?: string;
  manager?: string;
  is_active?: boolean;
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

  // Fetch users: Simulated data for now, extend here for your user source
  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (error) {
        toast({ title: "Error loading users", description: error.message });
        setLoading(false);
        return;
      }
      // Mock data for additional columns
      setUsers(
        (data?.users || []).map((u: any, i: number) => ({
          id: u.id,
          email: u.email,
          user_name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "User "+i,
          department: departments[i % departments.length],
          phone: u.phone,
          manager: departments[(i + 2) % departments.length] + " Manager",
          is_active: !u.banned, // Supabase doesn't have is_active; just example
        }))
      );
      setLoading(false);
    }
    fetchUsers();
  }, []);

  // Filtering logic
  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        search === "" ||
        user.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase());
      const matchesDept = selectedDept === "" || user.department === selectedDept;
      const matchesStatus =
        !status ||
        (status === "active" && user.is_active) ||
        (status === "inactive" && !user.is_active);
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [users, search, selectedDept, status]);

  // Enhance: Allow parent to refresh user list after create
  const handleUserCreated = () => {
    // re-fetch users after creating new user
    // We use fetchUsers directly but since it's inside useEffect,
    // we copy the logic inline:
    setLoading(true);
    supabase.auth.admin.listUsers({ perPage: 1000 })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Error loading users", description: error.message });
          setLoading(false);
          return;
        }
        setUsers(
          (data?.users || []).map((u: any, i: number) => ({
            id: u.id,
            email: u.email,
            user_name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "User " + i,
            department: departments[i % departments.length],
            phone: u.phone,
            manager: u.user_metadata?.manager ?? departments[(i + 2) % departments.length] + " Manager",
            is_active: !u.banned,
          }))
        );
        setLoading(false);
      });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <CreateUserDialog onUserCreated={handleUserCreated} departments={departments} />
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
        <div className="flex items-center gap-2">
          <span className="text-sm">Status:</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
