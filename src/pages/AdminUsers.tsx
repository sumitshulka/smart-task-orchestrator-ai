
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
import { Plus, Filter } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserTableActions from "@/components/UserTableActions";
import EditUserDialog from "@/components/EditUserDialog";
import BulkUserUploadDialog from "@/components/BulkUserUploadDialog";
import { useQuery } from "@tanstack/react-query";

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

  // Fetch users using react-query (React Query v5 format)
  const { isLoading, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Error loading users", description: error.message });
        return [];
      }
      return data || [];
    },
    meta: {
      onSuccess: (data: User[]) => {
        setUsers(data);
      },
    },
  });

  const fetchUsersAndUpdate = () => {
    refetch();
  };

  const filteredUsers = React.useMemo(() => {
    return users.filter((user) => {
      const searchTerm = search.toLowerCase();
      return (
        user.user_name?.toLowerCase().includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm)
      );
    });
  }, [users, search]);

  function handleCreateUser() {
    setCreateDialogOpen(true);
  }
  function handleEditUser(user: User) {
    setEditUser(user);
    setEditDialogOpen(true);
  }

  return (
    <div className="p-6 max-w-6xl w-full">
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
        <div className="flex gap-3">
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
                  <span className="text-muted-foreground">No users found.</span>
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
