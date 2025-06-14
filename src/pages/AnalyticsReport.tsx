
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { startOfMonth, format } from "date-fns";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

function getDefaultMonthRange() {
  const now = new Date();
  return {
    fromDate: format(startOfMonth(now), "yyyy-MM-dd"),
    toDate: format(now, "yyyy-MM-dd")
  };
}

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#e57373", "#ba68c8", "#4dd0e1", "#ffd54f", "#a1887f"
];

export default function AnalyticsReport() {
  const { fromDate, toDate } = getDefaultMonthRange();

  const { data: taskData, isLoading } = useQuery({
    queryKey: ["analytics-report", fromDate, toDate],
    queryFn: async () => {
      const { tasks } = await fetchTasksPaginated({
        fromDate,
        toDate,
        limit: 1000
      });
      return tasks;
    }
  });

  // Prepare analytic data
  const statusData = React.useMemo(() => {
    if (!taskData) return [];
    const map: Record<string, number> = {};
    taskData.forEach((t: any) => {
      if (t.status) {
        map[t.status] = (map[t.status] || 0) + 1;
      }
    });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [taskData]);

  // Count tasks over time (created_at by date)
  const trendData = React.useMemo(() => {
    if (!taskData) return [];
    const map: Record<string, number> = {};
    taskData.forEach(t => {
      const date = t.created_at ? t.created_at.slice(0, 10) : "unknown";
      map[date] = (map[date] || 0) + 1;
    });
    // sort by date
    return Object.entries(map)
      .sort(([d1], [d2]) => d1.localeCompare(d2))
      .map(([date, count]) => ({ date, count }));
  }, [taskData]);

  // Overdue tasks
  const overdueCount = React.useMemo(() => {
    if (!taskData) return 0;
    const now = new Date();
    return taskData.filter(
      t => t.due_date && new Date(t.due_date) < now && t.status !== "completed"
    ).length;
  }, [taskData]);

  // Top performers
  const performerData = React.useMemo(() => {
    if (!taskData) return [];
    const map: Record<string, { name: string; completed: number }> = {};
    taskData.forEach(t => {
      const uid = t.assigned_to || "Unassigned";
      if (!map[uid]) {
        map[uid] = {
          name: (t.assigned_user?.user_name || t.assigned_user?.email || "Unassigned"),
          completed: 0
        };
      }
      if (t.status === "completed") {
        map[uid].completed += 1;
      }
    });
    return Object.entries(map)
      .map(([id, v]) => ({
        employee: v.name,
        completed: v.completed
      }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);
  }, [taskData]);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Analytics Report</h1>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Status Breakdown */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Task Status Distribution</h2>
            <div className="flex justify-center">
              <PieChart width={340} height={260}>
                <Pie
                  dataKey="count"
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={entry.status} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </div>
          </section>
          {/* Trend */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Task Creation Trend</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData}>
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </section>
          {/* Overdue tasks */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Overdue Tasks</h2>
            <div className="text-3xl font-bold text-red-600">{overdueCount}</div>
            <span className="text-muted-foreground">Tasks past due date and not completed</span>
          </section>
          {/* Top Performers */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Top Performers (Most Completed)</h2>
            <ul className="list-disc list-inside">
              {performerData.map((p, idx) => (
                <li key={p.employee || idx}>
                  <span className="font-medium">{p.employee}:</span> {p.completed} completed
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
