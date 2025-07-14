
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
  console.log("[DEBUG] TaskCardClickable rendering, onOpen exists:", !!onOpen);
  return (
    <TaskCard 
      task={task} 
      onTaskUpdated={onTaskUpdated} 
      canDelete={canDelete} 
      statusColor={statusColor}
      onOpenDetails={(task) => {
        console.log("[DEBUG] TaskCardClickable onOpenDetails triggered, calling onOpen");
        onOpen();
      }}
    />
  );
}
export default TaskCardClickable;
