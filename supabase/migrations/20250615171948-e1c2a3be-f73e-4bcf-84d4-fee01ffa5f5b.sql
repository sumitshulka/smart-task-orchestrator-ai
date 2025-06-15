
-- 1. Add "dependencyTaskId" to "tasks" table for tracking dependency relationships
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS "dependencyTaskId" UUID NULL;

-- (Optional - add index for faster lookup)
CREATE INDEX IF NOT EXISTS idx_tasks_dependencyTaskId ON public.tasks("dependencyTaskId");
