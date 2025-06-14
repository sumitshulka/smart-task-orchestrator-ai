import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, XAxis, YAxis, Bar, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import { useStatusStats } from "@/hooks/useStatusStats";

type Role = "admin" | "manager" | "team_manager" | "user" | "unknown";

interface OrgStats {
  users: number;
  teams: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
}

interface UserStats {
  assignedTasks: number;
  completed: number;
  pending: number;
}

interface StatusStat {
  status: string;
  count: number;
}

function StatCard({ label, value, extra }: { label: string; value: number | string, extra?: React.ReactNode }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {extra}
      </CardContent>
    </Card>
  );
}

// Pie chart for statuses
function StatusPieChart({ data, width = 220, height = 180 }) {
  const COLORS = [
    "#8884d8", "#82ca9d", "#ffc658", "#e57373", "#ba68c8", "#4dd0e1", "#ffd54f", "#a1887f",
  ];
  return (
    <div className="mx-auto">
      <PieChart width={width} height={height}>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={65}
          label={({ status, count }) => `${status} (${count})`}
        >
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
      {/* Move legend outside and below the PieChart, with margin for breathing space */}
      <div className="mt-2 flex justify-center">
        <Legend layout="horizontal" verticalAlign="bottom" align="center" />
      </div>
    </div>
  );
}

