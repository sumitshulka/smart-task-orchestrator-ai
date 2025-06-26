
import React from "react";
import { Menu } from "lucide-react";

const Logo: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => (
  <div
    className={`flex items-center transition-all duration-300 ${
      collapsed ? "justify-center px-2 py-4" : "px-4 py-4"
    }`}
  >
    <a
      href="/"
      className={`select-none font-bold tracking-tight text-blue-600 transition-all duration-300 ${
        collapsed ? "text-lg" : "text-xl"
      }`}
      aria-label="Go to homepage"
    >
      {collapsed ? (
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Menu className="w-4 h-4 text-white" />
        </div>
      ) : (
        "#smartask"
      )}
    </a>
  </div>
);

export default Logo;
