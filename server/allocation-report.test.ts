import assert from "node:assert/strict";
import test from "node:test";
import { buildAllocationsReport } from "./allocation-report";

const users = [
  { id: "u1", email: "alex@example.com", user_name: "Alex", is_active: true },
  { id: "u2", email: "sam@example.com", user_name: "Sam", is_active: true },
];

test("allocation report includes users without allocations and calculates available load", () => {
  const report = buildAllocationsReport(users, [
    {
      project_id: "p1",
      project_name: "Alpha",
      project_code: "ALPHA",
      project_status: "active",
      project_start_date: "2026-01-01",
      project_end_date: "2026-12-31",
      project_actual_end_date: null,
      user_id: "u1",
      member_user_type: "internal",
      allocation_percentage: 40,
      joined_at: "2026-01-10",
      left_at: null,
    },
    {
      project_id: "p2",
      project_name: "Beta",
      project_code: null,
      project_status: "active",
      project_start_date: "2026-02-01",
      project_end_date: null,
      project_actual_end_date: null,
      user_id: "u1",
      member_user_type: "internal",
      allocation_percentage: 30,
      joined_at: "2026-01-20",
      left_at: null,
    },
  ], "2026-06-01");

  assert.equal(report.length, 2);
  assert.equal(report[0].name, "Alex");
  assert.equal(report[0].totalAllocationPercentage, 70);
  assert.equal(report[0].availableLoadPercentage, 30);
  assert.equal(report[0].assignments[0].startDate, "2026-01-10");
  assert.equal(report[1].totalAllocationPercentage, 0);
  assert.equal(report[1].availableLoadPercentage, 100);
});

test("allocation report excludes future and closed project allocations from today's load", () => {
  const report = buildAllocationsReport([users[0]], [
    {
      project_id: "future",
      project_name: "Future",
      project_code: null,
      project_status: "planning",
      project_start_date: "2026-07-01",
      project_end_date: "2026-09-01",
      project_actual_end_date: null,
      user_id: "u1",
      member_user_type: "internal",
      allocation_percentage: 50,
      joined_at: "2026-01-01",
      left_at: null,
    },
    {
      project_id: "done",
      project_name: "Done",
      project_code: null,
      project_status: "completed",
      project_start_date: "2025-01-01",
      project_end_date: "2025-12-31",
      project_actual_end_date: "2025-12-20",
      user_id: "u1",
      member_user_type: "internal",
      allocation_percentage: 40,
      joined_at: "2025-01-01",
      left_at: null,
    },
  ], "2026-06-01");

  assert.equal(report[0].totalAllocationPercentage, 0);
  assert.equal(report[0].assignments.find((assignment) => assignment.projectId === "done")?.allocationState, "Ended");
  assert.equal(report[0].assignments.find((assignment) => assignment.projectId === "future")?.allocationState, "Upcoming");
});

test("allocation report preserves over-allocation as negative available capacity", () => {
  const report = buildAllocationsReport([users[0]], [
    {
      project_id: "p1",
      project_name: "Alpha",
      project_code: null,
      project_status: "active",
      project_start_date: null,
      project_end_date: null,
      project_actual_end_date: null,
      user_id: "u1",
      member_user_type: "internal",
      allocation_percentage: 120,
      joined_at: "2026-01-01",
      left_at: null,
    },
  ], "2026-06-01");

  assert.equal(report[0].totalAllocationPercentage, 120);
  assert.equal(report[0].availableLoadPercentage, -20);
});
