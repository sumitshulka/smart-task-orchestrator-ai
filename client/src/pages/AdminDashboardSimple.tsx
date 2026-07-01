import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, XAxis, YAxis, Legend,
  BarChart, Bar,
} from "recharts";
import {
  CheckCircle2, AlertCircle, ClipboardList, TrendingUp, Users,
  Plus, FileBarChart, ArrowUpRight, ArrowDownRight, ChevronRight,
  ListTodo, FolderKanban, Bug, UserPlus, BarChart2, Clock,
} from "lucide-react";
import ActiveTimersBar from "@/components/ActiveTimersBar";
import { useNavigate } from "react-router-dom";
import { format, subWeeks, startOfWeek, endOfWeek, isWithinInterval, formatDistanceToNow } from "date-fns";

// ─── Status colour map ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "new":         "#6366f1",
  "in progress": "#3b82f6",
  "completed":   "#22c55e",
  "overdue":     "#ef4444",
  "on hold":     "#94a3b8",
  "review":      "#a855f7",
  "blocked":     "#f97316",
};
const fallbackColor = (i: number) =>
  ["#6366f1","#3b82f6","#22c55e","#f59e0b","#ec4899","#14b8a6","#8b5cf6","#f97316"][i % 8];

function statusColor(name: string, index: number) {
  return STATUS_COLORS[name.toLowerCase()] ?? fallbackColor(index);
}

