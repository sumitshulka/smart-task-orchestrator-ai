import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { registerRoutes } from "./routes";
import { storage } from "./storage";

const projectId = "project-settings-fixture";
const managerId = "project-settings-manager";
const memberId = "project-settings-member";
const regularUserId = "project-settings-regular";
const projectCode = "SETTINGS-01";

const projectFixture = {
  id: projectId,
  name: "Settings Fixture Project",
  project_code: projectCode,
  description: "A project used by settings regression coverage",
  project_type: "fixed_cost",
  status: "planning",
  start_date: null,
  projected_end_date: null,
  actual_end_date: null,
  client_id: null,
  client_name: null,
  is_confirmed: false,
} as any;

const membershipFixtures = [
  {
    id: "project-settings-manager-membership",
    project_id: projectId,
    user_id: managerId,
    contact_id: null,
    member_user_type: "internal",
    member_type: "project_manager",
    project_role: "Project Manager",
    allocation_percentage: 100,
    is_active: true,
  },
  {
    id: "project-settings-member-membership",
    project_id: projectId,
    user_id: memberId,
    contact_id: null,
    member_user_type: "internal",
    member_type: "member",
    project_role: "Engineer",
    allocation_percentage: 100,
    is_active: true,
  },
] as any[];

const originalStorageMethods = {
  getProject: storage.getProject,
  getAllProjects: storage.getAllProjects,
  updateProject: storage.updateProject,
  getProjectSettings: storage.getProjectSettings,
  saveProjectSettings: storage.saveProjectSettings,
  getProjectFinanceHeads: storage.getProjectFinanceHeads,
  createProjectFinanceHead: storage.createProjectFinanceHead,
  updateProjectFinanceHead: storage.updateProjectFinanceHead,
  deleteProjectFinanceHead: storage.deleteProjectFinanceHead,
  getProjectSettingAudit: storage.getProjectSettingAudit,
  addProjectSettingAudit: storage.addProjectSettingAudit,
  getProjectMembers: storage.getProjectMembers,
  updateProjectMember: storage.updateProjectMember,
  getUserRoles: storage.getUserRoles,
  getAllRoles: storage.getAllRoles,
};

let server: Server;
let baseUrl: string;
let savedSettings: any;
let financeHeads: any[];
let auditEntries: any[];
let nextFinanceHeadId = 1;

before(async () => {
  savedSettings = undefined;
  financeHeads = [];
  auditEntries = [];

  storage.getProject = async (id) => id === projectId ? projectFixture : undefined;
  storage.getAllProjects = async () => [projectFixture];
  storage.updateProject = async (id, updates) => {
    Object.assign(projectFixture, updates);
    return projectFixture;
  };
  storage.getProjectSettings = async () => savedSettings;
  storage.saveProjectSettings = async (id, settings, updatedBy) => {
    savedSettings = {
      project_id: id,
      settings,
      updated_by: updatedBy,
      created_at: new Date(),
      updated_at: new Date(),
    };
    return savedSettings;
  };
  storage.getProjectFinanceHeads = async () => financeHeads;
  storage.createProjectFinanceHead = async (head) => {
    const created = {
      ...head,
      id: `finance-head-${nextFinanceHeadId++}`,
      created_at: new Date(),
      updated_at: new Date(),
    };
    financeHeads.push(created);
    return created;
  };
  storage.updateProjectFinanceHead = async (id, updates) => {
    const head = financeHeads.find((candidate) => candidate.id === id);
    if (!head) throw new Error("Finance head not found");
    Object.assign(head, updates);
    return head;
  };
  storage.deleteProjectFinanceHead = async (id) => {
    financeHeads = financeHeads.filter((head) => head.id !== id);
  };
  storage.getProjectSettingAudit = async () => auditEntries;
  storage.addProjectSettingAudit = async (entry) => {
    const created = { ...entry, id: `audit-${auditEntries.length + 1}`, created_at: new Date() };
    auditEntries.unshift(created);
    return created;
  };
  storage.getProjectMembers = async () => membershipFixtures;
  storage.updateProjectMember = async (id, updates) => {
    const member = membershipFixtures.find((candidate) => candidate.id === id);
    if (!member) throw new Error("Member not found");
    Object.assign(member, updates);
    return member;
  };
  storage.getUserRoles = async (userId) => [{
    id: `user-role-${userId}`,
    user_id: userId,
    role_id: userId === managerId ? "manager-role" : "user-role",
    assigned_by: null,
    assigned_at: new Date(),
  }] as any;
  storage.getAllRoles = async () => [
    { id: "manager-role", name: "manager", description: null, created_at: new Date(), updated_at: new Date() },
    { id: "user-role", name: "user", description: null, created_at: new Date(), updated_at: new Date() },
  ] as any;

  const app = express();
  app.use(express.json());
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  Object.assign(storage, originalStorageMethods);
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

async function request(
  method: string,
  path: string,
  body?: unknown,
  userId = managerId,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

const validSettings = {
  visibility: "organization",
  timeZone: "America/New_York",
  planning: {
    enabled: false,
    methodology: "story_point",
    allowAiPlanning: true,
    allowPlanningApproval: false,
    allowPhases: true,
    allowStages: true,
    allowMilestones: true,
    allowFeatureGroups: true,
    allowUserStories: true,
    allowDependencies: true,
    granularity: "milestone",
  },
  finance: {
    trackFinance: false,
    trackPeopleCost: false,
    peopleCostVisibility: ["finance"],
    visibility: {
      budget: ["finance"],
      expenses: ["finance"],
      resourceCost: ["finance"],
      profitability: ["finance"],
    },
  },
  quality: {
    defectManagement: false,
    testCaseManagement: true,
    allowClientDefectCreation: false,
    allowClientTestCaseVisibility: false,
    allowClientTestExecution: false,
    requireTestCasesForFeatureCompletion: false,
    requireTestCasesForMilestoneCompletion: false,
    requireDefectsResolvedForMilestoneClosure: false,
  },
  collaboration: {
    workspaceEnabled: false,
    internalCollaboration: true,
    clientCollaboration: false,
    clientComments: false,
    clientFileUpload: false,
    clientDefectCreation: false,
    clientActivityVisibility: false,
    clientDecisionVisibility: false,
    clientWorkspaceAccess: false,
  },
};

test("settings API saves valid values and records changed settings in audit history", async () => {
  const response = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: validSettings,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.project.id, projectId);
  assert.equal(response.body.settings.planning.methodology, "story_point");
  assert.equal(savedSettings.settings.finance.trackFinance, false);
  assert.deepEqual(
    auditEntries.map((entry) => entry.setting_key).sort(),
    ["collaboration", "finance", "planning", "quality", "timeZone", "visibility"],
  );
  assert.equal(auditEntries[0].changed_by, managerId);
});

test("settings API rejects unsupported enum, project type, and malformed date values", async () => {
  const invalidSettings = { ...validSettings, visibility: "public" };
  const invalidEnum = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: invalidSettings,
  });
  assert.equal(invalidEnum.status, 400);
  assert.equal(invalidEnum.body.error, "Unsupported project visibility");

  const invalidType = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: validSettings,
    projectUpdates: { project_type: "subscription" },
  });
  assert.equal(invalidType.status, 400);
  assert.equal(invalidType.body.error, "Unsupported project type");

  const invalidDate = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: validSettings,
    projectUpdates: { start_date: "not-a-date" },
  });
  assert.equal(invalidDate.status, 400);
  assert.equal(invalidDate.body.error, "Invalid project start date");
});

