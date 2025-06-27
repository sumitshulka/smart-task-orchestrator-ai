
import React from "react";
import { LayoutDashboard } from "lucide-react";

const Logo: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => (
  <div className="flex items-center">
    {collapsed ? (
      // Only show icon when collapsed, centered properly
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <LayoutDashboard className="w-5 h-5 text-white" />
      </div>
    ) : (
      // Show icon + text when expanded
      <>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-semibold text-gray-800">
          #TaskRep
        </span>
      </>
    )}
  </div>
);

export default Logo;
