
import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SidebarProvider>
    <div className="flex w-full min-h-screen">
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </div>
  </SidebarProvider>
);

export default AdminLayout;
