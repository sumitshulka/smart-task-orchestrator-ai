
-- Allow authenticated users to SELECT from public.roles so joins from the "user_roles" table work for non-admins
CREATE POLICY "All users can select roles" ON public.roles
  FOR SELECT
  TO authenticated
  USING (true); -- allows read-only access for all authenticated users

-- (Optional) If you've made mistakes with policies before, and want a clean start, you can also drop old policies and re-add the strict ones for non-SELECT operations:
-- DROP POLICY IF EXISTS "Admins can do everything with roles" ON public.roles;

-- Now roles can be joined in the UI for all authenticated users and "user" role will not appear missing in frontend.
