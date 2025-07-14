// Legacy Supabase client replaced with API client
// This file is kept for compatibility during migration
// All new code should use apiClient from '@/lib/api'

import { apiClient } from '@/lib/api';

// Deprecated: Use apiClient instead
export const supabase = {
  from: (table: string) => {
    console.warn(`Deprecated: supabase.from('${table}') calls should be replaced with apiClient methods`);
    return {
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    };
  },
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => {
      console.warn("Deprecated: onAuthStateChange should be replaced with useAuth hook");
      return {
        data: { subscription: { unsubscribe: () => {} } },
        error: null,
      };
    },
    signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

// Re-export the API client for easy migration
export { apiClient };