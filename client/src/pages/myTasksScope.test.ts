import assert from "node:assert/strict";
import test from "node:test";
import { buildMyTasksInput } from "./myTasksScope";

const filters = {
  fromDate: "2026-09-01",
  toDate: "2026-09-30",
  teamId: "team-1",
  status: "In Progress",
  priority: 1,
  offset: 25,
  limit: 25,
  includeOverdue: true,
};

test("admin My Tasks mode is restricted to the current user", () => {
  const input = buildMyTasksInput({
    userId: "admin-1",
    isAdmin: true,
    adminTaskView: "mine",
    assigneeFilter: "user-2",
    filters,
  });

  assert.equal(input.assignedTo, "admin-1");
  assert.deepEqual({ ...input, assignedTo: undefined }, {
    ...filters,
    assignedTo: undefined,
  });
});

test("admin All User Tasks mode can request every assignee", () => {
  const input = buildMyTasksInput({
    userId: "admin-1",
    isAdmin: true,
    adminTaskView: "all",
    assigneeFilter: "all",
    filters,
  });

  assert.equal(input.assignedTo, undefined);
  assert.deepEqual(input, { ...filters, assignedTo: undefined });
});

test("admin All User Tasks mode can request one selected assignee", () => {
  const input = buildMyTasksInput({
    userId: "admin-1",
    isAdmin: true,
    adminTaskView: "all",
    assigneeFilter: "user-2",
    filters,
  });

  assert.equal(input.assignedTo, "user-2");
  assert.deepEqual(input, { ...filters, assignedTo: "user-2" });
});

test("non-admin users remain restricted even with an all-users selection", () => {
  const input = buildMyTasksInput({
    userId: "user-1",
    isAdmin: false,
    adminTaskView: "all",
    assigneeFilter: "all",
    filters,
  });

  assert.equal(input.assignedTo, "user-1");
  assert.deepEqual(input, { ...filters, assignedTo: "user-1" });
});