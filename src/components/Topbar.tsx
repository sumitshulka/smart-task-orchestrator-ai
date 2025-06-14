
import React from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import useSupabaseSession from "@/hooks/useSupabaseSession";

const USER_PLACEHOLDER = {
  name: "Jane Doe",
  email: "janedoe@email.com",
};

const getInitials = (name: string) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const Topbar: React.FC = () => {
  const navigate = useNavigate();

  // Use current logged-in user info via session hook
  const { user } = useSupabaseSession();

  const displayName = user?.user_metadata?.user_name || user?.email || USER_PLACEHOLDER.name;
  const displayEmail = user?.email || USER_PLACEHOLDER.email;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header className="flex items-center justify-between border-b bg-background h-14 px-6 gap-4">
      <div className="text-lg font-semibold tracking-tight">Admin Dashboard</div>
      <div className="flex items-center gap-2">
        <button
          aria-label="Settings"
          onClick={() => navigate("/admin/settings")}
          className="rounded-full p-1.5 hover:bg-accent text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Settings className="w-6 h-6" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none rounded-full focus:ring-2 focus:ring-primary/50">
            <Avatar>
              {/* Replace with AvatarImage if you have a user photo URL */}
              <AvatarFallback>
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">
              <div>{displayName}</div>
              <div className="text-muted-foreground">{displayEmail}</div>
            </div>
            <DropdownMenuItem onClick={handleLogout} className="gap-2 mt-1 cursor-pointer">
              <LogOut className="w-4 h-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Topbar;
