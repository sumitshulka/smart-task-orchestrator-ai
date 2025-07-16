import React, { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useLicenseCheck } from "@/hooks/useLicenseCheck";
import { LicenseAcquisitionScreen } from "@/components/LicenseAcquisitionScreen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, roles } = useCurrentUserRoleAndTeams();
  
  // Check if user is admin
  const isAdmin = roles.some(role => role.name === 'admin');
  
  // Only check license for authenticated admin users
  const { data: licenseStatus, isLoading: licenseLoading, refetch: refetchLicense } = useLicenseCheck(
    !!currentUser && isAdmin
  );

  // Handle license acquisition success
  const handleLicenseAcquired = () => {
    refetchLicense();
  };

  // Show license acquisition screen if no valid license exists for admin users
  if (currentUser && isAdmin && !licenseLoading && licenseStatus) {
    if (!licenseStatus.hasLicense || !licenseStatus.isValid) {
      return <LicenseAcquisitionScreen onLicenseAcquired={handleLicenseAcquired} />;
    }
  }

  // Show loading state while checking license for admin users
  if (currentUser && isAdmin && licenseLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying license...</p>
        </div>
      </div>
    );
  }

  // Show access denied for non-authenticated users
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please log in to access the admin panel.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <AppSidebar />
      </div>
      
      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 lg:ml-0">
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-auto p-2 sm:p-4 bg-muted/50">
          {children}
        </main>
      </div>
    </div>
  );
}