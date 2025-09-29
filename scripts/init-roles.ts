#!/usr/bin/env tsx
// Initialize roles and permissions for new TaskRep installation
import { storage } from '../server/storage';

// Define the base roles and their configurations
const BASE_ROLES = [
  {
    name: 'admin',
    description: 'System Administrator - Full access to all features',
    visibility_scope: 'organization'
  },
  {
    name: 'manager',
    description: 'Manager - Team oversight and management capabilities',
    visibility_scope: 'organization'
  },
  {
    name: 'team_manager',
    description: 'Team Manager - Limited team management capabilities',
    visibility_scope: 'team'
  },
  {
    name: 'user',
    description: 'User - Basic task and team access',
    visibility_scope: 'user'
  }
];

// Define role permissions based on the application's resource structure
// Permission levels: 0=None, 1=View, 2=View+Update, 3=View+Update+Create, 4=Full
const ROLE_PERMISSIONS_CONFIG = {
  admin: [
    { resource: 'users', permission_level: 4 },
    { resource: 'roles', permission_level: 4 },
    { resource: 'teams', permission_level: 4 },
    { resource: 'tasks', permission_level: 4 },
    { resource: 'reports', permission_level: 1 },
    { resource: 'analytics', permission_level: 1 },
    { resource: 'settings', permission_level: 2 },
    { resource: 'task-groups', permission_level: 4 },
    { resource: 'benchmarking', permission_level: 4 },
    { resource: 'licenses', permission_level: 4 },
    { resource: 'user-management', permission_level: 4 },
    { resource: 'role-permissions', permission_level: 4 },
  ],
  manager: [
    { resource: 'users', permission_level: 2 },
    { resource: 'teams', permission_level: 3 },
    { resource: 'tasks', permission_level: 4 },
    { resource: 'reports', permission_level: 1 },
    { resource: 'analytics', permission_level: 1 },
    { resource: 'task-groups', permission_level: 3 },
    { resource: 'benchmarking', permission_level: 1 },
  ],
  team_manager: [
    { resource: 'users', permission_level: 1 },
    { resource: 'teams', permission_level: 2 },
    { resource: 'tasks', permission_level: 3 },
    { resource: 'reports', permission_level: 1 },
    { resource: 'task-groups', permission_level: 2 },
  ],
  user: [
    { resource: 'tasks', permission_level: 3 },
    { resource: 'teams', permission_level: 1 },
    { resource: 'task-groups', permission_level: 1 },
  ],
};

async function initializeRoles() {
  console.log('🎭 Initializing roles and permissions for TaskRep...');
  
  try {
    // Check if roles already exist
    const existingRoles = await storage.getAllRoles();
    if (existingRoles.length > 0) {
      console.log('⚠️  Roles already exist in the database. Skipping role creation.');
      console.log(`   Found ${existingRoles.length} existing roles: ${existingRoles.map(r => r.name).join(', ')}`);
      return;
    }

    const createdRoles: any[] = [];

    // 1. Create base roles
    console.log('📝 Creating base roles...');
    for (const roleConfig of BASE_ROLES) {
      try {
        const role = await storage.createRole(roleConfig);
        createdRoles.push(role);
        console.log(`✓ Created role: ${roleConfig.name} (${roleConfig.description})`);
      } catch (error) {
        console.log(`⚠️  Role ${roleConfig.name} already exists or failed to create`);
      }
    }

    // 2. Create role permissions
    console.log('🔐 Creating role permissions...');
    for (const role of createdRoles) {
      const permissionsConfig = ROLE_PERMISSIONS_CONFIG[role.name as keyof typeof ROLE_PERMISSIONS_CONFIG];
      if (!permissionsConfig) {
        console.log(`⚠️  No permissions configuration found for role: ${role.name}`);
        continue;
      }

      console.log(`   Setting permissions for ${role.name}...`);
      for (const permConfig of permissionsConfig) {
        try {
          await storage.createRolePermission({
            role_id: role.id,
            resource: permConfig.resource,
            permission_level: permConfig.permission_level,
          });
          console.log(`     ✓ ${permConfig.resource}: Level ${permConfig.permission_level}`);
        } catch (error) {
          console.log(`     ⚠️  Failed to create permission for ${permConfig.resource}`);
        }
      }
    }

    console.log('');
    console.log('🎉 Role initialization completed successfully!');
    console.log('');
    console.log('📊 Created Roles:');
    console.log('   • admin: Full system access');
    console.log('   • manager: Team oversight and management');
    console.log('   • team_manager: Limited team management');
    console.log('   • user: Basic task and team access');
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('   1. Create your first admin user');
    console.log('   2. Assign roles to users via the admin interface');
    console.log('   3. Customize role permissions as needed');
    
  } catch (error) {
    console.error('❌ Role initialization failed:', error);
    process.exit(1);
  }
}

// Run the role initialization
initializeRoles();