#!/usr/bin/env tsx
// Script to inspect Supabase database structure
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectDatabase() {
  console.log('🔍 Inspecting Supabase database structure...');
  
  // Try to list all tables by attempting to query common table names
  const commonTables = [
    'users', 'profiles', 'auth.users',
    'tasks', 'todos', 'items',
    'teams', 'groups', 'organizations',
    'roles', 'permissions', 'user_roles',
    'task_groups', 'categories', 'collections',
    'departments', 'office_locations',
    'task_statuses', 'statuses',
    'task_activity', 'activities', 'logs',
    'team_memberships', 'memberships'
  ];

  for (const tableName of commonTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✓ Table '${tableName}': ${count || 0} records`);
        
        // If we find records, show a sample
        if (count && count > 0) {
          const { data: sample } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          if (sample && sample.length > 0) {
            console.log(`  Sample columns:`, Object.keys(sample[0]));
          }
        }
      }
    } catch (e) {
      // Table doesn't exist or no access
    }
  }

  // Try to get auth users specifically
  try {
    const { data: authUsers, error } = await supabase.auth.admin.listUsers();
    if (!error && authUsers?.users) {
      console.log(`✓ Auth users: ${authUsers.users.length} users found`);
      if (authUsers.users.length > 0) {
        console.log(`  Sample user:`, {
          id: authUsers.users[0].id,
          email: authUsers.users[0].email,
          created_at: authUsers.users[0].created_at,
        });
      }
    }
  } catch (e) {
    console.log('⚠️  Could not access auth.users');
  }
}

inspectDatabase();