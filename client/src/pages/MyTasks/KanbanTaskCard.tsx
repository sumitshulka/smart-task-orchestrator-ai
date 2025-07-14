
import React from "react";
import { useDrag } from "react-dnd";
import { Task } from "@/integrations/supabase/tasks";

const getStatusKey = (status: string) => {
  return status.trim().toLowerCase().replace(/_/g, " ");
};

// Status badge color mapping
const STATUS_BADGE_COLORS: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-700 border-slate-300",
  "in progress": "bg-blue-100 text-blue-700 border-blue-300",
  in_progress: "bg-blue-100 text-blue-700 border-blue-300",
  review: "bg-amber-100 text-amber-700 border-amber-300",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  
  // Legacy statuses
  new: "bg-purple-100 text-purple-700 border-purple-300",
  assigned: "bg-cyan-100 text-cyan-700 border-cyan-300",
  pending: "bg-orange-100 text-orange-700 border-orange-300",
  planning: "bg-indigo-100 text-indigo-700 border-indigo-300",
  testing: "bg-pink-100 text-pink-700 border-pink-300",
  deployed: "bg-green-100 text-green-700 border-green-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
  on_hold: "bg-gray-100 text-gray-700 border-gray-300",
  "on hold": "bg-gray-100 text-gray-700 border-gray-300",
};

const getStatusBadgeColor = (statusKey: string): string => {
  return STATUS_BADGE_COLORS[statusKey] || STATUS_BADGE_COLORS[statusKey.replace(/\s+/g, "_")] || "bg-neutral-100 text-neutral-700 border-neutral-300";
};

function KanbanTaskCard({ task, onClick, CARD_TYPE }: { task: Task; onClick: () => void; CARD_TYPE: string }) {
  const statusKey = getStatusKey(task.status);
  const isCompleted = statusKey === "completed";
  const [{ isDragging }, dragRef] = useDrag({
    type: CARD_TYPE,
    item: { id: task.id, status: task.status },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  return (
    <div
      ref={dragRef}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: "pointer" }}
      className="rounded border bg-white shadow p-4 hover:shadow-lg transition-all select-none max-w-[320px] mx-auto"
      onClick={onClick}
    >
      <div className="font-semibold mb-2 truncate">{task.title}</div>
      <div className="flex justify-between items-center text-sm">
        <span className={`capitalize px-2 py-1 rounded border text-xs font-medium ${getStatusBadgeColor(statusKey)}`}>
          {task.status.replace(/_/g, " ")}
        </span>
        <span>
          {isCompleted ? (
            <span>
              <span className="text-muted-foreground">Completed:</span>{" "}
              {task.actual_completion_date || "-"}
            </span>
          ) : (
            <span>
              <span className="text-muted-foreground">Due:</span>{" "}
              {task.due_date || "-"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export default KanbanTaskCard;
