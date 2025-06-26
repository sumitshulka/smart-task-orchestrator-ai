
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "../ui/sidebar";
import { FileText, ChartBar, AlertTriangle } from "lucide-react";

export default function ReportsMenu({ isUserOnly, collapsed }: { isUserOnly: boolean, collapsed: boolean }) {
  const location = useLocation();
  return (
    <SidebarGroup className="mt-6">
      <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wide mb-2 px-3">
        Reports
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/reports/task")}>
              <NavLink
                to="/admin/reports/task"
                end
                className={({ isActive }) =>
                  "flex items-center gap-3 py-2 px-3 rounded-md transition-colors duration-200 " +
                  (isActive 
                    ? "bg-blue-500 text-white font-medium" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <FileText className="w-4 h-4" />
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
                  "flex items-center gap-3 py-2 px-3 rounded-md transition-colors duration-200 " +
                  (isActive 
                    ? "bg-orange-500 text-white font-medium" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <AlertTriangle className="w-4 h-4" />
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
                  "flex items-center gap-3 py-2 px-3 rounded-md transition-colors duration-200 " +
                  (isActive 
                    ? "bg-purple-500 text-white font-medium" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <ChartBar className="w-4 h-4" />
                {!collapsed && <span>Analytics Report</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
