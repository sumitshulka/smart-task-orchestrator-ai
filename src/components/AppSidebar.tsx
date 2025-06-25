
import React from "react";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import SidebarHeader from "./AppSidebarParts/SidebarHeader";
import DashboardMenu from "./AppSidebarParts/DashboardMenu";
import TaskManagementMenu from "./AppSidebarParts/TaskManagementMenu";
import ManagementMenu from "./AppSidebarParts/ManagementMenu";
import ReportsMenu from "./AppSidebarParts/ReportsMenu";
import WarningNoTeams from "./AppSidebarParts/WarningNoTeams";

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
      className={`${collapsed ? "w-14" : "w-64 min-w-14"} bg-gradient-to-b from-sidebar to-sidebar/95 border-r border-sidebar-border/50`}
      collapsible="icon"
    >
      <SidebarTrigger className="m-2 self-end hover:bg-sidebar-accent/70 transition-colors duration-200 rounded-lg" />
      <SidebarContent className="px-2 py-1">
        <SidebarHeader />
        <div className="space-y-2">
          <DashboardMenu isUserOnly={isUserOnly} collapsed={collapsed} />
          <TaskManagementMenu collapsed={collapsed} />
          <ManagementMenu isAdmin={isAdmin} isManager={isManager} collapsed={collapsed} />
          <WarningNoTeams isOnTeams={isOnTeams} loading={loading} isUserOnly={isUserOnly} hasTeams={hasTeams} />
          <ReportsMenu isUserOnly={isUserOnly} collapsed={collapsed} />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
// NOTE: Now refactored for maintainability!
