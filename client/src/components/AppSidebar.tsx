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
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function AppSidebar({
  collapsed = false,
  canCollapse = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  canCollapse?: boolean;
  onToggleCollapse?: () => void;
}) {
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
    <div className="w-full flex flex-col h-full" style={{ background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

      {/* ── Logo / brand header ── */}
      <div
        className={`hidden lg:flex items-center flex-shrink-0 ${collapsed ? "justify-center px-2" : "px-5"}`}
        style={{ height: "56px", minHeight: "56px", background: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className={`flex items-center ${collapsed ? "" : "gap-3"}`} title={collapsed ? "TaskRep" : undefined}>
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <span className="text-white font-bold text-sm">#</span>
          </div>
          {!collapsed && <div>
            <span className="text-white font-semibold text-base tracking-tight">TaskRep</span>
            <p className="text-slate-500 text-[10px] leading-none mt-0.5">Task Management</p>
          </div>}
        </div>
      </div>

      {/* ── Scrollable nav ── */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1 ${collapsed ? "[&_p]:hidden [&_a]:!justify-center [&_a]:!px-2" : ""}`}
        style={{ background: "#0f172a" }}
      >
        <DashboardMenu isUserOnly={isUserOnly} collapsed={collapsed} />
        <TaskManagementMenu isAdmin={isAdmin} isManager={isManager} collapsed={collapsed} />
        {projectManagementEnabled && <ProjectManagementMenu collapsed={collapsed} />}
        {defectManagementEnabled && <DefectManagementMenu collapsed={collapsed} />}
        <ManagementMenu isAdmin={isAdmin} isManager={isManager} collapsed={collapsed} />
        <WarningNoTeams isOnTeams={isOnTeams} loading={loading} isUserOnly={isUserOnly} hasTeams={hasTeams} />
        <ReportsMenu isUserOnly={isUserOnly} collapsed={collapsed} />
      </div>

      {canCollapse && onToggleCollapse && (
        <div className="hidden lg:block border-t border-white/[0.08] p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand main menu" : "Collapse main menu"}
            title={collapsed ? "Expand main menu" : "Collapse main menu"}
            className="flex w-full items-center justify-center rounded-lg px-2 py-2 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span className="ml-2 text-xs">Collapse menu</span>}
          </button>
        </div>
      )}
    </div>
  );
}
