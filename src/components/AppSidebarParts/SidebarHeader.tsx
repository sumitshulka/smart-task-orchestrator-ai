
import React from "react";
import Logo from "../Logo";
import { useSidebar } from "../ui/sidebar";

export default function SidebarHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className="border-b border-gray-300 pb-2 mb-3">
      <Logo collapsed={collapsed} />
    </div>
  );
}
