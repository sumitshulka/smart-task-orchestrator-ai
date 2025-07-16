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
    
    // Clear all localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear any cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Force navigate to auth with replace to clear history
    window.location.href = "/auth";
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