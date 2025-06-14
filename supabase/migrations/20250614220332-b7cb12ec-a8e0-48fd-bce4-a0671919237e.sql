
-- Enable Row Level Security (RLS) on the users table if it is not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow admins to UPDATE and SELECT all users
-- This assumes you have an "is_admin(uuid)" SECURITY DEFINER function (as in your schema)
-- Allows updates from admins only; you can tailor this policy for more granular access
CREATE POLICY "Admins can update any user"
  ON public.users
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view any user"
  ON public.users
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- (Optional) If users should be able to update *their own* row, add:
CREATE POLICY "Users can update their own row"
  ON public.users
  FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can view their own row"
  ON public.users
  FOR SELECT
  USING (id = auth.uid());
