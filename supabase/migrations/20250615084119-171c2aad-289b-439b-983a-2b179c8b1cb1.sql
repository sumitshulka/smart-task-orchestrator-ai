
-- 1. Table: task_groups
CREATE TABLE public.task_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private', -- options: 'private', 'managers_admin_only', 'all_team_members'
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: task_group_tasks (many-to-many mapping group <-> task)
CREATE TABLE public.task_group_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.task_groups(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, task_id)
);

-- 3. Enable Row Level Security
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_group_tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for task_groups
-- Only group owner and admins can select/insert/delete/update
CREATE POLICY "Group owner or admin can read group"
  ON public.task_groups
  FOR SELECT
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Group owner or admin can insert"
  ON public.task_groups
  FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Group owner can update group"
  ON public.task_groups
  FOR UPDATE
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Group owner can delete group"
  ON public.task_groups
  FOR DELETE
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- 5. RLS for task_group_tasks
-- Can insert/select/delete mapping if group is owned by user or user is admin
CREATE POLICY "Owner or admin can link task to group"
  ON public.task_group_tasks
  FOR INSERT
  WITH CHECK (
    (SELECT owner_id FROM public.task_groups WHERE id = group_id) = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Owner or admin can see group task links"
  ON public.task_group_tasks
  FOR SELECT
  USING (
    (SELECT owner_id FROM public.task_groups WHERE id = group_id) = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Owner or admin can delete task-group link"
  ON public.task_group_tasks
  FOR DELETE
  USING (
    (SELECT owner_id FROM public.task_groups WHERE id = group_id) = auth.uid()
    OR public.is_admin(auth.uid())
  );
