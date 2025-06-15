
-- 1. Security definer function to check if a user has the manager/team_manager role
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id AND (r.name = 'manager' OR r.name = 'team manager')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Security definer function to check if a user manages a given user (direct manager)
CREATE OR REPLACE FUNCTION public.manages_user(manager_id uuid, target_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = target_user_id AND u.manager = (SELECT u2.user_name FROM public.users u2 WHERE u2.id = manager_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Security definer function to check if both users share a team where the requesting user is a manager of that team
CREATE OR REPLACE FUNCTION public.team_manager_of_user(manager_id uuid, target_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.team_memberships tm1 ON tm1.team_id = t.id AND tm1.user_id = manager_id
    JOIN public.team_memberships tm2 ON tm2.team_id = t.id AND tm2.user_id = target_user_id
    WHERE tm1.role_within_team = 'manager'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. Drop existing select policies if needed (otherwise, policy order won't matter)
DROP POLICY IF EXISTS "Admins can view any user" ON public.users;
DROP POLICY IF EXISTS "Users can view their own row" ON public.users;

-- 5. New SELECT policy for users table
CREATE POLICY "User table: admins/managers/team managers visibility"
  ON public.users
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR id = auth.uid()
    OR public.is_manager(auth.uid()) AND (public.manages_user(auth.uid(), id) OR public.team_manager_of_user(auth.uid(), id))
  );
