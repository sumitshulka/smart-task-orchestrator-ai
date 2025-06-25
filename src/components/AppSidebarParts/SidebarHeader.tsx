
import React from "react";
import Logo from "../Logo";
import { useSidebar } from "../ui/sidebar";

export default function SidebarHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className="border-b border-sidebar-border/50 pb-3 mb-4 flex items-center justify-center bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-lg mx-2">
      <Logo collapsed={collapsed} />
    </div>
  );
}
