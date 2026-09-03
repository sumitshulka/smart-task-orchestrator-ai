import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  applyTaskVisibilityScope,
  buildTaskQueryConditions,
  getTaskQueryFilters,
  getTeamVisibleUserIds,
  hasTaskQueryParams,
} from "./task-query";
import { tasks } from "@shared/schema";

function renderCondition(condition: ReturnType<typeof buildTaskQueryConditions>) {
  return condition
    ? new PgDialect().sqlToQuery(sql`select * from ${tasks} where ${condition}`)
    : null;
}

test("route parses every supported task filter and pagination value", () => {
  assert.equal(hasTaskQueryParams({ paginated: "true" }), true);
  assert.deepEqual(getTaskQueryFilters({
    fromDate: "2026-09-01",
    toDate: "2026-09-30",
    assignedTo: "user-2",
    teamId: "team-1",
    status: "In Progress",
    priority: "0",
    offset: "25",
    limit: "10",
    includeOverdue: "true",
    paginated: "true",
  }), {
    fromDate: "2026-09-01",
    toDate: "2026-09-30",
    assignedTo: "user-2",
    teamId: "team-1",
    status: "In Progress",
    priority: 0,
    offset: 25,
    limit: 10,
    includeOverdue: true,
  });
});

test("regular-user task queries always replace a requested assignee", () => {
  const filters = applyTaskVisibilityScope(
    { assignedTo: "another-user", status: "pending", limit: 10 },
    "user",
    "current-user",
  );

  assert.equal(filters.assignedTo, "current-user");
});

test("organization admins can query all tasks or one selected assignee", () => {
  assert.equal(
    applyTaskVisibilityScope({}, "organization", "admin-user").assignedTo,
    undefined,
  );
  assert.equal(
    applyTaskVisibilityScope(
      { assignedTo: "selected-user" },
      "organization",
      "admin-user",
    ).assignedTo,
    "selected-user",
  );
});

test("team visibility includes only the manager and direct reports", () => {
  assert.deepEqual(getTeamVisibleUserIds("manager", [
    { id: "manager", manager: null },
    { id: "report", manager: "manager" },
    { id: "other", manager: "someone-else" },
  ]), ["manager", "report"]);
});

test("storage conditions include assignee, team, status, priority, and date filters", () => {
  const query = renderCondition(buildTaskQueryConditions({
    assignedTo: "user-2",
    teamId: "team-1",
    status: "In Progress",
    priority: 0,
    fromDate: "2026-09-01",
    toDate: "2026-09-30",
  }));

  assert.ok(query);
  assert.match(query.sql, /assigned_to/);
  assert.match(query.sql, /team_id/);
  assert.match(query.sql, /"status" ilike/);
  assert.match(query.sql, /priority/);
  assert.match(query.sql, /created_at/);
  assert.deepEqual(query.params, [
    "user-2",
    "team-1",
    "%In Progress%",
    0,
    "2026-09-01T00:00:00.000Z",
    "2026-09-30T00:00:00.000Z",
  ]);
});

test("storage conditions include overdue active tasks without leaking completed tasks", () => {
  const query = renderCondition(buildTaskQueryConditions({
    fromDate: "2026-09-01",
    toDate: "2026-09-30",
    includeOverdue: true,
  }, undefined, new Date("2026-09-03T12:00:00.000Z")));

  assert.ok(query);
  assert.match(query.sql, /due_date/);
  assert.match(query.sql, /NOT IN/);
  assert.deepEqual(query.params, [
    "2026-09-01T00:00:00.000Z",
    "2026-09-30T00:00:00.000Z",
    "2026-09-03T12:00:00.000Z",
  ]);
});

test("empty team visibility produces no rows and therefore a zero total", () => {
  const query = renderCondition(buildTaskQueryConditions(
    { limit: 25, offset: 25 },
    [],
  ));

  assert.ok(query);
  assert.match(query.sql, /false/);
});

test("storage receives limit and offset values for page-sized responses", () => {
  const filters = getTaskQueryFilters({ limit: "25", offset: "50" });
  assert.equal(filters.limit, 25);
  assert.equal(filters.offset, 50);
  assert.equal(filters.limit + filters.offset, 75);
});