
import React from "react";
import Logo from "../Logo";

export default function SidebarHeader() {
  const collapsed = false; // Since we removed collapsible functionality
  return (
    <div className={`h-full ${collapsed ? 'flex items-center justify-center w-full' : 'flex items-center'}`}>
      <Logo collapsed={collapsed} />
    </div>
  );
}
