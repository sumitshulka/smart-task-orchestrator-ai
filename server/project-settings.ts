import { storage } from "./storage";

export const DEFAULT_PROJECT_SETTINGS = {
  visibility: "private",
  timeZone: "UTC",
  planning: {
    enabled: true,
    methodology: "manual",
    allowAiPlanning: true,
    allowPlanningApproval: false,
    allowPhases: true,
    allowStages: true,
    allowMilestones: true,
    allowFeatureGroups: true,
    allowUserStories: true,
    allowDependencies: true,
    granularity: "task",
  },
  finance: {
    trackFinance: true,
    trackPeopleCost: false,
    peopleCostVisibility: ["organization_admin", "finance", "project_manager"],
    visibility: {
      budget: ["organization_admin", "finance", "project_manager"],
      expenses: ["organization_admin", "finance", "project_manager"],
      resourceCost: ["organization_admin", "finance", "project_manager"],
      profitability: ["organization_admin", "finance"],
    },
  },
  quality: {
    defectManagement: true,
    testCaseManagement: true,
    qualityAnalystTitle: "Quality Analyst",
    allowClientDefectCreation: false,
    allowClientTestCaseVisibility: false,
    allowClientTestExecution: false,
    requireTestCasesForFeatureCompletion: false,
    requireTestCasesForMilestoneCompletion: false,
    requireDefectsResolvedForMilestoneClosure: false,
  },
  releaseManagement: {
    enabled: true,
    repository: {
      type: "git",
      location: "",
      startingVersion: "1.0.0",
    },
  },
  collaboration: {
    workspaceEnabled: true,
    internalCollaboration: true,
    clientCollaboration: false,
    clientComments: false,
    clientFileUpload: false,
    clientDefectCreation: false,
    clientActivityVisibility: false,
    clientDecisionVisibility: false,
    clientWorkspaceAccess: false,
  },
  notifications: {
    taskAssigned: { enabled: true, channels: ["in_app"] },
    taskCompleted: { enabled: true, channels: ["in_app"] },
    taskOverdue: { enabled: true, channels: ["in_app"] },
    milestoneCompleted: { enabled: true, channels: ["in_app"] },
    milestoneDelayed: { enabled: true, channels: ["in_app"] },
    defectCreated: { enabled: true, channels: ["in_app"] },
    defectAssigned: { enabled: true, channels: ["in_app"] },
    defectResolved: { enabled: true, channels: ["in_app"] },
    defectReopened: { enabled: true, channels: ["in_app"] },
    workspaceMention: { enabled: true, channels: ["in_app"] },
    workspaceComment: { enabled: true, channels: ["in_app"] },
    planningUpdated: { enabled: true, channels: ["in_app"] },
    planningApprovalRequired: { enabled: true, channels: ["in_app"] },
    financeEntryAdded: { enabled: true, channels: ["in_app"] },
    budgetThresholdReached: { enabled: true, channels: ["in_app"] },
    clientActivity: { enabled: false, channels: ["in_app"] },
  },
} as const;

const PROJECT_SETTING_ENUMS = {
  visibility: ["private", "organization", "client"],
  methodology: ["manual", "complexity_based", "component_based", "function_point", "story_point", "historical", "custom"],
  granularity: ["project", "phase", "stage", "milestone", "feature_group", "feature", "user_story", "task"],
  peopleCostVisibility: ["organization_admin", "finance", "project_manager", "team_lead", "project_member", "client"],
} as const;

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeProjectSettings(saved: any): Record<string, any> {
  const source = isRecord(saved) ? saved : {};
  return {
    ...DEFAULT_PROJECT_SETTINGS,
    ...source,
    planning: { ...DEFAULT_PROJECT_SETTINGS.planning, ...(isRecord(source.planning) ? source.planning : {}) },
    finance: {
      ...DEFAULT_PROJECT_SETTINGS.finance,
      ...(isRecord(source.finance) ? source.finance : {}),
      visibility: {
        ...DEFAULT_PROJECT_SETTINGS.finance.visibility,
        ...(isRecord(source.finance?.visibility) ? source.finance.visibility : {}),
      },
    },
    quality: { ...DEFAULT_PROJECT_SETTINGS.quality, ...(isRecord(source.quality) ? source.quality : {}) },
    releaseManagement: {
      ...DEFAULT_PROJECT_SETTINGS.releaseManagement,
      ...(isRecord(source.releaseManagement) ? source.releaseManagement : {}),
      repository: {
        ...DEFAULT_PROJECT_SETTINGS.releaseManagement.repository,
        ...(isRecord(source.releaseManagement?.repository) ? source.releaseManagement.repository : {}),
      },
    },
    collaboration: { ...DEFAULT_PROJECT_SETTINGS.collaboration, ...(isRecord(source.collaboration) ? source.collaboration : {}) },
    notifications: { ...DEFAULT_PROJECT_SETTINGS.notifications, ...(isRecord(source.notifications) ? source.notifications : {}) },
  };
}

