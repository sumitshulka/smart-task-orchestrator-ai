import React from "react";
import { NavLink } from "react-router-dom";
import { Bug, Kanban, ClipboardList } from "lucide-react";

const link = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow-md shadow-indigo-900/40 outline-none"
    : "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white transition-all duration-150 outline-none";

export default function DefectManagementMenu({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pb-1 pt-3">Defect Management</p>
      <ul className="space-y-0.5">
        <li><NavLink to="/defects" end className={link}><Bug className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Defects</span>}</NavLink></li>
        <li><NavLink to="/defects/board" className={link}><Kanban className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Defect Board</span>}</NavLink></li>
        <li><NavLink to="/defects/my" className={link}><ClipboardList className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">My Defects</span>}</NavLink></li>
      </ul>
    </div>
  );
}
