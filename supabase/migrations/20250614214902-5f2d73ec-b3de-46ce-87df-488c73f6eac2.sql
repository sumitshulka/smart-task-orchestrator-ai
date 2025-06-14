
-- Insert nd@nancyd.me into public.users if not already present
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
    'Main',      -- or specify the desired organization
    u.id
FROM auth.users u
WHERE u.email = 'nd@nancyd.me'
  AND NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = u.id);

-- Insert sumits@smopl.com into public.users if not already present
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
    'Main',     -- or specify the desired organization
    u.id
FROM auth.users u
WHERE u.email = 'sumits@smopl.com'
  AND NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = u.id);

-- Mark email as confirmed for both users (set email_confirmed_at to now)
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email IN ('nd@nancyd.me', 'sumits@smopl.com');
