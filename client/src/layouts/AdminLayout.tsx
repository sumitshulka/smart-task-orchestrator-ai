
import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SidebarProvider>
    <div className="flex w-full h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full ml-64" style={{ position: 'relative' }}>
        <Topbar />
        <SidebarInset className="flex-1 w-full max-w-none p-0 overflow-auto">
          {children}
        </SidebarInset>
      </div>
    </div>
  </SidebarProvider>
);

export default AdminLayout;
