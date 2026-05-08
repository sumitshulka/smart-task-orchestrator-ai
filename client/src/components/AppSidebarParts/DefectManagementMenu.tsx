
import React from "react";
import { NavLink } from "react-router-dom";
import { Bug, Kanban, ClipboardList } from "lucide-react";

export default function DefectManagementMenu({ collapsed }: { collapsed: boolean }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
    (isActive ? "bg-gray-100 font-medium" : "");

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2 text-[#021133]">
        Defect Management
      </div>
      <div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          <li className="group/menu-item relative">
            <NavLink to="/defects" end className={linkClass}>
              <Bug className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Defects</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink to="/defects/board" className={linkClass}>
              <Kanban className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Defect Board</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink to="/defects/my" className={linkClass}>
              <ClipboardList className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">My Defects</span>}
            </NavLink>
          </li>
        </ul>
      </div>
    </div>
  );
}
