
-- SEGMENT 1: AUTH & DYNAMIC RBAC: Core Tables & RLS --

-- 1. ROLES TABLE: List of available roles
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. USER_ROLES TABLE: Mapping users to roles (many-to-many)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID, -- To track who added the role
  assigned_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);

-- 3. TEAMS TABLE: Team structure
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TEAM MEMBERSHIP: link users and teams (optional role/position within a team)
CREATE TABLE public.team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_within_team TEXT, -- Optional, for team-level hierarchy
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, team_id)
);

-- 5. Insert initial system roles (admin/user)
INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Full access to manage system, roles, users, and data'),
  ('user', 'Regular system user with standard permissions')
ON CONFLICT DO NOTHING;

-- 6. RLS: Enable & Policies

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

-- Utility function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id AND r.name = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ROLES policy (admin view/manage all)
CREATE POLICY "Admins can do everything with roles" ON public.roles
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- USER_ROLES: Admin can view/add/delete; user can view their own roles
CREATE POLICY "Admins manage all user_roles" ON public.user_roles
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "User sees own user_role mappings" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- TEAMS: Admins manage all; members can see/join
CREATE POLICY "Admins manage all teams" ON public.teams
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- TEAM MEMBERSHIPS: Admins manage all, users can see/leave/join their own memberships
CREATE POLICY "Admins manage all team_memberships" ON public.team_memberships
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "User views/joins/leaves their own teams" ON public.team_memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- Note: policies will be refined and expanded in later segments.

-- 7. Grant usage for Security Definer function (so it works with RLS)
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
