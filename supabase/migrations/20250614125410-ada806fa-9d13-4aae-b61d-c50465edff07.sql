
-- 1. Create table for task statuses
CREATE TABLE public.task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Insert default statuses
INSERT INTO public.task_statuses (name, description, sequence_order)
VALUES
  ('New', 'Task created and not yet started', 1),
  ('Assigned', 'Task has been assigned to a user', 2),
  ('In Progress', 'Task is currently in progress', 3),
  ('Completed', 'Task is finished', 4);

-- 3. Table for allowed transitions between statuses (defining lifecycle)
CREATE TABLE public.task_status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status UUID REFERENCES public.task_statuses(id) ON DELETE CASCADE,
  to_status UUID REFERENCES public.task_statuses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable row-level security on the new tables
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_transitions ENABLE ROW LEVEL SECURITY;

-- 5. RLS -- only allow admins to select, insert, update, delete
CREATE POLICY "Admins can manage task statuses" ON public.task_statuses
  FOR ALL USING ( public.is_admin(auth.uid()) ) WITH CHECK ( public.is_admin(auth.uid()) );

CREATE POLICY "Admins can manage status transitions" ON public.task_status_transitions
  FOR ALL USING ( public.is_admin(auth.uid()) ) WITH CHECK ( public.is_admin(auth.uid()) );
