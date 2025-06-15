
-- 1. Validation Trigger Function: Prevent dependent task from having start_date before dependency due_date
CREATE OR REPLACE FUNCTION enforce_dependency_start_date()
RETURNS TRIGGER AS $$
DECLARE
  dep_task_due_date date;
BEGIN
  IF NEW.dependencyTaskId IS NOT NULL THEN
    SELECT due_date INTO dep_task_due_date FROM tasks WHERE id = NEW.dependencyTaskId;
    IF dep_task_due_date IS NOT NULL AND (NEW.start_date IS NULL OR NEW.start_date < dep_task_due_date) THEN
      RAISE EXCEPTION 'Dependent task cannot start before dependency task due date (%).', dep_task_due_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1a. Attach trigger to tasks table on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_enforce_dependency_start_date ON tasks;
CREATE TRIGGER trg_enforce_dependency_start_date
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_dependency_start_date();

-- 2. Trigger for shifting dependent tasks' start_date/due_date and logging task_activity if dependency's due_date changes
CREATE OR REPLACE FUNCTION shift_dependent_tasks_on_dependency_due_date_change()
RETURNS TRIGGER AS $$
DECLARE
  dep_task RECORD;
  new_start_date date;
BEGIN
  IF NEW.due_date IS DISTINCT FROM OLD.due_date AND NEW.due_date IS NOT NULL THEN
    FOR dep_task IN
      SELECT * FROM tasks WHERE dependencyTaskId = NEW.id
    LOOP
      -- If dependent task's start_date is before the new due_date, update it (& due_date if due_date < new start)
      new_start_date := GREATEST(dep_task.start_date, NEW.due_date);
      IF dep_task.start_date IS NULL OR dep_task.start_date < NEW.due_date THEN
        UPDATE tasks
        SET start_date = NEW.due_date,
            due_date = (CASE WHEN dep_task.due_date IS NOT NULL AND dep_task.due_date < NEW.due_date THEN NEW.due_date ELSE dep_task.due_date END),
            updated_at = now()
        WHERE id = dep_task.id;

        -- Log the shift in task_activity
        INSERT INTO task_activity (task_id, action_type, old_value, new_value, acted_by)
        VALUES (
          dep_task.id,
          'edit',
          'start_date:' || COALESCE(dep_task.start_date::text,'null') || ',due_date:' || COALESCE(dep_task.due_date::text,'null'),
          'start_date:' || NEW.due_date::text || ',due_date:' || COALESCE(
              (CASE WHEN dep_task.due_date IS NOT NULL AND dep_task.due_date < NEW.due_date THEN NEW.due_date ELSE dep_task.due_date END)::text,
              'null'
            ),
          NULL
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2a. Attach trigger to tasks table on UPDATE (for due_date changes)
DROP TRIGGER IF EXISTS trg_shift_dependent_tasks_due_date ON tasks;
CREATE TRIGGER trg_shift_dependent_tasks_due_date
  AFTER UPDATE OF due_date ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION shift_dependent_tasks_on_dependency_due_date_change();

-- 3. Prevent completion of dependent task until dependency is complete
CREATE OR REPLACE FUNCTION enforce_dependency_completion()
RETURNS TRIGGER AS $$
DECLARE
  dependency_status text;
BEGIN
  IF NEW.dependencyTaskId IS NOT NULL AND NEW.status = 'completed' THEN
    SELECT status INTO dependency_status FROM tasks WHERE id = NEW.dependencyTaskId;
    IF dependency_status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'Cannot complete this task until the dependency task is marked completed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3a. Attach trigger to tasks table on UPDATE (status change)
DROP TRIGGER IF EXISTS trg_enforce_dependency_completion ON tasks;
CREATE TRIGGER trg_enforce_dependency_completion
  BEFORE UPDATE OF status ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_dependency_completion();

-- NOTE: Make sure "dependencyTaskId" exists and is the field used for dependencies.
-- If its name is different or needs a migration, let me know.

