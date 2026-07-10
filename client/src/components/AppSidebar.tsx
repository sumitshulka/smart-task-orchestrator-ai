import React from "react";
import { useLocation } from "react-router-dom";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import DashboardMenu from "./AppSidebarParts/DashboardMenu";
import TaskManagementMenu from "./AppSidebarParts/TaskManagementMenu";
import SidebarHeader from "./AppSidebarParts/SidebarHeader";
import ManagementMenu from "./AppSidebarParts/ManagementMenu";
import ReportsMenu from "./AppSidebarParts/ReportsMenu";
import WarningNoTeams from "./AppSidebarParts/WarningNoTeams";
import ProjectManagementMenu from "./AppSidebarParts/ProjectManagementMenu";
import DefectManagementMenu from "./AppSidebarParts/DefectManagementMenu";

export default function AppSidebar() {
  const location = useLocation();
  const { roles, teams, loading } = useCurrentUserRoleAndTeams();

  const { data: settings } = useQuery({
    queryKey: ["/api/organization-settings"],
    queryFn: () => apiClient.get("/organization-settings"),
  });

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager") || roles.includes("team_manager");
  const isUserOnly = !isAdmin && !isManager && roles.includes("user");

  const projectManagementEnabled = settings?.project_management_enabled ?? false;
  const defectManagementEnabled = settings?.defect_management_enabled ?? false;

  const isOnTeams = location.pathname.startsWith("/admin/teams");
  const hasTeams = teams.length > 0;

  return (
    <div className="w-64 flex flex-col h-full" style={{ background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

      {/* ── Logo / brand header ── */}
      <div
        className="hidden lg:flex items-center px-5 flex-shrink-0"
        style={{ height: "56px", minHeight: "56px", background: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <span className="text-white font-bold text-sm">#</span>
          </div>
          <div>
            <span className="text-white font-semibold text-base tracking-tight">TaskRep</span>
            <p className="text-slate-500 text-[10px] leading-none mt-0.5">Task Management</p>
          </div>
        </div>
      </div>

      {/* ── Scrollable nav ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1"
        style={{ background: "#0f172a" }}
      >
        <DashboardMenu isUserOnly={isUserOnly} collapsed={false} />
        <TaskManagementMenu isAdmin={isAdmin} isManager={isManager} collapsed={false} />
        {projectManagementEnabled && <ProjectManagementMenu collapsed={false} />}
        {defectManagementEnabled && <DefectManagementMenu collapsed={false} />}
        <ManagementMenu isAdmin={isAdmin} isManager={isManager} collapsed={false} />
        <WarningNoTeams isOnTeams={isOnTeams} loading={loading} isUserOnly={isUserOnly} hasTeams={hasTeams} />
        <ReportsMenu isUserOnly={isUserOnly} collapsed={false} />
      </div>
    </div>
  );
}