export function validateProjectSettings(input: unknown): { settings?: Record<string, any>; error?: string } {
  if (!isRecord(input)) return { error: "settings must be an object" };
  const settings = mergeProjectSettings(input);
  if (!PROJECT_SETTING_ENUMS.visibility.includes(settings.visibility)) return { error: "Unsupported project visibility" };
  if (!PROJECT_SETTING_ENUMS.methodology.includes(settings.planning.methodology)) return { error: "Unsupported planning methodology" };
  if (!PROJECT_SETTING_ENUMS.granularity.includes(settings.planning.granularity)) return { error: "Unsupported planning granularity" };
  if (!isRecord(settings.releaseManagement.repository) ||
      !["git", "subversion", "mercurial", "other"].includes(settings.releaseManagement.repository.type)) {
    return { error: "Unsupported repository type" };
  }
  if (typeof settings.releaseManagement.repository.location !== "string") {
    return { error: "Repository location must be text" };
  }
  if (typeof settings.releaseManagement.repository.startingVersion !== "string" ||
      !settings.releaseManagement.repository.startingVersion.trim()) {
    return { error: "Starting version is required" };
  }

  const booleanGroups = ["planning", "finance", "quality", "releaseManagement", "collaboration"] as const;
  for (const group of booleanGroups) {
    for (const [key, value] of Object.entries(settings[group])) {
      if (key === "peopleCostVisibility" || key === "visibility" || key === "methodology" || key === "granularity" || key === "repository") continue;
      if (typeof value !== "boolean") return { error: `${group}.${key} must be boolean` };
    }
  }
  if (!Array.isArray(settings.finance.peopleCostVisibility) ||
      settings.finance.peopleCostVisibility.some((role: unknown) => !PROJECT_SETTING_ENUMS.peopleCostVisibility.includes(role as any))) {
    return { error: "Invalid people cost visibility role" };
  }
  for (const key of ["budget", "expenses", "resourceCost", "profitability"]) {
    const roles = settings.finance.visibility[key];
    if (!Array.isArray(roles) || roles.some((role: unknown) => !PROJECT_SETTING_ENUMS.peopleCostVisibility.includes(role as any))) {
      return { error: `Invalid finance visibility for ${key}` };
    }
  }
  for (const [event, config] of Object.entries(settings.notifications)) {
    if (!isRecord(config) || typeof config.enabled !== "boolean" ||
        !Array.isArray(config.channels) || config.channels.some((channel: unknown) => channel !== "in_app")) {
      return { error: `Invalid notification configuration for ${event}` };
    }
  }
  return { settings };
}

export type ProjectModule = "planning" | "workspace" | "finance" | "defects" | "testCases" | "release";
export type PlanningCapability =
  | "allowAiPlanning"
  | "allowPlanningApproval"
  | "allowPhases"
  | "allowStages"
  | "allowMilestones"
  | "allowFeatureGroups"
  | "allowUserStories"
  | "allowDependencies";
export type FinanceVisibilityKey = "peopleCost" | "budget" | "expenses" | "resourceCost" | "profitability";

function getRequestUserId(req: any): string | null {
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.trim()) return headerUserId;
  return req.session?.userId ?? null;
}

async function getRoleNames(userId: string): Promise<string[]> {
  const [userRoles, allRoles] = await Promise.all([
    storage.getUserRoles(userId),
    storage.getAllRoles(),
  ]);
  return userRoles
    .map((userRole) => allRoles.find((role) => role.id === userRole.role_id)?.name)
    .filter((role): role is string => Boolean(role));
}

