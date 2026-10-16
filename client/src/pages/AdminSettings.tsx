
import React, { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import DepartmentsManager from "@/components/settings/DepartmentsManager";
import OfficeLocationsManager from "@/components/settings/OfficeLocationsManager";
import StatusManager from "@/components/settings/StatusManager";
import GeneralSettings from "@/components/settings/GeneralSettings";
import { LicenseManager } from "@/components/settings/LicenseManager";
import ProjectTemplates from "@/components/settings/ProjectTemplates";
import AiSettings from "@/components/settings/AiSettings";
import OrganizationFinanceSettings from "@/components/settings/OrganizationFinanceSettings";
import OrganizationDocumentRepository from "@/components/settings/OrganizationDocumentRepository";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

const AdminSettings: React.FC = () => {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") ?? "general");

  const { data: settings } = useQuery({
    queryKey: ["/api/organization-settings"],
    queryFn: () => apiClient.get("/organization-settings"),
  });

  const projectManagementEnabled = settings?.project_management_enabled ?? false;

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="w-full max-w-none px-6 py-6">
        <h2 className="text-2xl font-semibold mb-6 text-left">Settings</h2>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-6 grid h-auto w-full max-w-none grid-cols-2 items-stretch justify-start gap-2 rounded-md border bg-background p-2 sm:grid-cols-3 lg:grid-cols-5">
            <TabsTrigger
              value="general"
              className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3"
            >
              General
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3"
            >
              Departments
            </TabsTrigger>
            <TabsTrigger
              value="office-locations"
              className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3"
            >
              Office Locations
            </TabsTrigger>
            <TabsTrigger
              value="statuses"
              className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3"
            >
              Task Statuses
            </TabsTrigger>
            {projectManagementEnabled && (
              <TabsTrigger
                value="project-templates"
                className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3"
              >
                Project Templates
              </TabsTrigger>
            )}
            {projectManagementEnabled && (
              <TabsTrigger value="project-finance" className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3">
                Project Finance
              </TabsTrigger>
            )}
            <TabsTrigger value="document-repository" className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3">Document Repository</TabsTrigger>
            <TabsTrigger
              value="ai-integration"
              className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3"
            >
              AI Integration
            </TabsTrigger>
            <TabsTrigger
              value="license"
              className="h-auto min-h-11 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center leading-tight sm:px-3"
            >
              License Manager
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="w-full">
            <GeneralSettings />
          </TabsContent>
          <TabsContent value="departments" className="w-full">
            <DepartmentsManager />
          </TabsContent>
          <TabsContent value="office-locations" className="w-full">
            <OfficeLocationsManager />
          </TabsContent>
          <TabsContent value="statuses" className="w-full">
            <StatusManager />
          </TabsContent>
          {projectManagementEnabled && (
            <TabsContent value="project-templates" className="w-full">
              <ProjectTemplates />
            </TabsContent>
          )}
          {projectManagementEnabled && (
            <TabsContent value="project-finance" className="w-full">
              <OrganizationFinanceSettings />
            </TabsContent>
          )}
          <TabsContent value="document-repository" className="w-full"><OrganizationDocumentRepository /></TabsContent>
          <TabsContent value="ai-integration" className="w-full">
            <AiSettings />
          </TabsContent>
          <TabsContent value="license" className="w-full">
            <LicenseManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminSettings;
