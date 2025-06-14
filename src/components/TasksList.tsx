
import React from "react";
import TaskCard from "./TaskCard";
import { Task } from "@/integrations/supabase/tasks";

type TasksListProps = {
  tasks: Task[];
  onTaskUpdated: () => void;
  canDelete: (status: string) => boolean;
};

export default function TasksList({ tasks, onTaskUpdated, canDelete }: TasksListProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onTaskUpdated={onTaskUpdated} canDelete={canDelete} />
      ))}
    </div>
  );
}