export async function getProjectAccess(projectId: string, userId: string) {
  const project = await storage.getProject(projectId);
  if (!project) return { project: undefined, settings: mergeProjectSettings(null), allowed: false };

  const saved = await storage.getProjectSettings(projectId);
  const settings = mergeProjectSettings(saved?.settings);
  const [members, roleNames] = await Promise.all([
    storage.getProjectMembers(projectId),
    getRoleNames(userId),
  ]);
  const activeMember = members.some((member) =>
    member.user_id === userId &&
    member.is_active !== false &&
    (member as any).member_user_type !== "client_contact",
  );
  const isCreator = project.created_by === userId;
  const isAdmin = roleNames.includes("admin");
  const isManager = roleNames.includes("manager") || roleNames.includes("team_manager");
  const allowed = isAdmin || isCreator || activeMember ||
    settings.visibility === "organization";

  return { project, settings, allowed, roleNames, activeMember };
}

export function requireProjectAccess(paramName = "id") {
  return async (req: any, res: any, next: any) => {
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const projectId = String(req.params[paramName] ?? "");
      const context = await getProjectAccess(projectId, userId);
      if (!context.project) return res.status(404).json({ error: "Project not found" });
      if (!context.allowed) return res.status(403).json({ error: "You do not have access to this project" });
      req.projectContext = context;
      next();
    } catch (error) {
      console.error("Project access check failed:", error);
      res.status(500).json({ error: "Failed to verify project access" });
    }
  };
}

export function requireProjectModule(module: ProjectModule, paramName = "id") {
  const access = requireProjectAccess(paramName);
  return async (req: any, res: any, next: any) => {
    await access(req, res, () => {
      const settings = req.projectContext?.settings;
      const enabled =
        module === "planning" ? settings?.planning?.enabled !== false :
        module === "workspace" ? settings?.collaboration?.workspaceEnabled !== false :
        module === "finance" ? settings?.finance?.trackFinance !== false :
        module === "testCases" ? settings?.quality?.testCaseManagement !== false :
        module === "release" ? settings?.releaseManagement?.enabled !== false :
        settings?.quality?.defectManagement !== false;
      if (!enabled) return res.status(403).json({ error: `The ${module} module is disabled for this project` });
      next();
    });
  };
}

export function requireWorkspaceAccess(paramName = "entityId") {
  return async (req: any, res: any, next: any) => {
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const entityType = String(req.params.entityType ?? "");
      const entityId = String(req.params[paramName] ?? "");
      let projectId: string | undefined;
      if (entityType === "project") {
        projectId = entityId;
      } else if (entityType === "task") {
        projectId = (await storage.getTask(entityId))?.project_id ?? undefined;
      } else if (entityType === "milestone") {
        projectId = (await storage.getMilestone(entityId))?.project_id ?? undefined;
      } else if (entityType === "defect") {
        projectId = (await storage.getDefect(entityId))?.project_id ?? undefined;
      }
      if (!projectId) return res.status(404).json({ error: "Workspace entity not found" });
      const context = await getProjectAccess(projectId, userId);
      if (!context.project) return res.status(404).json({ error: "Project not found" });
      if (!context.allowed) return res.status(403).json({ error: "You do not have access to this project" });
      if (context.settings.collaboration.workspaceEnabled === false) {
        return res.status(403).json({ error: "Workspace is disabled for this project" });
      }
      if (context.settings.collaboration.internalCollaboration === false) {
        return res.status(403).json({ error: "Internal collaboration is disabled for this project" });
      }
      req.projectContext = context;
      next();
    } catch (error) {
      console.error("Workspace access check failed:", error);
      res.status(500).json({ error: "Failed to verify workspace access" });
    }
  };
}

