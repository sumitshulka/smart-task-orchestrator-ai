
-- TASKS TABLE
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority INT, -- 1 (high) - 3 (low), can adjust as enum later if needed
  due_date DATE,
  estimated_hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending', -- can adjust as enum
  type TEXT NOT NULL, -- 'personal' | 'team'
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SUBTASKS TABLE
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- can adjust as enum
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  estimated_hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TASK DEPENDENCIES
CREATE TABLE public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT no_self_dependency CHECK (task_id != depends_on_task_id)
);

-- TASK ATTACHMENTS
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  filename TEXT,
  mimetype TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS FOR TASKS TABLE
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Allow users to see tasks they created or are assigned to, or are on their team
CREATE POLICY "Can view own/assigned/team tasks" ON public.tasks
FOR SELECT USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR (type = 'team' AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM team_memberships tm WHERE tm.team_id = team_id AND tm.user_id = auth.uid()
    )
  )
);

-- Allow insert for authenticated users (must insert correct created_by)
CREATE POLICY "Can create tasks" ON public.tasks
FOR INSERT WITH CHECK (created_by = auth.uid());

-- Allow update for created_by or assigned_to
CREATE POLICY "Can update own/assigned tasks" ON public.tasks
FOR UPDATE USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
);

-- Allow delete for creator only
CREATE POLICY "Can delete own tasks" ON public.tasks
FOR DELETE USING (
  created_by = auth.uid()
);

-- RLS FOR SUBTASKS
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Can select if creator/assigned_to (through parent task)
CREATE POLICY "Can view parent/assigned subtasks" ON public.subtasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
      OR (t.type = 'team' AND t.team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM team_memberships tm WHERE tm.team_id = t.team_id AND tm.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Can insert subtasks of own/assigned/team tasks" ON public.subtasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
      OR (t.type = 'team' AND t.team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM team_memberships tm WHERE tm.team_id = t.team_id AND tm.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Can update subtasks of own/assigned/team tasks" ON public.subtasks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
      OR (t.type = 'team' AND t.team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM team_memberships tm WHERE tm.team_id = t.team_id AND tm.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Can delete subtasks of own/assigned/team tasks" ON public.subtasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
    )
  )
);

-- RLS FOR TASK_DEPENDENCIES
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All can view dependencies if they can view the task" ON public.task_dependencies
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
      OR (t.type = 'team' AND t.team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM team_memberships tm WHERE tm.team_id = t.team_id AND tm.user_id = auth.uid()
        )
      )
    )
  )
);
CREATE POLICY "Can insert dependencies if user owns the task" ON public.task_dependencies
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND t.created_by = auth.uid()
  )
);
CREATE POLICY "Can delete dependencies if user owns the task" ON public.task_dependencies
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND t.created_by = auth.uid()
  )
);

-- RLS FOR TASK ATTACHMENTS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view uploads if can view task" ON public.task_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
      OR (t.type = 'team' AND t.team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM team_memberships tm WHERE tm.team_id = t.team_id AND tm.user_id = auth.uid()
        )
      )
    )
  )
);
CREATE POLICY "Can upload attachments if can edit task" ON public.task_attachments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR t.assigned_to = auth.uid()
    )
  )
);
CREATE POLICY "Can delete attachments if created" ON public.task_attachments
FOR DELETE USING (
  uploaded_by = auth.uid()
);

