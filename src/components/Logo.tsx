
import React from "react";
import { LayoutDashboard } from "lucide-react";

const Logo: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => (
  <div className="flex items-center">
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2">
      <LayoutDashboard className="w-5 h-5 text-white" />
    </div>
    {!collapsed && (
      <span className="text-lg font-semibold text-gray-800">
        IntraHub
      </span>
    )}
  </div>
);

export default Logo;
