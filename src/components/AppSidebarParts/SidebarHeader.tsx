
import React from "react";
import Logo from "../Logo";
import { useSidebar } from "../ui/sidebar";

export default function SidebarHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className="border-b pb-2 mb-2 flex items-center justify-center">
      <Logo collapsed={collapsed} />
    </div>
  );
}
