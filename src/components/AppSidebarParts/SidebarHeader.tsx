
import React from "react";
import Logo from "../Logo";
import { useSidebar } from "../ui/sidebar";

export default function SidebarHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'flex-1'}`}>
      <Logo collapsed={collapsed} />
    </div>
  );
}
