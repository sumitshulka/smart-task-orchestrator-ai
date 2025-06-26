
import React from "react";
import Logo from "../Logo";
import { useSidebar } from "../ui/sidebar";

export default function SidebarHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className="border-b border-sidebar-border pb-1 mb-2">
      <Logo collapsed={collapsed} />
    </div>
  );
}
