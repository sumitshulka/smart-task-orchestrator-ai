
import React from "react";
import { Menu } from "lucide-react";

const Logo: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => (
  <div
    className={`flex items-center transition-all duration-300 ${
      collapsed ? "justify-center px-2 py-6" : "px-6 py-5"
    }`}
  >
    <a
      href="/"
      className={`select-none font-black tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 text-transparent bg-clip-text drop-shadow-sm transition-all duration-300 ${
        collapsed ? "text-xl" : "text-2xl md:text-3xl"
      }`}
      aria-label="Go to homepage"
      style={{ letterSpacing: "-0.03em" }}
    >
      {collapsed ? (
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center shadow-lg">
          <Menu className="w-5 h-5 text-white" />
        </div>
      ) : (
        "#smartask"
      )}
    </a>
  </div>
);

export default Logo;