export function requireEntityProjectModule(
  module: ProjectModule,
  entityType: "task" | "milestone" | "defect",
  paramName = "id",
) {
  return async (req: any, res: any, next: any) => {
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const entityId = String(req.params[paramName] ?? "");
      const projectId = entityType === "task"
        ? (await storage.getTask(entityId))?.project_id
        : entityType === "milestone"
          ? (await storage.getMilestone(entityId))?.project_id
          : (await storage.getDefect(entityId))?.project_id;
      if (!projectId) return res.status(404).json({ error: `${entityType} not found` });
      const context = await getProjectAccess(projectId, userId);
      if (!context.project) return res.status(404).json({ error: "Project not found" });
      if (!context.allowed) return res.status(403).json({ error: "You do not have access to this project" });
      const enabled =
        module === "planning" ? context.settings.planning.enabled !== false :
        module === "workspace" ? context.settings.collaboration.workspaceEnabled !== false :
        module === "finance" ? context.settings.finance.trackFinance !== false :
        context.settings.quality.defectManagement !== false;
      if (!enabled) return res.status(403).json({ error: `The ${module} module is disabled for this project` });
      req.projectContext = context;
      next();
    } catch (error) {
      console.error("Entity project access check failed:", error);
      res.status(500).json({ error: "Failed to verify project access" });
    }
  };
}

function userFinanceRoleKeys(context: any): string[] {
  const roleNames: string[] = context?.roleNames ?? [];
  const keys = new Set<string>();
  if (context?.activeMember) keys.add("project_member");
  for (const role of roleNames) {
    if (role === "admin") keys.add("organization_admin");
    if (role === "manager" || role === "team_manager") keys.add("project_manager");
    if (role === "team_lead") keys.add("team_lead");
    if (role === "finance") keys.add("finance");
  }
  return Array.from(keys);
}

export function financeVisibilityAllows(context: any, key: FinanceVisibilityKey): boolean {
  const settings = context?.settings;
  if (!settings || settings.finance?.trackFinance === false) return false;
  const configuredRoles = key === "peopleCost"
    ? settings.finance.peopleCostVisibility
    : settings.finance.visibility?.[key];
  if (!Array.isArray(configuredRoles)) return false;
  const currentRoles = userFinanceRoleKeys(context);
  return configuredRoles.some((role: string) => currentRoles.includes(role));
}

export function requireFinanceVisibility(key: FinanceVisibilityKey, paramName = "id") {
  const access = requireProjectModule("finance", paramName);
  return async (req: any, res: any, next: any) => {
    await access(req, res, () => {
      if (!financeVisibilityAllows(req.projectContext, key)) {
        return res.status(403).json({ error: `Finance visibility does not allow access to ${key}` });
      }
      next();
    });
  };
}

export async function getCompletionGateError(
  context: any,
  projectId: string,
  entityType: "feature" | "milestone",
  nextStatus: unknown,
): Promise<string | null> {
  if (!["completed", "done", "closed"].includes(String(nextStatus))) return null;
  const quality = context?.settings?.quality;
  if (!quality) return null;
  const requiresTestCases = entityType === "feature"
    ? quality.requireTestCasesForFeatureCompletion
    : quality.requireTestCasesForMilestoneCompletion;
  if (requiresTestCases) {
    return "Test Case completion enforcement is enabled, but Test Case execution is not available yet.";
  }
  if (entityType === "milestone" && quality.requireDefectsResolvedForMilestoneClosure) {
    const defects = await storage.getDefectsByProject(projectId);
    const unresolved = defects.filter((defect: any) => !["resolved", "closed", "rejected"].includes(String(defect.status)));
    if (unresolved.length > 0) {
      return "All project defects must be resolved before this milestone can be closed.";
    }
  }
  return null;
}

export function requirePlanningCapability(capability: PlanningCapability) {
  return (req: any, res: any, next: any) => {
    if (req.projectContext?.settings?.planning?.[capability] === false) {
      return res.status(403).json({ error: `Planning setting ${capability} is disabled for this project` });
    }
    next();
  };
}

export function requirePlanningEntityCapability(paramName = "entityType") {
  return (req: any, res: any, next: any) => {
    const capabilityByEntity: Record<string, PlanningCapability | undefined> = {
      phase: "allowPhases",
      stage: "allowStages",
      milestone: "allowMilestones",
      feature_group: "allowFeatureGroups",
      user_story: "allowUserStories",
    };
    const capability = capabilityByEntity[String(req.params[paramName] ?? "")];
    if (capability && req.projectContext?.settings?.planning?.[capability] === false) {
      return res.status(403).json({ error: `Planning setting ${capability} is disabled for this project` });
    }
    next();
  };
}

export function getProjectContextFromRequest(req: any) {
  return req.projectContext ?? null;
}