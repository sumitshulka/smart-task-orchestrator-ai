
CREATE POLICY "Admins can select all tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
