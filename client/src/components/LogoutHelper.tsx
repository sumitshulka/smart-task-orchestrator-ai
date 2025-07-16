import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export const LogoutHelper = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleCompleteLogout = () => {
    // Clear all authentication state
    logout();
    
    // Clear all React Query cache
    queryClient.clear();
    
    // Clear all localStorage
    localStorage.clear();
    
    // Navigate to auth page
    navigate("/auth");
    
    // Force page reload to ensure clean state
    window.location.reload();
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button 
        onClick={handleCompleteLogout}
        variant="destructive"
        size="sm"
      >
        Complete Logout & Clear Cache
      </Button>
    </div>
  );
};