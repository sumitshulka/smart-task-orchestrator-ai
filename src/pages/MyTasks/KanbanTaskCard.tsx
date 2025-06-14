
import React from "react";
import { useDrag } from "react-dnd";
import { Task } from "@/integrations/supabase/tasks";

const getStatusKey = (status: string) => {
  return status.trim().toLowerCase().replace(/_/g, " ");
};

function KanbanTaskCard({ task, onClick, CARD_TYPE }: { task: Task; onClick: () => void; CARD_TYPE: string }) {
  const isCompleted = getStatusKey(task.status) === "completed";
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
        <span className="capitalize bg-gray-100 px-2 py-1 rounded text-gray-700">
          {task.status}
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
