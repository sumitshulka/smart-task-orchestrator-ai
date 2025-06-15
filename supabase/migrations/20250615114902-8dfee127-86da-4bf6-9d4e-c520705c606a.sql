
-- Remove old select policies that might be interfering (if any)
DROP POLICY IF EXISTS "Can view own/assigned/team tasks" ON public.tasks;

-- Allow users to see tasks they:
--   - created (created_by = auth.uid())
--   - are assigned to (assigned_to = auth.uid())
--   - are part of a team (for team-based tasks), i.e., if any membership exists
CREATE POLICY "Can view own/assigned/team tasks" ON public.tasks
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR (
    type = 'team'
    AND team_id IS NOT NULL
    AND team_id IN (
      SELECT tm.team_id FROM public.team_memberships tm WHERE tm.user_id = auth.uid()
    )
  )
);
