import React from "react";
import { NavLink } from "react-router-dom";
import { FolderKanban, Building2 } from "lucide-react";

const link = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow-md shadow-indigo-900/40 outline-none"
    : "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/[0.07] hover:text-white transition-all duration-150 outline-none";

export default function ProjectManagementMenu({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pb-1 pt-3">Project Management</p>
      <ul className="space-y-0.5">
        <li><NavLink to="/projects" end className={link}><FolderKanban className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Projects</span>}</NavLink></li>
        <li><NavLink to="/clients" end className={link}><Building2 className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Clients</span>}</NavLink></li>
      </ul>
    </div>
  );
}
