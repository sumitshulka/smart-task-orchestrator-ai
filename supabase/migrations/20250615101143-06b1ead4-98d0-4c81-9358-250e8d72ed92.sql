
-- 1. Allow users to SELECT users who are in the same team as themselves
CREATE POLICY "Users can view users in their teams"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_memberships tm1
      JOIN public.team_memberships tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = users.id
    )
  );

-- 2. Allow users to SELECT tasks that are assigned to teams they are members of
CREATE POLICY "Team members can view their team tasks"
  ON public.tasks
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships WHERE user_id = auth.uid()
    )
  );
