
import { useEffect, useState } from "react";
import useSupabaseSession from "@/hooks/useSupabaseSession";

/**
 * Hook to fetch and hold current admin user id/org.
 * Optionally provide an initialOrganization string.
 */
export function useCurrentUser(initialOrganization?: string) {
  const [currentUser, setCurrentUser] = useState<null | { id: string; organization?: string }>(null);
  const { user } = useSupabaseSession();

  useEffect(() => {
    if (user) {
      setCurrentUser({ 
        id: user.id, 
        organization: initialOrganization || user.organization || undefined 
      });
    } else {
      setCurrentUser(null);
    }
  }, [user, initialOrganization]);

  return currentUser;
}
