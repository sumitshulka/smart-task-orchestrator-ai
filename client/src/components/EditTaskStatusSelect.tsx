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
  
  // Ensure we have a valid current status
  const validCurrentStatus = currentStatus || "New";
  
  const allowedStatuses = getAllowedNextStatuses(validCurrentStatus);
  
  // Include current status and allowed next statuses, filter out empty values
  const availableStatuses = [validCurrentStatus, ...allowedStatuses].filter(status => status && status.trim().length > 0);
  
  const handleStatusChange = (newStatus: string) => {
    if (newStatus === validCurrentStatus) {
      // No change needed
      return;
    }
    
    if (!isTransitionAllowed(validCurrentStatus, newStatus)) {
      toast({ 
        title: "Invalid Status Transition", 
        description: `Cannot move from "${validCurrentStatus}" to "${newStatus}". This transition is not allowed in the configured workflow.`,
        variant: "destructive"
      });
      return;
    }
    
    onStatusChange(newStatus);
  };

  return (
    <Select 
      value={validCurrentStatus} 
      onValueChange={handleStatusChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={validCurrentStatus}>
          {validCurrentStatus} (current)
        </SelectItem>
        {allowedStatuses.filter(status => status !== validCurrentStatus).map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}