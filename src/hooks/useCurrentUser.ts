
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch and hold current admin user id/org.
 * Optionally provide an initialOrganization string.
 */
export function useCurrentUser(initialOrganization?: string) {
  const [currentUser, setCurrentUser] = useState<null | { id: string; organization?: string }>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        let org = initialOrganization;
        const { data } = await supabase
          .from("users")
          .select("organization")
          .eq("id", session.user.id)
          .maybeSingle();
        if (data?.organization) org = data.organization;
        setCurrentUser({ id: session.user.id, organization: org });
      }
    };
    fetch();
  }, [initialOrganization]);

  return currentUser;
}
