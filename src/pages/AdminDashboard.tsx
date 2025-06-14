
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, PieChart } from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function TaskPieChart({ data, width = 260, height = 200 }) {
  // Simple pie chart example with recharts
  return (
    <div className="mx-auto">
      <PieChart width={width} height={height}>
        <PieChart.Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={60}
          label
        >
          <PieChart.Cell fill="#8884d8" />
          <PieChart.Cell fill="#82ca9d" />
          <PieChart.Cell fill="#ffc658" />
        </PieChart.Pie>
        <PieChart.Tooltip />
      </PieChart>
    </div>
  );
}

export default function AdminDashboard() {
  const { users, teams } = useUsersAndTeams();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("unknown");
  const [userId, setUserId] = useState<string | null>(null);
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
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
      // Fetch user roles
      const { data: roleRows, error: rerr } = await supabase
        .from("user_roles")
        .select("*, role:roles(name)")
        .eq("user_id", user.id);
      const roleNames: string[] =
        roleRows?.map((r: any) => r.role?.name || "").filter(Boolean) || [];
      // Detect role (basic: priority admin > manager > team_manager > user)
      let _role: Role = "user";
      if (roleNames.includes("admin")) _role = "admin";
      else if (roleNames.includes("manager")) _role = "manager";
      else if (roleNames.includes("team_manager")) _role = "team_manager";
      else if (roleNames.length === 0) _role = "unknown";
      setRole(_role);

      // Fetch stats by role
      if (_role === "admin") {
        // Org-wide: count users/teams/tasks by org (could restrict to org, here is global for demo)
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
        // List teams managed (for demo: all teams user is member of), tasks assigned to those teams
        // For a real app, extend with "managed_by", or assign managers in team data
        // For now, teams where user is a member
        const { data: memberships } = await supabase
          .from("team_memberships")
          .select("team_id")
          .eq("user_id", user.id);
        const teamIds = memberships?.map((m) => m.team_id) || [];
        // Fetch tasks for these teams
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
        // Show own assigned task info
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
      setLoading(false);
    }
    setup();
    // only run once at mount
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

  // Show unknown role message
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-5">
        Dashboard
      </h1>
      {/* Admin OR Manager View */}
      {(role === "admin" || role === "manager" || role === "team_manager") && orgStats && (
        <>
          <div className="flex flex-wrap gap-4 mb-7">
            <StatCard label="Total Users" value={orgStats.users} />
            <StatCard label="Teams" value={orgStats.teams} />
            <StatCard label="Total Tasks" value={orgStats.totalTasks} />
            <StatCard label="Completed Tasks" value={orgStats.completedTasks} />
            <StatCard label="Pending Tasks" value={orgStats.pendingTasks} />
          </div>
          <div className="flex flex-col md:flex-row gap-7">
            {/* Pie chart example for task completion */}
            <Card className="w-full md:w-64">
              <CardHeader>
                <CardTitle>Task Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <PieChart width={220} height={160}>
                  <PieChart.Pie
                    data={[
                      { name: "Completed", value: orgStats.completedTasks },
                      { name: "Pending", value: orgStats.pendingTasks },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={55}
                    fill="#8884d8"
                    label
                  >
                    <PieChart.Cell fill="#82ca9d" />
                    <PieChart.Cell fill="#ffc658" />
                  </PieChart.Pie>
                  <PieChart.Tooltip />
                  <PieChart.Legend />
                </PieChart>
              </CardContent>
            </Card>
            <Card className="flex-1">
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

      {/* User View */}
      {role === "user" && userStats && (
        <div className="flex flex-wrap gap-4 mb-7">
          <StatCard label="Assigned Tasks" value={userStats.assignedTasks} />
          <StatCard label="Completed" value={userStats.completed} />
          <StatCard label="Pending" value={userStats.pending} />
        </div>
      )}
    </div>
  );
}
