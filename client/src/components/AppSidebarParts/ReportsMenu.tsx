
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "../ui/sidebar";
import { FileText, ChartBar, AlertTriangle } from "lucide-react";

export default function ReportsMenu({ isUserOnly, collapsed }: { isUserOnly: boolean, collapsed: boolean }) {
  const location = useLocation();
  return (
    <SidebarGroup className="mt-6">
      <SidebarGroupLabel>REPORTS</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/reports/task")}>
              <NavLink
                to="/admin/reports/task"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <FileText className="w-5 h-5" />
                {!collapsed && (
                  <span>
                    {isUserOnly ? "My Task Report" : "Task Report"}
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/reports/overdue")}>
              <NavLink
                to="/admin/reports/overdue"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <AlertTriangle className="w-5 h-5" />
                {!collapsed && <span>Overdue Report</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/reports/analytics")}>
              <NavLink
                to="/admin/reports/analytics"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <ChartBar className="w-5 h-5" />
                {!collapsed && <span>Analytics Report</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
