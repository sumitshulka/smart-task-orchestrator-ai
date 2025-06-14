
-- 1. Table to store comments and activity related to a task
CREATE TABLE public.task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- e.g., 'created', 'status_changed', 'assigned', 'comment'
  old_value TEXT,            -- nullable, e.g., previous status/assignee
  new_value TEXT,            -- nullable, e.g., new status/assignee or comment text
  acted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Row level security (RLS): users can select if assigned or created, insert on assignment or comment, admins can do all
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- Allow assigned user, created_by user or admins to read activity
CREATE POLICY "Allowed users can see activity"
  ON public.task_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE id = task_id 
        AND (assigned_to = auth.uid() OR created_by = auth.uid())
    ) OR public.is_admin(auth.uid())
  );

-- Allow user to insert comment/assignment/status for assigned or created_by
CREATE POLICY "Assigned or creator can add activity"
  ON public.task_activity
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE id = task_id 
        AND (assigned_to = auth.uid() OR created_by = auth.uid())
    ) OR public.is_admin(auth.uid())
  );

-- Allow update/delete only for admins
CREATE POLICY "Admin can update/delete activity"
  ON public.task_activity
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete activity"
  ON public.task_activity
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
