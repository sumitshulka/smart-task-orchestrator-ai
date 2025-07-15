import React from "react";
import { useLocation } from "react-router-dom";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import DashboardMenu from "./AppSidebarParts/DashboardMenu";
import TaskManagementMenu from "./AppSidebarParts/TaskManagementMenu";
import SidebarHeader from "./AppSidebarParts/SidebarHeader";
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
    <div 
      className="w-64 flex flex-col h-full bg-sidebar text-sidebar-foreground"
      style={{ 
        backgroundColor: '#f8fafc', 
        borderRight: '1px solid #e2e8f0'
      }}
    >
      {/* Header section with logo */}
      <div 
        className="flex items-center px-6 border-b border-gray-200 bg-[#66655833]" 
        style={{ height: '56px', minHeight: '56px', maxHeight: '56px' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">#</span>
          </div>
          <span className="text-lg font-semibold text-gray-800">
            TaskRep
          </span>
        </div>
      </div>

      {/* Scrollable content with menu items */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-4 bg-[#e3e2de]" style={{ paddingTop: '16px' }}>
        <div className="space-y-2">
          <DashboardMenu isUserOnly={isUserOnly} collapsed={false} />
          <TaskManagementMenu collapsed={false} />
          <ManagementMenu isAdmin={isAdmin} isManager={isManager} collapsed={false} />
          <WarningNoTeams isOnTeams={isOnTeams} loading={loading} isUserOnly={isUserOnly} hasTeams={hasTeams} />
          <ReportsMenu isUserOnly={isUserOnly} collapsed={false} />
        </div>
      </div>
    </div>
  );
}