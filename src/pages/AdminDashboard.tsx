import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, XAxis, YAxis, Bar, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";

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
        <Legend />
      </PieChart>
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
  const [statusStats, setStatusStats] = useState<StatusStat[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [highPriorityTasks, setHighPriorityTasks] = useState<any[]>([]);
  const [taskMonthlyStats, setTaskMonthlyStats] = useState<{ month: string; assigned: number; completed: number }[]>([]);
  const [overdueRatio, setOverdueRatio] = useState<string>("0%");

  const navigate = useNavigate();

  useEffect(() => {
    async function setup() {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData?.user;
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("*, role:roles(name)")
        .eq("user_id", user.id);
      const roleNames: string[] =
        roleRows?.map((r: any) => r.role?.name || "").filter(Boolean) || [];
      let _role: Role = "user";
      if (roleNames.includes("admin")) _role = "admin";
      else if (roleNames.includes("manager")) _role = "manager";
      else if (roleNames.includes("team_manager")) _role = "team_manager";
      else if (roleNames.length === 0) _role = "unknown";
      setRole(_role);

      // Universal filters
      let taskFilter: any = {};
      if (_role === "admin") {
        // Org-wide
        taskFilter = {};
      } else if (_role === "manager" || _role === "team_manager") {
        // Teams
        const { data: memberships } = await supabase
          .from("team_memberships")
          .select("team_id")
          .eq("user_id", user.id);
        const teamIds = memberships?.map((m) => m.team_id) || [];
        if (teamIds.length) {
          taskFilter = { column: "team_id", op: "in", value: teamIds };
        }
      } else if (_role === "user") {
        taskFilter = { column: "assigned_to", op: "eq", value: user.id };
      }

      // 1. Org or user stats
      if (_role === "admin") {
        const [{ count: userCount }, { count: teamCount }, { count: taskCount }, { data: completedTasks }, { data: pendingTasks }] =
          await Promise.all([
            supabase.from("users").select("id", { count: "exact" }),
            supabase.from("teams").select("id", { count: "exact" }),
            supabase.from("tasks").select("id", { count: "exact" }),
            supabase.from("tasks").select("id").eq("status", "completed"),
            supabase.from("tasks").select("id").eq("status", "pending"),
          ]);
        setOrgStats({
          users: userCount || 0,
          teams: teamCount || 0,
          totalTasks: taskCount || 0,
          completedTasks: completedTasks?.length || 0,
          pendingTasks: pendingTasks?.length || 0,
        });
      } else if (_role === "manager" || _role === "team_manager") {
        // Teams user is a member of
        const { data: memberships } = await supabase
          .from("team_memberships")
          .select("team_id")
          .eq("user_id", user.id);
        const teamIds = memberships?.map((m) => m.team_id) || [];
        if (teamIds.length) {
          const { count: teamTaskCount } = await supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .in("team_id", teamIds);
          const { count: completedTeamTasks } = await supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .in("team_id", teamIds)
            .eq("status", "completed");
          setOrgStats({
            users: users.length || 0,
            teams: teamIds.length,
            totalTasks: teamTaskCount || 0,
            completedTasks: completedTeamTasks || 0,
            pendingTasks: (teamTaskCount || 0) - (completedTeamTasks || 0),
          });
        }
      } else if (_role === "user") {
        const [{ count: assigned }, { count: completed }, { count: pending }] = await Promise.all([
          supabase.from("tasks").select("id", { count: "exact" }).eq("assigned_to", user.id),
          supabase.from("tasks").select("id", { count: "exact" }).eq("assigned_to", user.id).eq("status", "completed"),
          supabase.from("tasks").select("id", { count: "exact" }).eq("assigned_to", user.id).eq("status", "pending"),
        ]);
        setUserStats({
          assignedTasks: assigned || 0,
          completed: completed || 0,
          pending: pending || 0,
        });
      }

      // 2. Status Pie Chart data
      let taskQuery = supabase.from("tasks").select("status");
      if (taskFilter.column) {
        if (taskFilter.op === "in") taskQuery = taskQuery.in(taskFilter.column, taskFilter.value);
        else if (taskFilter.op === "eq") taskQuery = taskQuery.eq(taskFilter.column, taskFilter.value);
      }
      // ---- NEW: Stop TypeScript from inferring deep types by using unknown, then cast manually
      const statusDataRaw = (await taskQuery) as { data: unknown };
      const taskRows: { status: string }[] = Array.isArray((statusDataRaw.data as any)) 
        ? (statusDataRaw.data as any[]).map((row: any) => ({ status: row.status })) 
        : [];
      const statusCounts: Record<string, number> = {};
      taskRows.forEach((row) => {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      });
      setStatusStats(
        Object.entries(statusCounts).map(([status, count]) => ({ status, count }))
      );

      // 3. Overdue tasks (due date < today and not completed)
      let overdueQuery = supabase.from("tasks").select("*").lt("due_date", dayjs().format("YYYY-MM-DD")).neq("status", "completed");
      if (taskFilter.column) {
        if (taskFilter.op === "in") overdueQuery = overdueQuery.in(taskFilter.column, taskFilter.value);
        else if (taskFilter.op === "eq") overdueQuery = overdueQuery.eq(taskFilter.column, taskFilter.value);
      }
      const { data: overdue } = await overdueQuery;
      setOverdueTasks(overdue || []);

      // 4. High priority tasks (priority = 1, not completed)
      let highPrioQuery = supabase.from("tasks").select("*").eq("priority", 1).neq("status", "completed");
      if (taskFilter.column) {
        if (taskFilter.op === "in") highPrioQuery = highPrioQuery.in(taskFilter.column, taskFilter.value);
        else if (taskFilter.op === "eq") highPrioQuery = highPrioQuery.eq(taskFilter.column, taskFilter.value);
      }
      const { data: highPrio } = await highPrioQuery;
      setHighPriorityTasks(highPrio || []);

      // 5. Assigned vs completion per month (last 6 months)
      const fromDate = dayjs().subtract(5, "months").startOf("month");
      const months = [];
      for (let i = 0; i < 6; i++) {
        months.push(dayjs(fromDate).add(i, "month"));
      }
      let assignedPerMonth = [];
      let completedPerMonth = [];
      // Query all assignments & completions in last 6 months
      let assignedQ = supabase.from("tasks").select("id,created_at").gte("created_at", months[0].format("YYYY-MM-DD"));
      let completedQ = supabase.from("tasks").select("id,actual_completion_date").gte("created_at", months[0].format("YYYY-MM-DD")).eq("status", "completed");
      if (taskFilter.column) {
        if (taskFilter.op === "in") {
          assignedQ = assignedQ.in(taskFilter.column, taskFilter.value);
          completedQ = completedQ.in(taskFilter.column, taskFilter.value);
        } else if (taskFilter.op === "eq") {
          assignedQ = assignedQ.eq(taskFilter.column, taskFilter.value);
          completedQ = completedQ.eq(taskFilter.column, taskFilter.value);
        }
      }
      const [{ data: assignedData }, { data: completedData }] = await Promise.all([assignedQ, completedQ]);
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
      const totalTasks = (_role === "user" && userStats) ? userStats.assignedTasks : (orgStats?.totalTasks || 0);
      const overdueCount = (overdue || []).length;
      setOverdueRatio(totalTasks ? `${Math.round((overdueCount / totalTasks) * 100)}%` : "0%");

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
              {statusStats.length > 0 ? (
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
          <div className="mt-7 grid md:grid-cols-2 gap-7">
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
          </div>
          <div className="mt-7 max-w-lg">
            {/* Overdue ratio */}
            <StatCard
              label="Overdue Task Ratio"
              value={overdueRatio}
              extra={overdueTasks.length > 0 ? (
                <span className="block text-xs text-muted-foreground">Total overdue compared to all tasks</span>
              ) : null}
            />
          </div>

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
              {statusStats.length > 0 ? (
                <StatusPieChart data={statusStats} />
              ) : (
                <div className="text-muted-foreground text-sm">No assigned tasks found.</div>
              )}
            </SectionCard>
            <SectionCard title="Tasks Assigned vs Completed (Last 6 Months)">
              <AssignedVsCompletedChart data={taskMonthlyStats} />
            </SectionCard>
          </div>
          <div className="mt-7 grid md:grid-cols-2 gap-7">
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
          </div>
          <div className="mt-7 max-w-lg">
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
