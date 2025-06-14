
-- 1. Ensure your user is mapped in public.user_roles with the admin role

-- Find your user id and the admin role id
WITH
  my_user AS (
    SELECT id FROM auth.users WHERE email = 'ss@sumits.me' LIMIT 1
  ),
  admin_role AS (
    SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1
  )
-- Insert admin mapping if missing
INSERT INTO public.user_roles (user_id, role_id)
SELECT mu.id, ar.id
FROM my_user mu, admin_role ar
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = mu.id AND ur.role_id = ar.id
);

-- 2. OPTIONAL: If your user is missing from public.users, insert them as well (should already be OK, but safe to re-run)

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
    'Main',          -- default org; change if needed
    u.id             -- self as created_by
FROM auth.users u
WHERE u.email = 'ss@sumits.me'
  AND NOT EXISTS (
      SELECT 1 FROM public.users pu WHERE pu.id = u.id
  );

-- After these commands, your user will have admin privileges and should be able to access roles and permissions.
