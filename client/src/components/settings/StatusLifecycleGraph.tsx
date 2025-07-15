
import React, { useState, useRef, useCallback } from "react";
import { useStatusTransitions, TaskStatus } from "@/hooks/useTaskStatuses";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const StatusLifecycleGraph: React.FC<{ statuses: TaskStatus[] }> = ({ statuses }) => {
  const { transitions, setTransitions } = useStatusTransitions();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  
  // Drag and drop state
  const [statusPositions, setStatusPositions] = useState<Map<string, {x: number, y: number}>>(new Map());
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

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
    
    try {
      const response = await fetch('/api/task-status-transitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': (window as any).currentUser?.id || ''
        },
        body: JSON.stringify({
          from_status: fromStatus.name,
          to_status: toStatus.name
        })
      });
      
      if (response.ok) {
        // Refresh transitions from database
        window.location.reload();
        toast({ title: "Status transition added successfully!" });
      } else {
        toast({ title: "Failed to add transition", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error adding transition:', error);
      toast({ title: "Error adding transition", variant: "destructive" });
    }
    
    setFrom("");
    setTo("");
  };

  const deleteTransition = async (transitionId: string) => {
    try {
      const response = await fetch(`/api/task-status-transitions/${transitionId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': (window as any).currentUser?.id || ''
        }
      });
      
      if (response.ok) {
        // Refresh transitions from database
        window.location.reload();
        toast({ title: "Transition removed." });
      } else {
        toast({ title: "Failed to remove transition", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error removing transition:', error);
      toast({ title: "Error removing transition", variant: "destructive" });
    }
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
  
  // Build transition maps for smarter layout
  const outgoingTransitions = new Map<string, string[]>(); // status -> [target statuses]
  const incomingTransitions = new Map<string, string[]>(); // status -> [source statuses]
  
  transitions.forEach(transition => {
    // Track outgoing
    if (!outgoingTransitions.has(transition.from_status)) {
      outgoingTransitions.set(transition.from_status, []);
    }
    outgoingTransitions.get(transition.from_status)!.push(transition.to_status);
    
    // Track incoming
    if (!incomingTransitions.has(transition.to_status)) {
      incomingTransitions.set(transition.to_status, []);
    }
    incomingTransitions.get(transition.to_status)!.push(transition.from_status);
  });
  
  // Find statuses that have multiple incoming transitions (merge points)
  const mergePoints = Array.from(incomingTransitions.entries())
    .filter(([status, sources]) => sources.length > 1)
    .map(([status]) => status);
  
  // Find statuses that have multiple outgoing transitions (branch points)
  const branchPoints = Array.from(outgoingTransitions.entries())
    .filter(([status, targets]) => targets.length > 1)
    .map(([status]) => status);
  
  // Check if we can still maintain linear flow despite merge/branch points
  // Linear flow is possible if after merge points, the flow continues linearly
  const canMaintainLinearFlow = () => {
    // If there are branch points (one status pointing to multiple), we need hierarchical
    if (branchPoints.length > 0) return false;
    
    // If there are merge points, check if the flow after merge is still linear
    if (mergePoints.length > 0) {
      // For each merge point, check if it continues linearly afterwards
      for (const mergePoint of mergePoints) {
        const outgoing = outgoingTransitions.get(mergePoint) || [];
        if (outgoing.length > 1) return false; // Merge point that also branches
        
        // Follow the chain after merge point to ensure it's linear
        let current = outgoing[0];
        while (current) {
          const nextTargets = outgoingTransitions.get(current) || [];
          if (nextTargets.length > 1) return false; // Branch found later
          current = nextTargets[0];
        }
      }
      return true; // Merge points exist but flow continues linearly
    }
    
    return true; // No merge or branch points
  };
  
  // Determine if we need hierarchical layout
  const needsHierarchicalLayout = !canMaintainLinearFlow();
  
  // Calculate dimensions and layout based on complexity
  const hasTransitions = transitions.length > 0;
  let svgWidth: number, svgHeight: number, nodeY: number;
  
  if (!hasTransitions) {
    // Simple horizontal layout when no transitions
    svgWidth = Math.max(800, statuses.length * 180 + containerPadding * 2);
    svgHeight = 200;
    nodeY = svgHeight / 2;
  } else if (!needsHierarchicalLayout) {
    // Linear layout for simple sequential workflows
    svgWidth = Math.max(800, statuses.length * 180 + containerPadding * 2);
    svgHeight = 250;
    nodeY = svgHeight / 2;
  } else {
    // Hierarchical layout for complex workflows with branches/merges
    const statusesInvolved = new Set([...incomingTransitions.keys(), ...outgoingTransitions.keys()]);
    const maxRowsNeeded = Math.max(
      mergePoints.reduce((max, status) => Math.max(max, incomingTransitions.get(status)?.length || 0), 1),
      branchPoints.reduce((max, status) => Math.max(max, outgoingTransitions.get(status)?.length || 0), 1)
    );
    svgHeight = Math.max(300, maxRowsNeeded * rowSpacing + containerPadding * 2);
    svgWidth = Math.max(600, statusesInvolved.size * columnSpacing + containerPadding * 2);
    nodeY = svgHeight / 2; // Not used in hierarchical layout
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
            
            if (!needsHierarchicalLayout) {
              // Smart linear layout that handles merge points but maintains horizontal flow
              const statusPositions = new Map<string, {x: number, y: number}>();
              
              // Build the main linear chain by following the longest path
              const statusChain: string[] = [];
              const visitedStatuses = new Set<string>();
              
              // Find the main flow path - start from a status with no incoming OR follow from merge points
              let mainFlowStart: string | undefined;
              
              // First, try to find a true starting point (no incoming transitions)
              const trueStarts = Array.from(outgoingTransitions.keys()).filter(status => 
                !incomingTransitions.has(status) || incomingTransitions.get(status)!.length === 0
              );
              
              if (trueStarts.length > 0) {
                mainFlowStart = trueStarts[0];
              } else if (mergePoints.length > 0) {
                // Start from the first merge point and build the main flow
                mainFlowStart = mergePoints[0];
              } else if (outgoingTransitions.size > 0) {
                mainFlowStart = Array.from(outgoingTransitions.keys())[0];
              }
              
              // Build main chain by following single outgoing transitions
              if (mainFlowStart) {
                let current = mainFlowStart;
                while (current && !visitedStatuses.has(current)) {
                  statusChain.push(current);
                  visitedStatuses.add(current);
                  const nextStatuses = outgoingTransitions.get(current) || [];
                  current = nextStatuses.length === 1 ? nextStatuses[0] : undefined;
                }
              }
              
              // Add any remaining transition statuses that weren't in the main chain
              const allTransitionStatuses = new Set([...outgoingTransitions.keys(), ...incomingTransitions.keys()]);
              allTransitionStatuses.forEach(status => {
                if (!visitedStatuses.has(status)) {
                  statusChain.push(status);
                }
              });
              
              // Position main chain horizontally
              statusChain.forEach((statusName, idx) => {
                statusPositions.set(statusName, {
                  x: containerPadding + idx * 180 + 90,
                  y: nodeY
                });
              });
              
              // For merge scenarios, position additional source statuses above/below the merge point
              mergePoints.forEach(mergePoint => {
                const sources = incomingTransitions.get(mergePoint) || [];
                const mergePos = statusPositions.get(mergePoint);
                if (!mergePos) return;
                
                sources.forEach((source, idx) => {
                  if (!statusPositions.has(source)) {
                    // Position additional sources vertically offset from merge point
                    statusPositions.set(source, {
                      x: mergePos.x - 180, // Position to the left of merge point
                      y: nodeY + (idx - Math.floor(sources.length / 2)) * 120 // Vertical offset
                    });
                  }
                });
              });
              
              // Render transitions
              const transitionElements = transitions.map((tr, i) => {
                const fromPos = statusPositions.get(tr.from_status);
                const toPos = statusPositions.get(tr.to_status);
                if (!fromPos || !toPos) return null;
                
                const startX = fromPos.x + nodeRadius;
                const endX = toPos.x - nodeRadius;
                const startY = fromPos.y;
                const endY = toPos.y;
                
                const midX = (startX + endX) / 2;
                const midY = startY - 40; // Slight curve above
                
                return (
                  <g key={tr.id}>
                    <path
                      d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
                      stroke="#4b5563"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrowhead)"
                      opacity="0.8"
                    />
                    
                    <foreignObject 
                      x={midX - 12} 
                      y={midY - 12} 
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
            }
            
            // Hierarchical layout for complex workflows with branches/merges
            const statusPositions = new Map<string, {x: number, y: number}>();
            
            // Group statuses by their role in the workflow
            const startStatuses = Array.from(outgoingTransitions.keys()).filter(status => 
              !incomingTransitions.has(status) || incomingTransitions.get(status)!.length === 0
            );
            const endStatuses = Array.from(incomingTransitions.keys()).filter(status => 
              !outgoingTransitions.has(status) || outgoingTransitions.get(status)!.length === 0
            );
            const intermediateStatuses = Array.from(new Set([...outgoingTransitions.keys(), ...incomingTransitions.keys()]))
              .filter(status => !startStatuses.includes(status) && !endStatuses.includes(status));
            
            // Position statuses in columns based on their role
            startStatuses.forEach((statusName, idx) => {
              statusPositions.set(statusName, {
                x: containerPadding + nodeRadius,
                y: containerPadding + (idx + 1) * rowSpacing
              });
            });
            
            intermediateStatuses.forEach((statusName, idx) => {
              statusPositions.set(statusName, {
                x: containerPadding + columnSpacing + nodeRadius,
                y: containerPadding + (idx + 1) * rowSpacing
              });
            });
            
            endStatuses.forEach((statusName, idx) => {
              const xOffset = columnSpacing * (startStatuses.length > 0 ? 1 : 0) + columnSpacing * (intermediateStatuses.length > 0 ? 1 : 0);
              statusPositions.set(statusName, {
                x: containerPadding + xOffset + nodeRadius,
                y: containerPadding + (idx + 1) * rowSpacing
              });
            });
            
            // Render transitions
            const transitionElements = transitions.map((tr, i) => {
              const fromPos = statusPositions.get(tr.from_status);
              const toPos = statusPositions.get(tr.to_status);
              if (!fromPos || !toPos) return null;
              
              const startX = fromPos.x + nodeRadius;
              const endX = toPos.x - nodeRadius;
              const startY = fromPos.y;
              const endY = toPos.y;
              
              const midX = (startX + endX) / 2;
              
              return (
                <g key={tr.id}>
                  <path
                    d={`M ${startX} ${startY} Q ${midX} ${startY} ${midX} ${(startY + endY) / 2} Q ${midX} ${endY} ${endX} ${endY}`}
                    stroke="#4b5563"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    opacity="0.8"
                  />
                  
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
