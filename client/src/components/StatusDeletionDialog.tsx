import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Trash2, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface StatusDeletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusId: string | null;
  statusName: string;
  onStatusDeleted: () => void;
}

interface DeletionPreview {
  statusName: string;
  taskCount: number;
  availableStatuses: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  hasTransitions: boolean;
}

export function StatusDeletionDialog({ 
  open, 
  onOpenChange, 
  statusId, 
  statusName,
  onStatusDeleted 
}: StatusDeletionDialogProps) {
  const [action, setAction] = useState<'delete_tasks' | 'reassign_tasks'>('reassign_tasks');
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch deletion preview data
  const { data: preview, isLoading, error } = useQuery<DeletionPreview>({
    queryKey: ['/api/task-statuses', statusId, 'deletion-preview'],
    queryFn: async () => {
      if (!statusId) throw new Error('Status ID is required');
      
      // Get user ID for authentication
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.id;
      
      const response = await fetch(`/api/task-statuses/${statusId}/deletion-preview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(userId && { 'x-user-id': userId }),
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: open && !!statusId,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setAction('reassign_tasks');
      setSelectedStatusId('');
    }
  }, [open]);

  // Utility function to clean up status transitions
  const cleanupStatusTransitions = (deletedStatusName: string) => {
    try {
      const savedTransitions = localStorage.getItem('status_transitions');
      if (savedTransitions) {
        const transitions = JSON.parse(savedTransitions);
        const cleanedTransitions = transitions.filter((t: any) => 
          t.from_status !== deletedStatusName && t.to_status !== deletedStatusName
        );
        localStorage.setItem('status_transitions', JSON.stringify(cleanedTransitions));
        console.log(`Removed transitions involving status: ${deletedStatusName}`);
      }
    } catch (error) {
      console.error('Error cleaning up status transitions:', error);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!statusId || !preview) return;

    if (action === 'reassign_tasks' && !selectedStatusId) {
      toast({
        title: "Please select a status",
        description: "You must select a status to reassign tasks to.",
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);

    try {
      const selectedStatus = preview.availableStatuses.find(s => s.id === selectedStatusId);
      
      // Get user ID for authentication
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.id;
      
      const response = await fetch(`/api/task-statuses/${statusId}/delete-with-handling`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId && { 'x-user-id': userId }),
        },
        body: JSON.stringify({
          action,
          newStatusName: action === 'reassign_tasks' ? selectedStatus?.name : undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete status');
      }

      const result = await response.json();

      // Clean up status transitions in localStorage
      cleanupStatusTransitions(preview.statusName);

      // Show success message based on action
      if (action === 'delete_tasks') {
        toast({
          title: "Status deleted successfully",
          description: `Deleted ${result.deletedTasks} tasks and removed status transitions.`,
        });
      } else {
        toast({
          title: "Status deleted successfully",
          description: `Reassigned ${result.reassignedTasks} tasks to "${selectedStatus?.name}" and removed status transitions.`,
        });
      }

      onStatusDeleted();
      onOpenChange(false);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete status",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading status information...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !preview) {
    console.error("StatusDeletionDialog error:", error);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load status information. Please try again.
              {error && (
                <div className="mt-2 text-xs">
                  Error: {error.message || "Unknown error"}
                </div>
              )}
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Status: {preview.statusName}
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete the status and remove it from the workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Impact Summary */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Impact Summary:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Tasks using this status:</span>
                <Badge variant={preview.taskCount > 0 ? "destructive" : "secondary"}>
                  {preview.taskCount} tasks
                </Badge>
              </div>
              {preview.hasTransitions && (
                <div className="flex items-center justify-between">
                  <span>Status transitions:</span>
                  <Badge variant="outline">Will be removed</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Task Handling Options - Always show for consistency */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">
              {preview.taskCount > 0 
                ? `What should happen to the ${preview.taskCount} tasks?`
                : 'Task handling options (no tasks currently use this status):'
              }
            </h4>
            
            <RadioGroup value={action} onValueChange={(value) => setAction(value as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="reassign_tasks" id="reassign" />
                <Label htmlFor="reassign" className="flex-1">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                    <span>Reassign tasks to another status</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Move all tasks to a different status (recommended)
                  </p>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete_tasks" id="delete" />
                <Label htmlFor="delete" className="flex-1">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span>Delete all tasks</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently remove all tasks with this status
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {/* Status Selection for Reassignment */}
            {action === 'reassign_tasks' && (
              <div className="space-y-2">
                <Label htmlFor="new-status">Select new status for tasks:</Label>
                <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {preview.availableStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Warning for deletion */}
          {(preview.taskCount > 0 && action === 'delete_tasks') && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will permanently delete {preview.taskCount} tasks. 
                This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}

          {/* Transition Warning */}
          {preview.hasTransitions && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> All status transitions involving "{preview.statusName}" will be removed. 
                You may need to recreate transitions in the Status Lifecycle Graph.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirmDeletion}
            disabled={isDeleting || (action === 'reassign_tasks' && !selectedStatusId)}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Status
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}