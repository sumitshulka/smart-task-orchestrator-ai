
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "../ui/sidebar";
import { Users2, Users, ShieldCheck } from "lucide-react";

export default function ManagementMenu({ isAdmin, isManager, collapsed }: { isAdmin: boolean, isManager: boolean, collapsed: boolean }) {
  const location = useLocation();
  if (!(isAdmin || isManager)) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Management</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/users")}>
                <NavLink
                  to="/admin/users"
                  end
                  className={({ isActive }) =>
                    "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                    (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                  }
                >
                  <Users2 className="w-5 h-5" />
                  {!collapsed && <span>User Management</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/teams")}>
              <NavLink
                to="/admin/teams"
                end
                className={({ isActive }) =>
                  "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                  (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                }
              >
                <Users className="w-5 h-5" />
                {!collapsed && <span>Team Management</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/roles") && location.pathname === "/admin/roles"}>
                <NavLink
                  to="/admin/roles"
                  end
                  className={({ isActive }) =>
                    "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                    (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                  }
                >
                  <ShieldCheck className="w-5 h-5" />
                  {!collapsed && <span>Roles & Access</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin/role-permissions")}>
                <NavLink
                  to="/admin/role-permissions"
                  end
                  className={({ isActive }) =>
                    "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                    (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                  }
                >
                  <ShieldCheck className="w-5 h-5" />
                  {!collapsed && <span>Roles & Privileges</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
