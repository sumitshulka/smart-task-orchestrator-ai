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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Users,
  Check,
  ChevronsUpDown,
  Building2
} from "lucide-react";
import { apiClient } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: any | null;
};

export default function TaskGroupDetailsSheet({ open, onOpenChange, group }: Props) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("member");
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchValue, setUserSearchValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users for member selection
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: open,
  });

  // Fetch all teams for team selection
  const { data: teams = [] } = useQuery({
    queryKey: ['/api/teams'],
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

  const handleAddTeam = async () => {
    if (!group?.id || !selectedTeamId) return;
    
    try {
      // Get team members
      const teamMembers = await apiClient.getTeamMembers(selectedTeamId);
      
      // Filter out members already in the group
      const currentMemberIds = group?.members?.map((m: any) => m.user_id) || [];
      const newMembers = teamMembers.filter((member: any) => !currentMemberIds.includes(member.user_id));
      
      if (newMembers.length === 0) {
        toast({
          title: "No new members to add",
          description: "All team members are already in this group.",
        });
        setSelectedTeamId("");
        return;
      }
      
      // Add only new team members to the task group
      for (const member of newMembers) {
        await apiClient.addTaskGroupMember(group.id, member.user_id, selectedRole);
      }
      
      // Get team tasks and assign them to the group
      const teamTasks = await apiClient.getTeamTasks(selectedTeamId);
      for (const task of teamTasks) {
        try {
          await apiClient.addTaskToGroup(group.id, task.id);
        } catch (error) {
          console.log("Task might already be in group:", task.id);
        }
      }
      
      // Refresh the group details immediately
      queryClient.invalidateQueries({ queryKey: ['/api/task-groups'] });
      queryClient.invalidateQueries({ queryKey: [`/api/task-groups/${group.id}/details`] });
      
      setSelectedTeamId("");
      setSelectedRole("member");
      toast({
        title: "Team added successfully",
        description: `${newMembers.length} new team members and their tasks have been added to the group.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to add team",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const handleAddMembers = async () => {
    if (!group?.id || selectedUserIds.length === 0) return;
    
    try {
      // Filter out users already in the group
      const currentMemberIds = group?.members?.map((m: any) => m.user_id) || [];
      const newUserIds = selectedUserIds.filter(userId => !currentMemberIds.includes(userId));
      
      if (newUserIds.length === 0) {
        toast({
          title: "No new members to add",
          description: "All selected users are already in this group.",
        });
        setSelectedUserIds([]);
        return;
      }
      
      // Add only new users to the task group
      for (const userId of newUserIds) {
        await apiClient.addTaskGroupMember(group.id, userId, selectedRole);
      }
      
      // Get user tasks and assign them to the group
      for (const userId of newUserIds) {
        const userTasks = await apiClient.getUserTasks(userId);
        // Filter out personal tasks - only add team/work tasks
        const workTasks = userTasks.filter((task: any) => task.team_id || !task.is_personal);
        
        for (const task of workTasks) {
          try {
            await apiClient.addTaskToGroup(group.id, task.id);
          } catch (error) {
            console.log("Task might already be in group:", task.id);
          }
        }
      }
      
      // Refresh the group details immediately
      queryClient.invalidateQueries({ queryKey: ['/api/task-groups'] });
      queryClient.invalidateQueries({ queryKey: [`/api/task-groups/${group.id}/details`] });
      
      setSelectedUserIds([]);
      setSelectedRole("member");
      toast({
        title: "Members added successfully",
        description: `${newUserIds.length} new member(s) and their work tasks have been added to the group.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to add members",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!group?.id) return;
    
    try {
      await apiClient.removeTaskGroupMember(group.id, userId);
      // Refresh the group details immediately
      queryClient.invalidateQueries({ queryKey: ['/api/task-groups'] });
      queryClient.invalidateQueries({ queryKey: [`/api/task-groups/${group.id}/details`] });
      toast({
        title: "Member removed successfully",
        description: "The user has been removed from the task group.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove member",
        description: error.message || "Unknown error occurred",
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
  
  const getAvailableTeams = () => {
    return teams || [];
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getSelectedUserNames = () => {
    return selectedUserIds.map(id => {
      const user = users.find((u: any) => u.id === id);
      return user?.user_name || user?.email || 'Unknown';
    }).join(', ');
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
              <div className="space-y-3">
                {/* Team Selection */}
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTeams().map((team: any) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
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
                    onClick={handleAddTeam}
                    disabled={!selectedTeamId}
                    size="sm"
                  >
                    <Building2 className="h-4 w-4 mr-1" />
                    Add Team
                  </Button>
                </div>

                {/* Individual User Selection */}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userSearchOpen}
                        className="w-48 justify-between"
                      >
                        {selectedUserIds.length > 0 
                          ? `${selectedUserIds.length} users selected`
                          : "Select users..."
                        }
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Search users..." 
                          value={userSearchValue}
                          onValueChange={setUserSearchValue}
                        />
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {getAvailableUsers()
                            .filter((user: any) => 
                              user.user_name?.toLowerCase().includes(userSearchValue.toLowerCase()) ||
                              user.email?.toLowerCase().includes(userSearchValue.toLowerCase())
                            )
                            .map((user: any) => (
                            <CommandItem
                              key={user.id}
                              value={user.id}
                              onSelect={() => toggleUserSelection(user.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  selectedUserIds.includes(user.id) ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{user.user_name}</span>
                                <span className="text-xs text-gray-500">{user.email}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button 
                    onClick={handleAddMembers}
                    disabled={selectedUserIds.length === 0}
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add Users
                  </Button>
                </div>

                {/* Selected Users Preview */}
                {selectedUserIds.length > 0 && (
                  <div className="text-sm text-gray-600 border rounded-lg p-2 bg-gray-50">
                    <strong>Selected:</strong> {getSelectedUserNames()}
                  </div>
                )}
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
