
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "../ui/sidebar";
import { FileText, ChartBar, AlertTriangle } from "lucide-react";

export default function ReportsMenu({ isUserOnly, collapsed }: { isUserOnly: boolean, collapsed: boolean }) {
  const location = useLocation();
  return (
    <SidebarGroup className="mt-6">
      <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2 px-3">
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
                  "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 group " +
                  (isActive 
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md font-medium" 
                    : "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground font-medium text-sidebar-foreground/80"
                  )
                }
              >
                <FileText className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${location.pathname.startsWith("/admin/reports/task") ? "text-white" : ""}`} />
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
                  "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 group " +
                  (isActive 
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md font-medium" 
                    : "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground font-medium text-sidebar-foreground/80"
                  )
                }
              >
                <AlertTriangle className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${location.pathname.startsWith("/admin/reports/overdue") ? "text-white" : ""}`} />
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
                  "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 group " +
                  (isActive 
                    ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md font-medium" 
                    : "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground font-medium text-sidebar-foreground/80"
                  )
                }
              >
                <ChartBar className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${location.pathname.startsWith("/admin/reports/analytics") ? "text-white" : ""}`} />
                {!collapsed && <span>Analytics Report</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
