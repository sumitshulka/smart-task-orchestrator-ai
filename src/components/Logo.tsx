
import React from "react";
import { LayoutDashboard } from "lucide-react";

const Logo: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => (
  <div>
    {collapsed ? (
      // Only show icon when collapsed, perfectly centered
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <LayoutDashboard className="w-5 h-5 text-white" />
      </div>
    ) : (
      // Show icon + text when expanded, left aligned
      <div className="flex items-center">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-semibold text-gray-800">
          #TaskRep
        </span>
      </div>
    )}
  </div>
);

export default Logo;
