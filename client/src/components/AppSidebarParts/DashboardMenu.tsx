
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { Home, BarChart3 } from "lucide-react";

export default function DashboardMenu({ isUserOnly, collapsed }: { isUserOnly: boolean, collapsed: boolean }) {
  const location = useLocation();
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2 text-[#021133]">Dashboard</div>
      <div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/dashboard"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <Home className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Dashboard</span>}
            </NavLink>
          </li>

        </ul>
      </div>
    </div>
  );
}
