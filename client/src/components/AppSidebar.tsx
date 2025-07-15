
import React from "react";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent
} from "@/components/ui/sidebar";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import DashboardMenu from "./AppSidebarParts/DashboardMenu";
import TaskManagementMenu from "./AppSidebarParts/TaskManagementMenu";
import ManagementMenu from "./AppSidebarParts/ManagementMenu";
import ReportsMenu from "./AppSidebarParts/ReportsMenu";
import WarningNoTeams from "./AppSidebarParts/WarningNoTeams";

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
    <Sidebar
      className="w-64 flex flex-col h-full"
      collapsible="none"
      style={{ 
        backgroundColor: '#f8fafc', 
        borderRight: '1px solid #e2e8f0',
        height: 'calc(100% - 56px)',
        marginTop: '56px'
      }}
    >
      {/* Scrollable content with menu items */}
      <SidebarContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-4 bg-[#e3e2de]" style={{ paddingTop: '16px' }}>
        <div className="space-y-2">
          <DashboardMenu isUserOnly={isUserOnly} collapsed={false} />
          <TaskManagementMenu collapsed={false} />
          <ManagementMenu isAdmin={isAdmin} isManager={isManager} collapsed={false} />
          <WarningNoTeams isOnTeams={isOnTeams} loading={loading} isUserOnly={isUserOnly} hasTeams={hasTeams} />
          <ReportsMenu isUserOnly={isUserOnly} collapsed={false} />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
