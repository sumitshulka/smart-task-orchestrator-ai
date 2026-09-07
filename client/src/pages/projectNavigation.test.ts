import assert from "node:assert/strict";
import test from "node:test";
import { filterProjectNavigation } from "./projectNavigation";

const projectNavigationFixture = [
  { id: "overview", label: "Overview" },
  { id: "workspace", label: "Project Workspace" },
  { id: "planning", label: "Planning" },
  { id: "members", label: "Members" },
  { id: "defects", label: "Defects" },
  { id: "release", label: "Release" },
  { id: "finance", label: "Finance" },
  { id: "settings", label: "Settings" },
];

test("disabled project modules disappear from navigation", () => {
  const visible = filterProjectNavigation(projectNavigationFixture, {
    planning: { enabled: false },
    finance: { trackFinance: false },
    quality: { defectManagement: false },
    releaseManagement: { enabled: false },
    collaboration: { workspaceEnabled: false },
  });

  assert.deepEqual(visible.map((item) => item.id), [
    "overview",
    "members",
    "settings",
  ]);
});

test("re-enabling modules restores navigation without changing project data", () => {
  const existingProjectData = {
    projectId: "project-settings-fixture",
    planning: [{ id: "milestone-1", name: "Launch" }],
    finance: [{ id: "finance-entry-1", amount: 1250 }],
    defects: [{ id: "defect-1", title: "Retained defect" }],
    workspace: [{ id: "message-1", body: "Retained decision" }],
  };
  const disabledSettings = {
    planning: { enabled: false },
    finance: { trackFinance: false },
    quality: { defectManagement: false },
    releaseManagement: { enabled: false },
    collaboration: { workspaceEnabled: false },
  };
  const reenabledSettings = {
    planning: { enabled: true },
    finance: { trackFinance: true },
    quality: { defectManagement: true },
    releaseManagement: { enabled: true },
    collaboration: { workspaceEnabled: true },
  };

  const hidden = filterProjectNavigation(projectNavigationFixture, disabledSettings);
  const restored = filterProjectNavigation(projectNavigationFixture, reenabledSettings);

  assert.deepEqual(hidden.map((item) => item.id), ["overview", "members", "settings"]);
  assert.deepEqual(restored.map((item) => item.id), projectNavigationFixture.map((item) => item.id));
  assert.deepEqual(existingProjectData, {
    projectId: "project-settings-fixture",
    planning: [{ id: "milestone-1", name: "Launch" }],
    finance: [{ id: "finance-entry-1", amount: 1250 }],
    defects: [{ id: "defect-1", title: "Retained defect" }],
    workspace: [{ id: "message-1", body: "Retained decision" }],
  });
});