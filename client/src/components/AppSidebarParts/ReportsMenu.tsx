
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { FileText, AlertTriangle, Settings, BarChart3, TrendingUp } from "lucide-react";

export default function ReportsMenu({ isUserOnly, collapsed }: { isUserOnly: boolean, collapsed: boolean }) {
  const location = useLocation();
  if (isUserOnly) return null;

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2 text-[#021133]">Reports</div>
      <div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/reports/task"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <FileText className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Task Report</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/reports/overdue"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Overdue Report</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/reports/analytics"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Analytics Report</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/reports/benchmarking"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Benchmarking Report</span>}
            </NavLink>
          </li>
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/settings"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Settings</span>}
            </NavLink>
          </li>
        </ul>
      </div>
    </div>
  );
}
