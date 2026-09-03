
import React from "react";
import { Task } from "@/integrations/supabase/tasks";
import TaskCard from "@/components/TaskCard";

function TaskCardClickable({
  task,
  onOpen,
  canDelete,
  onTaskUpdated,
  statusColor,
  compact = false,
}: {
  task: Task;
  onOpen: () => void;
  canDelete: (status: string) => boolean;
  onTaskUpdated: () => void;
  statusColor?: string;
  compact?: boolean;
}) {
  return (
    <TaskCard 
      task={task} 
      onTaskUpdated={onTaskUpdated} 
      canDelete={canDelete} 
      statusColor={statusColor}
      compact={compact}
      onOpenDetails={(task) => {
        onOpen();
      }}
    />
  );
}
export default TaskCardClickable;
