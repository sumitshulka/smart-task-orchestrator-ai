
import React from "react";
import { Image } from "lucide-react";
import TaskCard from "./TaskCard";
import { Task } from "@/integrations/supabase/tasks";

const fallbackImage =
  "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=400&q=80";

type TasksNoResultsProps = {
  allTasks: Task[];
  onTaskUpdated: () => void;
  canDelete: (status: string) => boolean;
};

export default function TasksNoResults({ allTasks, onTaskUpdated, canDelete }: TasksNoResultsProps) {
  return (
    <div>
      <div className="flex flex-col items-center justify-center mt-16">
        <img
          src={fallbackImage}
          alt="No data found"
          className="w-40 h-40 object-cover rounded-lg mb-4 shadow"
        />
        <div className="text-muted-foreground text-lg mb-2 flex items-center gap-2">
          <Image className="w-5 h-5" />
          No tasks found.
        </div>
      </div>
      {allTasks.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold mb-4">Latest Tasks</h2>
          <div className="grid grid-cols-1 gap-6">
            {allTasks.map((task) => (
              <TaskCard key={task.id} task={task} onTaskUpdated={onTaskUpdated} canDelete={canDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