test("settings API rejects blank and duplicate project codes", async () => {
  const blankCode = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: validSettings,
    projectUpdates: { project_code: "   " },
  });
  assert.equal(blankCode.status, 400);
  assert.equal(blankCode.body.error, "Project code is required");

  const otherProject = { ...projectFixture, id: "other-project", project_code: "TAKEN" };
  storage.getAllProjects = async () => [projectFixture, otherProject];
  const duplicateCode = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: validSettings,
    projectUpdates: { project_code: "taken" },
  });
  assert.equal(duplicateCode.status, 409);
  assert.equal(duplicateCode.body.error, "Project code must be unique");
  storage.getAllProjects = async () => [projectFixture];
});

test("regular members cannot save project settings", async () => {
  const response = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: validSettings,
  }, regularUserId);

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Insufficient permissions");
});

test("expense heads cannot be created or edited at project level", async () => {
  const created = await request("POST", `/api/projects/${projectId}/settings/finance-heads`, {
    name: "Engineering",
    code: "eng",
  });
  assert.equal(created.status, 410);
  assert.match(created.body.error, /organization level/i);
});

test("disabling modules keeps project data available when settings are re-enabled", async () => {
  const disabledSettings = {
    ...validSettings,
    finance: { ...validSettings.finance, revenueRecognitionBasis: "monthly" },
  };
  const disabled = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: disabledSettings,
  });
  assert.equal(disabled.status, 200);
  const disabledSnapshot = await request("GET", `/api/projects/${projectId}/settings`);
  assert.equal(disabledSnapshot.status, 200);
  assert.equal(disabledSnapshot.body.settings.finance.revenueRecognitionBasis, "monthly");

  const reenabledSettings = {
    ...validSettings,
    planning: { ...validSettings.planning, enabled: true },
    finance: { ...validSettings.finance, trackFinance: true, revenueRecognitionBasis: "monthly" },
    quality: { ...validSettings.quality, defectManagement: true },
    collaboration: { ...validSettings.collaboration, workspaceEnabled: true },
  };
  const reenabled = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: reenabledSettings,
  });
  assert.equal(reenabled.status, 200);
  const restored = await request("GET", `/api/projects/${projectId}/settings`);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.settings.finance.revenueRecognitionBasis, "monthly");
});

test("release management stores repository configuration without connecting to it", async () => {
  const repositorySettings = {
    ...validSettings,
    releaseManagement: {
      enabled: true,
      repository: {
        type: "subversion",
        location: "https://svn.example.test/project",
        startingVersion: "2.4.0",
      },
    },
  };
  const saved = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: repositorySettings,
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.settings.releaseManagement, repositorySettings.releaseManagement);

  const invalid = await request("PUT", `/api/projects/${projectId}/settings`, {
    settings: {
      ...repositorySettings,
      releaseManagement: {
        ...repositorySettings.releaseManagement,
        repository: { ...repositorySettings.releaseManagement.repository, type: "github" },
      },
    },
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, "Unsupported repository type");
});