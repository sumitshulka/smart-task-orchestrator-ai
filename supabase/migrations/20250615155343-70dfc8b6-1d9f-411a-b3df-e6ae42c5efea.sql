
-- Manager-level reporting view for tasks, showing only tasks visible to managers/team managers
-- This view only includes tasks where the current user (manager) manages the assignee or they are on a team where he/she is the manager

CREATE OR REPLACE VIEW public.tasks_manager_report_view AS
SELECT
  t.id,
  t.title,
  t.description,
  t.priority,
  t.due_date,
  t.estimated_hours,
  t.status,
  t.type,
  t.created_at,
  t.updated_at,
  t.actual_completion_date,
  t.start_date,

  -- Created By (creator)
  creator.user_name AS creator_name,
  creator.email AS creator_email,
  creator.department AS creator_department,
  creator.manager AS creator_manager,

  -- Assigned To (assignee)
  assignee.user_name AS assignee_name,
  assignee.email AS assignee_email,
  assignee.department AS assignee_department,
  assignee.manager AS assignee_manager,

  -- Team Info (optional, only id exposed)
  t.team_id

FROM public.tasks t
LEFT JOIN public.users AS creator ON t.created_by = creator.id
LEFT JOIN public.users AS assignee ON t.assigned_to = assignee.id
WHERE (
  -- The current user is a manager...
  public.is_manager(auth.uid())
  AND (
    -- ...and manages the assigned user (direct report)
    public.manages_user(auth.uid(), t.assigned_to)
    -- ...or manages the assigned user's team (team manager role)
    OR public.team_manager_of_user(auth.uid(), t.assigned_to)
    -- ...or manages the creator (creator direct report)
    OR public.manages_user(auth.uid(), t.created_by)
    -- ...or manages the creator's team (creator team manager role)
    OR public.team_manager_of_user(auth.uid(), t.created_by)
  )
)
OR (
  -- Always allow the manager to see their own tasks
  t.assigned_to = auth.uid() OR t.created_by = auth.uid()
);

-- (Optional) Grant select to authenticated for clarity (RLS will still apply)
GRANT SELECT ON public.tasks_manager_report_view TO authenticated;

-- Enable RLS on the new view (optional, as view enforces logic)
ALTER VIEW public.tasks_manager_report_view OWNER TO postgres;
