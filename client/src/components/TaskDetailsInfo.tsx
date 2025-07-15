
import React from "react";
import { Task } from "@/integrations/supabase/tasks";
import { EditTaskStatusSelect } from "./EditTaskStatusSelect";

type Props = {
  task: Task;
  status: string;
  statuses: { id: string; name: string }[];
  statusesLoading: boolean;
  canChangeStatus: boolean;
  onStatusChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

const TaskDetailsInfo: React.FC<Props> = ({
  task,
  status,
  statuses,
  statusesLoading,
  canChangeStatus,
  onStatusChange,
}) => (
  <div className="space-y-3">
    <div>
      <label className="block font-bold mb-1">Task Title</label>
      <div>{task.title}</div>
    </div>
    <div>
      <label className="block font-bold mb-1">Status</label>
      {canChangeStatus ? (
        <EditTaskStatusSelect
          currentStatus={status}
          onStatusChange={(newStatus) => onStatusChange({ target: { value: newStatus } })}
          disabled={statusesLoading}
        />
      ) : (
        <div>{task.status}</div>
      )}
    </div>
    <div>
      <label className="block font-bold mb-1">Description</label>
      <div>{task.description || <span className="text-muted-foreground">No description</span>}</div>
    </div>
    <div>
      <label className="block font-bold mb-1">Priority</label>
      <div>
        {task.priority === 1 ? "High" : task.priority === 2 ? "Medium" : "Low"}
      </div>
    </div>
    <div>
      <label className="block font-bold mb-1">Assigned To</label>
      <div>
        {task.assigned_user
          ? task.assigned_user.user_name || task.assigned_user.email
          : task.assigned_to
          ? `(${task.assigned_to})`
          : "-"}
      </div>
    </div>
    <div>
      <label className="block font-bold mb-1">Due Date</label>
      <div>
        {task.status === "completed"
          ? (
            <span>
              Completion: {task.actual_completion_date || "-"}
            </span>
          ) : (
            <span>
              {task.due_date || "-"}
            </span>
          )
        }
      </div>
    </div>
    <div>
      <label className="block font-bold mb-1">Estimated Hours</label>
      <div>{task.estimated_hours || "-"}</div>
    </div>
    <div>
      <label className="block font-bold mb-1">Created At</label>
      <div>{task.created_at ? task.created_at.slice(0, 10) : "-"}</div>
    </div>
  </div>
);

export default TaskDetailsInfo;
