import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Home } from "lucide-react";

const link = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow-md shadow-indigo-900/40 outline-none"
    : "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white transition-all duration-150 outline-none";

export default function DashboardMenu({ isUserOnly, collapsed }: { isUserOnly: boolean; collapsed: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pb-1 pt-2">Main</p>
      <ul className="space-y-0.5">
        <li>
          <NavLink to="/my-workspace" end className={link}>
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">My Workspace</span>}
          </NavLink>
        </li>
        <li>
          <NavLink to="/admin/dashboard" end className={link}>
            <Home className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Dashboard</span>}
          </NavLink>
        </li>
      </ul>
    </div>
  );
}
