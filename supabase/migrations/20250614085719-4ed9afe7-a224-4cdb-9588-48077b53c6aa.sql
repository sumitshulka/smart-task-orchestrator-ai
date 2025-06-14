
-- [1] Update user_name to user's email if it's blank (NULL)
UPDATE public.users
SET user_name = email
WHERE id = '9642e616-74d2-4359-9989-11b54f9d070d'
  AND (user_name IS NULL OR user_name = '');

-- [2] For future runs: update insert logic
-- When inserting into public.users via migration, use this for user_name:
--    COALESCE(u.raw_user_meta_data->>'full_name', u.email)
-- (No change needed if code handles it, but document for future)

-- [3] Check the admin role in "roles" has the correct ID
SELECT id, name FROM public.roles WHERE name = 'admin';

-- If admin role exists but with a different ID, you may have a mismatch. Consider aligning IDs if needed.
