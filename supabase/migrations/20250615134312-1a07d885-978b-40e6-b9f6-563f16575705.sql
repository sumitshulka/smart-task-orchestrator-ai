
CREATE POLICY "Admins can view any user"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
