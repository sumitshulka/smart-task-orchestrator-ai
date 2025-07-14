
import React from "react";
import { useDrag } from "react-dnd";
import { Task } from "@/integrations/supabase/tasks";
import { formatOrgDate } from "@/lib/dateUtils";
import { useUserName } from "@/hooks/useUserName";

// Utility to convert hex to RGB for lighter colors
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Generate lighter card colors based on status color
const getDynamicCardStyling = (statusColor?: string) => {
  if (!statusColor) {
    return {
      backgroundColor: `rgba(107, 114, 128, 0.08)`,
      borderColor: `rgba(107, 114, 128, 0.15)`
    };
  }
  
  const rgb = hexToRgb(statusColor);
  if (!rgb) {
    return {
      backgroundColor: `rgba(107, 114, 128, 0.08)`,
      borderColor: `rgba(107, 114, 128, 0.15)`
    };
  }
  
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`, // Very light background
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` // Subtle border
  };
};

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

// Dynamic card styling based on status
const getCardStyling = (statusKey: string) => {
  const CARD_STYLES: Record<string, { bg: string; border: string }> = {
    // Core task statuses
    backlog: {
      bg: "bg-gray-50/40",
      border: "border-gray-100 hover:border-gray-200"
    },
    "in progress": {
      bg: "bg-blue-50/40", 
      border: "border-blue-100 hover:border-blue-200"
    },
    in_progress: {
      bg: "bg-blue-50/40",
      border: "border-blue-100 hover:border-blue-200"
    },
    review: {
      bg: "bg-orange-50/40",
      border: "border-orange-100 hover:border-orange-200"
    },
    completed: {
      bg: "bg-green-50/40",
      border: "border-green-100 hover:border-green-200"
    },
    
    // Legacy statuses
    new: {
      bg: "bg-purple-50/40",
      border: "border-purple-100 hover:border-purple-200"
    },
    assigned: {
      bg: "bg-cyan-50/40",
      border: "border-cyan-100 hover:border-cyan-200"
    },
    pending: {
      bg: "bg-yellow-50/40",
      border: "border-yellow-100 hover:border-yellow-200"
    },
    planning: {
      bg: "bg-indigo-50/40",
      border: "border-indigo-100 hover:border-indigo-200"
    },
  };
  
  return CARD_STYLES[statusKey] || CARD_STYLES[statusKey.replace(/\s+/g, "_")] || {
    bg: "bg-neutral-50/40",
    border: "border-neutral-100 hover:border-neutral-200"
  };
};

function KanbanTaskCard({ task, onClick, CARD_TYPE, statusColor }: { 
  task: Task; 
  onClick: () => void; 
  CARD_TYPE: string;
  statusColor?: string;
}) {
  const statusKey = getStatusKey(task.status);
  const isCompleted = statusKey === "completed";
  const cardStyling = getCardStyling(statusKey);
  const dynamicStyling = getDynamicCardStyling(statusColor);
  const assignedUserName = useUserName(task.assigned_to);
  
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
      style={{ 
        opacity: isDragging ? 0.6 : 1, 
        cursor: "grab",
        backgroundColor: statusColor ? dynamicStyling.backgroundColor : undefined,
        borderColor: statusColor ? dynamicStyling.borderColor : undefined
      }}
      className={`${statusColor ? 'bg-transparent border' : `${cardStyling.bg} border ${cardStyling.border}`} rounded-lg shadow-sm hover:shadow-md transition-all duration-200 select-none group`}
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
                formatOrgDate(task.actual_completion_date) : 
                "Completed"
            ) : (
              task.due_date ? 
                formatOrgDate(task.due_date) : 
                "No due date"
            )}
          </div>
        </div>
        
        {/* Assigned to and Priority indicator */}
        <div className="mt-3 space-y-2">
          {task.assigned_to && (
            <div className="flex items-center text-xs text-gray-500">
              <span className="font-medium">Assigned: </span>
              <span className="ml-1">{assignedUserName}</span>
            </div>
          )}
          
          {task.priority && task.priority <= 2 && (
            <div className="flex items-center">
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
    </div>
  );
}

export default KanbanTaskCard;
