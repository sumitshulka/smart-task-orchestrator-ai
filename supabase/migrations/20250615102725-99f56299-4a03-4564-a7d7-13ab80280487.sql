
-- Allow team members to view all memberships of their teams
CREATE POLICY "Team members can view all memberships of their teams"
  ON public.team_memberships
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships WHERE user_id = auth.uid()
    )
  );
