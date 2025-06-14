
-- Insert super admin into public.users if not already present
INSERT INTO public.users (
    id,
    email,
    user_name,
    department,
    phone,
    manager,
    organization,
    created_by
)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', NULL),
    COALESCE(u.raw_user_meta_data->>'department', NULL),
    COALESCE(u.raw_user_meta_data->>'phone', NULL),
    COALESCE(u.raw_user_meta_data->>'manager', NULL),
    'Main' AS organization,  -- set default org, change as needed
    u.id   -- self as created_by
FROM auth.users u
WHERE u.email = 'ss@sumits.me'
  AND NOT EXISTS (
      SELECT 1 FROM public.users pu WHERE pu.id = u.id
  );
