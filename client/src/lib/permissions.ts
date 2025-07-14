// Role-based permissions system
export type Role = 'admin' | 'manager' | 'team_manager' | 'user';

export interface Permission {
  action: string;
  resource: string;
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    // Full system access
    { action: 'read', resource: 'users' },
    { action: 'create', resource: 'users' },
    { action: 'update', resource: 'users' },
    { action: 'delete', resource: 'users' },
    { action: 'read', resource: 'roles' },
    { action: 'create', resource: 'roles' },
    { action: 'update', resource: 'roles' },
    { action: 'delete', resource: 'roles' },
    { action: 'read', resource: 'teams' },
    { action: 'create', resource: 'teams' },
    { action: 'update', resource: 'teams' },
    { action: 'delete', resource: 'teams' },
    { action: 'read', resource: 'tasks' },
    { action: 'create', resource: 'tasks' },
    { action: 'update', resource: 'tasks' },
    { action: 'delete', resource: 'tasks' },
    { action: 'read', resource: 'reports' },
    { action: 'read', resource: 'analytics' },
    { action: 'read', resource: 'settings' },
    { action: 'update', resource: 'settings' },
  ],
  manager: [
    // Team oversight capabilities
    { action: 'read', resource: 'users' },
    { action: 'update', resource: 'users' },
    { action: 'read', resource: 'teams' },
    { action: 'create', resource: 'teams' },
    { action: 'update', resource: 'teams' },
    { action: 'read', resource: 'tasks' },
    { action: 'create', resource: 'tasks' },
    { action: 'update', resource: 'tasks' },
    { action: 'delete', resource: 'tasks' },
    { action: 'read', resource: 'reports' },
    { action: 'read', resource: 'analytics' },
  ],
  team_manager: [
    // Limited team management
    { action: 'read', resource: 'users' },
    { action: 'read', resource: 'teams' },
    { action: 'update', resource: 'teams' },
    { action: 'read', resource: 'tasks' },
    { action: 'create', resource: 'tasks' },
    { action: 'update', resource: 'tasks' },
    { action: 'read', resource: 'reports' },
  ],
  user: [
    // Basic user access
    { action: 'read', resource: 'tasks' },
    { action: 'create', resource: 'tasks' },
    { action: 'update', resource: 'tasks' },
    { action: 'read', resource: 'teams' },
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: Role, action: string, resource: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.some(p => p.action === action && p.resource === resource);
}

// Get all permissions for a role
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Check if user can access a specific route
export function canAccessRoute(role: Role, route: string): boolean {
  const routePermissions: Record<string, { action: string; resource: string }> = {
    '/admin/users': { action: 'read', resource: 'users' },
    '/admin/roles': { action: 'read', resource: 'roles' },
    '/admin/teams': { action: 'read', resource: 'teams' },
    '/admin/settings': { action: 'read', resource: 'settings' },
    '/admin/reports': { action: 'read', resource: 'reports' },
    '/admin/analytics': { action: 'read', resource: 'analytics' },
    '/tasks': { action: 'read', resource: 'tasks' },
    '/my-teams': { action: 'read', resource: 'teams' },
  };

  const permission = routePermissions[route];
  if (!permission) return true; // Allow access to unprotected routes
  
  return hasPermission(role, permission.action, permission.resource);
}

// Get navigation items based on role
export function getNavigationItems(role: Role) {
  const allItems = [
    {
      title: 'Dashboard',
      path: '/admin/dashboard',
      icon: 'LayoutDashboard',
      requiredPermission: { action: 'read', resource: 'analytics' },
    },
    {
      title: 'Tasks',
      path: '/admin/tasks',
      icon: 'CheckSquare',
      requiredPermission: { action: 'read', resource: 'tasks' },
    },
    {
      title: 'My Tasks',
      path: '/admin/my-tasks',
      icon: 'User',
      requiredPermission: { action: 'read', resource: 'tasks' },
    },
    {
      title: 'Task Groups',
      path: '/admin/task-groups',
      icon: 'FolderOpen',
      requiredPermission: { action: 'read', resource: 'tasks' },
    },
    {
      title: 'Users',
      path: '/admin/users',
      icon: 'Users',
      requiredPermission: { action: 'read', resource: 'users' },
    },
    {
      title: 'Teams',
      path: '/admin/teams',
      icon: 'Users',
      requiredPermission: { action: 'read', resource: 'teams' },
    },
    {
      title: 'Roles',
      path: '/admin/roles',
      icon: 'Shield',
      requiredPermission: { action: 'read', resource: 'roles' },
    },
    {
      title: 'Reports',
      path: '/admin/reports',
      icon: 'BarChart3',
      requiredPermission: { action: 'read', resource: 'reports' },
    },
    {
      title: 'Settings',
      path: '/admin/settings',
      icon: 'Settings',
      requiredPermission: { action: 'read', resource: 'settings' },
    },
  ];

  return allItems.filter(item => 
    hasPermission(role, item.requiredPermission.action, item.requiredPermission.resource)
  );
}

// Role hierarchy for privilege checks
export const ROLE_HIERARCHY: Record<Role, number> = {
  user: 1,
  team_manager: 2,
  manager: 3,
  admin: 4,
};

// Check if one role is higher than another
export function isHigherRole(role1: Role, role2: Role): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

// Check if user can manage another user based on roles
export function canManageUser(managerRole: Role, targetRole: Role): boolean {
  return isHigherRole(managerRole, targetRole) || managerRole === 'admin';
}