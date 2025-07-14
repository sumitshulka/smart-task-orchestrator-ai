import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleProvider';
import { canAccessRoute, type Role } from '@/lib/permissions';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
  requiredPermission?: {
    action: string;
    resource: string;
  };
  fallbackPath?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallbackPath = '/auth'
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { highestRole, loading: roleLoading } = useRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Check role-based access
  if (requiredRole && highestRole !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check permission-based access
  if (requiredPermission && !canAccessRoute(highestRole as Role, window.location.pathname)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}