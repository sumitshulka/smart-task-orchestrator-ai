
-- 1. Remove all old policies on every core table
DROP POLICY IF EXISTS "Admins can do everything with roles" ON public.roles;
DROP POLICY IF EXISTS "Admins manage all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "User sees own user_role mappings" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage all teams" ON public.teams;
DROP POLICY IF EXISTS "Admins manage all team_memberships" ON public.team_memberships;
DROP POLICY IF EXISTS "User views/joins/leaves their own teams" ON public.team_memberships;
DROP POLICY IF EXISTS "Team members can view all memberships of their teams" ON public.team_memberships;
DROP POLICY IF EXISTS "Can view own/assigned/team tasks" ON public.tasks;
DROP POLICY IF EXISTS "Can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Can update own/assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Can delete own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Can view parent/assigned subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Can insert subtasks of own/assigned/team tasks" ON public.subtasks;
DROP POLICY IF EXISTS "Can update subtasks of own/assigned/team tasks" ON public.subtasks;
DROP POLICY IF EXISTS "Can delete subtasks of own/assigned/team tasks" ON public.subtasks;
DROP POLICY IF EXISTS "All can view dependencies if they can view the task" ON public.task_dependencies;
DROP POLICY IF EXISTS "Can insert dependencies if user owns the task" ON public.task_dependencies;
DROP POLICY IF EXISTS "Can delete dependencies if user owns the task" ON public.task_dependencies;
DROP POLICY IF EXISTS "Can view uploads if can view task" ON public.task_attachments;
DROP POLICY IF EXISTS "Can upload attachments if can edit task" ON public.task_attachments;
DROP POLICY IF EXISTS "Can delete attachments if created" ON public.task_attachments;
DROP POLICY IF EXISTS "Admins can select users in their org" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users they created" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users they created" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can select users" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Admins can view any user" ON public.users;
DROP POLICY IF EXISTS "Users can update their own row" ON public.users;
DROP POLICY IF EXISTS "Users can view their own row" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their teams" ON public.users;
DROP POLICY IF EXISTS "Team members can view their team tasks" ON public.tasks;
DROP POLICY IF EXISTS "User table: admins/managers/team managers visibility" ON public.users;
DROP POLICY IF EXISTS "All users can select roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage office locations" ON public.office_locations;
DROP POLICY IF EXISTS "Admins can manage task statuses" ON public.task_statuses;
DROP POLICY IF EXISTS "Admins can manage status transitions" ON public.task_status_transitions;
DROP POLICY IF EXISTS "Allowed users can see activity" ON public.task_activity;
DROP POLICY IF EXISTS "Assigned or creator can add activity" ON public.task_activity;
DROP POLICY IF EXISTS "Admin can update/delete activity" ON public.task_activity;
DROP POLICY IF EXISTS "Admin can delete activity" ON public.task_activity;
DROP POLICY IF EXISTS "Group owner or admin can read group" ON public.task_groups;
DROP POLICY IF EXISTS "Group owner or admin can insert" ON public.task_groups;
DROP POLICY IF EXISTS "Group owner can update group" ON public.task_groups;
DROP POLICY IF EXISTS "Group owner can delete group" ON public.task_groups;
DROP POLICY IF EXISTS "Owner or admin can link task to group" ON public.task_group_tasks;
DROP POLICY IF EXISTS "Owner or admin can see group task links" ON public.task_group_tasks;
DROP POLICY IF EXISTS "Owner or admin can delete task-group link" ON public.task_group_tasks;
DROP POLICY IF EXISTS "Users can view their own teams" ON public.teams;

-- Also cover default fallback named policies, in case any were created:
DROP POLICY IF EXISTS "Anyone (auth'd) can select all users" ON public.users;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all team memberships" ON public.team_memberships;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all task_groups" ON public.task_groups;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all task_group_tasks" ON public.task_group_tasks;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all task_activity" ON public.task_activity;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all task_attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all task_dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all roles" ON public.roles;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all departments" ON public.departments;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all office_locations" ON public.office_locations;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all task_statuses" ON public.task_statuses;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all task_status_transitions" ON public.task_status_transitions;
DROP POLICY IF EXISTS "Anyone (auth'd) can select all tasks_with_extras" ON public.tasks_with_extras;

-- 2. Create wide open policies for SELECT, INSERT, UPDATE, DELETE for all app tables

-- USERS
CREATE POLICY "Allow all actions for auth'd" ON public.users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TEAMS
CREATE POLICY "Allow all actions for auth'd" ON public.teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TEAM MEMBERSHIPS
CREATE POLICY "Allow all actions for auth'd" ON public.team_memberships
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASKS
CREATE POLICY "Allow all actions for auth'd" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SUBTASKS
CREATE POLICY "Allow all actions for auth'd" ON public.subtasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_DEPENDENCIES
CREATE POLICY "Allow all actions for auth'd" ON public.task_dependencies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_ATTACHMENTS
CREATE POLICY "Allow all actions for auth'd" ON public.task_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DEPARTMENTS
CREATE POLICY "Allow all actions for auth'd" ON public.departments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OFFICE_LOCATIONS
CREATE POLICY "Allow all actions for auth'd" ON public.office_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_STATUS
CREATE POLICY "Allow all actions for auth'd" ON public.task_statuses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_STATUS_TRANSITIONS
CREATE POLICY "Allow all actions for auth'd" ON public.task_status_transitions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- USER_ROLES
CREATE POLICY "Allow all actions for auth'd" ON public.user_roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ROLES
CREATE POLICY "Allow all actions for auth'd" ON public.roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_GROUPS
CREATE POLICY "Allow all actions for auth'd" ON public.task_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_GROUP_TASKS
CREATE POLICY "Allow all actions for auth'd" ON public.task_group_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_ACTIVITY
CREATE POLICY "Allow all actions for auth'd" ON public.task_activity
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tasks_with_extras is a VIEW, not a table, so cannot apply RLS directly

