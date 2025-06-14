
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SimpleUser {
  id: string;
  user_name?: string | null;
  email: string;
}

export function useUserList() {
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("users")
      .select("id, user_name, email")
      .then(({ data }) => {
        setUsers(data || []);
        setLoading(false);
      });
  }, []);

  return { users, loading };
}
