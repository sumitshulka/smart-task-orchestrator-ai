import React, { useState, useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import UniversalSearch from "@/components/UniversalSearch";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useLicenseCheck } from "@/hooks/useLicenseCheck";
import { LicenseAcquisitionScreen } from "@/components/LicenseAcquisitionScreen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import { queryClient } from "@/lib/queryClient";
import { AlertCircle, Plus } from "lucide-react";


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user: currentUser, roles } = useCurrentUserRoleAndTeams();

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  
  // Check if user is admin
  const isAdmin = roles.includes('admin');
  
  // Only check license for authenticated admin users
  const { data: licenseStatus, isLoading: licenseLoading, refetch: refetchLicense } = useLicenseCheck(
    !!currentUser && isAdmin
  );

  // Handle license acquisition success
  const handleLicenseAcquired = () => {
    refetchLicense();
  };

  const handleQuickTaskCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
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
        <div className="text-center space-y-4">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please log in to access the admin panel.
            </AlertDescription>
          </Alert>
        </div>
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
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onSearchOpen={() => setSearchOpen(true)} />
        <main className="flex-1 overflow-auto p-2 sm:p-4 bg-muted/50">
          {children}
        </main>
      </div>

      {/* Persistent quick task creation action */}
      <CreateTaskSheet onTaskCreated={handleQuickTaskCreated}>
        <Button
          type="button"
          size="icon"
          aria-label="Create a task"
          title="Quick task creation"
          className="group fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full border border-white/20 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-[0_10px_28px_rgba(99,102,241,0.38)] ring-1 ring-indigo-300/30 transition-all duration-200 hover:scale-110 hover:shadow-[0_14px_34px_rgba(124,58,237,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 active:scale-95"
        >
          <span className="pointer-events-none absolute inset-1 rounded-full border border-white/20" />
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 shadow-inner shadow-white/20 backdrop-blur-sm">
            <Plus className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.75} />
          </span>
        </Button>
      </CreateTaskSheet>

      {/* Universal Search modal */}
      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}