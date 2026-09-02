
import React from "react";
import { useDrop } from "react-dnd";
import { Plus } from "lucide-react";

interface KanbanColumnProps {
  statusKey: string;
  statusLabel: string;
  children: React.ReactNode;
  onDrop: (item: { id: string; status: string }, statusKey: string) => void;
  CARD_TYPE: string;
  statusStyle: {
    bg: string;
    header: string;
    count: string;
    customStyles?: {
      bg?: React.CSSProperties;
      header?: React.CSSProperties;
      count?: React.CSSProperties;
    };
  };
  taskCount: number;
  onAddTask?: () => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  statusKey,
  statusLabel,
  children,
  onDrop,
  CARD_TYPE,
  statusStyle,
  taskCount,
  onAddTask,
}) => {
  const [{ isOver, canDrop }, dropRef] = useDrop({
    accept: CARD_TYPE,
    canDrop: (item: { id: string; status: string }) =>
      item.status.trim().toLowerCase().replace(/_/g, " ") !== statusKey,
    drop: (item: { id: string; status: string }) => {
      onDrop(item, statusKey);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={dropRef}
      className={`
        min-w-[280px] max-w-[320px] rounded-xl transition-all duration-200 
        ${statusStyle.bg}
        ${isOver && canDrop ? "ring-2 ring-blue-400 ring-offset-2 scale-[1.02]" : ""}
      `}
      style={statusStyle.customStyles?.bg}
    >
      {/* Column Header */}
      <div 
        className={`
          rounded-t-xl px-4 py-3 border-b border-gray-200/50
          ${statusStyle.header}
        `}
        style={statusStyle.customStyles?.header}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide">
            {statusLabel.replace(/_/g, " ")}
          </h3>
          <div className="flex items-center gap-2">
            {onAddTask && (
              <button
                type="button"
                aria-label="Create a quick personal task"
                title="Quick personal task"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddTask();
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-current/20 bg-white/70 text-current shadow-sm transition-all hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
            <span
              className={`
                px-2.5 py-1 rounded-full text-xs font-semibold min-w-[24px] text-center
                ${statusStyle.count}
              `}
              style={statusStyle.customStyles?.count}
            >
              {taskCount}
            </span>
          </div>
        </div>
      </div>
      
      {/* Column Content */}
      <div className="p-4">
        <div className="flex flex-col gap-3 min-h-[200px]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;
