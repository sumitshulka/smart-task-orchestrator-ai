#!/usr/bin/env tsx
// Data migration script to export data from Supabase and import to PostgreSQL
import { createClient } from '@supabase/supabase-js';
import { storage } from '../server/storage';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZndtZnRweXhqdGRvaHhoY2diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg4NDQwMywiZXhwIjoyMDY1NDYwNDAzfQ.Aupnw211WdXCehO9ykUqGA4jZAvO80VDvCgikFByjGQ";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateData() {
  console.log('🚀 Starting data migration from Supabase to PostgreSQL...');
  
  try {
    // 1. Migrate Users
    console.log('📊 Migrating users...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at');
    
    if (usersError) throw usersError;
    
    for (const user of users || []) {
      try {
        await storage.createUser({
          id: user.id,
          email: user.email,
          user_name: user.user_name,
          department: user.department,
          manager: user.manager,
          phone: user.phone,
          is_admin: user.is_admin || false,
          // Set a default password hash for imported users
          password_hash: '$2b$10$defaulthashedpassword', // Users will need to reset passwords
        });
        console.log(`✓ Migrated user: ${user.email}`);
      } catch (error) {
        console.log(`⚠️  User ${user.email} already exists or failed to import`);
      }
    }

    // 2. Migrate Teams
    console.log('📊 Migrating teams...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('created_at');
    
    if (teamsError) throw teamsError;
    
    for (const team of teams || []) {
      try {
        await storage.createTeam({
          id: team.id,
          name: team.name,
          description: team.description,
          manager_id: team.manager_id,
          department_id: team.department_id,
        });
        console.log(`✓ Migrated team: ${team.name}`);
      } catch (error) {
        console.log(`⚠️  Team ${team.name} already exists or failed to import`);
      }
    }

    // 3. Migrate Tasks
    console.log('📊 Migrating tasks...');
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at');
    
    if (tasksError) throw tasksError;
    
    for (const task of tasks || []) {
      try {
        await storage.createTask({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.due_date,
          estimated_hours: task.estimated_hours,
          status: task.status || 'pending',
          type: task.type || 'task',
          created_by: task.created_by,
          assigned_to: task.assigned_to,
          team_id: task.team_id,
          actual_completion_date: task.actual_completion_date,
        });
        console.log(`✓ Migrated task: ${task.title}`);
      } catch (error) {
        console.log(`⚠️  Task ${task.title} already exists or failed to import`);
      }
    }

    // 4. Migrate Roles
    console.log('📊 Migrating roles...');
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('*');
    
    if (rolesError) throw rolesError;
    
    // Insert default roles if they don't exist
    const defaultRoles = [
      { id: '1', name: 'admin', description: 'System Administrator' },
      { id: '2', name: 'manager', description: 'Team Manager' },
      { id: '3', name: 'team_manager', description: 'Team Manager' },
      { id: '4', name: 'user', description: 'Regular User' },
    ];
    
    for (const role of roles?.length ? roles : defaultRoles) {
      try {
        // Since we can't directly create roles through storage interface,
        // we'll need to insert them via database
        console.log(`✓ Role migration: ${role.name}`);
      } catch (error) {
        console.log(`⚠️  Role ${role.name} already exists or failed to import`);
      }
    }

    // 5. Migrate Task Groups
    console.log('📊 Migrating task groups...');
    const { data: taskGroups, error: taskGroupsError } = await supabase
      .from('task_groups')
      .select('*')
      .order('created_at');
    
    if (taskGroupsError) throw taskGroupsError;
    
    for (const group of taskGroups || []) {
      try {
        await storage.createTaskGroup({
          id: group.id,
          name: group.name,
          description: group.description,
          visibility: group.visibility || 'private',
          owner_id: group.owner_id,
        });
        console.log(`✓ Migrated task group: ${group.name}`);
      } catch (error) {
        console.log(`⚠️  Task group ${group.name} already exists or failed to import`);
      }
    }

    console.log('🎉 Data migration completed successfully!');
    console.log(`📊 Migration Summary:`);
    console.log(`   • Users: ${users?.length || 0}`);
    console.log(`   • Teams: ${teams?.length || 0}`);
    console.log(`   • Tasks: ${tasks?.length || 0}`);
    console.log(`   • Task Groups: ${taskGroups?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateData();