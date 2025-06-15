
-- Create a new view to expose group_ids and dependent flag for each task
CREATE OR REPLACE VIEW public.tasks_with_extras AS
SELECT
  t.*,
  -- array of task group ids (empty if not in any group)
  COALESCE(ARRAY(
    SELECT tgt.group_id
    FROM public.task_group_tasks tgt
    WHERE tgt.task_id = t.id
  ), '{}') AS group_ids,
  -- is_dependent: true if task appears as a dependent in task_dependencies
  EXISTS (
    SELECT 1 FROM public.task_dependencies td
    WHERE td.task_id = t.id
  ) AS is_dependent
FROM public.tasks t;

-- (Optional) grant select on new view to anon and authenticated, if needed
GRANT SELECT ON public.tasks_with_extras TO anon, authenticated;
