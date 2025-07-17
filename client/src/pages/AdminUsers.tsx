
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Filter, Shield, Users, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api";
import UserTableActions from "@/components/UserTableActions";
import EditUserDialog from "@/components/EditUserDialog";
import CreateUserDialog from "@/components/CreateUserDialog";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useUserRoles } from "@/hooks/useUserRoles";
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
  const [editUser, setEditUser] = React.useState<User | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);

  // For checking session info and admin status
  const { user } = useSupabaseSession();

  // Get user roles
  const userIds = users.map(user => user.id);
  const { userRoles, loading: rolesLoading, refreshUserRoles } = useUserRoles(userIds);

  // Get license information for user limits
  const { data: licenseInfo, isLoading: licenseLoading, refetch: refetchLicense } = useQuery({
    queryKey: ['license-user-limits'],
    queryFn: async () => {
      const response = await fetch('/api/license/user-limits', {
        headers: {
          'x-user-id': user?.id || '',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch license info');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Fetch users from API
  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getUsers();
      setUsers(data as User[]);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
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
    // Check license limits before opening create dialog
    if (licenseInfo && licenseInfo.hasLicense && licenseInfo.userLimits) {
      const { maximum } = licenseInfo.userLimits;
      const currentUsers = licenseInfo.currentUsers;
      
      if (currentUsers >= maximum) {
        toast({
          title: "License Limit Reached",
          description: `Cannot create user. License limit reached (${currentUsers}/${maximum} users). Please upgrade your license or deactivate existing users.`,
          variant: "destructive"
        });
        return;
      }
    }
    
    setCreateDialogOpen(true);
  }

  function handleEditUser(user: User) {
    setEditUser(user);
    setEditDialogOpen(true);
  }

  // Function to refresh both users and roles data
  const handleDataRefresh = React.useCallback(async () => {
    await fetchUsers();
    await refreshUserRoles();
  }, [fetchUsers, refreshUserRoles]);

  // Helper: Given the user's managerId (manager is now a UUID), find their manager's full user object
  function getManagerInfo(managerId?: string) {
    if (!managerId) return null;
    const found = users.find((u) => u.id === managerId);
    return found || null;
  }

  return (
    <div className="p-6 max-w-6xl w-full">
      {/* Dialogs */}
      <CreateUserDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={() => {
          fetchUsers();
          refetchLicense();
        }} 
      />
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={editUser}
        onUserUpdated={() => {
          fetchUsers();
          refetchLicense();
        }}
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

      {/* License Information Card */}
      {licenseInfo && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-blue-600" />
              License Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {licenseInfo.hasLicense && licenseInfo.isValid ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Active Users</p>
                    <p className="text-lg font-semibold">
                      {licenseInfo.currentUsers}
                      {licenseInfo.userLimits && (
                        <span className="text-sm font-normal text-muted-foreground">
                          /{licenseInfo.userLimits.maximum}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {licenseInfo.userLimits && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">User Limits</p>
                    <p className="text-sm">
                      Min: {licenseInfo.userLimits.minimum} | Max: {licenseInfo.userLimits.maximum}
                    </p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subscription</p>
                  <Badge variant="outline" className="text-xs">
                    {licenseInfo.subscriptionType || 'Active'}
                  </Badge>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {licenseInfo.message || 'No valid license found. Please configure your license in Settings.'}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Warning when approaching limit */}
            {licenseInfo.hasLicense && licenseInfo.userLimits && (
              licenseInfo.currentUsers >= licenseInfo.userLimits.maximum * 0.8 && (
                <Alert className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {licenseInfo.currentUsers >= licenseInfo.userLimits.maximum ? (
                      <span className="text-red-600 font-medium">
                        License limit reached ({licenseInfo.currentUsers}/{licenseInfo.userLimits.maximum} users). 
                        Cannot create new users until you upgrade your license or deactivate existing users.
                      </span>
                    ) : (
                      <span className="text-amber-600">
                        Approaching license limit ({licenseInfo.currentUsers}/{licenseInfo.userLimits.maximum} users). 
                        Consider upgrading your license soon.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )
            )}
          </CardContent>
        </Card>
      )}
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
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-left">Manager</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <span className="text-muted-foreground">Loading users...</span>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <span className="text-muted-foreground">
                    No users found in the system.
                  </span>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const managerObj = getManagerInfo(user.manager);
                const roles = userRoles[user.id] || [];
                return (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{user.user_name || "--"}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      {rolesLoading ? (
                        <span className="text-muted-foreground">Loading...</span>
                      ) : roles.length > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs"
                        >
                          {roles[0].role.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No role</span>
                      )}
                    </td>
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
                    <td className="p-2">
                      <Badge 
                        variant={user.is_active ? "default" : "secondary"} 
                        className={user.is_active ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}
                      >
                        {user.is_active ? "Active" : "Deactivated"}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">
                      <UserTableActions 
                        user={user} 
                        onEdit={handleEditUser} 
                        onRefresh={() => {
                          handleDataRefresh();
                          refetchLicense();
                        }} 
                      />
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
