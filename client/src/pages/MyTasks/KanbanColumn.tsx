
import React from "react";
import { useDrop } from "react-dnd";

const KANBAN_COLORS: Record<string, string> = {
  new: "bg-fuchsia-50",
  assigned: "bg-blue-50",
  "in progress": "bg-green-50",
  pending: "bg-yellow-50",
  completed: "bg-emerald-50",
};

interface KanbanColumnProps {
  statusKey: string;
  statusLabel: string;
  children: React.ReactNode;
  onDrop: (item: { id: string; status: string }, statusKey: string) => void;
  CARD_TYPE: string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  statusKey,
  statusLabel,
  children,
  onDrop,
  CARD_TYPE,
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
        min-w-[320px] rounded-lg p-4 shadow-md transition-all
        ${KANBAN_COLORS[statusKey] || "bg-slate-50"}
        ${isOver && canDrop ? "ring-2 ring-primary" : ""}
      `}
    >
      <h3 className="font-semibold text-lg mb-4 capitalize">{statusLabel}</h3>
      <div className="flex flex-col gap-4 min-h-[40px]">{children}</div>
    </div>
  );
};

export default KanbanColumn;
