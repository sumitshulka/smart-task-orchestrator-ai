
import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

// Replace with actual data/fetch from auth later
const USER = {
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
  // Placeholder - replace with actual logout (Supabase or custom logic)
  const handleLogout = () => {
    // TODO: Add actual logout logic with Supabase
    alert("Logged out (not implemented)");
  };

  return (
    <header className="flex items-center justify-between border-b bg-background h-14 px-6 gap-4">
      <div className="text-lg font-semibold tracking-tight">Admin Dashboard</div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none rounded-full focus:ring-2 focus:ring-primary/50">
            <Avatar>
              {/* Replace with AvatarImage if you have a user photo URL */}
              <AvatarFallback>
                {getInitials(USER.name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">
              <div>{USER.name}</div>
              <div className="text-muted-foreground">{USER.email}</div>
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
