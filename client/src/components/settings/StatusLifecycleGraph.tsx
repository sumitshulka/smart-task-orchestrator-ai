
import React, { useState } from "react";
import { useStatusTransitions, TaskStatus } from "@/hooks/useTaskStatuses";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const StatusLifecycleGraph: React.FC<{ statuses: TaskStatus[] }> = ({ statuses }) => {
  const { transitions, setTransitions } = useStatusTransitions();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const createTransition = async () => {
    if (!from || !to || from === to) {
      toast({ title: "Please select different statuses." });
      return;
    }
    
    // Find the actual status names from IDs
    const fromStatus = statuses.find(s => s.id === from);
    const toStatus = statuses.find(s => s.id === to);
    
    if (!fromStatus || !toStatus) {
      toast({ title: "Invalid status selection." });
      return;
    }
    
    if (transitions.find((t) => t.from_status === fromStatus.name && t.to_status === toStatus.name)) {
      toast({ title: "Transition already exists." });
      return;
    }
    
    const newTransition = {
      id: Date.now().toString(),
      from_status: fromStatus.name,
      to_status: toStatus.name,
      created_at: new Date().toISOString(),
    };
    
    setTransitions([...transitions, newTransition]);
    setFrom("");
    setTo("");
    toast({ title: "Status transition added successfully!" });
  };

  const deleteTransition = async (transitionId: string) => {
    // For now, just remove from local state
    // In a real implementation, this would delete from the database
    setTransitions(transitions.filter((t) => t.id !== transitionId));
    toast({ title: "Transition removed." });
  };

  if (statuses.length === 0) {
    return (
      <div className="w-full bg-white border rounded-lg p-6 shadow-sm">
        <h4 className="font-semibold mb-4 text-lg">Status Lifecycle (Transitions)</h4>
        <p className="text-muted-foreground">No statuses available to create transitions.</p>
      </div>
    );
  }

  // Calculate responsive dimensions
  const containerPadding = 40;
  const nodeRadius = 50;
  const nodeSpacing = Math.max(150, Math.min(200, (window.innerWidth - containerPadding * 2) / Math.max(statuses.length, 1)));
  const svgWidth = Math.max(800, statuses.length * nodeSpacing + containerPadding * 2);
  const svgHeight = 400; // Increased height to accommodate curved paths
  const nodeY = svgHeight / 2;

  const wrapText = (text: string, maxChars: number) => {
    if (text.length <= maxChars) return [text];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word.length > maxChars ? word.substring(0, maxChars - 3) + '...' : word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 2); // Max 2 lines to fit in circle
  };

  return (
    <div className="w-full bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold mb-4 text-lg">Status Lifecycle (Transitions)</h4>
      
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
        <select
          className="border px-3 py-2 bg-background rounded-md shadow-sm min-w-[150px]"
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
          className="border px-3 py-2 bg-background rounded-md shadow-sm min-w-[150px]"
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

      <div className="w-full">
        <svg 
          width="100%" 
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#4b5563" />
            </marker>
            
            <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>

          {(() => {
            // Group transitions by their path to prevent overlap
            const transitionPaths = new Map();
            
            transitions.forEach((tr, i) => {
              const fromIdx = statuses.findIndex((s) => s.name === tr.from_status);
              const toIdx = statuses.findIndex((s) => s.name === tr.to_status);
              if (fromIdx === -1 || toIdx === -1) return;
              
              // Create a key for this path direction
              const pathKey = `${Math.min(fromIdx, toIdx)}-${Math.max(fromIdx, toIdx)}`;
              if (!transitionPaths.has(pathKey)) {
                transitionPaths.set(pathKey, []);
              }
              transitionPaths.get(pathKey).push({ tr, fromIdx, toIdx, originalIndex: i });
            });
            
            return Array.from(transitionPaths.values()).flatMap(pathGroup => {
              return pathGroup.map((item, groupIndex) => {
                const { tr, fromIdx, toIdx } = item;
                const fromX = containerPadding + fromIdx * nodeSpacing + nodeSpacing / 2;
                const toX = containerPadding + toIdx * nodeSpacing + nodeSpacing / 2;
                
                const deltaX = toX - fromX;
                const distance = Math.abs(deltaX);
                const unitX = deltaX / distance;
                
                const startX = fromX + unitX * nodeRadius;
                const endX = toX - unitX * nodeRadius;
                
                // Offset each transition in the same path group to prevent overlap
                const baseOffset = -60;
                const groupOffset = groupIndex * 30; // Each additional transition gets more curve
                const curveOffset = baseOffset - groupOffset;
                
                const midX = (startX + endX) / 2;
                const midY = nodeY + curveOffset;
                
                return (
                  <g key={tr.id}>
                    <path
                      d={`M ${startX} ${nodeY} Q ${midX} ${midY} ${endX} ${nodeY}`}
                      stroke="#4b5563"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrowhead)"
                      opacity="0.8"
                    />
                    
                    {/* Transition label */}
                    <text
                      x={midX}
                      y={midY - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#6b7280"
                      className="pointer-events-none"
                    >
                      {tr.from_status} → {tr.to_status}
                    </text>
                    
                    {/* Delete button */}
                    <foreignObject 
                      x={midX - 12} 
                      y={midY + 5} 
                      width="24" 
                      height="24"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!w-6 !h-6 !p-0 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-full border border-red-200"
                        onClick={() => deleteTransition(tr.id)}
                        title="Remove transition"
                      >
                        ✕
                      </Button>
                    </foreignObject>
                  </g>
                );
              });
            });
          })()}

          {statuses.map((status, idx) => {
            const x = containerPadding + idx * nodeSpacing + nodeSpacing / 2;
            const textLines = wrapText(status.name, 10);
            
            return (
              <g key={status.id}>
                <circle 
                  cx={x} 
                  cy={nodeY} 
                  r={nodeRadius} 
                  fill="url(#nodeGradient)" 
                  stroke="#64748b" 
                  strokeWidth="2"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                />
                
                {textLines.map((line, lineIdx) => (
                  <text 
                    key={lineIdx}
                    x={x} 
                    y={nodeY + (lineIdx - (textLines.length - 1) / 2) * 14} 
                    textAnchor="middle" 
                    fontSize="12" 
                    fill="#1e293b"
                    fontWeight="500"
                  >
                    {line}
                  </text>
                ))}
                
                <text 
                  x={x} 
                  y={nodeY + nodeRadius + 20} 
                  textAnchor="middle" 
                  fontSize="10" 
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
