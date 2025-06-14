
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to keep track of Supabase session and user.
 * Always returns up-to-date information for both.
 */
export default function useSupabaseSession() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for login/logout, refresh etc
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        console.log("[LOVABLE DEBUG][useSupabaseSession] AuthStateChange event:", _event, session);
      }
    );
    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      console.log("[LOVABLE DEBUG][useSupabaseSession] getSession():", session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
