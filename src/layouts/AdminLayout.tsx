
import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SidebarProvider>
    <div className="flex w-full min-h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1">
        <div className="flex items-center h-14 border-b bg-white px-4">
          <div className="flex-1">
            <Topbar />
          </div>
        </div>
        <SidebarInset className="flex-1">{children}</SidebarInset>
      </div>
    </div>
  </SidebarProvider>
);

export default AdminLayout;
