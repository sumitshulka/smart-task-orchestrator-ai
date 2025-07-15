import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Calendar, FileText, Search, Download, User, Mail, Building, Phone } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatOrgDate } from "@/lib/utils";

interface DeletedUser {
  id: string;
  email: string;
  user_name: string;
  department: string;
  phone: string;
  manager: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  deleted_by: string;
}

interface DeletedTask {
  id: string;
  task_number: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  estimated_hours: number;
  actual_hours: number;
  assigned_to_name: string;
  created_by_name: string;
  team_name: string;
  task_group_name: string;
  start_date: string;
  completion_date: string;
  created_at: string;
  deleted_at: string;
  original_user_id: string;
}

const DeletedUsers: React.FC = () => {
  const [search, setSearch] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState<DeletedUser | null>(null);

  // Fetch deleted users
  const { data: deletedUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/deleted-users"],
    queryFn: () => apiClient.getDeletedUsers(),
  });

  // Fetch deleted user tasks when a user is selected
  const { data: deletedTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/deleted-users", selectedUser?.id, "tasks"],
    queryFn: () => selectedUser ? apiClient.getDeletedUserTasks(selectedUser.id) : Promise.resolve([]),
    enabled: !!selectedUser,
  });

  // Filter users by search
  const filteredUsers = React.useMemo(() => {
    if (!search) return deletedUsers;
    const searchTerm = search.toLowerCase();
    return deletedUsers.filter((user: DeletedUser) => {
      return (
        user.user_name?.toLowerCase().includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm) ||
        user.department?.toLowerCase().includes(searchTerm)
      );
    });
  }, [deletedUsers, search]);

  const getPriorityBadge = (priority: string) => {
    const colors = {
      'critical': 'bg-red-100 text-red-800 border-red-200',
      'high': 'bg-orange-100 text-orange-800 border-orange-200',
      'medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'low': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const exportUserData = (user: DeletedUser) => {
    const userData = {
      user_info: user,
      tasks: deletedTasks
    };
    
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deleted_user_${user.user_name || user.email}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Archive className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Deleted Users Repository</h1>
        </div>
        <Badge variant="outline" className="w-fit">
          {filteredUsers.length} deleted user{filteredUsers.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deleted Users</CardTitle>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {usersLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Loading deleted users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No deleted users found
                  </div>
                ) : (
                  filteredUsers.map((user: DeletedUser) => (
                    <div
                      key={user.id}
                      className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedUser?.id === user.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="font-medium">{user.user_name || user.email}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Deleted {formatOrgDate(user.deleted_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Details and Tasks */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <Tabs defaultValue="details" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="details">User Details</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks ({deletedTasks.length})</TabsTrigger>
                </TabsList>
                <Button
                  onClick={() => exportUserData(selectedUser)}
                  variant="outline"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>

              <TabsContent value="details">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {selectedUser.user_name || selectedUser.email}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Email:</span>
                          <span className="text-sm">{selectedUser.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Department:</span>
                          <span className="text-sm">{selectedUser.department || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Phone:</span>
                          <span className="text-sm">{selectedUser.phone || "—"}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Created:</span>
                          <span className="text-sm">{formatOrgDate(selectedUser.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Deleted:</span>
                          <span className="text-sm">{formatOrgDate(selectedUser.deleted_at)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      User's Tasks ({deletedTasks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tasksLoading ? (
                      <div className="text-center text-muted-foreground">
                        Loading tasks...
                      </div>
                    ) : deletedTasks.length === 0 ? (
                      <div className="text-center text-muted-foreground">
                        No tasks found for this user
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {deletedTasks.map((task: DeletedTask) => (
                          <div key={task.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-medium">#{task.task_number}</span>
                                  <Badge
                                    variant="outline"
                                    className={getPriorityBadge(task.priority)}
                                  >
                                    {task.priority}
                                  </Badge>
                                  <Badge variant="secondary">{task.status}</Badge>
                                </div>
                                <h4 className="font-medium mb-1">{task.title}</h4>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {task.description}
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                  {task.team_name && (
                                    <div>Team: {task.team_name}</div>
                                  )}
                                  {task.estimated_hours && (
                                    <div>Est. Hours: {task.estimated_hours}</div>
                                  )}
                                  {task.due_date && (
                                    <div>Due: {formatOrgDate(task.due_date)}</div>
                                  )}
                                  <div>Created: {formatOrgDate(task.created_at)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a deleted user to view details and tasks</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeletedUsers;