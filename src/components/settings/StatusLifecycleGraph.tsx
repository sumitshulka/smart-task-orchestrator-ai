import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStatusTransitions, TaskStatus } from "@/hooks/useStatusStatuses";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/**
 * Enhanced directional graph: shows transition lines as arrows with better visual design.
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

  // Enhanced node positioning for better layout - responsive to container width
  const nodeGap = Math.max(200, Math.min(300, (window.innerWidth - 200) / Math.max(statuses.length, 1)));
  const nodeY = 120;
  const nodeRadius = 60;
  const svgHeight = 280;
  const svgWidth = Math.max(statuses.length * nodeGap + 100, 800);

  // Function to wrap text within circle
  const wrapText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return [text];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3); // Max 3 lines
  };

  return (
    <div className="my-6 w-full">
      <h4 className="font-semibold mb-4 text-lg">Status Lifecycle (Transitions)</h4>
      
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
        <select
          className="border px-3 py-2 bg-background rounded-md shadow-sm"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        >
          <option value="">From Status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="self-center text-2xl text-muted-foreground">→</span>
        <select
          className="border px-3 py-2 bg-background rounded-md shadow-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        >
          <option value="">To Status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Button onClick={createTransition} variant="default" className="ml-2">
          Add Transition
        </Button>
      </div>

      {/* Enhanced Visual Graph - Full Width */}
      <div className="w-full bg-white border rounded-lg p-6 shadow-sm">
        <div className="w-full overflow-x-auto">
          <svg 
            width={svgWidth} 
            height={svgHeight}
            className="min-w-full"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Define gradients and markers */}
            <defs>
              {/* Arrow marker */}
              <marker
                id="arrowhead"
                markerWidth="12"
                markerHeight="12"
                refX="11"
                refY="6"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 12 6, 0 12" fill="#4b5563" />
              </marker>
              
              {/* Gradient for nodes */}
              <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>

            {/* Draw arrows for transitions */}
            {transitions.map((tr, i) => {
              const fromIdx = statuses.findIndex((s) => s.id === tr.from_status);
              const toIdx = statuses.findIndex((s) => s.id === tr.to_status);
              if (fromIdx === -1 || toIdx === -1) return null;

              const fromX = nodeGap / 2 + fromIdx * nodeGap + 100;
              const toX = nodeGap / 2 + toIdx * nodeGap + 100;
              
              // Calculate arrow positions to connect circle edges
              const deltaX = toX - fromX;
              const deltaY = 0; // Same Y level
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
              const unitX = deltaX / distance;
              
              const startX = fromX + unitX * nodeRadius;
              const endX = toX - unitX * nodeRadius;
              
              // Create curved path for better visual appeal
              const midX = (startX + endX) / 2;
              const midY = nodeY - 50; // Curve upward
              
              return (
                <g key={tr.id}>
                  {/* Curved arrow path */}
                  <path
                    d={`M ${startX} ${nodeY} Q ${midX} ${midY} ${endX} ${nodeY}`}
                    stroke="#4b5563"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                  
                  {/* Delete button */}
                  <foreignObject 
                    x={midX - 15} 
                    y={midY - 15} 
                    width="30" 
                    height="30"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!w-7 !h-7 !p-0 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-full border border-red-200"
                      onClick={() => deleteTransition(tr.id)}
                      title="Remove transition"
                    >
                      ✕
                    </Button>
                  </foreignObject>
                </g>
              );
            })}

            {/* Draw enhanced nodes */}
            {statuses.map((status, idx) => {
              const x = nodeGap / 2 + idx * nodeGap + 100;
              const textLines = wrapText(status.name, 12);
              
              return (
                <g key={status.id}>
                  {/* Node circle with gradient and shadow */}
                  <circle 
                    cx={x} 
                    cy={nodeY} 
                    r={nodeRadius} 
                    fill="url(#nodeGradient)" 
                    stroke="#64748b" 
                    strokeWidth="2"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  />
                  
                  {/* Multi-line text */}
                  {textLines.map((line, lineIdx) => (
                    <text 
                      key={lineIdx}
                      x={x} 
                      y={nodeY + (lineIdx - (textLines.length - 1) / 2) * 16} 
                      textAnchor="middle" 
                      fontSize="13" 
                      fill="#1e293b"
                      fontWeight="500"
                    >
                      {line}
                    </text>
                  ))}
                  
                  {/* Status sequence number */}
                  <text 
                    x={x} 
                    y={nodeY + nodeRadius + 25} 
                    textAnchor="middle" 
                    fontSize="11" 
                    fill="#64748b"
                    fontWeight="400"
                  >
                    #{status.sequence_order}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Enhanced Legend */}
      <div className="text-sm text-muted-foreground mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
        <div className="font-medium text-blue-800 mb-2">How to use:</div>
        <ul className="space-y-1 text-blue-700">
          <li>• Drag to reorder statuses in the table above</li>
          <li>• Configure allowed transitions using the dropdown menus</li>
          <li>• Remove transitions by clicking the ✕ button on the curved arrows</li>
          <li>• Numbers below circles show the sequence order</li>
        </ul>
      </div>
    </div>
  );
};

export default StatusLifecycleGraph;
