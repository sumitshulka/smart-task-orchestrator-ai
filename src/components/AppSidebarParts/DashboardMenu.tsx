
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "../ui/sidebar";
import { LayoutDashboard, Users2 } from "lucide-react";

export default function DashboardMenu({ isUserOnly, collapsed }: { isUserOnly: boolean, collapsed: boolean }) {
  const location = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/dashboard")}>
              <NavLink
                to="/admin/dashboard"
                end
                className={({ isActive }) =>
                  "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 group " +
                  (isActive 
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md font-medium" 
                    : "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground font-medium text-sidebar-foreground/80"
                  )
                }
              >
                <LayoutDashboard className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${location.pathname.startsWith("/admin/dashboard") ? "text-white" : ""}`} />
                {!collapsed && <span>Dashboard</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isUserOnly && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname.startsWith("/my-teams")}>
                <NavLink
                  to="/my-teams"
                  end
                  className={({ isActive }) =>
                    "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 group " +
                    (isActive 
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md font-medium" 
                      : "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground font-medium text-sidebar-foreground/80"
                    )
                  }
                >
                  <Users2 className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${location.pathname.startsWith("/my-teams") ? "text-white" : ""}`} />
                  {!collapsed && <span>My Teams</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
