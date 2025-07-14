
import React from "react";
import { useDrop } from "react-dnd";

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
  };
  taskCount: number;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  statusKey,
  statusLabel,
  children,
  onDrop,
  CARD_TYPE,
  statusStyle,
  taskCount,
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
    >
      {/* Column Header */}
      <div className={`
        rounded-t-xl px-4 py-3 border-b border-gray-200/50
        ${statusStyle.header}
      `}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide">
            {statusLabel.replace(/_/g, " ")}
          </h3>
          <span className={`
            px-2.5 py-1 rounded-full text-xs font-semibold min-w-[24px] text-center
            ${statusStyle.count}
          `}>
            {taskCount}
          </span>
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
