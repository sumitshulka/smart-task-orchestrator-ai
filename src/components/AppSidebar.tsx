
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
  useSidebar
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Users2, 
  Users,         
  ShieldCheck, 
  ClipboardList, 
  FolderKanban, // Use for Task Groups
  UserCheck,    // Use for My Tasks
  History,
  FileText,
  ChartBar
} from "lucide-react";
import Logo from "./Logo";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

export default function AppSidebar() {
  const location = useLocation();
  const { roles, teams, loading } = useCurrentUserRoleAndTeams();
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === "collapsed";

  // Simple role helpers
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager") || roles.includes("team_manager");
  const isUserOnly = !isAdmin && !isManager && roles.includes("user");

  // Teams logic for warning
  const isOnTeams = location.pathname.startsWith("/admin/teams");
  const hasTeams = teams.length > 0;

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-64 min-w-14"}
      collapsible
      data-collapsible="icon"
    >
      {/* SidebarTrigger inside sidebar for accessibility */}
      <SidebarTrigger className="m-2 self-end" />
      <SidebarContent>
        {/* App name/logo should always be visible, with size depending on collapse */}
        <div className="border-b pb-2 mb-2 flex items-center justify-center">
          <Logo collapsed={collapsed} />
        </div>
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
                    {/* Only show text when not collapsed */}
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isUserOnly && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith("/my-teams")}>
                    <NavLink
                      to="/my-teams"
                      end
                      className={({ isActive }) =>
                        "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                        (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                      }
                    >
                      <Users2 className="w-5 h-5" />
                      {!collapsed && <span>My Teams</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
                    {!collapsed && <span>Tasks</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* DIFFERENT ICON FOR TASK GROUPS */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/task-groups")}>
                  <NavLink
                    to="/admin/task-groups"
                    end
                    className={({ isActive }) =>
                      "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                      (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                    }
                  >
                    <FolderKanban className="w-5 h-5" />
                    {!collapsed && <span>Task Groups</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* DIFFERENT ICON FOR MY TASKS */}
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
                    <UserCheck className="w-5 h-5" />
                    {!collapsed && <span>My Tasks</span>}
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
                    {!collapsed && <span>Historical Tasks</span>}
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
                        {!collapsed && <span>User Management</span>}
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
                      {!collapsed && <span>Team Management</span>}
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
                        {!collapsed && <span>Roles and Privileges</span>}
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
              {/* Task Report: Now visible to ALL users */}
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
                    {!collapsed && (
                      <span>
                        {isUserOnly ? "My Task Report" : "Task Report"}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
                    {!collapsed && <span>Analytics Report</span>}
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

// NOTE: src/components/AppSidebar.tsx is now over 277 lines and getting lengthy. Please consider refactoring for maintainability.

