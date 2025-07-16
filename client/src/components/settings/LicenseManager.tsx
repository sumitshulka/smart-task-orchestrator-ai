import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle, Clock, Users, Calendar, Server } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

interface LicenseStatus {
  hasLicense: boolean;
  isValid: boolean;
  expiresAt?: string;
  subscriptionType?: string;
  userLimits?: { minimum: number; maximum: number };
  message: string;
}



interface LicenseValidationData {
  clientId: string;
  domain: string;
}

export const LicenseManager = () => {
  const [validationData, setValidationData] = useState<LicenseValidationData>({
    clientId: '',
    domain: ''
  });
  
  const queryClient = useQueryClient();
  const { user: currentUser, roles } = useCurrentUserRoleAndTeams();
  
  // Check if user is admin
  const isAdmin = roles.includes('admin');

  // Get license status - only if user is authenticated and admin
  const { data: licenseStatus, isLoading: statusLoading, refetch: refetchStatus, error: statusError } = useQuery<LicenseStatus>({
    queryKey: ['/api/license/status'],
    enabled: !!currentUser && isAdmin, // Only run query if user is authenticated and admin
    refetchInterval: currentUser && isAdmin ? 30000 : false, // Only auto-refresh if authenticated
    retry: false, // Don't retry on authentication failures
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });



  // License validation mutation
  const validateMutation = useMutation({
    mutationFn: (data: LicenseValidationData) => 
      apiRequest('/api/license/validate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      if (result.valid) {
        toast({
          title: "License Valid",
          description: result.message || "License is valid and active.",
        });
      } else {
        toast({
          title: "License Invalid",
          description: result.message || "License validation failed.",
          variant: "destructive",
        });
      }
      setValidationData({ clientId: '', domain: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Validation Error",
        description: error.message || "Failed to validate license.",
        variant: "destructive",
      });
    }
  });



  const handleValidateLicense = () => {
    if (!validationData.clientId || !validationData.domain) {
      toast({
        title: "Missing Information",
        description: "Client ID and Domain are required.",
        variant: "destructive",
      });
      return;
    }
    validateMutation.mutate(validationData);
  };

  const getLicenseStatusIcon = () => {
    if (!licenseStatus?.hasLicense) return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    if (licenseStatus.isValid) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <AlertCircle className="h-5 w-5 text-red-500" />;
  };

  const getLicenseStatusColor = () => {
    if (!licenseStatus?.hasLicense) return "bg-yellow-50 border-yellow-200";
    if (licenseStatus.isValid) return "bg-green-50 border-green-200";
    return "bg-red-50 border-red-200";
  };

  // Show access denied if not admin
  if (!currentUser || !isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">License Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage system license acquisition, validation, and monitoring
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!currentUser 
              ? "Please log in to access license management." 
              : "Administrator access required to manage licenses."
            }
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">License Information</h3>
          <p className="text-sm text-muted-foreground">
            View current license details and validate license status
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchStatus()}
          disabled={statusLoading || !currentUser || !isAdmin}
        >
          {statusLoading ? "Refreshing..." : "Refresh Status"}
        </Button>
      </div>

      {/* License Status Card */}
      <Card className={getLicenseStatusColor()}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            {getLicenseStatusIcon()}
            License Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="text-sm text-muted-foreground">Loading license status...</div>
          ) : statusError ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {statusError.message || "Failed to load license status"}
              </AlertDescription>
            </Alert>
          ) : licenseStatus ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={licenseStatus.isValid ? "default" : "destructive"}>
                  {licenseStatus.hasLicense ? (licenseStatus.isValid ? "Active" : "Expired") : "No License"}
                </Badge>
              </div>
              
              {licenseStatus.subscriptionType && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Subscription Type:</span>
                  <span className="text-sm">{licenseStatus.subscriptionType}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Application ID:</span>
                <span className="text-sm font-mono">taskrep-task-management</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Client ID:</span>
                <span className="text-sm font-mono">default-client</span>
              </div>

              {licenseStatus.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Expires:
                  </span>
                  <span className="text-sm">
                    {new Date(licenseStatus.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {licenseStatus.userLimits && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    User Limits:
                  </span>
                  <span className="text-sm">
                    {licenseStatus.userLimits.minimum} - {licenseStatus.userLimits.maximum} users
                  </span>
                </div>
              )}
              
              <Alert>
                <AlertDescription>{licenseStatus.message}</AlertDescription>
              </Alert>
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Unable to load license status</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* License Validation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Validate License
          </CardTitle>
          <CardDescription>
            Re-validate your current license against the license server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validationClientId">Client ID *</Label>
              <Input
                id="validationClientId"
                placeholder="Enter client ID"
                value={validationData.clientId}
                onChange={(e) => setValidationData(prev => ({ ...prev, clientId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain *</Label>
              <Input
                id="domain"
                placeholder="your-domain.com"
                value={validationData.domain}
                onChange={(e) => setValidationData(prev => ({ ...prev, domain: e.target.value }))}
              />
            </div>
          </div>
          <Button 
            onClick={handleValidateLicense}
            disabled={validateMutation.isPending}
            className="w-full"
          >
            {validateMutation.isPending ? "Validating License..." : "Validate License"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};