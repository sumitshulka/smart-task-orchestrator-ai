import React from "react";
import UserRoleManager from "@/components/UserRoleManager";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AdminRolesPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth");
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <UserRoleManager />
    </div>
  );
};

export default AdminRolesPage;
