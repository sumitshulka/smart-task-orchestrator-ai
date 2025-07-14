import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, Users, FileText, BarChart3, Settings, Eye, UserCheck, Building2, Calendar, Target, Archive } from 'lucide-react';
import { apiClient } from '@/lib/api';

const PERMISSION_LEVELS = {
  0: "None",
  1: "View", 
  2: "View + Edit",
  3: "View + Edit + Create",
  4: "Full Access"
};

const PERMISSION_LEVEL_DESCRIPTIONS = {
  0: "No access to this feature",
  1: "Can only view data", 
  2: "Can view and edit existing data",
  3: "Can view, edit, and create new data",
  4: "Full access including delete operations"
};

const VISIBILITY_SCOPES = {
  user: "User Level",
  manager: "Manager Level", 
  team: "Team Level",
  organization: "Organization Level"
};

const VISIBILITY_SCOPE_DESCRIPTIONS = {
  user: "Can only see their own data",
  manager: "Can see own + managed users data",
  team: "Can see own + team members data", 
  organization: "Can see all organizational data"
};

const MENU_RESOURCES = [
  // Dashboard
  { id: 'dashboard', name: 'Dashboard', icon: '📊', category: 'Overview' },
  
  // Task Management
  { id: 'tasks', name: 'Tasks', icon: '✅', category: 'Task Management' },
  { id: 'my-tasks', name: 'My Tasks', icon: '👤', category: 'Task Management' },
  { id: 'task-groups', name: 'Task Groups', icon: '📁', category: 'Task Management' },
  { id: 'historical-tasks', name: 'Historical Tasks', icon: '📜', category: 'Task Management' },
  
  // Management
  { id: 'user-management', name: 'User Management', icon: '👥', category: 'Management' },
  { id: 'team-management', name: 'Team Management', icon: '🏢', category: 'Management' },
  { id: 'roles-privileges', name: 'Roles & Privileges', icon: '🔐', category: 'Management' },
  
  // Reports
  { id: 'task-report', name: 'Task Reports', icon: '📈', category: 'Reports' },
  { id: 'overdue-report', name: 'Overdue Reports', icon: '⚠️', category: 'Reports' },
  { id: 'analytics-report', name: 'Analytics Reports', icon: '📊', category: 'Reports' }
];

interface Role {
  id: string;
  name: string;
  description: string;
  visibility_scope?: string;
  created_at: string;
  updated_at: string;
}

interface RolePermission {
  id: string;
  role_id: string;
  resource: string;
  permission_level: number;
  created_at: string;
  updated_at: string;
}

