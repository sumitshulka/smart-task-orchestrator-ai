import { useStatusTransitions } from "./useTaskStatuses";

export function useStatusTransitionValidation() {
  const { transitions } = useStatusTransitions();

  // Get allowed next statuses for a given current status
  const getAllowedNextStatuses = (currentStatus: string): string[] => {
    return transitions
      .filter(transition => transition.from_status === currentStatus)
      .map(transition => transition.to_status);
  };

  // Check if a status transition is valid
  const isTransitionAllowed = (fromStatus: string, toStatus: string): boolean => {
    return transitions.some(
      transition => transition.from_status === fromStatus && transition.to_status === toStatus
    );
  };

  // Get the sequence of statuses based on transitions (for forward-only workflow)
  const getStatusSequence = (): string[] => {
    const statusOrder: string[] = [];
    const visited = new Set<string>();
    
    // Find the starting status (one that has no incoming transitions)
    const allToStatuses = new Set(transitions.map(t => t.to_status));
    const allFromStatuses = new Set(transitions.map(t => t.from_status));
    const startingStatuses = [...allFromStatuses].filter(status => !allToStatuses.has(status));
    
    if (startingStatuses.length === 0 && transitions.length > 0) {
      // If no clear start, use the first from_status
      statusOrder.push(transitions[0].from_status);
      visited.add(transitions[0].from_status);
    } else if (startingStatuses.length > 0) {
      statusOrder.push(startingStatuses[0]);
      visited.add(startingStatuses[0]);
    }

    // Build the sequence following transitions
    let currentStatus = statusOrder[0];
    while (currentStatus) {
      const nextTransition = transitions.find(t => 
        t.from_status === currentStatus && !visited.has(t.to_status)
      );
      
      if (nextTransition) {
        statusOrder.push(nextTransition.to_status);
        visited.add(nextTransition.to_status);
        currentStatus = nextTransition.to_status;
      } else {
        break;
      }
    }

    return statusOrder;
  };

  // Check if a status change would be moving backwards
  const isMovingBackwards = (fromStatus: string, toStatus: string): boolean => {
    const sequence = getStatusSequence();
    const fromIndex = sequence.indexOf(fromStatus);
    const toIndex = sequence.indexOf(toStatus);
    
    return fromIndex !== -1 && toIndex !== -1 && toIndex < fromIndex;
  };

  return {
    getAllowedNextStatuses,
    isTransitionAllowed,
    getStatusSequence,
    isMovingBackwards,
    transitions
  };
}