// Bar chart for Assigned vs Completed per month
function AssignedVsCompletedChart({ data }: { data: { month: string; assigned: number; completed: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="assigned" name="Assigned" fill="#8884d8" />
        <Bar dataKey="completed" name="Completed" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdminDashboard() {
  const { users, teams } = useUsersAndTeams();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("unknown");
  const [userId, setUserId] = useState<string | null>(null);
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  // New: For Analytics
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [highPriorityTasks, setHighPriorityTasks] = useState<any[]>([]);
  const [taskMonthlyStats, setTaskMonthlyStats] = useState<{ month: string; assigned: number; completed: number }[]>([]);
  const [overdueRatio, setOverdueRatio] = useState<string>("0%");
  const [oldestOpenTasks, setOldestOpenTasks] = useState<any[]>([]);

  const navigate = useNavigate();

  // Keep this in state so hooks can use the params
  const [taskFilter, setTaskFilter] = useState<any>({});

  // --- NEW: Use status stats hook
  const { statusStats, loading: statusLoading } = useStatusStats(taskFilter);

  useEffect(() => {
    async function setup() {
      setLoading(true);
      // 1: Get current user
      const sessionDataResult: any = await supabase.auth.getUser();
      const user = sessionDataResult?.data?.user;
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // 2: Get roles
      // Avoid deep inference by casting
      const roleRowsResult: any = await supabase
        .from("user_roles")
        .select("*, role:roles(name)")
        .eq("user_id", user.id);
      const roleRows: any[] = roleRowsResult?.data ?? [];
      const roleNames: string[] =
        roleRows?.map((r: any) => r.role?.name || "").filter(Boolean) || [];
      let _role: Role = "user";
      if (roleNames.includes("admin")) _role = "admin";
      else if (roleNames.includes("manager")) _role = "manager";
      else if (roleNames.includes("team_manager")) _role = "team_manager";
      else if (roleNames.length === 0) _role = "unknown";
      setRole(_role);

      // Universal filters
      let nextTaskFilter: any = {};
      if (_role === "admin") {
        nextTaskFilter = {};
      } else if (_role === "manager" || _role === "team_manager") {
        const membershipsResult: any = await supabase
          .from("team_memberships")
          .select("team_id")
          .eq("user_id", user.id);
        const memberships: any[] = membershipsResult?.data ?? [];
        const teamIds = memberships?.map((m: any) => m.team_id) || [];
        if (teamIds.length) {
          nextTaskFilter = { column: "team_id", op: "in", value: teamIds };
        }
      } else if (_role === "user") {
        nextTaskFilter = { column: "assigned_to", op: "eq", value: user.id };
      }
      setTaskFilter(nextTaskFilter);

      // 1. Org or user stats
      if (_role === "admin") {
        const [
          userCountResult,
          teamCountResult,
          taskCountResult,
          completedTasksResult,
          pendingTasksResult,
        ]: any = await Promise.all([
          supabase.from("users").select("id", { count: "exact" }),
          supabase.from("teams").select("id", { count: "exact" }),
          supabase.from("tasks").select("id", { count: "exact" }),
          supabase.from("tasks").select("id").eq("status", "completed"),
          supabase.from("tasks").select("id").eq("status", "pending"),
        ]);
        setOrgStats({
          users: userCountResult?.count || 0,
          teams: teamCountResult?.count || 0,
          totalTasks: taskCountResult?.count || 0,
          completedTasks: completedTasksResult?.data?.length || 0,
          pendingTasks: pendingTasksResult?.data?.length || 0,
        });
      } else if (_role === "manager" || _role === "team_manager") {
        // Teams user is a member of
        const membershipsResult: any = await supabase
          .from("team_memberships")
          .select("team_id")
          .eq("user_id", user.id);
        const memberships: any[] = membershipsResult?.data ?? [];
        const teamIds = memberships?.map((m: any) => m.team_id) || [];
        if (teamIds.length) {
          const teamTaskCountResult: any = await supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .in("team_id", teamIds);
          const completedTeamTasksResult: any = await supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .in("team_id", teamIds)
            .eq("status", "completed");
          setOrgStats({
            users: users.length || 0,
            teams: teamIds.length,
            totalTasks: teamTaskCountResult?.count || 0,
            completedTasks: completedTeamTasksResult?.count || 0,
            pendingTasks:
              (teamTaskCountResult?.count || 0) -
              (completedTeamTasksResult?.count || 0),
          });
        }
      } else if (_role === "user") {
        const [
          assignedResult,
          completedResult,
          pendingResult,
        ]: any = await Promise.all([
          supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .eq("assigned_to", user.id),
          supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .eq("assigned_to", user.id)
            .eq("status", "completed"),
          supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .eq("assigned_to", user.id)
            .eq("status", "pending"),
        ]);
        setUserStats({
          assignedTasks: assignedResult?.count || 0,
          completed: completedResult?.count || 0,
          pending: pendingResult?.count || 0,
        });
      }

      // 3. Overdue tasks
      let overdueQuery: any = supabase
        .from("tasks")
        .select("*")
        .lt("due_date", dayjs().format("YYYY-MM-DD"))
        .neq("status", "completed");
      if (taskFilter.column) {
        if (taskFilter.op === "in")
          overdueQuery = overdueQuery.in(
            taskFilter.column,
            taskFilter.value
          );
        else if (taskFilter.op === "eq")
          overdueQuery = overdueQuery.eq(
            taskFilter.column,
            taskFilter.value
          );
      }
      const overdueResult: any = await overdueQuery;
      setOverdueTasks(overdueResult?.data || []);

      // 4. High priority tasks
      let highPrioQuery: any = supabase
        .from("tasks")
        .select("*")
        .eq("priority", 1)
        .neq("status", "completed");
      if (taskFilter.column) {
        if (taskFilter.op === "in")
          highPrioQuery = highPrioQuery.in(
            taskFilter.column,
            taskFilter.value
          );
        else if (taskFilter.op === "eq")
          highPrioQuery = highPrioQuery.eq(
            taskFilter.column,
            taskFilter.value
          );
      }
      const highPrioResult: any = await highPrioQuery;
      setHighPriorityTasks(highPrioResult?.data || []);

      // 5. Assigned vs completion per month (last 6 months)
      const fromDate = dayjs().subtract(5, "months").startOf("month");
      const months = [];
      for (let i = 0; i < 6; i++) {
        months.push(dayjs(fromDate).add(i, "month"));
      }
      // Query all assignments & completions in last 6 months
      let assignedQ: any = supabase
        .from("tasks")
        .select("id,created_at")
        .gte("created_at", months[0].format("YYYY-MM-DD"));
      let completedQ: any = supabase
        .from("tasks")
        .select("id,actual_completion_date")
        .gte("created_at", months[0].format("YYYY-MM-DD"))
        .eq("status", "completed");
      if (taskFilter.column) {
        if (taskFilter.op === "in") {
          assignedQ = assignedQ.in(taskFilter.column, taskFilter.value);
          completedQ = completedQ.in(taskFilter.column, taskFilter.value);
        } else if (taskFilter.op === "eq") {
          assignedQ = assignedQ.eq(taskFilter.column, taskFilter.value);
          completedQ = completedQ.eq(taskFilter.column, taskFilter.value);
        }
      }
      const [assignedDataResult, completedDataResult]: any = await Promise.all([
        assignedQ,
        completedQ,
      ]);
      const assignedData: any[] = assignedDataResult?.data ?? [];
      const completedData: any[] = completedDataResult?.data ?? [];
      // Format as monthly buckets
      const stats = months.map((m) => ({
        month: m.format("MMM YYYY"),
        assigned: 0,
        completed: 0,
      }));
      (assignedData || []).forEach((task: any) => {
        const idx = months.findIndex((m) =>
          dayjs(task.created_at).isSame(m, "month")
        );
        if (idx > -1) stats[idx].assigned++;
      });
      (completedData || []).forEach((task: any) => {
        // Try prefer actual_completion_date if available
        const dt = task.actual_completion_date || task.created_at;
        const idx = months.findIndex((m) =>
          dayjs(dt).isSame(m, "month")
        );
        if (idx > -1) stats[idx].completed++;
      });
      setTaskMonthlyStats(stats);

      // 6. Overdue ratio
      const totalTasks =
        _role === "user" && userStats
          ? userStats.assignedTasks
          : orgStats?.totalTasks || 0;
      const overdueCount = (overdueResult?.data || []).length;
      setOverdueRatio(
        totalTasks
          ? `${Math.round((overdueCount / totalTasks) * 100)}%`
          : "0%"
      );

      // --- Get 5 oldest open (non-completed) tasks for this user/role ---
      let oldestOpenTasksQuery: any = supabase
        .from("tasks")
        .select("*")
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true })
        .limit(5);

      if (nextTaskFilter.column) {
        if (nextTaskFilter.op === "in") {
          oldestOpenTasksQuery = oldestOpenTasksQuery.in(
            nextTaskFilter.column,
            nextTaskFilter.value
          );
        } else if (nextTaskFilter.op === "eq") {
          oldestOpenTasksQuery = oldestOpenTasksQuery.eq(
            nextTaskFilter.column,
            nextTaskFilter.value
          );
        }
      }
      const oldestOpenTasksResult: any = await oldestOpenTasksQuery;
      setOldestOpenTasks(oldestOpenTasksResult?.data || []);

      setLoading(false);
    }
    setup();
    // eslint-disable-next-line
  }, []);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80">
        <Loader2 className="animate-spin mb-2 w-10 h-10 text-primary" />
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (role === "unknown") {
    return (
      <div className="max-w-2xl mx-auto text-center mt-16">
        <div className="text-xl font-bold mb-2">No Role Assigned</div>
        <div className="text-muted-foreground mb-4">
          You do not have a role assigned in the system.<br />
          Please contact your administrator.
        </div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  // Helper: Show task priority as label
  function priorityLabel(priority: number | null) {
    return priority === 1
      ? <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">High</span>
      : priority === 2
      ? <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">Medium</span>
      : <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Low</span>;
  }

  // CARD/ROW WRAPPERS
  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-5">
        Dashboard
      </h1>

      {/* ADMIN/MANAGER/TEAM_MANAGER */}
      {(role === "admin" || role === "manager" || role === "team_manager") && (
        <>
          {/* Main Stats */}
          {orgStats && (
            <div className="flex flex-wrap gap-4 mb-7">
              <StatCard label="Total Users" value={orgStats.users} />
              <StatCard label="Teams" value={orgStats.teams} />
              <StatCard label="Total Tasks" value={orgStats.totalTasks} />
              <StatCard label="Completed Tasks" value={orgStats.completedTasks} />
              <StatCard label="Pending Tasks" value={orgStats.pendingTasks} />
            </div>
          )}

          {/* Analytics/Graphs */}
          <div className="grid md:grid-cols-2 gap-7">
            {/* Status Breakdown Pie */}
            <SectionCard title="Task Status Breakdown">
              {statusLoading ? (
                <div className="text-muted-foreground text-sm">Loading...</div>
              ) : statusStats.length > 0 ? (
                <StatusPieChart data={statusStats} />
              ) : (
                <div className="text-muted-foreground text-sm">No tasks found for this role.</div>
              )}
            </SectionCard>
            
            {/* Assigned vs Completed Tasks per Month */}
            <SectionCard title="Tasks Assigned vs Completed (Last 6 Months)">
              <AssignedVsCompletedChart data={taskMonthlyStats} />
            </SectionCard>
          </div>

          {/* ---------- OLDEST OPEN TASKS LIST SECTION ---------- */}
          <div className="mt-7">
            <Card>
              <CardHeader>
                <CardTitle>Oldest Open Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {oldestOpenTasks && oldestOpenTasks.length > 0 ? (
                  <ul className="divide-y">
                    {oldestOpenTasks.map((t: any) => (
                      <li key={t.id} className="py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{t.title}</span>
                        <span>
                          Due:{" "}
                          {t.due_date ? (
                            <span>{t.due_date}</span>
                          ) : (
                            <span className="text-muted-foreground">No due date</span>
                          )}
                        </span>
                        {priorityLabel(t.priority)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground text-sm">No open tasks.</span>
                )}
              </CardContent>
            </Card>
          </div>
          {/* ---------------------------------------------------- */}

          {/* --- 3 Stat Cards in a Row --- */}
          <div className="mt-7 grid gap-7 md:grid-cols-3">
            {/* Overdue tasks count/card */}
            <StatCard
              label="Overdue Tasks"
              value={overdueTasks.length}
              extra={overdueTasks.length > 0 && (
                <div className="mt-2 text-xs max-h-24 overflow-auto">
                  <b>Titles:</b>
                  <ul className="list-disc ml-5">
                    {overdueTasks.slice(0, 3).map((t: any) => (
                      <li key={t.id}>{t.title}</li>
                    ))}
                  </ul>
                  {overdueTasks.length > 3 && (
                    <span className="text-muted-foreground">...and {overdueTasks.length - 3} more.</span>
                  )}
                </div>
              )}
            />

            {/* High Priority tasks */}
            <StatCard
              label="High Priority Tasks"
              value={highPriorityTasks.length}
              extra={highPriorityTasks.length > 0 && (
                <div className="mt-2 text-xs max-h-24 overflow-auto">
                  <b>Titles:</b>
                  <ul className="list-disc ml-5">
                    {highPriorityTasks.slice(0, 3).map((t: any) => (
                      <li key={t.id}>{t.title}</li>
                    ))}
                  </ul>
                  {highPriorityTasks.length > 3 && (
                    <span className="text-muted-foreground">...and {highPriorityTasks.length - 3} more.</span>
                  )}
                </div>
              )}
            />

            {/* Overdue ratio */}
            <StatCard
              label="Overdue Task Ratio"
              value={overdueRatio}
              extra={overdueTasks.length > 0 ? (
                <span className="block text-xs text-muted-foreground">Total overdue compared to all tasks</span>
              ) : null}
            />
          </div>

          {/* How to use section */}
          <div className="mt-7">
            <Card>
              <CardHeader>
                <CardTitle>How to use this dashboard?</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-4 text-sm">
                  <li>
                    <span className="font-medium">Admins</span>: View organization-wide stats (users, teams, all tasks).
                  </li>
                  <li>
                    <span className="font-medium">Managers/Team Managers</span>: See analytics for your teams and their tasks.
                  </li>
                  <li>
                    <span className="font-medium">Users</span>: See your own assigned task stats below.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* USER VIEW */}
      {role === "user" && userStats && (
        <>
          <div className="flex flex-wrap gap-4 mb-7">
            <StatCard label="Assigned Tasks" value={userStats.assignedTasks} />
            <StatCard label="Completed" value={userStats.completed} />
            <StatCard label="Pending" value={userStats.pending} />
          </div>
          <div className="grid md:grid-cols-2 gap-7">
            {/* Status Breakdown Pie */}
            <SectionCard title="Task Status Breakdown">
              {statusLoading ? (
                <div className="text-muted-foreground text-sm">Loading...</div>
              ) : statusStats.length > 0 ? (
                <StatusPieChart data={statusStats} />
              ) : (
                <div className="text-muted-foreground text-sm">No assigned tasks found.</div>
              )}
            </SectionCard>
            <SectionCard title="Tasks Assigned vs Completed (Last 6 Months)">
              <AssignedVsCompletedChart data={taskMonthlyStats} />
            </SectionCard>
          </div>
          
          {/* --- OLDEST OPEN TASKS for Users --- */}
          <div className="mt-7">
            <Card>
              <CardHeader>
                <CardTitle>Oldest Open Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {oldestOpenTasks && oldestOpenTasks.length > 0 ? (
                  <ul className="divide-y">
                    {oldestOpenTasks.map((t: any) => (
                      <li key={t.id} className="py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{t.title}</span>
                        <span>
                          Due:{" "}
                          {t.due_date ? (
                            <span>{t.due_date}</span>
                          ) : (
                            <span className="text-muted-foreground">No due date</span>
                          )}
                        </span>
                        {priorityLabel(t.priority)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground text-sm">No open tasks.</span>
                )}
              </CardContent>
            </Card>
          </div>
          {/* --------------------------- */}

          {/* --- 3 Stat Cards in a Row for User --- */}
          <div className="mt-7 grid gap-7 md:grid-cols-3">
            {/* Overdue tasks */}
            <StatCard
              label="Overdue Tasks"
              value={overdueTasks.length}
              extra={overdueTasks.length > 0 && (
                <div className="mt-2 text-xs max-h-24 overflow-auto">
                  <b>Titles:</b>
                  <ul className="list-disc ml-5">
                    {overdueTasks.slice(0, 3).map((t: any) => (
                      <li key={t.id}>{t.title}</li>
                    ))}
                  </ul>
                  {overdueTasks.length > 3 && (
                    <span className="text-muted-foreground">...and {overdueTasks.length - 3} more.</span>
                  )}
                </div>
              )}
            />

            {/* High Priority tasks */}
            <StatCard
              label="High Priority Tasks"
              value={highPriorityTasks.length}
              extra={highPriorityTasks.length > 0 && (
                <div className="mt-2 text-xs max-h-24 overflow-auto">
                  <b>Titles:</b>
                  <ul className="list-disc ml-5">
                    {highPriorityTasks.slice(0, 3).map((t: any) => (
                      <li key={t.id}>{t.title}</li>
                    ))}
                  </ul>
                  {highPriorityTasks.length > 3 && (
                    <span className="text-muted-foreground">...and {highPriorityTasks.length - 3} more.</span>
                  )}
                </div>
              )}
            />

            {/* Overdue Task Ratio */}
            <StatCard
              label="Overdue Task Ratio"
              value={overdueRatio}
              extra={overdueTasks.length > 0 ? (
                <span className="block text-xs text-muted-foreground">Total overdue compared to all tasks</span>
              ) : null}
            />
          </div>
        </>
      )}
    </div>
  );
}
