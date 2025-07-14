
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "../ui/sidebar";
import { LayoutDashboard, Users2 } from "lucide-react";

export default function DashboardMenu({ isUserOnly, collapsed }: { isUserOnly: boolean, collapsed: boolean }) {
  const location = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/dashboard")}>
              <NavLink
                to="/admin/dashboard"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <LayoutDashboard className="w-5 h-5" />
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
                    "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                    (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                  }
                >
                  <Users2 className="w-5 h-5" />
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
