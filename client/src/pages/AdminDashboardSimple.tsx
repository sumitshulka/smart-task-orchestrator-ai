import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, Building2, ClipboardList, CheckCircle, Calendar, Clock, AlertCircle } from "lucide-react";
import ActiveTimersBar from "@/components/ActiveTimersBar";
import { useNavigate } from "react-router-dom";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function StatCard({ label, value, icon: Icon, bgColor, borderColor }: { 
  label: string; 
  value: number | string; 
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <Card className={`flex-1 min-w-[140px] ${bgColor} ${borderColor} shadow-sm`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
          <Icon className="h-4 w-4 text-gray-500" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold text-gray-800">{value}</div>
      </CardContent>
    </Card>
  );
}

const AdminDashboard = () => {
  const { users, teams } = useUsersAndTeams();
  const { roles, loading: rolesLoading } = useCurrentUserRoleAndTeams();
  const navigate = useNavigate();

  // Simple tasks query with React Query
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: () => apiClient.getTasks(),
    staleTime: 60 * 1000, // 1 minute
  });

  // Calculate stats and tasks due today
  const stats = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status.toLowerCase() === "completed").length;
    const newTasks = tasks.filter(task => task.status.toLowerCase() === "new").length;
    const overdueTasks = tasks.filter(task => 
      task.due_date && 
      new Date(task.due_date) < new Date() && 
      task.status.toLowerCase() !== "completed"
    ).length;

    // Tasks due today
    const tasksDueToday = tasks.filter(task => {
      if (!task.due_date || task.status.toLowerCase() === "completed") return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    });

    // Status distribution for chart
    const statusCounts: Record<string, number> = {};
    tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count
    }));

    return {
      totalTasks,
      completedTasks,
      newTasks,
      overdueTasks,
      tasksDueToday,
      statusData
    };
  }, [tasks]);

  const isAdmin = roles.includes("admin");
  const isLoading = rolesLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <div>Loading...</div>
      </div>
    );
  }

  const handleTaskUpdated = () => {
    // Invalidate and refetch tasks when timer updates occur
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
  };

  const handleTaskClick = (taskId: string) => {
    // Navigate to My Tasks page - the task details will open automatically there
    console.log("[DEBUG] Navigating to my-tasks from dashboard task click, taskId:", taskId);
    navigate("/admin/my-tasks");
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1: return { text: "High", color: "bg-red-100 text-red-800 border-red-200" };
      case 2: return { text: "Medium", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
      case 3: return { text: "Low", color: "bg-green-100 text-green-800 border-green-200" };
      default: return { text: "Normal", color: "bg-gray-100 text-gray-800 border-gray-200" };
    }
  };

  const formatDueTime = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffMs < 0) {
      return { text: "Overdue", color: "text-red-600", icon: AlertCircle };
    } else if (diffHours < 1) {
      return { text: `${diffMinutes}m left`, color: "text-orange-600", icon: Clock };
    } else if (diffHours < 24) {
      return { text: `${diffHours}h left`, color: "text-blue-600", icon: Clock };
    } else {
      return { text: "Due today", color: "text-gray-600", icon: Calendar };
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {/* Active Timers Bar */}
      <ActiveTimersBar onTaskUpdated={handleTaskUpdated} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Total Users" 
          value={users.length} 
          icon={Users}
          bgColor="bg-gray-50"
          borderColor="border-gray-200"
        />
        <StatCard 
          label="Total Teams" 
          value={teams.length} 
          icon={Building2}
          bgColor="bg-slate-50"
          borderColor="border-slate-200"
        />
        <StatCard 
          label="Total Tasks" 
          value={stats.totalTasks} 
          icon={ClipboardList}
          bgColor="bg-zinc-50"
          borderColor="border-zinc-200"
        />
        <StatCard 
          label="Completed Tasks" 
          value={stats.completedTasks} 
          icon={CheckCircle}
          bgColor="bg-stone-50"
          borderColor="border-stone-200"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard 
          label="New Tasks" 
          value={stats.newTasks} 
          icon={ClipboardList}
          bgColor="bg-gray-100"
          borderColor="border-gray-300"
        />
        <StatCard 
          label="Overdue Tasks" 
          value={stats.overdueTasks} 
          icon={CheckCircle}
          bgColor="bg-red-50"
          borderColor="border-red-200"
        />
        <StatCard 
          label="Completion Rate" 
          value={`${stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%`} 
          icon={CheckCircle}
          bgColor="bg-green-50"
          borderColor="border-green-200"
        />
      </div>

      {/* Tasks Due Today Section */}
      <div className="mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Tasks Due Today
              {stats.tasksDueToday.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {stats.tasksDueToday.length}
                </span>
              )}
            </CardTitle>
            {stats.tasksDueToday.length > 0 && (
              <button
                onClick={() => navigate("/admin/my-tasks")}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                View All Tasks →
              </button>
            )}
          </CardHeader>
          <CardContent>
            {stats.tasksDueToday.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No tasks due today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.tasksDueToday.slice(0, 5).map((task: any) => {
                  const priorityBadge = getPriorityBadge(task.priority);
                  const dueTime = formatDueTime(task.due_date);
                  const DueIcon = dueTime.icon;
                  
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-gray-500">
                            #{task.task_number}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityBadge.color}`}>
                            {priorityBadge.text}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${dueTime.color}`}>
                            <DueIcon className="h-3 w-3" />
                            {dueTime.text}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-gray-600 truncate mt-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {task.status}
                        </span>
                        {task.estimated_hours && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {task.estimated_hours}h
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {stats.tasksDueToday.length > 5 && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => navigate("/admin/my-tasks")}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      +{stats.tasksDueToday.length - 5} more tasks →
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No task data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Tasks Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Users</span>
                <span className="font-medium">{users.filter(u => u.is_active).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Teams</span>
                <span className="font-medium">{teams.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tasks This Month</span>
                <span className="font-medium">{stats.totalTasks}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending Tasks</span>
                <span className="font-medium">{stats.totalTasks - stats.completedTasks}</span>
              </div>
              {stats.overdueTasks > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-600">⚠️ Overdue Tasks</span>
                  <span className="font-medium text-red-600">{stats.overdueTasks}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role-based access message */}
      {!isAdmin && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            You are viewing a limited dashboard. Contact your administrator for full access.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;