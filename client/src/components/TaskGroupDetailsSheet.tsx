import React, { useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  FolderKanban, 
  Clock, 
  User, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Play,
  Pause,
  UserPlus,
  UserMinus,
  Crown,
  Users
} from "lucide-react";
import { addTaskGroupMember, removeTaskGroupMember } from "@/integrations/supabase/taskGroups";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: any | null;
};

export default function TaskGroupDetailsSheet({ open, onOpenChange, group }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("member");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users for member selection
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: open,
  });

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

  const handleAddMember = async () => {
    if (!selectedUserId || !group?.id) return;
    
    try {
      await addTaskGroupMember(group.id, selectedUserId, selectedRole);
      queryClient.invalidateQueries({ queryKey: ['/api/task-groups'] });
      toast({
        title: "Member added successfully",
        description: "The user has been added to the task group.",
      });
      setSelectedUserId("");
      setSelectedRole("member");
    } catch (error: any) {
      toast({
        title: "Failed to add member",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!group?.id) return;
    
    try {
      await removeTaskGroupMember(group.id, userId);
      queryClient.invalidateQueries({ queryKey: ['/api/task-groups'] });
      toast({
        title: "Member removed successfully",
        description: "The user has been removed from the task group.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'manager' ? Crown : User;
  };

  const getRoleColor = (role: string) => {
    return role === 'manager' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getAvailableUsers = () => {
    const currentMemberIds = group?.members?.map((m: any) => m.user_id) || [];
    return users.filter((user: any) => !currentMemberIds.includes(user.id));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[50vw] min-w-[800px] max-w-[1400px] overflow-y-auto">
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
          <div className="grid grid-cols-4 gap-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold text-blue-700 mb-2">{group?.tasks?.length || 0}</div>
                <div className="text-sm text-blue-600 font-medium">Total Tasks</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold text-green-700 mb-2">
                  {group?.tasks?.filter((t: any) => t.task?.status?.toLowerCase() === 'completed').length || 0}
                </div>
                <div className="text-sm text-green-600 font-medium">Completed</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold text-orange-700 mb-2">
                  {group?.tasks?.filter((t: any) => t.task?.status?.toLowerCase() === 'in_progress').length || 0}
                </div>
                <div className="text-sm text-orange-600 font-medium">In Progress</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold text-gray-700 mb-2">
                  {group?.tasks?.filter((t: any) => t.task?.status?.toLowerCase() === 'new').length || 0}
                </div>
                <div className="text-sm text-gray-600 font-medium">New</div>
              </CardContent>
            </Card>
          </div>

          {/* Members Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Group Members</h3>
                <Badge variant="secondary" className="text-xs">
                  {group?.members?.length || 0} members
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableUsers().map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.user_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddMember}
                  disabled={!selectedUserId}
                  size="sm"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {group?.members?.length ? (
                group.members.map((member: any) => {
                  const RoleIcon = getRoleIcon(member.role);
                  
                  return (
                    <Card key={member.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {member.user?.user_name?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">
                                {member.user?.user_name || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {member.user?.email || 'No email'}
                              </div>
                              {member.user?.department && (
                                <div className="text-xs text-gray-400">
                                  {member.user.department}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline"
                              className={`text-xs ${getRoleColor(member.role)}`}
                            >
                              <RoleIcon className="h-3 w-3 mr-1" />
                              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="text-center py-8">
                  <CardContent>
                    <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No members yet</h4>
                    <p className="text-sm text-gray-500">
                      Add team members to this group to start collaborating.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
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
