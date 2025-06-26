
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
                  "flex items-center gap-3 py-2 px-3 rounded-md transition-colors duration-200 " +
                  (isActive 
                    ? "bg-blue-500 text-white font-medium" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <LayoutDashboard className="w-4 h-4" />
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
                    "flex items-center gap-3 py-2 px-3 rounded-md transition-colors duration-200 " +
                    (isActive 
                      ? "bg-blue-500 text-white font-medium" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )
                  }
                >
                  <Users2 className="w-4 h-4" />
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
