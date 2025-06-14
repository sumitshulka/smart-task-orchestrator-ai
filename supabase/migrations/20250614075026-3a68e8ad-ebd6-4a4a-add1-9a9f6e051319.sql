
-- Create the office_locations table for admin management
CREATE TABLE public.office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name TEXT NOT NULL,
  address TEXT NOT NULL,
  location_manager TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage office locations
CREATE POLICY "Admins can manage office_locations"
  ON public.office_locations
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
