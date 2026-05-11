
import React from "react";
import { NavLink } from "react-router-dom";
import { FolderKanban, Building2 } from "lucide-react";

export default function ProjectManagementMenu({ collapsed }: { collapsed: boolean }) {
  const links = [
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/clients",  label: "Clients",  icon: Building2 },
  ];

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2 text-[#021133]">Project Management</div>
      <div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <li key={to} className="group/menu-item relative">
              <NavLink
                to={to}
                end
                className={({ isActive }) =>
                  "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding] hover:bg-gray-100 focus-visible:ring-2 " +
                  (isActive ? "bg-gray-100 font-medium" : "")
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
