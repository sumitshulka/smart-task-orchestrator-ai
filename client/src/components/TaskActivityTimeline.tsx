
import React from "react";
import { TaskActivity } from "@/integrations/supabase/taskActivity";

const typeToColor = (type: string) =>
  type === "created"
    ? "bg-green-100 text-green-800"
    : type === "status_changed"
    ? "bg-blue-100 text-blue-800"
    : type === "assigned" || type === "assignment_changed"
    ? "bg-violet-100 text-violet-800"
    : type === "edit"
    ? "bg-yellow-100 text-yellow-800"
    : type.includes("timer_")
    ? "bg-orange-100 text-orange-800"
    : type === "priority_changed"
    ? "bg-red-100 text-red-800"
    : type === "due_date_changed"
    ? "bg-purple-100 text-purple-800"
    : type === "title_changed" || type === "description_changed"
    ? "bg-cyan-100 text-cyan-800"
    : type === "comment"
    ? "bg-indigo-100 text-indigo-800"
    : "bg-gray-100 text-gray-700";

const actionLabel = (action: TaskActivity) => {
  switch (action.action_type) {
    case "created":
      return "Task created";
    case "status_changed":
      return `Status changed from "${action.old_value}" to "${action.new_value}"`;
    case "assigned":
    case "assignment_changed":
      return `Assigned from "${action.old_value || "Unassigned"}" to "${action.new_value || "Unassigned"}"`;
    case "priority_changed":
      return `Priority changed from "${action.old_value}" to "${action.new_value}"`;
    case "due_date_changed":
      return `Due date changed from "${action.old_value}" to "${action.new_value}"`;
    case "title_changed":
      return `Title changed from "${action.old_value}" to "${action.new_value}"`;
    case "description_changed":
      return `Description changed from "${action.old_value}" to "${action.new_value}"`;
    case "timer_started":
      return "Timer started";
    case "timer_paused":
      return "Timer paused";
    case "timer_stopped":
      return "Timer stopped";
    case "edit":
      // For edit, we expect field name to be prepended to old_value in some way
      // Example: use format: old_value: "<field>:<old>", new_value: "<field>:<new>"
      // To avoid ambiguity, treat as: old_value = "<field>:<old>" new_value = "<field>:<new>"
      {
        const fieldMatch = action.old_value?.split(":")[0] || "Field";
        const oldV = action.old_value?.split(":")[1] ?? "";
        const newV = action.new_value?.split(":")[1] ?? "";
        const pretty = (
          fieldMatch === "title" ? "Title"
          : fieldMatch === "description" ? "Description"
          : fieldMatch === "priority" ? "Priority"
          : fieldMatch === "due_date" ? "Due Date"
          : fieldMatch === "status" ? "Status"
          : fieldMatch === "estimated_hours" ? "Estimated Hours"
          : fieldMatch === "actual_completion_date" ? "Completion Date"
          : fieldMatch
        );
        return `${pretty} changed from "${oldV}" to "${newV}"`;
      }
    case "comment":
      return action.new_value ? `Comment: "${action.new_value}"` : "Comment added";
    default:
      return action.new_value || `Unknown action: ${action.action_type}`;
  }
};

type Props = {
  activity: TaskActivity[];
  usersById?: Record<string, { email: string; user_name: string | null }>;
};

const TaskActivityTimeline: React.FC<Props> = ({ activity, usersById }) => (
  <ol className="relative border-s pl-4 py-2 space-y-3 max-h-80 overflow-y-auto">
    {activity.map((act) => (
      <li key={act.id} className="mb-0">
        <div className="absolute -left-[9px] mt-1 w-3 h-3 rounded-full border-2 border-background shadow-sm 
        bg-white" />
        <div className={`ml-2 p-2 rounded-md shadow-sm ${typeToColor(act.action_type)}`}>
          <div className="text-xs mb-1">
            {new Date(act.created_at).toLocaleString()} by{" "}
            <b>
              {usersById?.[act.acted_by || ""]?.user_name ||
                usersById?.[act.acted_by || ""]?.email ||
                "Unknown"}
            </b>
          </div>
          <div className="text-sm">{actionLabel(act)}</div>
        </div>
      </li>
    ))}
  </ol>
);

export default TaskActivityTimeline;