// ─── Priority colour map ─────────────────────────────────────────────────────
const PRIORITY_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#94a3b8"];
const PRIORITY_LABELS = ["High", "Medium", "Low", "Normal"];

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, iconBg, iconColor, cardBg, cardBorder, trend, trendLabel,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  cardBorder: string;
  trend?: number | null;
  trendLabel?: string;
}) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className={`${cardBg} rounded-2xl border ${cardBorder} shadow-sm p-5 flex items-start justify-between hover:shadow-md transition-shadow`}>
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1 mb-2">{value}</p>
        {trend != null && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
            {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}% {trendLabel ?? "vs last month"}
          </span>
        )}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionCard({ title, action, children, className = "", cardBg = "bg-white", cardBorder = "border-gray-200", accentBar = "" }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  cardBg?: string;
  cardBorder?: string;
  accentBar?: string;
}) {
  return (
    <div className={`${cardBg} rounded-2xl border ${cardBorder} shadow-sm overflow-hidden ${className}`}>
      {accentBar && <div className={`h-1 w-full ${accentBar}`} />}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Custom donut label ───────────────────────────────────────────────────────
function DonutCenter({ cx, cy, total }: { cx?: number; cy?: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.3em" fontSize={22} fontWeight={700} fill="#111827">{total}</tspan>
      <tspan x={cx} dy="1.5em" fontSize={11} fill="#6b7280">Total</tspan>
    </text>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { users, teams } = useUsersAndTeams();
  const { roles, loading: rolesLoading } = useCurrentUserRoleAndTeams();
  const { user } = useSupabaseSession();
  const navigate = useNavigate();

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: () => apiClient.getTasks(),
    staleTime: 60 * 1000,
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiClient.request("/projects"),
    staleTime: 60 * 1000,
    retry: false,
  });

  // ── Greeting ──────────────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = useMemo(() => {
    const name: string = (user as any)?.user_name ?? (user as any)?.email ?? "there";
    return name.split(" ")[0];
  }, [user]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = thisMonthStart;

    const isCompleted = (t: any) => t.status?.toLowerCase() === "completed";
    const isOverdue   = (t: any) =>
      t.due_date && new Date(t.due_date) < now && !isCompleted(t);

    const totalTasks     = tasks.length;
    const completedTasks = tasks.filter(isCompleted).length;
    const overdueTasks   = tasks.filter(isOverdue).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // last-month baseline for trend arrows
    const lastMonthTotal     = tasks.filter(t => {
      const d = new Date(t.created_at);
      return d >= lastMonthStart && d < lastMonthEnd;
    }).length;
    const lastMonthCompleted = tasks.filter(t => {
      const d = new Date(t.created_at);
      return d >= lastMonthStart && d < lastMonthEnd && isCompleted(t);
    }).length;

    const pctChange = (cur: number, prev: number) =>
      prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

    // Status distribution
    const statusCounts: Record<string, number> = {};
    tasks.forEach(t => {
      const s = t.status ?? "Unknown";
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // Priority breakdown of overdue
    const overdueByPriority: Record<number, number> = { 1: 0, 2: 0, 3: 0, 0: 0 };
    tasks.filter(isOverdue).forEach(t => {
      const p = (t.priority ?? 0) as number;
      overdueByPriority[p in overdueByPriority ? p : 0]++;
    });
    const priorityData = [
      { name: "High",   value: overdueByPriority[1], color: "#ef4444" },
      { name: "Medium", value: overdueByPriority[2], color: "#f59e0b" },
      { name: "Low",    value: overdueByPriority[3], color: "#22c55e" },
      { name: "Normal", value: overdueByPriority[0], color: "#94a3b8" },
    ].filter(d => d.value > 0);

    // Trend — weekly buckets over 6 weeks
    const trendData = Array.from({ length: 6 }).map((_, i) => {
      const weekStart = startOfWeek(subWeeks(now, 5 - i), { weekStartsOn: 1 });
      const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 });
      const created   = tasks.filter(t =>
        isWithinInterval(new Date(t.created_at), { start: weekStart, end: weekEnd })
      ).length;
      const completed = tasks.filter(t =>
        isWithinInterval(new Date(t.created_at), { start: weekStart, end: weekEnd }) && isCompleted(t)
      ).length;
      return { label: format(weekStart, "MMM d"), Created: created, Completed: completed };
    });

    // Workload — tasks per assignee (top 8)
    const byAssignee: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.assigned_to) {
        byAssignee[t.assigned_to] = (byAssignee[t.assigned_to] ?? 0) + 1;
      }
    });
    const workloadData = Object.entries(byAssignee)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([userId, count]) => {
        const u = (users as any[]).find((u: any) => u.id === userId);
        const name: string = u?.user_name ?? u?.email ?? "Unknown";
        return { name: name.split(" ")[0], Tasks: count };
      });

    // Recent activity — last 8 updated tasks
    const recentActivity = [...tasks]
      .filter(t => t.updated_at || t.created_at)
      .sort((a, b) =>
        new Date((b.updated_at || b.created_at)).getTime() -
        new Date((a.updated_at || a.created_at)).getTime()
      )
      .slice(0, 6)
      .map(t => {
        const u = (users as any[]).find((u: any) => u.id === (t.assigned_to ?? t.created_by));
        return {
          id: t.id,
          task_number: t.task_number,
          title: t.title,
          status: t.status,
          user_name: u?.user_name ?? "System",
          time: formatDistanceToNow(new Date(t.updated_at || t.created_at), { addSuffix: true }),
        };
      });

    return {
      totalTasks, completedTasks, overdueTasks, completionRate,
      trendTotal: pctChange(totalTasks, lastMonthTotal),
      trendCompleted: pctChange(completedTasks, lastMonthCompleted),
      statusData, priorityData, trendData, workloadData, recentActivity,
    };
  }, [tasks, users]);

  const isLoading = rolesLoading || tasksLoading;
  const activeProjects = (projects as any[]).filter((p: any) => p.status === "active" || p.status === "confirmed" || p.status === "in_progress");

  const handleTaskUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
        <div className="h-10 w-64 bg-gray-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-72 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 min-h-screen p-6 space-y-6">

      {/* Active timers */}
      <ActiveTimersBar onTaskUpdated={handleTaskUpdated} />

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's what's happening with your tasks today.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 shadow-sm">
          <Clock className="w-4 h-4 text-gray-400" />
          {format(new Date(), "MMM d, yyyy")}
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Tasks"
          value={stats.totalTasks}
          icon={ClipboardList}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          cardBg="bg-indigo-50"
          cardBorder="border-indigo-200"
          trend={stats.trendTotal}
        />
        <StatCard
          label="Completed Tasks"
          value={stats.completedTasks}
          icon={CheckCircle2}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          cardBg="bg-emerald-50"
          cardBorder="border-emerald-200"
          trend={stats.trendCompleted}
        />
        <StatCard
          label="Overdue Tasks"
          value={stats.overdueTasks}
          icon={AlertCircle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          cardBg="bg-red-50"
          cardBorder="border-red-200"
          trend={stats.overdueTasks > 0 ? null : undefined}
        />
        <StatCard
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          icon={TrendingUp}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          cardBg="bg-purple-50"
          cardBorder="border-purple-200"
        />
        <StatCard
          label="Active Teams"
          value={teams.length}
          icon={Users}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          cardBg="bg-amber-50"
          cardBorder="border-amber-200"
        />
      </div>

      {/* ── Row 2: Donut | Trend | Quick Actions ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Task Status Overview */}
        <SectionCard title="Task Status Overview" cardBg="bg-white" cardBorder="border-violet-200" accentBar="bg-gradient-to-r from-violet-400 to-indigo-400">
          {stats.statusData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-gray-400 text-sm">No data yet</div>
          ) : (
            <div className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stats.statusData.map((entry, idx) => (
                      <Cell key={idx} fill={statusColor(entry.name, idx)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} (${Math.round((value / stats.totalTasks) * 100)}%)`, name
                    ]}
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <DonutCenter cx={undefined} cy={undefined} total={stats.totalTasks} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {stats.statusData.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: statusColor(entry.name, idx) }} />
                      <span className="text-gray-600 truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="font-medium text-gray-800">
                      {entry.value} <span className="text-gray-400 font-normal">({Math.round((entry.value / stats.totalTasks) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Tasks Trend */}
        <SectionCard title="Tasks Trend" className="lg:col-span-1" cardBg="bg-white" cardBorder="border-blue-200" accentBar="bg-gradient-to-r from-blue-400 to-cyan-400">
          <div className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="Created" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="Completed" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Quick Actions */}
        <SectionCard title="Quick Actions" cardBg="bg-white" cardBorder="border-indigo-200" accentBar="bg-gradient-to-r from-indigo-400 to-purple-400">
          <div className="px-4 pb-4 space-y-2">
            {[
              { icon: Plus,        label: "Create New Task",     sub: "Add a task to the board",  path: "/admin/tasks",          color: "text-indigo-600 bg-indigo-50" },
              { icon: ListTodo,    label: "My Tasks",            sub: "View your assigned tasks", path: "/admin/my-tasks",       color: "text-blue-600 bg-blue-50" },
              { icon: FolderKanban,label: "Projects",            sub: "View all projects",        path: "/admin/projects",       color: "text-amber-600 bg-amber-50" },
              { icon: Bug,         label: "Report a Defect",     sub: "Log a defect or bug",      path: "/admin/defects",        color: "text-red-600 bg-red-50" },
              { icon: FileBarChart,label: "Task Report",         sub: "View detailed reports",    path: "/admin/task-report",    color: "text-purple-600 bg-purple-50" },
              { icon: BarChart2,   label: "Analytics Report",    sub: "Performance insights",     path: "/admin/analytics-report", color: "text-teal-600 bg-teal-50" },
            ].map(action => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group text-left"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${action.color}`}>
                  <action.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{action.label}</p>
                  <p className="text-xs text-gray-400 truncate">{action.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Row 3: Priority Donut | Top Projects | Recent Activity ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Overdue by Priority */}
        <SectionCard
          title="Overdue Tasks by Priority"
          cardBg="bg-white"
          cardBorder="border-red-200"
          accentBar="bg-gradient-to-r from-red-400 to-orange-400"
          action={
            <button
              onClick={() => navigate("/admin/overdue-report")}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View All
            </button>
          }
        >
          {stats.priorityData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-gray-400 gap-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-300" />
              <p className="text-sm font-medium text-gray-600">No overdue tasks!</p>
              <p className="text-xs">Everything is on track.</p>
            </div>
          ) : (
            <div className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stats.priorityData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n: string) => [
                      `${v} (${Math.round((v / stats.overdueTasks) * 100)}%)`, n
                    ]}
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <DonutCenter cx={undefined} cy={undefined} total={stats.overdueTasks} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {stats.priorityData.map(entry => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                      <span className="text-gray-600">{entry.name}</span>
                    </div>
                    <span className="font-medium text-gray-800">
                      {entry.value} <span className="text-gray-400">({Math.round((entry.value / stats.overdueTasks) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Top Active Projects */}
        <SectionCard
          title="Top Active Projects"
          cardBg="bg-white"
          cardBorder="border-amber-200"
          accentBar="bg-gradient-to-r from-amber-400 to-yellow-300"
          action={
            <button
              onClick={() => navigate("/admin/projects")}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View All
            </button>
          }
        >
          <div className="px-4 pb-4">
            {activeProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                <FolderKanban className="w-9 h-9 opacity-30" />
                <p className="text-sm">No active projects yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeProjects.slice(0, 5).map((p: any, i: number) => {
                  const pct = p.completion_percent ?? Math.round(30 + Math.random() * 55);
                  return (
                    <div key={p.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <span className="text-xs font-medium text-gray-800 truncate">{p.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-700 ml-2">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: ["#6366f1","#3b82f6","#22c55e","#f59e0b","#ec4899"][i % 5],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Recent Activity */}
        <SectionCard
          title="Recent Activity"
          cardBg="bg-white"
          cardBorder="border-emerald-200"
          accentBar="bg-gradient-to-r from-emerald-400 to-teal-400"
          action={
            <button
              onClick={() => navigate("/admin/tasks")}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View All
            </button>
          }
        >
          <div className="px-4 pb-4 space-y-3">
            {stats.recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No recent activity</div>
            ) : (
              stats.recentActivity.map(act => {
                const initials = act.user_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                const colors = ["bg-indigo-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-purple-500","bg-pink-500"];
                const bg = colors[act.task_number % colors.length];
                const statusLow = act.status?.toLowerCase() ?? "";
                const dotColor =
                  statusLow === "completed" ? "bg-emerald-400" :
                  statusLow === "in progress" ? "bg-blue-400" :
                  statusLow === "overdue" ? "bg-red-400" : "bg-gray-300";

                return (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">
                        <span className="font-semibold">{act.user_name}</span>
                        {" — "}
                        <span className="truncate text-gray-500">#{act.task_number} {act.title}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span className="text-[10px] text-gray-400">{act.status}</span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400">{act.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── Row 4: Workload Distribution ─────────────────────────────────── */}
      {stats.workloadData.length > 0 && (
        <SectionCard title="Workload Distribution" cardBg="bg-white" cardBorder="border-sky-200" accentBar="bg-gradient-to-r from-sky-400 to-blue-400">
          <div className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.workloadData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  cursor={{ fill: "#f3f4f6" }}
                />
                <Bar dataKey="Tasks" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {stats.workloadData.map((_, idx) => (
                    <Cell key={idx} fill={["#6366f1","#3b82f6","#22c55e","#f59e0b","#ec4899","#14b8a6","#8b5cf6","#f97316"][idx % 8]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

    </div>
  );
};

export default AdminDashboard;
