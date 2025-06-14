
-- Create a public.users table to store user meta separately from Auth for access by your app
create table public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    user_name text,
    department text,
    phone text,
    manager text,
    organization text,
    created_by uuid, -- reference to the admin user who created
    created_at timestamp with time zone not null default now()
);

-- Enable row level security
alter table public.users enable row level security;

-- Allow admins to select users in their same organization
create policy "Admins can select users in their org"
on public.users
for select
using (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
  and organization is not null
);

-- Allow admins to insert users
create policy "Admins can insert users"
on public.users
for insert
with check (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
);

-- Allow admins to update/delete users they created
create policy "Admins can update users they created"
on public.users
for update
using (created_by = auth.uid());

create policy "Admins can delete users they created"
on public.users
for delete
using (created_by = auth.uid());
