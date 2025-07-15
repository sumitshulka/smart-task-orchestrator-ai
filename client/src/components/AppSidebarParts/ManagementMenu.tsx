
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { Users2, Users, ShieldCheck, Archive } from "lucide-react";

export default function ManagementMenu({ isAdmin, isManager, collapsed }: { isAdmin: boolean, isManager: boolean, collapsed: boolean }) {
  const location = useLocation();
  if (!(isAdmin || isManager)) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2 text-[#021133]">Management</div>
      <div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {isAdmin && (
            <li className="group/menu-item relative">
              <NavLink
                to="/admin/users"
                end
                className={({ isActive }) =>
                  "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                  (isActive ? "bg-gray-100 font-medium" : "")
                }
              >
                <Users2 className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">User Management</span>}
              </NavLink>
            </li>
          )}
          {isAdmin && (
            <li className="group/menu-item relative">
              <NavLink
                to="/admin/deleted-users"
                end
                className={({ isActive }) =>
                  "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                  (isActive ? "bg-gray-100 font-medium" : "")
                }
              >
                <Archive className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">Deleted Users</span>}
              </NavLink>
            </li>
          )}
          <li className="group/menu-item relative">
            <NavLink
              to="/admin/teams"
              end
              className={({ isActive }) =>
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                (isActive ? "bg-gray-100 font-medium" : "")
              }
            >
              <Users className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Team Management</span>}
            </NavLink>
          </li>
          {isAdmin && (
            <li className="group/menu-item relative">
              <NavLink
                to="/admin/role-permissions"
                end
                className={({ isActive }) =>
                  "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                  (isActive ? "bg-gray-100 font-medium" : "")
                }
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">Roles & Privileges</span>}
              </NavLink>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
