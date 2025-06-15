
import { useEffect, useState } from "react";
import { fetchTasks, Task } from "@/integrations/supabase/tasks";

// Helps validate dependency-based logic for task creation/editing
export function useDependencyConstraintValidation(dependencyTaskId?: string | null) {
  const [dependencyTask, setDependencyTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch dependency task info as needed
  useEffect(() => {
    if (!dependencyTaskId) {
      setDependencyTask(null);
      return;
    }
    setLoading(true);
    fetchTasks().then(tasks => {
      setDependencyTask(tasks.find(t => t.id === dependencyTaskId) || null);
      setLoading(false);
    });
  }, [dependencyTaskId]);

  // Expose relevant data and validation helpers
  const dependencyDueDate = dependencyTask?.due_date ?? null;
  const dependencyStatus = dependencyTask?.status ?? null;

  // Constraint: cannot start before dependency due_date
  function isInvalidStartDate(selectedDate: string) {
    if (!dependencyDueDate || !selectedDate) return false;
    return selectedDate < dependencyDueDate;
  }

  // Constraint: cannot mark completed unless dependency is completed
  function canCompleteDependent() {
    return !dependencyStatus || dependencyStatus === "completed";
  }

  return {
    loading,
    dependencyTask,
    dependencyDueDate,
    dependencyStatus,
    isInvalidStartDate,
    canCompleteDependent,
  };
}
