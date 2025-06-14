
-- Insert "manager" and "user" roles if they do not already exist in the roles table
INSERT INTO public.roles (name, description)
SELECT 'manager', 'Line manager role for approving/reviewing subordinates'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE name = 'manager'
);

INSERT INTO public.roles (name, description)
SELECT 'user', 'Default regular user'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE name = 'user'
);
