import { useQuery } from "@tanstack/react-query";

interface LicenseStatus {
  hasLicense: boolean;
  isValid: boolean;
  expiresAt?: string;
  subscriptionType?: string;
  userLimits?: { minimum: number; maximum: number };
  message: string;
}

export const useLicenseCheck = (enabled: boolean = true) => {
  return useQuery<LicenseStatus>({
    queryKey: ['/api/license/status'],
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};