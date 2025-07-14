import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api";
import { 
  Shield, 
  Users, 
  Settings, 
  Eye, 
  Edit, 
  Plus, 
  Trash2,
  UserPlus,
  Building,
  UserCheck,
  Crown
} from "lucide-react";

// Permission Levels
const PERMISSION_LEVELS = {
  NONE: 0,
  VIEW_ONLY: 1,
  VIEW_UPDATE: 2,
  VIEW_UPDATE_CREATE: 3,
  FULL_ACCESS: 4,
} as const;

const PERMISSION_LEVEL_NAMES = {
  0: "No Access",
  1: "View Only",
  2: "View & Update", 
  3: "View, Update & Create",
  4: "Full Access",
} as const;

// Visibility Scopes
const VISIBILITY_SCOPES = {
  USER: "user",           // Own data only
  MANAGER: "manager",     // Own data + managed users
  TEAM: "team",           // Own data + team members
  ORGANIZATION: "organization", // All data
} as const;

const VISIBILITY_SCOPE_NAMES = {
  user: "Self Only",
  manager: "Manager Scope",
  team: "Team Scope", 
  organization: "Organization Wide",
} as const;

// Menu Resources
const MENU_RESOURCES = [
  { id: "dashboard", name: "Dashboard", icon: "📊", category: "Core" },
  { id: "tasks", name: "Task Management", icon: "✅", category: "Core" },
  { id: "my-tasks", name: "My Tasks", icon: "👤", category: "Core" },
  { id: "task-groups", name: "Task Groups", icon: "📁", category: "Core" },
  { id: "historical-tasks", name: "Historical Tasks", icon: "📈", category: "Core" },
  { id: "user-management", name: "User Management", icon: "👥", category: "Management" },
  { id: "team-management", name: "Team Management", icon: "🏢", category: "Management" },
  { id: "roles-privileges", name: "Roles & Privileges", icon: "🔐", category: "Management" },
  { id: "task-report", name: "Task Reports", icon: "📋", category: "Reports" },
  { id: "overdue-report", name: "Overdue Reports", icon: "⚠️", category: "Reports" },
  { id: "analytics-report", name: "Analytics", icon: "📊", category: "Reports" },
];

interface Role {
  id: string;
  name: string;
  description: string;
  permissions?: RolePermission[];
}

interface RolePermission {
  id: string;
  role_id: string;
  resource: string;
  permission_level: number;
  visibility_scope: string;
}

interface CreateRolePermissionRequest {
  role_id: string;
  resource: string;
  permission_level: number;
  visibility_scope: string;
}

