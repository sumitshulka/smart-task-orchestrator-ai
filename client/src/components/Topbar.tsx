import React from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Menu, HelpCircle, ChevronDown, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleProvider";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import HelpButton from "@/components/help/HelpButton";

const getInitials = (name: string) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
};

const ROLE_COLORS: Record<string, string> = {
  admin:        "bg-indigo-100 text-indigo-700",
  manager:      "bg-blue-100 text-blue-700",
  team_manager: "bg-sky-100 text-sky-700",
  user:         "bg-gray-100 text-gray-600",
};

interface TopbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Topbar: React.FC<TopbarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { userName, highestRole, loading } = useRole();
  const { canViewSettings } = useRolePermissions();

  const displayName = userName || user?.user_name || user?.email || "User";
  const displayEmail = user?.email || "";
  const initials = getInitials(displayName);
  const roleBadge = ROLE_COLORS[highestRole ?? ""] ?? ROLE_COLORS.user;
  const roleLabel = highestRole
    ? highestRole.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "User";

  const handleLogout = async () => {
    logout();
    navigate("/auth");
  };

  return (
    <header
      className="flex items-center justify-between px-4 sm:px-6 gap-4 bg-slate-900 border-b border-white/[0.06]"
      style={{ height: "56px", minHeight: "56px", maxHeight: "56px" }}
    >
      {/* ── Left: mobile hamburger + logo ── */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white transition-colors"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Mobile logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">#</span>
          </div>
          <span className="text-base font-semibold text-white">TaskRep</span>
        </div>
      </div>

      {/* ── Right: actions + user ── */}
      <div className="flex items-center gap-1 sm:gap-2 ml-auto">

        {/* Help */}
        <div className="[&_button]:text-white [&_button:hover]:text-white">
          <HelpButton variant="ghost" size="sm" showText={false} />
        </div>

        {/* Settings */}
        {canViewSettings && (
          <button
            onClick={() => navigate("/admin/settings")}
            aria-label="Settings"
            className="p-2 rounded-lg text-white hover:bg-white/[0.07] transition-colors"
          >
            <Settings className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] mx-1 hidden sm:block" />

        {/* Logout — always visible */}
        <button
          onClick={handleLogout}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white border border-white/20 hover:bg-white/[0.07] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] mx-1 hidden sm:block" />

        {/* Avatar + name dropdown */}
        {!loading && (
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-white/[0.07] transition-colors cursor-pointer">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-indigo-600 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start leading-none">
                  <span className="text-sm font-medium text-white max-w-[120px] truncate">{displayName}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${roleBadge}`}>
                    {roleLabel}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-[220px] p-1">
              {/* Profile header */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-indigo-600 text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                  <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${roleBadge}`}>
                    {roleLabel}
                  </span>
                </div>
              </div>

              <DropdownMenuSeparator />

              {canViewSettings && (
                <DropdownMenuItem
                  onClick={() => navigate("/admin/settings")}
                  className="gap-2 cursor-pointer text-sm"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Settings
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Logout inside dropdown too (for mobile / consistency) */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 cursor-pointer text-sm text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export default Topbar;
