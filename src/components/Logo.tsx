
import React from "react";

const Logo: React.FC = () => (
  <div className="flex items-center px-6 py-4">
    <a
      href="/"
      className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-blue-400 to-teal-400 text-transparent bg-clip-text drop-shadow-lg"
      aria-label="Go to homepage"
    >
      Smart Task Manager
    </a>
  </div>
);

export default Logo;
