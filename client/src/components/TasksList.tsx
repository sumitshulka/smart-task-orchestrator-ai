
import React from "react";
import TaskCard from "./TaskCard";
import { Task } from "@/integrations/supabase/tasks";

type TasksListProps = {
  tasks: Task[];
  onTaskUpdated: () => void;
  canDelete: (status: string) => boolean;
  statuses?: Array<{ id: string; name: string; color?: string }>;
  onOpenDetails?: (task: Task) => void;
};

// Helper function to get status key
const getStatusKey = (status: string) => {
  return status.trim().toLowerCase().replace(/_/g, " ");
};

export default function TasksList({ tasks, onTaskUpdated, canDelete, statuses = [], onOpenDetails }: TasksListProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {tasks.map((task) => {
        const statusObj = statuses.find(s => getStatusKey(s.name) === getStatusKey(task.status));
        return (
          <TaskCard 
            key={task.id} 
            task={task} 
            onTaskUpdated={onTaskUpdated} 
            canDelete={canDelete} 
            statusColor={statusObj?.color}
            onOpenDetails={onOpenDetails}
          />
        );
      })}
    </div>
  );
}
