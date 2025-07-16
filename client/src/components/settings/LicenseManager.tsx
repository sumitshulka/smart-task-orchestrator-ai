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

interface LicenseStatus {
  hasLicense: boolean;
  isValid: boolean;
  expiresAt?: string;
  subscriptionType?: string;
  userLimits?: { minimum: number; maximum: number };
  message: string;
}

interface LicenseAcquisitionData {
  clientId: string;
  baseUrl: string;
  licenseManagerUrl: string;
}

interface LicenseValidationData {
  clientId: string;
  domain: string;
}

export const LicenseManager = () => {
  const [acquisitionData, setAcquisitionData] = useState<LicenseAcquisitionData>({
    clientId: '',
    baseUrl: '',
    licenseManagerUrl: ''
  });
  
  const [validationData, setValidationData] = useState<LicenseValidationData>({
    clientId: '',
    domain: ''
  });

  const [activeSection, setActiveSection] = useState<'status' | 'acquire' | 'validate'>('status');
  
  const queryClient = useQueryClient();

  // Get license status
  const { data: licenseStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<LicenseStatus>({
    queryKey: ['/api/license/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // License acquisition mutation
  const acquireMutation = useMutation({
    mutationFn: (data: LicenseAcquisitionData) => 
      apiRequest('/api/license/acquire', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "License Acquired",
          description: "License has been successfully acquired and stored.",
        });
        setAcquisitionData({ clientId: '', baseUrl: '', licenseManagerUrl: '' });
        queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
        setActiveSection('status');
      } else {
        toast({
          title: "Acquisition Failed",
          description: result.message || "Failed to acquire license.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Acquisition Error",
        description: error.message || "Failed to acquire license.",
        variant: "destructive",
      });
    }
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

  const handleAcquireLicense = () => {
    if (!acquisitionData.clientId || !acquisitionData.baseUrl) {
      toast({
        title: "Missing Information",
        description: "Client ID and Base URL are required.",
        variant: "destructive",
      });
      return;
    }
    acquireMutation.mutate(acquisitionData);
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">License Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage system license acquisition, validation, and monitoring
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchStatus()}
          disabled={statusLoading}
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

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant={activeSection === 'status' ? 'default' : 'outline'}
          onClick={() => setActiveSection('status')}
        >
          Status
        </Button>
        <Button
          variant={activeSection === 'acquire' ? 'default' : 'outline'}
          onClick={() => setActiveSection('acquire')}
        >
          Acquire License
        </Button>
        <Button
          variant={activeSection === 'validate' ? 'default' : 'outline'}
          onClick={() => setActiveSection('validate')}
        >
          Validate License
        </Button>
      </div>

      <Separator />

      {/* License Acquisition Section */}
      {activeSection === 'acquire' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Acquire New License
            </CardTitle>
            <CardDescription>
              Connect to a license server to acquire a new license for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID *</Label>
                <Input
                  id="clientId"
                  placeholder="Enter your client ID"
                  value={acquisitionData.clientId}
                  onChange={(e) => setAcquisitionData(prev => ({ ...prev, clientId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL *</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://your-domain.com"
                  value={acquisitionData.baseUrl}
                  onChange={(e) => setAcquisitionData(prev => ({ ...prev, baseUrl: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseManagerUrl">License Server URL</Label>
              <Input
                id="licenseManagerUrl"
                placeholder="https://license-server.com"
                value={acquisitionData.licenseManagerUrl}
                onChange={(e) => setAcquisitionData(prev => ({ ...prev, licenseManagerUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Optional: Leave empty to use default license server
              </p>
            </div>
            <Button 
              onClick={handleAcquireLicense}
              disabled={acquireMutation.isPending}
              className="w-full"
            >
              {acquireMutation.isPending ? "Acquiring License..." : "Acquire License"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* License Validation Section */}
      {activeSection === 'validate' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Validate Existing License
            </CardTitle>
            <CardDescription>
              Validate an existing license against the license server.
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
      )}
    </div>
  );
};