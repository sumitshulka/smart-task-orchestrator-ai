import React from "react";
import { NavLink } from "react-router-dom";
import { CheckSquare, FolderOpen, User, History, Target, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

const link = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow-md shadow-indigo-900/40 outline-none"
    : "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white transition-all duration-150 outline-none";

interface Props {
  collapsed: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
}

export default function TaskManagementMenu({ collapsed, isAdmin = false, isManager = false }: Props) {
  const { data: settings } = useQuery({
    queryKey: ["/api/organization-settings"],
    queryFn: () => apiClient.get("/organization-settings"),
  });

  const canSeeDecisions = isAdmin || isManager;

  const { data: allDecisions = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/decisions/all"],
    queryFn: () => apiClient.get("/workspace/decisions/all"),
    enabled: canSeeDecisions,
  });

  const pendingCount = allDecisions.filter((d: any) => d.status === "pending").length;

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pb-1 pt-3">Task Management</p>
      <ul className="space-y-0.5">
        <li><NavLink to="/admin/tasks" end className={link}><CheckSquare className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Tasks</span>}</NavLink></li>
        <li><NavLink to="/admin/task-groups" end className={link}><FolderOpen className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Task Groups</span>}</NavLink></li>
        <li><NavLink to="/admin/my-tasks" end className={link}><User className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">My Tasks</span>}</NavLink></li>
        <li><NavLink to="/admin/historical-tasks" end className={link}><History className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Historical Tasks</span>}</NavLink></li>
        {settings?.benchmarking_enabled && (
          <li><NavLink to="/benchmarking" end className={link}><Target className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Benchmarking</span>}</NavLink></li>
        )}
        {canSeeDecisions && (
          <li>
            <NavLink to="/decisions" end className={link}>
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate flex-1">Decisions</span>}
              {!collapsed && pendingCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          </li>
        )}
      </ul>
    </div>
  );
}
