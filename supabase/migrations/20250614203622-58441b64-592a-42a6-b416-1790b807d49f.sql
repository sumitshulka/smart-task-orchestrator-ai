
-- Enable Row Level Security on the users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (or limit to admin in future) to insert users
CREATE POLICY "Authenticated users can insert users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to select users (optional; remove if you want stricter privacy)
CREATE POLICY "Authenticated users can select users"
ON public.users
FOR SELECT
TO authenticated
USING (true);
