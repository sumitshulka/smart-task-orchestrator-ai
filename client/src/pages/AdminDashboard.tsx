import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, XAxis, YAxis, Bar, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import { useStatusStats } from "@/hooks/useStatusStats";
import TaskDetailsSheet from "@/components/TaskDetailsSheet";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import AnalyticsKPICards from "@/components/analytics/AnalyticsKPICards";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { X } from "lucide-react";

type Role = "admin" | "manager" | "team_manager" | "user" | "unknown";

interface OrgStats {
  users: number;
  teams: number;
  totalTasks: number;
  completedTasks: number;
  newTasks: number;
}

interface UserStats {
  assignedTasks: number;
  completed: number;
  pending: number;
  new: number;
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

// Pie chart for statuses -- UPDATED
function StatusPieChart({ data, width = 220, height = 180 }) {
  const COLORS = [
    "#8884d8", "#82ca9d", "#ffc658", "#e57373", "#ba68c8", "#4dd0e1", "#ffd54f", "#a1887f",
  ];
  return (
    <div className="flex flex-col items-center justify-center">
      <PieChart width={width} height={height}>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={65}
          label={false} // Hide default labels to prevent overlap
        >
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 13 }}
          formatter={(value, name, props) =>
            [`${value}`, `Status: ${props.payload.status}`]
          }
        />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          wrapperStyle={{ fontSize: 14, marginTop: 10 }}
        />
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

function priorityLabel(priority: number) {
  if (priority === 1) return <span className="text-xs text-red-700 font-bold">High</span>;
  if (priority === 2) return <span className="text-xs text-yellow-700 font-bold">Medium</span>;
  return <span className="text-xs text-green-700 font-bold">Low</span>;
}

const AdminDashboard = () => {
  const { users, teams: allTeams } = useUsersAndTeams();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("unknown");
  const [userId, setUserId] = useState<string | null>(null);
  const [orgStats, setOrgStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [highPriorityTasks, setHighPriorityTasks] = useState<any[]>([]);
  const [taskMonthlyStats, setTaskMonthlyStats] = useState<{ month: string; assigned: number; completed: number }[]>([]);
  const [overdueRatio, setOverdueRatio] = useState<string>("0%");
  const [oldestOpenTasks, setOldestOpenTasks] = useState<any[]>([]);
  const [detailsTask, setDetailsTask] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [taskFilter, setTaskFilter] = useState<any>({});
  const [managersWithoutTeams, setManagersWithoutTeams] = useState<any[]>([]);
  const [showManagersNoTeamsAlert, setShowManagersNoTeamsAlert] = useState(true);

  // Use Status Stats Hook (only declare ONCE at the top)
  const { statusStats, loading: statusLoading } = useStatusStats(taskFilter);

  // Use the custom hook to get roles and teams for the current user
  const { roles, teams, user, loading: rolesLoading } = useCurrentUserRoleAndTeams();

  // Improved robust role detection
  const currentRole: Role =
    roles && roles.includes("admin")
      ? "admin"
      : roles && roles.includes("manager")
      ? "manager"
      : roles && roles.includes("team_manager")
      ? "team_manager"
      : roles && roles.includes("user")
      ? "user"
      : "unknown";

  // Check team assignment
  const isUserAndNoTeams = currentRole === "user" && teams.length === 0;

  // --- Function to fetch oldest open tasks from API ---
  async function fetchManagerOldestOpenTasks(nextTaskFilter: any) {
    try {
      // Get all tasks and filter them client-side
      const allTasks = await apiClient.getTasks();
      let filteredTasks = allTasks.filter((task: any) => task.status !== "completed");
      
      // Apply filters based on nextTaskFilter
      if (nextTaskFilter.column) {
        if (nextTaskFilter.op === "in") {
          filteredTasks = filteredTasks.filter((task: any) => 
            nextTaskFilter.value.includes(task[nextTaskFilter.column])
          );
        } else if (nextTaskFilter.op === "eq") {
          filteredTasks = filteredTasks.filter((task: any) => 
            task[nextTaskFilter.column] === nextTaskFilter.value
          );
        }
      }
      
      // Sort by due_date and created_at, then limit to 5
      return filteredTasks
        .sort((a: any, b: any) => {
          if (a.due_date && b.due_date) {
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          }
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        })
        .slice(0, 5);
    } catch (error) {
      console.error('Failed to fetch oldest open tasks:', error);
      return [];
    }
  }

  useEffect(() => {
    async function setup() {
      setLoading(true);

      // Get user and id (single source)
      let localUser = user;
      if (!localUser) {
        setUserId(null);
        setLoading(false);
        return;
      }
      setUserId(localUser.id);

      // roles already loaded by hook (roles: string[])
      let filteredRole: Role = "unknown";
      if (roles && roles.includes("admin")) filteredRole = "admin";
      else if (roles && roles.includes("manager")) filteredRole = "manager";
      else if (roles && roles.includes("team_manager")) filteredRole = "team_manager";
      else if (roles && roles.includes("user")) filteredRole = "user";
      setRole(filteredRole);

      // Generate task filter for the rest of queries
      let nextTaskFilter: any = {};
      if (filteredRole === "admin") {
        nextTaskFilter = {};
      } else if (filteredRole === "manager" || filteredRole === "team_manager") {
        try {
          const memberships = await apiClient.getTeamMembers(localUser.id);
          const teamIds = memberships?.map((m: any) => m.team_id) || [];
          if (teamIds.length) {
            nextTaskFilter = { column: "team_id", op: "in", value: teamIds };
          }
        } catch (error) {
          console.error('Failed to fetch team memberships:', error);
        }
      } else if (filteredRole === "user") {
        nextTaskFilter = { column: "assigned_to", op: "eq", value: localUser.id };
      }
      setTaskFilter(nextTaskFilter);

      // ---------------- NEW TASKS LOGIC ---------------- //
      if (filteredRole === "admin") {
        try {
          const [users, teams, tasks] = await Promise.all([
            apiClient.getUsers(),
            apiClient.getTeams(),
            apiClient.getTasks(),
          ]);
          
          const completedTasks = tasks.filter((task: any) => task.status === "completed");
          const newTasks = tasks.filter((task: any) => task.status === "New");
          
          setOrgStats({
            users: users.length,
            teams: teams.length,
            totalTasks: tasks.length,
            completedTasks: completedTasks.length,
            newTasks: newTasks.length,
          });
        } catch (error) {
          console.error('Failed to fetch admin stats:', error);
        }
      } else if (filteredRole === "manager" || filteredRole === "team_manager") {
        try {
          // Get teams user is a member of
          const allMembers = await apiClient.getTeamMembers(''); // We'll need to fix this API
          const userTeams = teams.map((t: any) => t.id); // Use from hook
          
          if (userTeams.length) {
            const allTasks = await apiClient.getTasks();
            const teamTasks = allTasks.filter((task: any) => userTeams.includes(task.team_id));
            const completedTeamTasks = teamTasks.filter((task: any) => task.status === "completed");
            const newTeamTasks = teamTasks.filter((task: any) => task.status === "New");
            
            setOrgStats({
              users: users.length || 0,
              teams: userTeams.length,
              totalTasks: teamTasks.length,
              completedTasks: completedTeamTasks.length,
              newTasks: newTeamTasks.length,
            });
          }
        } catch (error) {
          console.error('Failed to fetch manager stats:', error);
        }
      } else if (filteredRole === "user") {
        try {
          const allTasks = await apiClient.getTasks();
          const userTasks = allTasks.filter((task: any) => task.assigned_to === localUser.id);
          const completedTasks = userTasks.filter((task: any) => task.status === "completed");
          const pendingTasks = userTasks.filter((task: any) => task.status === "pending");
          const newTasks = userTasks.filter((task: any) => task.status === "New");
          
          setUserStats({
            assignedTasks: userTasks.length,
            completed: completedTasks.length,
            pending: pendingTasks.length,
            new: newTasks.length,
          });
        } catch (error) {
          console.error('Failed to fetch user stats:', error);
        }
      }

      // 3. Overdue tasks
      try {
        const allTasks = await apiClient.getTasks();
        const today = dayjs().format("YYYY-MM-DD");
        let overdueTasks = allTasks.filter((task: any) => 
          task.due_date && 
          task.due_date < today && 
          task.status !== "completed"
        );
        
        // Apply task filter
        if (nextTaskFilter.column) {
          if (nextTaskFilter.op === "in") {
            overdueTasks = overdueTasks.filter((task: any) => 
              nextTaskFilter.value.includes(task[nextTaskFilter.column])
            );
          } else if (nextTaskFilter.op === "eq") {
            overdueTasks = overdueTasks.filter((task: any) => 
              task[nextTaskFilter.column] === nextTaskFilter.value
            );
          }
        }
        
        setOverdueTasks(overdueTasks);
      } catch (error) {
        console.error('Failed to fetch overdue tasks:', error);
        setOverdueTasks([]);
      }

      // 4. High priority tasks  
      try {
        const allTasks = await apiClient.getTasks();
        let highPriorityTasks = allTasks.filter((task: any) => 
          task.priority === 1 && task.status !== "completed"
        );
        
        // Apply task filter
        if (nextTaskFilter.column) {
          if (nextTaskFilter.op === "in") {
            highPriorityTasks = highPriorityTasks.filter((task: any) => 
              nextTaskFilter.value.includes(task[nextTaskFilter.column])
            );
          } else if (nextTaskFilter.op === "eq") {
            highPriorityTasks = highPriorityTasks.filter((task: any) => 
              task[nextTaskFilter.column] === nextTaskFilter.value
            );
          }
        }
        
        setHighPriorityTasks(highPriorityTasks);
      } catch (error) {
        console.error('Failed to fetch high priority tasks:', error);
        setHighPriorityTasks([]);
      }

      // 5. Assigned vs completion per month (last 6 months)
      try {
        const fromDate = dayjs().subtract(5, "months").startOf("month");
        const months = [];
        for (let i = 0; i < 6; i++) {
          months.push(dayjs(fromDate).add(i, "month"));
        }
        
        const allTasks = await apiClient.getTasks();
        const fromDateStr = months[0].format("YYYY-MM-DD");
        
        // Filter tasks from the last 6 months
        let recentTasks = allTasks.filter((task: any) => 
          task.created_at >= fromDateStr
        );
        
        // Apply task filter
        if (nextTaskFilter.column) {
          if (nextTaskFilter.op === "in") {
            recentTasks = recentTasks.filter((task: any) => 
              nextTaskFilter.value.includes(task[nextTaskFilter.column])
            );
          } else if (nextTaskFilter.op === "eq") {
            recentTasks = recentTasks.filter((task: any) => 
              task[nextTaskFilter.column] === nextTaskFilter.value
            );
          }
        }
        
        const assignedData = recentTasks;
        const completedData = recentTasks.filter((task: any) => task.status === "completed");
        
        // Format as monthly buckets
        const stats = months.map((m) => ({
          month: m.format("MMM YYYY"),
          assigned: 0,
          completed: 0,
        }));
        
        assignedData.forEach((task: any) => {
          const idx = months.findIndex((m) =>
            dayjs(task.created_at).isSame(m, "month")
          );
          if (idx > -1) stats[idx].assigned++;
        });
        
        completedData.forEach((task: any) => {
          // Try prefer actual_completion_date if available
          const dt = task.actual_completion_date || task.created_at;
          const idx = months.findIndex((m) =>
            dayjs(dt).isSame(m, "month")
          );
          if (idx > -1) stats[idx].completed++;
        });
        
        setTaskMonthlyStats(stats);
      } catch (error) {
        console.error('Failed to fetch monthly stats:', error);
        setTaskMonthlyStats([]);
      }

      // 6. Overdue ratio
      const totalTasks =
        currentRole === "user" && userStats
          ? userStats.assignedTasks
          : orgStats?.totalTasks || 0;
      const overdueCount = overdueTasks.length;
      setOverdueRatio(
        totalTasks > 0 ? `${Math.round((overdueCount / totalTasks) * 100)}%` : "0%"
      );

      // --- Refactor: Use view for oldest open tasks for managers/team managers ---
      let oldestOpenTasksData = [];
      if (filteredRole === "manager" || filteredRole === "team_manager") {
        oldestOpenTasksData = await fetchManagerOldestOpenTasks(nextTaskFilter);
      } else {
        // Default: users/admins  
        try {
          const allTasks = await apiClient.getTasks();
          let filteredTasks = allTasks.filter((task: any) => task.status !== "completed");
          
          // Apply filter if needed
          if (nextTaskFilter.column) {
            if (nextTaskFilter.op === "in") {
              filteredTasks = filteredTasks.filter((task: any) => 
                nextTaskFilter.value.includes(task[nextTaskFilter.column])
              );
            } else if (nextTaskFilter.op === "eq") {
              filteredTasks = filteredTasks.filter((task: any) => 
                task[nextTaskFilter.column] === nextTaskFilter.value
              );
            }
          }
          
          // Sort and limit to 5
          oldestOpenTasksData = filteredTasks
            .sort((a: any, b: any) => {
              if (a.due_date && b.due_date) {
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
              }
              if (a.due_date && !b.due_date) return -1;
              if (!a.due_date && b.due_date) return 1;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            })
            .slice(0, 5);
        } catch (error) {
          console.error('Failed to fetch oldest open tasks:', error);
          oldestOpenTasksData = [];
        }
      }
      setOldestOpenTasks(oldestOpenTasksData);

      // ---------- FETCH MANAGERS/TEAM_MANAGERS WITHOUT TEAMS (For ADMIN) ----------
      if (filteredRole === "admin") {
        try {
          // 1. Get all roles and find manager/team_manager IDs
          const allRoles = await apiClient.getRoles();
          const managerRoleIds = allRoles
            .filter((role: any) => role.name === "manager" || role.name === "team_manager")
            .map((role: any) => role.id);

          // 2. Get all users and their roles
          const allUsers = await apiClient.getUsers();
          const managerUserIds: string[] = [];
          
          for (const user of allUsers) {
            try {
              const userRoles = await apiClient.getUserRoles(user.id);
              const hasManagerRole = userRoles.some((ur: any) => 
                managerRoleIds.includes(ur.role_id)
              );
              if (hasManagerRole) {
                managerUserIds.push(user.id);
              }
            } catch (error) {
              // Skip users with role fetch errors
            }
          }

          // 3. Check which managers don't have teams
          const managersWithoutTeams: any[] = [];
          for (const userId of managerUserIds) {
            try {
              const teamMembers = await apiClient.getTeamMembers(userId);
              if (!teamMembers || teamMembers.length === 0) {
                const user = allUsers.find((u: any) => u.id === userId);
                if (user) {
                  managersWithoutTeams.push(user);
                }
              }
            } catch (error) {
              // If can't fetch team info, assume no teams
              const user = allUsers.find((u: any) => u.id === userId);
              if (user) {
                managersWithoutTeams.push(user);
              }
            }
          }

          setManagersWithoutTeams(managersWithoutTeams);
        } catch (error) {
          console.error('Failed to fetch managers without teams:', error);
          setManagersWithoutTeams([]);
        }
      }

      setLoading(false);
    }
    
    setup();
    // eslint-disable-next-line
  }, [user, roles, teams]);

  // --- FIX: Move "No Role Assigned" UI to a local variable ---
  let noRoleAssignedUI = null;
  if ((currentRole === "unknown" || !currentRole) && !rolesLoading) {
    // More explicit debug info:
    noRoleAssignedUI = (
      <div className="max-w-2xl mx-auto text-center mt-16">
        <div className="text-xl font-bold mb-2">No Role Assigned</div>
        <div className="text-muted-foreground mb-4">
          Unable to find one of: admin, manager, team_manager, user for account <b>{user?.email}</b>.
          <br />
          <pre className="text-xs bg-gray-100 rounded p-2 mt-2 text-left">{JSON.stringify({ roles, user }, null, 2)}</pre>
        </div>
      </div>
    );
  }

  if (loading || rolesLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-80">
        <Loader2 className="animate-spin mb-2 w-10 h-10 text-primary" />
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  // Move the original "No Role Assigned" return here as a conditional block
  if (noRoleAssignedUI) {
    return noRoleAssignedUI;
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
      {/* --- Admin: show managers/team_managers without team --- */}
      {currentRole === "admin" &&
        managersWithoutTeams.length > 0 &&
        showManagersNoTeamsAlert && (
          <Alert variant="destructive" className="mb-6 flex items-start relative pr-9">
            <button
              type="button"
              className="absolute top-3.5 right-4 cursor-pointer rounded-full p-1 hover:bg-red-100 focus:bg-red-200 focus:outline-none transition"
              aria-label="Dismiss"
              tabIndex={0}
              onClick={() => {
                console.log("Dismiss managers alert clicked");
                setShowManagersNoTeamsAlert(false);
              }}
            >
              <X size={20} />
            </button>
            <div>
              <AlertTitle>
                Some managers are not assigned to any team
              </AlertTitle>
              <AlertDescription>
                The following manager(s) and team manager(s) do not belong to any team. Assign them to a team so they can manage tasks and view proper dashboard stats.
                <ul className="mt-2 ml-4 list-disc text-sm">
                  {managersWithoutTeams.map((mgr) => (
                    <li key={mgr.id}>
                      <Badge variant="secondary" className="mr-2">{mgr.user_name || "Unnamed"}</Badge>
                      <span className="text-muted-foreground">{mgr.email}</span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </div>
          </Alert>
      )}

      <h1 className="text-2xl font-bold mb-5">
        Dashboard
      </h1>

      {/* ADMIN/MANAGER/TEAM_MANAGER */}
      {(currentRole === "admin" || currentRole === "manager" || currentRole === "team_manager") && (
        <>
          {/* --- ADD KPI CARDS: Use AnalyticsKPICards for all privileged roles --- */}
          {orgStats && (
            <AnalyticsKPICards
              totalTasks={orgStats.totalTasks}
              completedTasks={orgStats.completedTasks}
              overdueTasks={overdueTasks.length}
              activeUsers={orgStats.users}
            />
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
                      <li
                        key={t.id}
                        className="py-2 text-sm grid grid-cols-3 gap-2 items-center"
                      >
                        <span className="col-span-1 font-medium truncate">{t.title}</span>
                        <span className="col-span-1">
                          Due:{" "}
                          {t.due_date ? (
                            <span>{t.due_date}</span>
                          ) : (
                            <span className="text-muted-foreground">No due date</span>
                          )}
                        </span>
                        <span className="col-span-1 flex items-center gap-2">
                          {priorityLabel(t.priority)}
                          <button
                            className="ml-2 text-blue-600 underline text-xs font-medium hover:text-blue-800"
                            onClick={() => {
                              setDetailsTask(t);
                              setDetailsOpen(true);
                            }}
                            type="button"
                          >
                            View task
                          </button>
                        </span>
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
      {currentRole === "user" && userStats && (
        <>
          <div className="flex flex-wrap gap-4 mb-7">
            <StatCard label="Assigned Tasks" value={userStats.assignedTasks} />
            <StatCard label="Completed" value={userStats.completed} />
            <StatCard label="Pending" value={userStats.pending} />
            <StatCard label="New Tasks" value={userStats.new} />
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
                      <li
                        key={t.id}
                        className="py-2 text-sm grid grid-cols-3 gap-2 items-center"
                      >
                        <span className="col-span-1 font-medium truncate">{t.title}</span>
                        <span className="col-span-1">
                          Due:{" "}
                          {t.due_date ? (
                            <span>{t.due_date}</span>
                          ) : (
                            <span className="text-muted-foreground">No due date</span>
                          )}
                        </span>
                        <span className="col-span-1 flex items-center gap-2">
                          {priorityLabel(t.priority)}
                          <button
                            className="ml-2 text-blue-600 underline text-xs font-medium hover:text-blue-800"
                            onClick={() => {
                              setDetailsTask(t);
                              setDetailsOpen(true);
                            }}
                            type="button"
                          >
                            View task
                          </button>
                        </span>
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

      {/* --- TaskDetailsSheet Drawer --- */}
      <TaskDetailsSheet
        task={detailsTask}
        open={detailsOpen}
        onOpenChange={(open: boolean) => setDetailsOpen(open)}
        currentUser={{ id: userId, role: currentRole }}
        onUpdated={() => {
          // When details update, re-fetch oldest open tasks etc
          // Optionally: could refetch all stats, but for now just reload all
          window.location.reload();
          // Or -- refactor in future for more efficient reload!
        }}
      />
    </div>
  );
};

export default AdminDashboard;
