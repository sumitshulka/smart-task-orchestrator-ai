
import React from "react";
import { Menu } from "lucide-react";

const Logo: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => (
  <div
    className={`flex items-center px-6 py-4 transition-all duration-200 ${
      collapsed ? "justify-center px-0 py-8" : ""
    }`}
  >
    <a
      href="/"
      className={`select-none font-black tracking-tight bg-gradient-to-r from-blue-600 via-blue-400 to-teal-400 text-transparent bg-clip-text drop-shadow-lg ${
        collapsed ? "" : "text-2xl md:text-3xl"
      }`}
      aria-label="Go to homepage"
      style={{ letterSpacing: "-0.03em" }}
    >
      {collapsed ? (
        <Menu className="w-8 h-8 text-blue-500" />
      ) : (
        "#smartask"
      )}
    </a>
  </div>
);

export default Logo;

