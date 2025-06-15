
CREATE OR REPLACE VIEW public.tasks_report_view AS
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
LEFT JOIN public.users AS assignee ON t.assigned_to = assignee.id;
