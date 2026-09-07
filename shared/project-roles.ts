export type StandardProjectRole = {
  title: string;
  systemRole: string;
  isQualityAnalyst?: boolean;
};

/**
 * Common delivery roles available to every project template.
 * Templates may add, remove, or rename roles for a specific organization.
 */
export const STANDARD_PROJECT_ROLES: StandardProjectRole[] = [
  { title: "Project Sponsor", systemRole: "project_stakeholder" },
  { title: "Project Manager", systemRole: "project_manager" },
  { title: "Project Coordinator", systemRole: "project_member" },
  { title: "Product Owner", systemRole: "project_member" },
  { title: "Scrum Master", systemRole: "project_member" },
  { title: "Team Lead", systemRole: "project_member" },
  { title: "Module Lead", systemRole: "project_member" },
  { title: "Release Manager", systemRole: "project_member" },
  { title: "Quality Analyst", systemRole: "project_member", isQualityAnalyst: true },
  { title: "Testing Manager", systemRole: "project_member" },
  { title: "Test Engineer", systemRole: "project_member" },
  { title: "Developer", systemRole: "project_member" },
  { title: "Senior Developer", systemRole: "project_member" },
  { title: "DevOps Engineer", systemRole: "project_member" },
  { title: "UI Designer", systemRole: "project_member" },
  { title: "UX Designer", systemRole: "project_member" },
  { title: "Functional Analyst", systemRole: "project_member" },
  { title: "Business Analyst", systemRole: "project_member" },
  { title: "System Analyst", systemRole: "project_member" },
  { title: "Solution Architect", systemRole: "project_member" },
  { title: "Technical Architect", systemRole: "project_member" },
  { title: "Database Administrator", systemRole: "project_member" },
  { title: "Security Engineer", systemRole: "project_member" },
  { title: "Configuration Manager", systemRole: "project_member" },
  { title: "Technical Writer", systemRole: "project_member" },
  { title: "Librarian", systemRole: "project_member" },
  { title: "Finance Manager", systemRole: "finance" },
  { title: "Support Engineer", systemRole: "project_member" },
  { title: "Client Representative", systemRole: "project_stakeholder" },
];