
import React, { useState } from "react";
import { Bot, CircleDollarSign, Cog, FolderKanban, HardDrive, KeyRound, ListTodo, MapPin, Users } from "lucide-react";
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
  const navItems = [
    { id: "general", label: "General", icon: Cog },
    { id: "departments", label: "Departments", icon: Users },
    { id: "office-locations", label: "Office Locations", icon: MapPin },
    { id: "statuses", label: "Task Statuses", icon: ListTodo },
    ...(projectManagementEnabled ? [
      { id: "project-templates", label: "Project Templates", icon: FolderKanban },
      { id: "project-finance", label: "Project Finance", icon: CircleDollarSign },
    ] : []),
    { id: "document-repository", label: "Document Repository", icon: HardDrive },
    { id: "ai-integration", label: "AI Integration", icon: Bot },
    { id: "license", label: "License Manager", icon: KeyRound },
  ];
  const activeTab = navItems.some((item) => item.id === tab) ? tab : "general";

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="w-full max-w-none px-6 py-6">
        <h2 className="text-2xl font-semibold mb-6 text-left">Settings</h2>
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Organization settings" className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = activeTab === item.id;
              return <button
                key={item.id}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => {
                  setTab(item.id);
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", item.id);
                  window.history.replaceState({}, "", url.toString());
                }}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-full ${
                  selected
                    ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>;
            })}
          </nav>

          <div className="min-w-0">
            {activeTab === "general" && <GeneralSettings />}
            {activeTab === "departments" && <DepartmentsManager />}
            {activeTab === "office-locations" && <OfficeLocationsManager />}
            {activeTab === "statuses" && <StatusManager />}
            {activeTab === "project-templates" && projectManagementEnabled && <ProjectTemplates />}
            {activeTab === "project-finance" && projectManagementEnabled && <OrganizationFinanceSettings />}
            {activeTab === "document-repository" && <OrganizationDocumentRepository />}
            {activeTab === "ai-integration" && <AiSettings />}
            {activeTab === "license" && <LicenseManager />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
