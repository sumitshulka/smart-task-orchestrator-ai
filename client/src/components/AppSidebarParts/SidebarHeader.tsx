
import React from "react";
import Logo from "../Logo";
import { useSidebar } from "../ui/sidebar";

export default function SidebarHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className={`h-full ${collapsed ? 'flex items-center justify-center w-full' : 'flex items-center'}`}>
      <Logo collapsed={collapsed} />
    </div>
  );
}
