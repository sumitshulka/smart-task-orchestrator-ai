
import React from "react";
import { TaskActivity } from "@/integrations/supabase/taskActivity";

const typeToColor = (type: string) =>
  type === "created"
    ? "bg-green-100 text-green-800"
    : type === "status_changed"
    ? "bg-blue-100 text-blue-800"
    : type === "assigned"
    ? "bg-violet-100 text-violet-800"
    : "bg-gray-100 text-gray-700";

const actionLabel = (action: TaskActivity) => {
  switch (action.action_type) {
    case "created":
      return "Task created";
    case "status_changed":
      return `Status changed from "${action.old_value}" to "${action.new_value}"`;
    case "assigned":
      return `Assigned from "${action.old_value || "-"}" to "${action.new_value || "-"}"`;
    case "comment":
      return action.new_value ? `Comment: "${action.new_value}"` : "Comment added";
    default:
      return "";
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
