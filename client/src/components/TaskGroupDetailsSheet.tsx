import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { TaskGroup } from "@/integrations/supabase/taskGroups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FolderKanban, 
  Clock, 
  User, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Play,
  Pause
} from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: any | null;
};

export default function TaskGroupDetailsSheet({ open, onOpenChange, group }: Props) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'new': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return CheckCircle2;
      case 'in_progress': return Play;
      case 'on_hold': return Pause;
      default: return AlertCircle;
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 text-red-800 border-red-200';
      case 2: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 3: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityText = (priority: number) => {
    switch (priority) {
      case 1: return 'High';
      case 2: return 'Medium'; 
      case 3: return 'Low';
      default: return 'Normal';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95vw] max-w-[1200px] overflow-y-auto">
        <SheetHeader className="pb-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FolderKanban className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-xl font-semibold">{group?.name || "Task Group"}</SheetTitle>
              <SheetDescription className="text-sm text-gray-600 mt-1">
                {group?.description || "No description provided."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Group Summary */}
        <div className="py-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-blue-700 mb-1">{group?.tasks?.length || 0}</div>
                <div className="text-sm text-blue-600 whitespace-nowrap">Total Tasks</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-green-700 mb-1">
                  {group?.tasks?.filter((t: any) => t.task?.status?.toLowerCase() === 'completed').length || 0}
                </div>
                <div className="text-sm text-green-600 whitespace-nowrap">Completed</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-orange-700 mb-1">
                  {group?.tasks?.filter((t: any) => t.task?.status?.toLowerCase() === 'in_progress').length || 0}
                </div>
                <div className="text-sm text-orange-600 whitespace-nowrap">In Progress</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-gray-700 mb-1">
                  {group?.tasks?.filter((t: any) => t.task?.status?.toLowerCase() === 'new').length || 0}
                </div>
                <div className="text-sm text-gray-600 whitespace-nowrap">New</div>
              </CardContent>
            </Card>
          </div>

          {/* Tasks Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold">Tasks in Group</h3>
              <Badge variant="secondary" className="text-xs">
                {group?.tasks?.length || 0} tasks
              </Badge>
            </div>
            
            <div className="space-y-3">
              {group?.tasks?.length ? (
                group.tasks.map((taskItem: any) => {
                  const task = taskItem.task;
                  const StatusIcon = getStatusIcon(task?.status || '');
                  
                  return (
                    <Card key={task?.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-500">
                                #{task?.task_number || 'N/A'}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getStatusColor(task?.status || '')}`}
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {task?.status || 'Unknown'}
                              </Badge>
                              {task?.priority && (
                                <Badge 
                                  variant="outline"
                                  className={`text-xs ${getPriorityColor(task.priority)}`}
                                >
                                  {getPriorityText(task.priority)}
                                </Badge>
                              )}
                            </div>
                            
                            <h4 className="font-medium text-gray-900 mb-1">
                              {task?.title || 'Untitled Task'}
                            </h4>
                            
                            {task?.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {task?.due_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Due: {formatDate(task.due_date)}
                                </div>
                              )}
                              {task?.estimated_hours && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {task.estimated_hours}h estimated
                                </div>
                              )}
                              {task?.assigned_user?.user_name && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {task.assigned_user.user_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <FolderKanban className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No tasks in this group</h4>
                    <p className="text-sm text-gray-500">
                      This task group doesn't contain any tasks yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="pt-6 border-t">
          <SheetClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
