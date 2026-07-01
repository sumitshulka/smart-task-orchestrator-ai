import React from "react";
import { NavLink } from "react-router-dom";
import { FileText, AlertTriangle, BarChart3, TrendingUp, SlidersHorizontal, Settings } from "lucide-react";
import { useRolePermissions } from "@/hooks/useRolePermissions";

const link = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow-md shadow-indigo-900/40 outline-none"
    : "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white transition-all duration-150 outline-none";

export default function ReportsMenu({ isUserOnly, collapsed }: { isUserOnly: boolean; collapsed: boolean }) {
  const { canViewSettings } = useRolePermissions();
  if (isUserOnly) return null;

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pb-1 pt-3">Reports</p>
      <ul className="space-y-0.5">
        <li><NavLink to="/admin/reports/task" end className={link}><FileText className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Task Report</span>}</NavLink></li>
        <li><NavLink to="/admin/reports/overdue" end className={link}><AlertTriangle className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Overdue Report</span>}</NavLink></li>
        <li><NavLink to="/admin/reports/analytics" end className={link}><BarChart3 className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Analytics Report</span>}</NavLink></li>
        <li><NavLink to="/admin/reports/benchmarking" end className={link}><TrendingUp className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Benchmarking Report</span>}</NavLink></li>
        <li><NavLink to="/admin/reports/custom-fields" end className={link}><SlidersHorizontal className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Custom Field Report</span>}</NavLink></li>
        {canViewSettings && (
          <li>
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <NavLink to="/admin/settings" end className={link}><Settings className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Settings</span>}</NavLink>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
