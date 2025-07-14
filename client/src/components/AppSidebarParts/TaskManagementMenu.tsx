
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "../ui/sidebar";
import { ClipboardList, FolderKanban, UserCheck, History } from "lucide-react";

export default function TaskManagementMenu({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Task Management</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/tasks")}>
              <NavLink
                to="/admin/tasks"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <ClipboardList className="w-5 h-5" />
                {!collapsed && <span>Tasks</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/task-groups")}>
              <NavLink
                to="/admin/task-groups"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <FolderKanban className="w-5 h-5" />
                {!collapsed && <span>Task Groups</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/my-tasks")}>
              <NavLink
                to="/admin/my-tasks"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <UserCheck className="w-5 h-5" />
                {!collapsed && <span>My Tasks</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/historical-tasks")}>
              <NavLink
                to="/admin/historical-tasks"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <History className="w-5 h-5" />
                {!collapsed && <span>Historical Tasks</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
