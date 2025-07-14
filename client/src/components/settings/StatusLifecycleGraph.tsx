
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

  // Calculate hierarchical layout dimensions
  const containerPadding = 60;
  const nodeRadius = 50;
  const columnSpacing = 250; // Spacing between columns (From -> To)
  const rowSpacing = 120; // Spacing between rows
  
  // Build transition hierarchy: From statuses -> To statuses
  const transitionMap = new Map<string, Set<string>>();
  const allFromStatuses = new Set<string>();
  const allToStatuses = new Set<string>();
  
  transitions.forEach(transition => {
    if (!transitionMap.has(transition.from_status)) {
      transitionMap.set(transition.from_status, new Set());
    }
    transitionMap.get(transition.from_status)!.add(transition.to_status);
    allFromStatuses.add(transition.from_status);
    allToStatuses.add(transition.to_status);
  });
  
  // Determine layout: statuses that are only sources go left, targets go right, others in middle
  const leftStatuses = Array.from(allFromStatuses).filter(status => !allToStatuses.has(status));
  const rightStatuses = Array.from(allToStatuses).filter(status => !allFromStatuses.has(status));
  const middleStatuses = statuses.filter(s => allFromStatuses.has(s.name) && allToStatuses.has(s.name)).map(s => s.name);
  
  // Calculate dimensions based on whether transitions exist
  const hasTransitions = transitions.length > 0;
  let svgWidth: number, svgHeight: number, nodeY: number;
  
  if (!hasTransitions) {
    // Simple horizontal layout when no transitions
    svgWidth = Math.max(800, statuses.length * 180 + containerPadding * 2);
    svgHeight = 200;
    nodeY = svgHeight / 2;
  } else {
    // Calculate dimensions for hierarchical layout
    const maxRows = Math.max(leftStatuses.length, middleStatuses.length, rightStatuses.length, 1);
    svgHeight = Math.max(300, maxRows * rowSpacing + containerPadding * 2);
    const numColumns = (leftStatuses.length > 0 ? 1 : 0) + (middleStatuses.length > 0 ? 1 : 0) + (rightStatuses.length > 0 ? 1 : 0);
    svgWidth = Math.max(600, numColumns * columnSpacing + containerPadding * 2);
    nodeY = svgHeight / 2; // Not used in hierarchical layout, but needed for compilation
  }

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
            if (!hasTransitions) {
              // Simple horizontal layout when no transitions
              return statuses.map((status, idx) => {
                const x = containerPadding + idx * 180 + 90;
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
                  </g>
                );
              });
            }
            
            // Calculate positions for hierarchical layout
            const statusPositions = new Map<string, {x: number, y: number}>();
            
            // Position left column (from-only statuses)
            leftStatuses.forEach((statusName, idx) => {
              statusPositions.set(statusName, {
                x: containerPadding + nodeRadius,
                y: containerPadding + (idx + 1) * rowSpacing
              });
            });
            
            // Position middle column (intermediate statuses)
            middleStatuses.forEach((statusName, idx) => {
              statusPositions.set(statusName, {
                x: containerPadding + columnSpacing + nodeRadius,
                y: containerPadding + (idx + 1) * rowSpacing
              });
            });
            
            // Position right column (to-only statuses)
            rightStatuses.forEach((statusName, idx) => {
              const xOffset = (leftStatuses.length > 0 ? columnSpacing : 0) + (middleStatuses.length > 0 ? columnSpacing : 0);
              statusPositions.set(statusName, {
                x: containerPadding + xOffset + nodeRadius,
                y: containerPadding + (idx + 1) * rowSpacing
              });
            });
            
            // Render transitions with proper hierarchy
            const transitionElements = transitions.map((tr, i) => {
              const fromPos = statusPositions.get(tr.from_status);
              const toPos = statusPositions.get(tr.to_status);
              if (!fromPos || !toPos) return null;
              
              const startX = fromPos.x + nodeRadius;
              const endX = toPos.x - nodeRadius;
              const startY = fromPos.y;
              const endY = toPos.y;
              
              // Create smooth curves for transitions
              const midX = (startX + endX) / 2;
              const controlY1 = startY;
              const controlY2 = endY;
              
              return (
                <g key={tr.id}>
                  <path
                    d={`M ${startX} ${startY} Q ${midX} ${controlY1} ${midX} ${(startY + endY) / 2} Q ${midX} ${controlY2} ${endX} ${endY}`}
                    stroke="#4b5563"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    opacity="0.8"
                  />
                  
                  {/* Delete button positioned along the path */}
                  <foreignObject 
                    x={midX - 12} 
                    y={(startY + endY) / 2 - 12} 
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
            
            // Render status nodes
            const statusElements = Array.from(statusPositions.entries()).map(([statusName, pos]) => {
              const status = statuses.find(s => s.name === statusName);
              if (!status) return null;
              
              const textLines = wrapText(status.name, 10);
              
              return (
                <g key={status.id}>
                  <circle 
                    cx={pos.x} 
                    cy={pos.y} 
                    r={nodeRadius} 
                    fill="url(#nodeGradient)" 
                    stroke="#64748b" 
                    strokeWidth="2"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  />
                  
                  {textLines.map((line, lineIdx) => (
                    <text 
                      key={lineIdx}
                      x={pos.x} 
                      y={pos.y + (lineIdx - (textLines.length - 1) / 2) * 14} 
                      textAnchor="middle" 
                      fontSize="12" 
                      fill="#1e293b"
                      fontWeight="500"
                    >
                      {line}
                    </text>
                  ))}
                  
                  <text 
                    x={pos.x} 
                    y={pos.y + nodeRadius + 20} 
                    textAnchor="middle" 
                    fontSize="10" 
                    fill="#64748b"
                  >
                    #{statuses.indexOf(status) + 1}
                  </text>
                </g>
              );
            });
            
            return [...transitionElements, ...statusElements];
          })()}


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
