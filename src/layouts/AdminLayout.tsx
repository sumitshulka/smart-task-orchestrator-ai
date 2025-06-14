
import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SidebarProvider>
    <div className="flex flex-col w-full min-h-screen">
      <Topbar />
      <div className="flex flex-1 w-full h-full">
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </div>
    </div>
  </SidebarProvider>
);

export default AdminLayout;
