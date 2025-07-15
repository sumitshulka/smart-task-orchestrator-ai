import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { BarChart3, Home } from "lucide-react";

interface DashboardMenuProps {
  isUserOnly: boolean;
  collapsed: boolean;
}

export default function DashboardMenu({ isUserOnly, collapsed }: DashboardMenuProps) {
  const location = useLocation();

  return (
    <div className="relative flex w-full min-w-0 flex-col p-2">
      <div className={`flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ${collapsed ? "opacity-0" : ""}`}>
        Dashboard
      </div>
      <div className="w-full text-sm">
        <ul className="flex w-full min-w-0 flex-col gap-1">
          <li className="group/menu-item relative">
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 " +
                (isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "")
              }
            >
              <Home className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Dashboard</span>}
            </NavLink>
          </li>
          {!isUserOnly && (
            <li className="group/menu-item relative">
              <NavLink
                to="/admin/analytics"
                end
                className={({ isActive }) =>
                  "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 " +
                  (isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "")
                }
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">Analytics</span>}
              </NavLink>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}