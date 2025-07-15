import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { CheckSquare, Users, History, UserCheck } from "lucide-react";

interface TaskManagementMenuProps {
  collapsed: boolean;
}

export default function TaskManagementMenu({ collapsed }: TaskManagementMenuProps) {
  const location = useLocation();

  return (
    <div className="relative flex w-full min-w-0 flex-col p-2">
      <div className={`flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ${collapsed ? "opacity-0" : ""}`}>
        Task Management
      </div>
      <div className="w-full text-sm">
        <ul className="flex w-full min-w-0 flex-col gap-1">
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/tasks"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 " +
                (isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "")
              }
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Tasks</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/task-groups"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 " +
                (isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "")
              }
            >
              <Users className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Task Groups</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/my-tasks"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 " +
                (isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "")
              }
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">My Tasks</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/historical-tasks"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 " +
                (isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "")
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