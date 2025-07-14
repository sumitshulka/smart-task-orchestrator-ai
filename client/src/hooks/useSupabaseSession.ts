
import { useAuth } from "@/contexts/AuthContext";

/**
 * Legacy hook for compatibility with old Supabase session code.
 * This now wraps the new AuthContext for backward compatibility.
 */
export default function useSupabaseSession() {
  const { user, loading } = useAuth();

  // Return session format for compatibility
  const session = user ? { user } : null;

  console.log("[LOVABLE DEBUG][useSupabaseSession] getSession():", session);

  return { session, user, loading };
}
