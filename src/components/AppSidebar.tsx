import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users2, UsersRound, ShieldCheck, ClipboardList, ListTodo, History } from "lucide-react"; // add LayoutDashboard icon
import Logo from "./Logo";

export default function AppSidebar() {
  const location = useLocation();
  const navItems = [
    {
      label: "Dashboard",
      to: "/admin/dashboard",
      Icon: LayoutDashboard,
    },
    {
      label: "User Management",
      to: "/admin/users",
      Icon: Users2,
    },
    {
      label: "Team Management",
      to: "/admin/teams",
      Icon: UsersRound,
    },
    {
      label: "Roles and Privileges",
      to: "/admin/roles",
      Icon: ShieldCheck,
    },
    {
      label: "Tasks",
      to: "/admin/tasks",
      Icon: ClipboardList,
    },
    {
      label: "My Tasks",
      to: "/admin/my-tasks",
      Icon: ListTodo,
    },
    {
      label: "Historical Tasks",
      to: "/admin/historical-tasks",
      Icon: History,
    },
  ];

  return (
    <Sidebar className="w-64 min-w-14">
      <SidebarTrigger className="m-2 self-end" />
      <SidebarContent>
        <div className="border-b pb-2 mb-2">
          <Logo />
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.to)}>
                    <NavLink
                      to={item.to}
                      end
                      className={({ isActive }) =>
                        "flex items-center gap-2 py-1.5 px-2 rounded transition " +
                        (isActive ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50")
                      }
                    >
                      <item.Icon className="w-5 h-5" />
                      <span className="hidden md:inline">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