export default function RolePermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleVisibilityScope, setNewRoleVisibilityScope] = useState("user");
  const { toast } = useToast();

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadRolePermissions(selectedRole.id);
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

  const loadRolePermissions = async (roleId: string) => {
    try {
      const permissionsData = await apiClient.getRolePermissions(roleId);
      setRolePermissions(permissionsData);
    } catch (error) {
      console.error("Failed to load permissions:", error);
      setRolePermissions([]);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      const newRole = await apiClient.createRole({
        name: newRoleName,
        description: newRoleDescription,
        visibility_scope: newRoleVisibilityScope
      });
      
      setRoles([...roles, newRole]);
      setSelectedRole(newRole);
      setCreateDialogOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
      setNewRoleVisibilityScope("user");
      
      toast({
        title: "Role created",
        description: `Role "${newRoleName}" has been created successfully`,
      });
    } catch (error) {
      toast({
        title: "Error creating role",
        description: "Failed to create role",
        variant: "destructive",
      });
    }
  };

  const updatePermission = async (resourceId: string, level: number) => {
    if (!selectedRole) return;
    
    const existingPermission = rolePermissions.find(p => p.resource === resourceId);
    
    try {
      if (existingPermission) {
        // Update existing permission
        await apiClient.updateRolePermission(existingPermission.id, {
          permission_level: level
        });
      } else {
        // Create new permission
        await apiClient.createRolePermission({
          role_id: selectedRole.id,
          resource: resourceId,
          permission_level: level
        });
      }
      
      // Reload permissions
      await loadRolePermissions(selectedRole.id);
      
      toast({
        title: "Permission updated",
        description: `Updated ${resourceId} permission for ${selectedRole.name}`,
      });
    } catch (error) {
      toast({
        title: "Error updating permission",
        description: "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  const updateRoleVisibilityScope = async (scope: string) => {
    if (!selectedRole) return;
    
    try {
      await apiClient.updateRole(selectedRole.id, {
        visibility_scope: scope
      });
      
      // Update local state
      const updatedRole = { ...selectedRole, visibility_scope: scope };
      setSelectedRole(updatedRole);
      setRoles(roles.map(r => r.id === selectedRole.id ? updatedRole : r));
      
      toast({
        title: "Visibility scope updated",
        description: `Updated visibility scope for ${selectedRole.name}`,
      });
    } catch (error) {
      toast({
        title: "Error updating visibility scope",
        description: "Failed to update visibility scope",
        variant: "destructive",
      });
    }
  };

  const getPermissionLevel = (resourceId: string): number => {
    const permission = rolePermissions.find(p => p.resource === resourceId);
    return permission ? permission.permission_level : 0;
  };

  const getPermissionBadgeColor = (level: number): string => {
    switch (level) {
      case 0: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case 1: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case 2: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case 3: return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case 4: return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getPermissionIcon = (level: number): string => {
    switch (level) {
      case 0: return "🚫";
      case 1: return "👁️";
      case 2: return "✏️";
      case 3: return "➕";
      case 4: return "🔧";
      default: return "❓";
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
            Manage role-based access control and permissions for your organization
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
                Create a new role with custom permissions and visibility scope
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
              <div>
                <Label htmlFor="visibility-scope">Visibility Scope</Label>
                <Select value={newRoleVisibilityScope} onValueChange={setNewRoleVisibilityScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISIBILITY_SCOPES).map(([scope, name]) => (
                      <SelectItem key={scope} value={scope}>
                        <div className="flex flex-col">
                          <span className="font-medium">{name}</span>
                          <span className="text-xs text-muted-foreground">
                            {VISIBILITY_SCOPE_DESCRIPTIONS[scope as keyof typeof VISIBILITY_SCOPE_DESCRIPTIONS]}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedRole(role)}
              >
                <div className="font-medium">{role.name}</div>
                <div className="text-sm text-muted-foreground">{role.description}</div>
                {role.visibility_scope && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {VISIBILITY_SCOPES[role.visibility_scope as keyof typeof VISIBILITY_SCOPES]}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Permissions Management */}
        <div className="lg:col-span-3 space-y-6">
          {selectedRole ? (
            <>
              {/* Role Header */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{selectedRole.name}</CardTitle>
                      <CardDescription>{selectedRole.description}</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium">Data Visibility Scope</Label>
                      <Select 
                        value={selectedRole.visibility_scope || "user"} 
                        onValueChange={updateRoleVisibilityScope}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VISIBILITY_SCOPES).map(([scope, name]) => (
                            <SelectItem key={scope} value={scope}>
                              <div className="flex flex-col">
                                <span className="font-medium">{name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {VISIBILITY_SCOPE_DESCRIPTIONS[scope as keyof typeof VISIBILITY_SCOPE_DESCRIPTIONS]}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Permissions by Category */}
              {Object.entries(groupedResources).map(([category, resources]) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category}</CardTitle>
                    <CardDescription>
                      Configure permissions for {category.toLowerCase()} features
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {resources.map((resource) => {
                      const currentLevel = getPermissionLevel(resource.id);
                      
                      return (
                        <div key={resource.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{resource.icon}</span>
                            <div>
                              <div className="font-medium">{resource.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Configure what users with this role can do in {resource.name}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Badge className={`${getPermissionBadgeColor(currentLevel)} flex items-center gap-1 px-3 py-1`}>
                                <span className="text-sm">{getPermissionIcon(currentLevel)}</span>
                                <span className="font-medium text-xs">{PERMISSION_LEVELS[currentLevel as keyof typeof PERMISSION_LEVELS]}</span>
                              </Badge>
                              {currentLevel > 0 && (
                                <div className="text-xs text-muted-foreground max-w-32 truncate">
                                  {PERMISSION_LEVEL_DESCRIPTIONS[currentLevel as keyof typeof PERMISSION_LEVEL_DESCRIPTIONS]}
                                </div>
                              )}
                            </div>
                            
                            <Select
                              value={currentLevel.toString()}
                              onValueChange={(value) => updatePermission(resource.id, parseInt(value))}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PERMISSION_LEVELS).map(([level, name]) => (
                                  <SelectItem key={level} value={level}>
                                    <div className="flex items-center gap-2">
                                      <span>{getPermissionIcon(parseInt(level))}</span>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {PERMISSION_LEVEL_DESCRIPTIONS[parseInt(level) as keyof typeof PERMISSION_LEVEL_DESCRIPTIONS]}
                                        </span>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Select a Role</h3>
                  <p className="text-muted-foreground">Choose a role from the left to manage its permissions</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}