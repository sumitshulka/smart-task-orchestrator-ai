import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { startOfDay, endOfDay, format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
} from "recharts";
import AnalyticsKPICards from "@/components/analytics/AnalyticsKPICards";
import AnalyticsLeaderboard from "@/components/analytics/AnalyticsLeaderboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Date range preset (last 30 days, month to date, etc)
const presetRanges = [
  { label: "Last 30 Days", get: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: "This Month", get: () => ({ from: startOfDay(startOfMonth(new Date())), to: endOfDay(new Date()) }) },
];

function getDefaultRange() {
  return { from: startOfDay(startOfMonth(new Date())), to: endOfDay(new Date()) };
}

function SummaryInsight({
  overdueDelta,
  completedDelta,
}: { overdueDelta: number; completedDelta: number }) {
  if (overdueDelta > 0)
    return <div className="text-sm text-yellow-700 mb-2">⚡ Overdue tasks increased by {overdueDelta}% vs previous period</div>;
  if (completedDelta > 0)
    return <div className="text-sm text-green-700 mb-2">✅ Completion rate is up by {completedDelta}%</div>;
  return <div className="text-sm text-muted-foreground mb-2">No major changes compared to previous period.</div>;
}

export default function AnalyticsReport() {
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date }>(getDefaultRange());

  // Date preset filter
  const [preset, setPreset] = React.useState("This Month");
  function handlePresetChange(p: string) {
    setPreset(p);
    const presetObj = presetRanges.find(r => r.label === p);
    if (presetObj) setDateRange(presetObj.get());
  }
  function handleCalendarChange(v: any) {
    if (v?.from && v?.to) setDateRange({ from: startOfDay(v.from), to: endOfDay(v.to) });
    setPreset("Custom");
  }

  // Always use `fromDateStr` as 00:00:00, and `toDateStr` as 23:59:59
  const fromDateStr = format(startOfDay(dateRange.from), "yyyy-MM-dd HH:mm:ss");
  const toDateStr = format(endOfDay(dateRange.to), "yyyy-MM-dd HH:mm:ss");

  // Query fetch uses the full from-to with time
  const { data: taskData, isLoading } = useQuery({
    queryKey: ["analytics-report", fromDateStr, toDateStr],
    queryFn: async () => {
      // Use string with time for accurate boundaries
      const { tasks } = await fetchTasksPaginated({
        fromDate: fromDateStr,
        toDate: toDateStr,
        limit: 2000,
      });
      return tasks;
    }
  });

  // Update comparison period for previous analysis (also covering full days)
  const numDays =
    Math.floor(
      (endOfDay(dateRange.to).getTime() - startOfDay(dateRange.from).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
  const compareFrom = startOfDay(subDays(dateRange.from, numDays));
  const compareTo = endOfDay(subDays(dateRange.from, 1));
  const { data: prevTaskData } = useQuery({
    queryKey: ["analytics-report-prev", format(compareFrom, "yyyy-MM-dd HH:mm:ss"), format(compareTo, "yyyy-MM-dd HH:mm:ss")],
    queryFn: async () => {
      const { tasks } = await fetchTasksPaginated({
        fromDate: format(compareFrom, "yyyy-MM-dd HH:mm:ss"),
        toDate: format(compareTo, "yyyy-MM-dd HH:mm:ss"),
        limit: 2000,
      });
      return tasks;
    }
  });

  // Summary KPIs
  const kpis = React.useMemo(() => {
    if (!taskData) return { total: 0, completed: 0, overdue: 0, active: 0 };
    const now = new Date();
    let completed = 0, overdue = 0, activeUsers = new Set();
    for (const t of taskData) {
      if (t.status?.toLowerCase() === "completed") completed++;
      if (t.due_date && t.status?.toLowerCase() !== "completed" && new Date(t.due_date) < now) overdue++;
      if (t.assigned_user?.email) activeUsers.add(t.assigned_user.email);
    }
    return {
      total: taskData.length,
      completed,
      overdue,
      active: activeUsers.size,
    };
  }, [taskData]);

  // Deltas for insights
  const deltas = React.useMemo(() => {
    if (!taskData || !prevTaskData) return { overdueDelta: 0, completedDelta: 0 };
    const get = (arr: any[], key: "overdue" | "completed") => {
      let completed = 0, overdue = 0, now = new Date();
      for (const t of arr) {
        if (t.status?.toLowerCase() === "completed") completed++;
        if (t.due_date && t.status?.toLowerCase() !== "completed" && new Date(t.due_date) < now) overdue++;
      }
      return key === "completed" ? completed : overdue;
    };
    const prevOverdue = get(prevTaskData, "overdue");
    const prevCompleted = get(prevTaskData, "completed");
    const overdueDelta = prevOverdue === 0 ? 0 : Math.round(((kpis.overdue - prevOverdue) / Math.max(prevOverdue, 1)) * 100);
    const completedDelta = prevCompleted === 0 ? 0 : Math.round(((kpis.completed - prevCompleted) / Math.max(prevCompleted, 1)) * 100);
    return { overdueDelta, completedDelta };
  }, [taskData, prevTaskData, kpis.overdue, kpis.completed]);

  // Status Pie
  const statusData = React.useMemo(() => {
    if (!taskData) return [];
    const map: Record<string, number> = {};
    for (const t of taskData) {
      if (t.status) map[t.status] = (map[t.status] || 0) + 1;
    }
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [taskData]);
  const COLORS = [
    "#6366f1", "#10b981", "#f59e42", "#ef4444", "#a21caf", "#3b82f6", "#eab308", "#6d28d9"
  ];

  // Created over time
  const trendData = React.useMemo(() => {
    if (!taskData) return [];
    const map: Record<string, number> = {};
    for (const t of taskData) {
      const date = t.created_at ? t.created_at.slice(0, 10) : "unknown";
      map[date] = (map[date] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([d1], [d2]) => d1.localeCompare(d2))
      .map(([date, count]) => ({ date, count }));
  }, [taskData]);

  // Completed vs overdue by date
  const barTrendData = React.useMemo(() => {
    if (!taskData) return [];
    const map: Record<string, { completed: number; overdue: number }> = {};
    const now = new Date();
    for (const t of taskData) {
      const date = t.due_date ? t.due_date.slice(0, 10) : "unknown";
      if (!map[date]) map[date] = { completed: 0, overdue: 0 };
      if (t.status?.toLowerCase() === "completed") map[date].completed++;
      if ((t.due_date && t.status?.toLowerCase() !== "completed" && new Date(t.due_date) < now))
        map[date].overdue++;
    }
    return Object.entries(map)
      .sort(([d1], [d2]) => d1.localeCompare(d2))
      .map(([date, v]) => ({ date, ...v }));
  }, [taskData]);

  // Top performers (completed) - now with progress bars
  const performerData = React.useMemo(() => {
    if (!taskData) return [];
    const map: Record<string, { name: string; completed: number; email?: string }> = {};
    for (const t of taskData) {
      const uid = t.assigned_to || "Unassigned";
      if (!map[uid]) {
        map[uid] = {
          name: (t.assigned_user?.user_name || t.assigned_user?.email || "Unassigned"),
          completed: 0,
          email: t.assigned_user?.email,
        };
      }
      if (t.status?.toLowerCase() === "completed") {
        map[uid].completed += 1;
      }
    }
    return Object.values(map)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);
  }, [taskData]);

  return (
    <div className="max-w-6xl mx-auto p-4 w-full">
      <h1 className="text-2xl font-semibold mb-4 text-left">Analytics Report</h1>
      {/* Date Range Filter */}
      <div className="flex flex-col md:flex-row gap-2 items-center justify-between mb-4">
        <div className="flex gap-2 items-center">
          <span className="font-medium mr-2">Date Range:</span>
          {presetRanges.map(r => (
            <Button
              key={r.label}
              size="sm"
              variant={preset === r.label ? "default" : "outline"}
              className="px-3"
              onClick={() => handlePresetChange(r.label)}
            >
              {r.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={preset === "Custom" ? "default" : "outline"}
                size="sm"
                className={cn("min-w-[140px] justify-start text-left", { "font-semibold": preset === "Custom" })}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                <span>
                  {dateRange.from && dateRange.to
                    ? `${format(dateRange.from, "LLL d, y")}–${format(dateRange.to, "LLL d, y")}`
                    : "Select range"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleCalendarChange}
                initialFocus
                className="p-3 pointer-events-auto"
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-xs text-muted-foreground mt-2 md:mt-0 ml-2">Showing data from <b>{format(dateRange.from, "LLL d, y")}</b> to <b>{format(dateRange.to, "LLL d, y")}</b></span>
      </div>

      {/* Summary cards */}
      <AnalyticsKPICards
        totalTasks={kpis.total}
        completedTasks={kpis.completed}
        overdueTasks={kpis.overdue}
        activeUsers={kpis.active}
      />

      {/* Auto-generated insight */}
      <SummaryInsight overdueDelta={deltas.overdueDelta} completedDelta={deltas.completedDelta} />

      {/* Charts section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="py-4">
            <div className="font-medium mb-1">Task Status Distribution</div>
            <div className="w-full flex justify-center">
              <PieChart width={300} height={210}>
                <Pie
                  dataKey="count"
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ status, count }) => `${status} (${count})`}
                  >
                  {statusData.map((entry, i) => (
                    <Cell key={entry.status} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="font-medium mb-1">Task Creation Trend</div>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={trendData}>
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      {/* Bar chart section */}
      <div className="mb-8">
        <Card>
          <CardContent className="py-4">
            <div className="font-medium mb-1">Completed vs. Overdue Tasks by Due Date</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={barTrendData}>
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" stackId="a" fill="#10b981" />
                <Bar dataKey="overdue" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      {/* Leaderboard */}
      <div className="mb-8">
        <Card>
          <CardContent className="py-4">
            <AnalyticsLeaderboard performers={performerData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