export default function RolePermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadPermissions(selectedRole.id);
    }
  }, [selectedRole]);

  const loadRoles = async () => {
    try {
      const rolesData = await apiClient.getRoles();
      setRoles(rolesData);
      if (rolesData.length > 0) {
        setSelectedRole(rolesData[0]);
      }
    } catch (error) {
      toast({
        title: "Error loading roles",
        description: "Failed to load roles from server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async (roleId: string) => {
    try {
      // This endpoint needs to be implemented
      const permissionsData = await apiClient.getRolePermissions(roleId);
      setPermissions(permissionsData);
    } catch (error) {
      console.error("Failed to load permissions:", error);
      setPermissions([]);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      const newRole = await apiClient.createRole({
        name: newRoleName,
        description: newRoleDescription,
      });
      
      setRoles([...roles, newRole]);
      setNewRoleName("");
      setNewRoleDescription("");
      setCreateDialogOpen(false);
      toast({
        title: "Role created",
        description: "New role has been created successfully",
      });
    } catch (error) {
      toast({
        title: "Error creating role",
        description: "Failed to create new role",
        variant: "destructive",
      });
    }
  };

  const updatePermission = async (resource: string, permissionLevel: number, visibilityScope: string) => {
    if (!selectedRole) return;

    try {
      const existingPermission = permissions.find(p => p.resource === resource);
      
      if (existingPermission) {
        // Update existing permission
        await apiClient.updateRolePermission(existingPermission.id, {
          permission_level: permissionLevel,
          visibility_scope: visibilityScope,
        });
      } else {
        // Create new permission
        await apiClient.createRolePermission({
          role_id: selectedRole.id,
          resource,
          permission_level: permissionLevel,
          visibility_scope: visibilityScope,
        });
      }

      // Reload permissions
      await loadPermissions(selectedRole.id);
      
      toast({
        title: "Permission updated",
        description: `Permission for ${resource} has been updated`,
      });
    } catch (error) {
      toast({
        title: "Error updating permission",
        description: "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  const getPermissionForResource = (resource: string): RolePermission | undefined => {
    return permissions.find(p => p.resource === resource);
  };

  const getPermissionLevel = (resource: string): number => {
    const permission = getPermissionForResource(resource);
    return permission?.permission_level || 0;
  };

  const getVisibilityScope = (resource: string): string => {
    const permission = getPermissionForResource(resource);
    return permission?.visibility_scope || "user";
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case "admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "manager": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "team_manager": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getPermissionBadgeColor = (level: number) => {
    switch (level) {
      case 0: return "bg-gray-100 text-gray-800";
      case 1: return "bg-blue-100 text-blue-800";
      case 2: return "bg-yellow-100 text-yellow-800";
      case 3: return "bg-orange-100 text-orange-800";
      case 4: return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const groupedResources = MENU_RESOURCES.reduce((acc, resource) => {
    if (!acc[resource.category]) {
      acc[resource.category] = [];
    }
    acc[resource.category].push(resource);
    return acc;
  }, {} as Record<string, typeof MENU_RESOURCES>);

  if (loading) {
    return <div className="p-6">Loading roles and permissions...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Roles & Privileges
          </h1>
          <p className="text-muted-foreground">
            Manage role-based access control and permissions
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a new role with custom permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Enter role name"
                />
              </div>
              <div>
                <Label htmlFor="role-description">Description</Label>
                <Input
                  id="role-description"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Enter role description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createRole}>Create Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Roles List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Roles</CardTitle>
            <CardDescription>Select a role to manage permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRole?.id === role.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted"
                }`}
                onClick={() => setSelectedRole(role)}
              >
                <div className="flex items-center justify-between">
                  <Badge className={getRoleBadgeColor(role.name)}>
                    {role.name}
                  </Badge>
                  {role.name === "admin" && <Crown className="h-4 w-4 text-yellow-500" />}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {role.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Permissions Management */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">
              Permissions for {selectedRole?.name}
            </CardTitle>
            <CardDescription>
              Configure permission levels and visibility scopes for menu items
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <Tabs defaultValue="permissions" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>
                
                <TabsContent value="permissions" className="space-y-6">
                  {Object.entries(groupedResources).map(([category, resources]) => (
                    <div key={category}>
                      <h3 className="text-lg font-semibold mb-3">{category}</h3>
                      <div className="space-y-2">
                        {resources.map((resource) => {
                          const currentLevel = getPermissionLevel(resource.id);
                          const currentScope = getVisibilityScope(resource.id);
                          
                          return (
                            <div key={resource.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{resource.icon}</span>
                                <div>
                                  <div className="font-medium">{resource.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    Resource ID: {resource.id}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1">
                                  <Label className="text-xs">Permission Level</Label>
                                  <Select
                                    value={currentLevel.toString()}
                                    onValueChange={(value) => 
                                      updatePermission(resource.id, parseInt(value), currentScope)
                                    }
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(PERMISSION_LEVEL_NAMES).map(([level, name]) => (
                                        <SelectItem key={level} value={level}>
                                          {name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="flex flex-col gap-1">
                                  <Label className="text-xs">Visibility Scope</Label>
                                  <Select
                                    value={currentScope}
                                    onValueChange={(value) => 
                                      updatePermission(resource.id, currentLevel, value)
                                    }
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(VISIBILITY_SCOPE_NAMES).map(([scope, name]) => (
                                        <SelectItem key={scope} value={scope}>
                                          {name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="summary">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Menu Item</TableHead>
                        <TableHead>Permission Level</TableHead>
                        <TableHead>Visibility Scope</TableHead>
                        <TableHead>Access</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MENU_RESOURCES.map((resource) => {
                        const level = getPermissionLevel(resource.id);
                        const scope = getVisibilityScope(resource.id);
                        
                        return (
                          <TableRow key={resource.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{resource.icon}</span>
                                {resource.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPermissionBadgeColor(level)}>
                                {PERMISSION_LEVEL_NAMES[level as keyof typeof PERMISSION_LEVEL_NAMES]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {VISIBILITY_SCOPE_NAMES[scope as keyof typeof VISIBILITY_SCOPE_NAMES]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {level > 0 ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Allowed
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800">
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Denied
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a role to manage its permissions
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}