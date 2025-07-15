import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ActiveTimersBar from "@/components/ActiveTimersBar";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

const AdminDashboard = () => {
  const { users, teams } = useUsersAndTeams();
  const { roles, loading: rolesLoading } = useCurrentUserRoleAndTeams();

  // Simple tasks query with React Query
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: () => apiClient.getTasks(),
    staleTime: 60 * 1000, // 1 minute
  });

  // Calculate stats
  const stats = React.useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status.toLowerCase() === "completed").length;
    const newTasks = tasks.filter(task => task.status.toLowerCase() === "new").length;
    const overdueTasks = tasks.filter(task => 
      task.due_date && 
      new Date(task.due_date) < new Date() && 
      task.status.toLowerCase() !== "completed"
    ).length;

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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {/* Active Timers Bar */}
      <ActiveTimersBar onTaskUpdated={handleTaskUpdated} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Total Teams" value={teams.length} />
        <StatCard label="Total Tasks" value={stats.totalTasks} />
        <StatCard label="Completed Tasks" value={stats.completedTasks} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="New Tasks" value={stats.newTasks} />
        <StatCard label="Overdue Tasks" value={stats.overdueTasks} />
        <StatCard label="Completion Rate" value={`${stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%`} />
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