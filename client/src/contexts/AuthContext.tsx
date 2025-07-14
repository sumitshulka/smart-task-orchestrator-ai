import React, { createContext, useContext, useState, useEffect } from 'react';

// Simple auth context to replace Supabase auth
// For now, we'll use a mock user until proper authentication is implemented
interface User {
  id: string;
  email: string;
  user_name?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, set a mock user to enable the application
    // In a real implementation, this would check for stored session
    const mockUser = {
      id: '12345678-1234-5678-9012-123456789012',
      email: 'admin@example.com',
      user_name: 'Admin User',
    };
    setUser(mockUser);
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Mock login for now
      const mockUser = {
        id: '12345678-1234-5678-9012-123456789012',
        email,
        user_name: 'Admin User',
      };
      setUser(mockUser);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Legacy Supabase auth hooks for compatibility
export function useSupabaseSession() {
  const { user, loading } = useAuth();
  return {
    session: user ? { user } : null,
    loading,
  };
}

export function useSupabaseUser() {
  const { user, loading } = useAuth();
  return {
    user,
    loading,
  };
}