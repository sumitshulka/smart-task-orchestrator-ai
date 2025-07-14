
import React from "react";
import { useDrag } from "react-dnd";
import { Task } from "@/integrations/supabase/tasks";

const getStatusKey = (status: string) => {
  return status.trim().toLowerCase().replace(/_/g, " ");
};

// Subtle status badge styling
const STATUS_BADGE_STYLES: Record<string, string> = {
  backlog: "bg-gray-100/80 text-gray-600 border-gray-200",
  "in progress": "bg-blue-100/80 text-blue-600 border-blue-200",
  in_progress: "bg-blue-100/80 text-blue-600 border-blue-200",
  review: "bg-orange-100/80 text-orange-600 border-orange-200",
  completed: "bg-green-100/80 text-green-600 border-green-200",
  
  // Legacy statuses
  new: "bg-purple-100/80 text-purple-600 border-purple-200",
  assigned: "bg-cyan-100/80 text-cyan-600 border-cyan-200",
  pending: "bg-yellow-100/80 text-yellow-600 border-yellow-200",
  planning: "bg-indigo-100/80 text-indigo-600 border-indigo-200",
};

const getStatusBadgeStyle = (statusKey: string): string => {
  return STATUS_BADGE_STYLES[statusKey] || STATUS_BADGE_STYLES[statusKey.replace(/\s+/g, "_")] || "bg-neutral-100/80 text-neutral-600 border-neutral-200";
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
      style={{ opacity: isDragging ? 0.6 : 1, cursor: "grab" }}
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 select-none group hover:border-gray-300"
      onClick={onClick}
    >
      <div className="p-4">
        {/* Task Title */}
        <div className="font-medium text-gray-900 mb-3 leading-tight">
          {task.title}
        </div>
        
        {/* Task Meta */}
        <div className="flex items-center justify-between">
          <span className={`
            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
            ${getStatusBadgeStyle(statusKey)}
          `}>
            {task.status.replace(/_/g, " ")}
          </span>
          
          <div className="text-xs text-gray-500">
            {isCompleted ? (
              task.actual_completion_date ? 
                new Date(task.actual_completion_date).toLocaleDateString() : 
                "Completed"
            ) : (
              task.due_date ? 
                new Date(task.due_date).toLocaleDateString() : 
                "No due date"
            )}
          </div>
        </div>
        
        {/* Priority indicator */}
        {task.priority && task.priority <= 2 && (
          <div className="mt-3 flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              task.priority === 1 ? "bg-red-400" : "bg-orange-400"
            }`} />
            <span className="text-xs text-gray-500">
              {task.priority === 1 ? "High Priority" : "Medium Priority"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanTaskCard;
