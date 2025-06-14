
-- Add actual_completion_date to tasks for tracking when tasks are completed.
ALTER TABLE public.tasks
ADD COLUMN actual_completion_date DATE;

-- You may want to allow updating and selecting this new column according to your existing RLS policies (no change needed if policies are already permissive).
