
import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SidebarProvider>
    <div className="flex w-full h-screen bg-background overflow-hidden">
      {/* Fixed header across the top */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Topbar />
      </div>
      
      {/* Main content area with sidebar and content */}
      <div className="flex w-full h-full pt-14"> {/* pt-14 to account for fixed header */}
        <AppSidebar />
        <SidebarInset className="flex-1 w-full max-w-none p-0 overflow-auto">
          {children}
        </SidebarInset>
      </div>
    </div>
  </SidebarProvider>
);

export default AdminLayout;
