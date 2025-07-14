import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStatusTransitionValidation } from "@/hooks/useStatusTransitionValidation";
import { toast } from "@/hooks/use-toast";

interface EditTaskStatusSelectProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  disabled?: boolean;
}

export function EditTaskStatusSelect({ currentStatus, onStatusChange, disabled }: EditTaskStatusSelectProps) {
  const { getAllowedNextStatuses, isTransitionAllowed } = useStatusTransitionValidation();
  
  const allowedStatuses = getAllowedNextStatuses(currentStatus);
  
  // Include current status and allowed next statuses
  const availableStatuses = [currentStatus, ...allowedStatuses];
  
  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) {
      // No change needed
      return;
    }
    
    if (!isTransitionAllowed(currentStatus, newStatus)) {
      toast({ 
        title: "Invalid Status Transition", 
        description: `Cannot move from "${currentStatus}" to "${newStatus}". This transition is not allowed in the configured workflow.`,
        variant: "destructive"
      });
      return;
    }
    
    onStatusChange(newStatus);
  };

  return (
    <Select 
      value={currentStatus} 
      onValueChange={handleStatusChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={currentStatus}>
          {currentStatus} (current)
        </SelectItem>
        {allowedStatuses.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}