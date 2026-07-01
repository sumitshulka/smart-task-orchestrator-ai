import React from "react";
import { NavLink } from "react-router-dom";
import { Users2, Users, ShieldCheck, Archive, SlidersHorizontal } from "lucide-react";

const link = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow-md shadow-indigo-900/40 outline-none"
    : "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/[0.07] hover:text-white transition-all duration-150 outline-none";

export default function ManagementMenu({ isAdmin, isManager, collapsed }: { isAdmin: boolean; isManager: boolean; collapsed: boolean }) {
  if (!(isAdmin || isManager)) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pb-1 pt-3">Management</p>
      <ul className="space-y-0.5">
        {isAdmin && <li><NavLink to="/admin/users" end className={link}><Users2 className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">User Management</span>}</NavLink></li>}
        {isAdmin && <li><NavLink to="/admin/deleted-users" end className={link}><Archive className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Deleted Users</span>}</NavLink></li>}
        <li><NavLink to="/admin/teams" end className={link}><Users className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Team Management</span>}</NavLink></li>
        {isAdmin && <li><NavLink to="/admin/role-permissions" end className={link}><ShieldCheck className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Roles & Privileges</span>}</NavLink></li>}
        {isAdmin && <li><NavLink to="/admin/custom-fields" end className={link}><SlidersHorizontal className="w-4 h-4 shrink-0" />{!collapsed && <span className="truncate">Custom Fields</span>}</NavLink></li>}
      </ul>
    </div>
  );
}
