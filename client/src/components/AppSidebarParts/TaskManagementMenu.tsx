
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { CheckSquare, FolderOpen, User, History, Clock } from "lucide-react";

export default function TaskManagementMenu({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Task Management</div>
      <div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          <li className="group/menu-item relative">
            <NavLink
              to="/tasks"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Tasks</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/task-groups"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Task Groups</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/my-tasks"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <User className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">My Tasks</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/historical-tasks"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <History className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Historical Tasks</span>}
            </NavLink>
          </li>
        </ul>
      </div>
    </div>
  );
}
