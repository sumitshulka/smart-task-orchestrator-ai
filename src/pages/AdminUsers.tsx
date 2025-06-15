import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Filter } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserTableActions from "@/components/UserTableActions";
import EditUserDialog from "@/components/EditUserDialog";
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
  const [editUser, setEditUser] = React.useState<User | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);

  // For checking session info and admin status
  const { user } = useSupabaseSession();

  // Fetch users from Supabase
  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setUsers(data as User[]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = React.useMemo(() => {
    if (!search) return users;
    const searchTerm = search.toLowerCase();
    return users.filter((user) => {
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

  // Helper: Given the user's managerId (manager is now a UUID), find their manager's full user object
  function getManagerInfo(managerId?: string) {
    if (!managerId) return null;
    const found = users.find((u) => u.id === managerId);
    return found || null;
  }

  return (
    <div className="p-6 max-w-6xl w-full">
      {/* Dialogs */}
      <EditUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserUpdated={fetchUsers}
        user={undefined}
      />
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={editUser}
        onUserUpdated={fetchUsers}
      />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-3 flex-wrap">
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
        <table className="w-full border text-sm rounded-md shadow bg-background">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-left">Manager</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <span className="text-muted-foreground">Loading users...</span>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <span className="text-muted-foreground">
                    No users found in the system.
                  </span>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const managerObj = getManagerInfo(user.manager);
                return (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="p-2">{user.user_name || "--"}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.department || "--"}</td>
                    <td className="p-2">
                      {managerObj
                        ? (
                          <div>
                            <div className="font-medium">{managerObj.user_name}</div>
                            <div className="text-xs text-muted-foreground">{managerObj.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      }
                    </td>
                    <td className="p-2 text-right">
                      <UserTableActions user={user} onEdit={handleEditUser} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
