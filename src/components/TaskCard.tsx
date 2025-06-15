
import React from "react";
import { Button } from "@/components/ui/button";
import EditTaskSheet from "@/components/EditTaskSheet";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Edit, Trash2, Check, Link2, List } from "lucide-react";
import { Task, deleteTask, updateTask } from "@/integrations/supabase/tasks";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Utility to determine if overdue/in time
function getTimeIndicator(task: Task) {
  if (!task || task.status === "completed") return null;
  if (!task.due_date) return "in_time";
  const todayStr = new Date().toISOString().slice(0, 10);
  if (todayStr <= task.due_date) return "in_time";
  return "overdue";
}

type TaskCardProps = {
  task: Task;
  onTaskUpdated: () => void;
  canDelete: (status: string) => boolean;
};

export default function TaskCard({ task, onTaskUpdated, canDelete }: TaskCardProps) {
  // Unique identifier for confirmation dialog if desired in the future
  // const [openDeleteConfirm, setOpenDeleteConfirm] = React.useState(false);

  async function handleDeleteTask(id: string) {
    if (!window.confirm("Delete this task?")) return;
    try {
      await deleteTask(id);
      onTaskUpdated();
      toast({ title: "Task deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message });
    }
  }

  async function handleCompleteTask(task: Task) {
    if (task.status === "completed") {
      toast({ title: "Task is already completed" });
      return;
    }
    try {
      await updateTask(task.id, {
        status: "completed",
        actual_completion_date: new Date().toISOString().slice(0, 10),
      });
      onTaskUpdated();
      toast({ title: "Task marked as completed" });
    } catch (err: any) {
      toast({ title: "Completion failed", description: err.message });
    }
  }

  const priorityClass =
    task.priority === 1
      ? "bg-red-100 text-red-700"
      : task.priority === 2
      ? "bg-yellow-100 text-yellow-700"
      : "bg-green-100 text-green-700";

  // New: Determine inTime/overdue
  const timeStatus = getTimeIndicator(task);

  // BADGE LOGIC: Now actually available on Task
  const isSubTask = !!(task.group_ids && Array.isArray(task.group_ids) && task.group_ids.length > 0);
  const isDependent = !!task.is_dependent;

  return (
    <Card className="relative group transition hover:shadow-lg">
      {/* Floating top/center actions visible on hover */}
      <div className="absolute left-1/2 top-2 -translate-x-1/2 z-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
        {/* Edit icon always present */}
        <EditTaskSheet task={task} onUpdated={onTaskUpdated}>
          <Button size="icon" variant="ghost" className="text-gray-400 hover:text-blue-600" title="Edit Task">
            <Edit size={20} />
          </Button>
        </EditTaskSheet>
        {/* Delete icon */}
        <Button
          size="icon"
          variant="ghost"
          className={`text-gray-400 ${canDelete(task.status) ? "hover:text-red-600" : "opacity-60 cursor-not-allowed"}`}
          title={canDelete(task.status) ? "Delete Task" : "Can only delete New or Pending tasks"}
          onClick={() => canDelete(task.status) && handleDeleteTask(task.id)}
          disabled={!canDelete(task.status)}
        >
          <Trash2 size={20} />
        </Button>
        {/* Mark complete */}
        <Button
          size="icon"
          variant="ghost"
          className={`text-gray-400 hover:text-green-700`}
          title={task.status === "completed" ? "Already completed" : "Mark as Complete"}
          onClick={() => handleCompleteTask(task)}
          disabled={task.status === "completed"}
        >
          <Check size={20} />
        </Button>
      </div>

      {/* Card header and summary */}
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center gap-2">
          <h2 className="font-semibold text-lg truncate">{task.title}</h2>
          <div className="flex gap-2 items-center">
            {/* Priority badge */}
            <span className={`text-xs px-2 py-1 rounded-full ${priorityClass}`}>
              {task.priority === 1
                ? "High"
                : task.priority === 2
                ? "Medium"
                : "Low"}
            </span>
            {/* In Time/Overdue badge */}
            {timeStatus === "in_time" && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                In Time
              </span>
            )}
            {timeStatus === "overdue" && (
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                Overdue
              </span>
            )}
            {/* Subtask and Dependency Badges */}
            {isSubTask && (
              <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1" variant="secondary" title="Subtask in Group">
                <List size={14} /> Subtask
              </Badge>
            )}
            {isDependent && (
              <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1" variant="secondary" title="Dependent task">
                <Link2 size={14} /> Dependent
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center md:gap-6 gap-2 text-sm">
          <div>
            <span className="font-semibold">Status:</span>{" "}
            <span className="capitalize">{task.status}</span>
          </div>
          <div>
            <span className="font-semibold">Due:</span>{" "}
            {task.due_date ? (
              <span>{task.due_date}</span>
            ) : (
              <span className="text-muted-foreground">No due date</span>
            )}
          </div>
          <div>
            <span className="font-semibold">Created:</span>{" "}
            {task.created_at ? task.created_at.slice(0, 10) : "-"}
          </div>
          <div>
            <span className="font-semibold">Assigned To:</span>{" "}
            {task.assigned_user
              ? task.assigned_user.user_name || task.assigned_user.email
              : task.assigned_to
              ? `(${task.assigned_to})`
              : "-"}
          </div>
          {task.status === "completed" && task.actual_completion_date && (
            <div>
              <span className="font-semibold">Completion Date:</span>{" "}
              {task.actual_completion_date}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
