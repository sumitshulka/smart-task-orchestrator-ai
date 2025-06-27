
import React from "react";
import Logo from "../Logo";
import { useSidebar } from "../ui/sidebar";

export default function SidebarHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className="flex-1">
      <Logo collapsed={collapsed} />
    </div>
  );
}
