
import React from "react";
import { Task } from "@/integrations/supabase/tasks";
import TaskCard from "@/components/TaskCard";

function TaskCardClickable({
  task,
  onOpen,
  canDelete,
  onTaskUpdated,
  statusColor,
}: {
  task: Task;
  onOpen: () => void;
  canDelete: (status: string) => boolean;
  onTaskUpdated: () => void;
  statusColor?: string;
}) {
  return (
    <div className="cursor-pointer" onClick={onOpen}>
      <TaskCard task={task} onTaskUpdated={onTaskUpdated} canDelete={canDelete} statusColor={statusColor} />
    </div>
  );
}
export default TaskCardClickable;
