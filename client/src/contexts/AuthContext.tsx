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
    // Check for stored session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Simple authentication - in production this should be more secure
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      if (response.ok) {
        const user = await response.json();
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        throw new Error('Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
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