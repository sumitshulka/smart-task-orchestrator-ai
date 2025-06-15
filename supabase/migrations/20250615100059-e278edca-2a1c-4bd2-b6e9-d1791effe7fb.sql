
-- Allow regular users to select teams they are assigned to via team_memberships
CREATE POLICY "Users can view their own teams" ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_memberships tm
      WHERE tm.team_id = teams.id
        AND tm.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );
