import React from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-4 bg-muted/50" style={{ marginLeft: '0px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}