import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

interface LicenseStatus {
  hasLicense: boolean;
  isValid: boolean;
  expiresAt?: string;
  subscriptionType?: string;
  userLimits?: { minimum: number; maximum: number };
  message: string;
}

export const useLicenseCheck = (enabled: boolean = true) => {
  const { user } = useAuth();
  
  return useQuery<LicenseStatus>({
    queryKey: ['/api/license/status'],
    queryFn: () => apiRequest('/api/license/status', {
      method: 'GET',
      headers: {
        ...(user?.id && { 'x-user-id': user.id }),
        'x-client-id': 'default-client'
      }
    }),
    enabled: enabled && !!user,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};