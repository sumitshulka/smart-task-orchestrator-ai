import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Server, Key } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LicenseAcquisitionProps {
  onLicenseAcquired: () => void;
}

interface LicenseAcquisitionData {
  clientId: string;
  appId: string;
  baseUrl: string;
  licenseManagerUrl: string;
}

export const LicenseAcquisitionScreen = ({ onLicenseAcquired }: LicenseAcquisitionProps) => {
  const [acquisitionData, setAcquisitionData] = useState<LicenseAcquisitionData>({
    clientId: '',
    appId: 'taskrep-task-management',
    baseUrl: '',
    licenseManagerUrl: ''
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
          title: "License Acquired Successfully",
          description: "Your license has been acquired and validated. Redirecting to dashboard...",
        });
        setTimeout(() => {
          onLicenseAcquired();
        }, 2000);
      } else {
        toast({
          title: "License Acquisition Failed",
          description: result.message || "Failed to acquire license from server.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Error",
        description: error.message || "Failed to connect to license server.",
        variant: "destructive",
      });
    }
  });

  const handleAcquireLicense = () => {
    if (!acquisitionData.clientId || !acquisitionData.appId || !acquisitionData.baseUrl || !acquisitionData.licenseManagerUrl) {
      toast({
        title: "Missing Information",
        description: "All fields are required to acquire a license.",
        variant: "destructive",
      });
      return;
    }
    
    // Show the JSON that will be sent to the license manager
    console.log('=== LICENSE ACQUISITION REQUEST ===');
    console.log('Method: POST');
    console.log('URL: /api/license/acquire');
    console.log('JSON Payload:', JSON.stringify(acquisitionData, null, 2));
    console.log('=====================================');
    
    acquireMutation.mutate(acquisitionData);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Key className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">License Required</h1>
          <p className="text-muted-foreground">
            A valid license is required to access TaskRep. Please provide your license details to continue.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              License Acquisition
            </CardTitle>
            <CardDescription>
              Connect to your license server to acquire a license for this application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID *</Label>
              <Input
                id="clientId"
                placeholder="Enter your organization's client ID"
                value={acquisitionData.clientId}
                onChange={(e) => setAcquisitionData(prev => ({ ...prev, clientId: e.target.value }))}
                disabled={acquireMutation.isPending}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="appId">Application ID *</Label>
              <Input
                id="appId"
                placeholder="taskrep-task-management"
                value={acquisitionData.appId}
                onChange={(e) => setAcquisitionData(prev => ({ ...prev, appId: e.target.value }))}
                disabled={acquireMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                The unique identifier for this TaskRep application
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Application Base URL *</Label>
              <Input
                id="baseUrl"
                placeholder="https://your-domain.com"
                value={acquisitionData.baseUrl}
                onChange={(e) => setAcquisitionData(prev => ({ ...prev, baseUrl: e.target.value }))}
                disabled={acquireMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                The URL where this TaskRep application is hosted
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="licenseManagerUrl">License Server URL *</Label>
              <Input
                id="licenseManagerUrl"
                placeholder="https://license-server.com"
                value={acquisitionData.licenseManagerUrl}
                onChange={(e) => setAcquisitionData(prev => ({ ...prev, licenseManagerUrl: e.target.value }))}
                disabled={acquireMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Your organization's license management server
              </p>
            </div>

            <Button 
              onClick={handleAcquireLicense}
              disabled={acquireMutation.isPending}
              className="w-full"
              size="lg"
            >
              {acquireMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Acquiring License...
                </>
              ) : (
                "Acquire License"
              )}
            </Button>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please contact your system administrator if you don't have these details.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};