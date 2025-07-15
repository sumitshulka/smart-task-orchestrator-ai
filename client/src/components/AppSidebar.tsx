
import React from "react";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
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
      className={`${collapsed ? "w-14" : "w-64 min-w-14"}`}
      collapsible="icon"
      style={{ backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <SidebarHeader />
      </div>
      <SidebarContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden px-2 py-4 bg-[#e3e2de]">
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
