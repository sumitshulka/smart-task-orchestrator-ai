
-- Grant admin role to a user by email (replace with your actual email if needed)
WITH my_user AS (
  SELECT id
  FROM auth.users
  WHERE email = 'ss@sumits.me'
  LIMIT 1
),
admin_role AS (
  SELECT id
  FROM public.roles
  WHERE name = 'admin'
  LIMIT 1
)
INSERT INTO public.user_roles (user_id, role_id)
SELECT mu.id, ar.id
FROM my_user mu, admin_role ar
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = mu.id AND ur.role_id = ar.id
);

-- Also ensure that this user exists in public.users with correct organization
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
    'Main',               -- set organization
    u.id                  -- self as created_by
FROM auth.users u
WHERE u.email = 'ss@sumits.me'
  AND NOT EXISTS (
      SELECT 1 FROM public.users pu WHERE pu.id = u.id
  );

