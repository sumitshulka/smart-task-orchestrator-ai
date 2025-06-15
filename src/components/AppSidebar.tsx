import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Users2, 
  Users,         
  ShieldCheck, 
  ClipboardList, 
  ListTodo, 
  History,
  FileText,
  ChartBar
} from "lucide-react";
import Logo from "./Logo";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

export default function AppSidebar() {
  const location = useLocation();
  const { roles, teams, loading } = useCurrentUserRoleAndTeams();

  // Simple role helpers
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager") || roles.includes("team_manager");
  const isUserOnly = !isAdmin && !isManager && roles.includes("user");

  // Teams logic for warning
  const isOnTeams = location.pathname.startsWith("/admin/teams");
  const hasTeams = teams.length > 0;

  return (
    <Sidebar className="w-64 min-w-14">
      <SidebarTrigger className="m-2 self-end" />
      <SidebarContent>
        <div className="border-b pb-2 mb-2">
          <Logo />
        </div>
        {/* Dashboard - ungrouped */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/dashboard")}>
                  <NavLink
                    to="/admin/dashboard"
                    end
                    className={({ isActive }) =>
                      "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                      (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                    }
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span className="hidden md:inline">Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Task Management Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Task Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/tasks")}>
                  <NavLink
                    to="/admin/tasks"
                    end
                    className={({ isActive }) =>
                      "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                      (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                    }
                  >
                    <ClipboardList className="w-5 h-5" />
                    <span className="hidden md:inline">Tasks</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/my-tasks")}>
                  <NavLink
                    to="/admin/my-tasks"
                    end
                    className={({ isActive }) =>
                      "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                      (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                    }
                  >
                    <ListTodo className="w-5 h-5" />
                    <span className="hidden md:inline">My Tasks</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/historical-tasks")}>
                  <NavLink
                    to="/admin/historical-tasks"
                    end
                    className={({ isActive }) =>
                      "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                      (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                    }
                  >
                    <History className="w-5 h-5" />
                    <span className="hidden md:inline">Historical Tasks</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management Section */}
        {(isAdmin || isManager) && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/users")}>
                      <NavLink
                        to="/admin/users"
                        end
                        className={({ isActive }) =>
                          "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                          (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                        }
                      >
                        <Users2 className="w-5 h-5" />
                        <span className="hidden md:inline">User Management</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {/* Team Management: visible to Admins, Managers, Users */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/teams")}>
                    <NavLink
                      to="/admin/teams"
                      end
                      className={({ isActive }) =>
                        "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                        (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                      }
                    >
                      <Users className="w-5 h-5" />
                      <span className="hidden md:inline">Team Management</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/roles")}>
                      <NavLink
                        to="/admin/roles"
                        end
                        className={({ isActive }) =>
                          "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                          (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                        }
                      >
                        <ShieldCheck className="w-5 h-5" />
                        <span className="hidden md:inline">Roles and Privileges</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* If the user is on /admin/teams and has NO team assignment, show warning */}
        {isOnTeams && !loading && isUserOnly && !hasTeams && (
          <div className="p-3 my-3 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded">
            <b>Warning:</b> You are not assigned to any team. Please contact your admin to get assigned to a team.
          </div>
        )}

        {/* Reports Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Reports</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Only admins and managers can see Task Report for all users */}
              {(isAdmin || isManager) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/reports/task")}>
                    <NavLink
                      to="/admin/reports/task"
                      end
                      className={({ isActive }) =>
                        "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                        (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                      }
                    >
                      <FileText className="w-5 h-5" />
                      <span className="hidden md:inline">Task Report</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {/* Analytics: visible to everyone */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/reports/analytics")}>
                  <NavLink
                    to="/admin/reports/analytics"
                    end
                    className={({ isActive }) =>
                      "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                      (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                    }
                  >
                    <ChartBar className="w-5 h-5" />
                    <span className="hidden md:inline">Analytics Report</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// NOTE: src/components/AppSidebar.tsx is now 211+ lines long; consider splitting out menu logic if you want maintainability.
