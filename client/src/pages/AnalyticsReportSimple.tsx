import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AnalyticsReport() {
  const [dateRange] = React.useState(defaultDateRange());
  const { users } = useUsersAndTeams();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["analytics-tasks", format(dateRange.from, "yyyy-MM-dd"), format(dateRange.to, "yyyy-MM-dd")],
    queryFn: async () => {
      const { tasks } = await fetchTasksPaginated({
        fromDate: format(dateRange.from, "yyyy-MM-dd"),
        toDate: format(dateRange.to, "yyyy-MM-dd"),
        limit: 2000,
      });
      return tasks;
    }
  });

  const analytics = React.useMemo(() => {
    if (!tasks) return { statusData: [], userStats: [], kpis: { total: 0, completed: 0, overdue: 0, inProgress: 0 } };
    
    const statusCounts: Record<string, number> = {};
    const userTaskCounts: Record<string, number> = {};
    let completed = 0;
    let overdue = 0;
    let inProgress = 0;
    const today = new Date();
    
    tasks.forEach(task => {
      // Status counts
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      
      // User task counts
      const userInfo = users.find(u => u.id === task.assigned_to);
      const userName = userInfo?.user_name || "Unassigned";
      userTaskCounts[userName] = (userTaskCounts[userName] || 0) + 1;
      
      // KPIs
      if (task.status.toLowerCase() === "completed") completed++;
      else if (task.status.toLowerCase().includes("progress")) inProgress++;
      
      if (task.due_date && task.status.toLowerCase() !== "completed" && new Date(task.due_date) < today) {
        overdue++;
      }
    });
    
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count
    }));
    
    const userStats = Object.entries(userTaskCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        tasks: count
      }));
    
    return {
      statusData,
      userStats,
      kpis: {
        total: tasks.length,
        completed,
        overdue,
        inProgress
      }
    };
  }, [tasks, users]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-0 p-4">
        <h1 className="text-2xl font-semibold mb-4">Analytics Report</h1>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-0 p-4">
      <h1 className="text-2xl font-semibold mb-4">Analytics Report</h1>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Report for {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Total Tasks</h3>
          <p className="text-3xl font-bold text-blue-600">{analytics.kpis.total}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{analytics.kpis.completed}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
          <p className="text-3xl font-bold text-yellow-600">{analytics.kpis.inProgress}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Overdue</h3>
          <p className="text-3xl font-bold text-red-600">{analytics.kpis.overdue}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution Chart */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Task Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Users by Task Count */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Top Users by Task Count</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.userStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="tasks" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}