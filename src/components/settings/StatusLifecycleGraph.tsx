
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStatusTransitions, TaskStatus } from "@/hooks/useTaskStatuses";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/**
 * Simple directional graph: shows transition lines as arrows.
 * Allows admin to create/remove transitions between statuses.
 */
const StatusLifecycleGraph: React.FC<{ statuses: TaskStatus[] }> = ({ statuses }) => {
  const { transitions, setTransitions } = useStatusTransitions();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const createTransition = async () => {
    if (!from || !to || from === to) {
      toast({ title: "Pick different statuses." });
      return;
    }
    // Check for duplicate
    if (transitions.find((t) => t.from_status === from && t.to_status === to)) {
      toast({ title: "Transition already exists." });
      return;
    }
    const { data, error } = await supabase
      .from("task_status_transitions")
      .insert([{ from_status: from, to_status: to }])
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }
    setTransitions([...transitions, data]);
    setFrom("");
    setTo("");
    toast({ title: "Transition added!" });
  };

  const deleteTransition = async (transitionId: string) => {
    const { error } = await supabase
      .from("task_status_transitions")
      .delete()
      .eq("id", transitionId);
    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }
    setTransitions(transitions.filter((t) => t.id !== transitionId));
    toast({ title: "Transition removed." });
  };

  // Node positions for SVG (simple horizontal layout, improve as needed)
  const nodeGap = 130;
  const nodeY = 80;
  const nodeRadius = 30;

  return (
    <div className="my-4">
      <h4 className="font-semibold mb-2">Status Lifecycle (Transitions)</h4>
      <div className="flex gap-2 mb-4">
        <select
          className="border px-2 py-1 bg-background rounded"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        >
          <option value="">From Status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="self-center text-muted-foreground">→</span>
        <select
          className="border px-2 py-1 bg-background rounded"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        >
          <option value="">To Status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Button onClick={createTransition} variant="secondary">
          Add Transition
        </Button>
      </div>
      {/* Visual Graph */}
      <div className="w-full overflow-x-auto pb-4">
        <svg width={Math.max(statuses.length * nodeGap, 350)} height={180}>
          {/* Draw arrows for transitions */}
          {transitions.map((tr, i) => {
            const fromIdx = statuses.findIndex((s) => s.id === tr.from_status);
            const toIdx = statuses.findIndex((s) => s.id === tr.to_status);
            if (fromIdx === -1 || toIdx === -1) return null;
            // Horizontal arrow (can be more sophisticated!)
            const fromX = nodeGap / 2 + fromIdx * nodeGap;
            const toX = nodeGap / 2 + toIdx * nodeGap;
            return (
              <g key={tr.id}>
                {/* Arrow */}
                <line
                  x1={fromX}
                  y1={nodeY}
                  x2={toX}
                  y2={nodeY}
                  stroke="#4b5563"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                {/* Delete button */}
                <foreignObject x={(fromX + toX) / 2 - 20} y={nodeY + 10} width="40" height="30">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!px-2 !py-0 text-xs"
                    onClick={() => deleteTransition(tr.id)}
                  >
                    ✕
                  </Button>
                </foreignObject>
              </g>
            );
          })}
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#4b5563" />
            </marker>
          </defs>
          {/* Draw nodes */}
          {statuses.map((status, idx) => {
            const x = nodeGap / 2 + idx * nodeGap;
            return (
              <g key={status.id}>
                <circle cx={x} cy={nodeY} r={nodeRadius} fill="#f1f5f9" stroke="#64748b" strokeWidth="2" />
                <text x={x} y={nodeY} textAnchor="middle" dy="0.3em" fontSize="13" fill="#22223b">
                  {status.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* Legend */}
      <div className="text-xs text-muted-foreground mt-2">
        Drag to reorder statuses in the table above. Configure allowed transitions here.<br />
        Delete a transition by clicking the ✕ on the arrow.
      </div>
    </div>
  );
};
export default StatusLifecycleGraph;
