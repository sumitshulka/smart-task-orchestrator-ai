
-- TASKS table RLS policies

-- Enable Row Level Security if not already enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Remove any pre-existing select/update policies to avoid policy order conflicts
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;

-- Allow users to view their own tasks (created_by or assigned_to)
CREATE POLICY "Tasks: users can view their own"
  ON public.tasks
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  );

-- Allow admins to view all tasks
CREATE POLICY "Tasks: admins can view all"
  ON public.tasks
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

-- Allow managers and team managers to view tasks assigned to/created by users they manage or team members
CREATE POLICY "Tasks: managers/team managers can view managed users' tasks"
  ON public.tasks
  FOR SELECT
  USING (
    public.is_manager(auth.uid()) AND (
      public.manages_user(auth.uid(), assigned_to)
      OR public.manages_user(auth.uid(), created_by)
      OR public.team_manager_of_user(auth.uid(), assigned_to)
      OR public.team_manager_of_user(auth.uid(), created_by)
    )
  );

-- Allow admins to update any task
CREATE POLICY "Tasks: admins can update all"
  ON public.tasks
  FOR UPDATE
  USING (
    public.is_admin(auth.uid())
  );

-- Allow user to update their own tasks (created_by or assigned_to)
CREATE POLICY "Tasks: users can update their own"
  ON public.tasks
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  );

-- Allow managers/team managers to update tasks assigned to/created by users they manage or that are on their teams
CREATE POLICY "Tasks: managers/team managers can update managed users' tasks"
  ON public.tasks
  FOR UPDATE
  USING (
    public.is_manager(auth.uid()) AND (
      public.manages_user(auth.uid(), assigned_to)
      OR public.manages_user(auth.uid(), created_by)
      OR public.team_manager_of_user(auth.uid(), assigned_to)
      OR public.team_manager_of_user(auth.uid(), created_by)
    )
  );


-- team_memberships table RLS (so managers/team managers can see their teams)
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read memberships" ON public.team_memberships;

-- Allow users to see their own team memberships
CREATE POLICY "TeamMembership: user can see their own"
  ON public.team_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Allow admins to see all memberships
CREATE POLICY "TeamMembership: admins can see all"
  ON public.team_memberships
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

-- Allow managers/team managers to see memberships for users they manage or that are members of their teams
CREATE POLICY "TeamMembership: managers can see team memberships"
  ON public.team_memberships
  FOR SELECT
  USING (
    public.is_manager(auth.uid()) AND (
      public.manages_user(auth.uid(), user_id)
      OR public.team_manager_of_user(auth.uid(), user_id)
      OR user_id = auth.uid()
    )
  );
