import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import express from "express";
import type { Server } from "node:http";
import * as XLSX from "xlsx";
import { registerRoutes } from "./routes";
import { storage } from "./storage";

const regularUserId = "task-route-regular-user";
const adminUserId = "task-route-admin-user";
const ownedTask = {
  id: "task-route-owned",
  title: "Owned task",
  assigned_to: regularUserId,
};
const privateTask = {
  id: "task-route-private",
  title: "Private task",
  assigned_to: "task-route-other-user",
};

let server: Server;
let baseUrl: string;

const originalStorageMethods = {
  getTask: storage.getTask,
  getTaskForUser: storage.getTaskForUser,
  getUserRoles: storage.getUserRoles,
  getAllRoles: storage.getAllRoles,
  getAllUsers: storage.getAllUsers,
  getProjectAllocationRows: storage.getProjectAllocationRows,
  getOrganizationSettings: storage.getOrganizationSettings,
};

before(async () => {
  const tasks = new Map([
    [ownedTask.id, ownedTask],
    [privateTask.id, privateTask],
  ]);

  storage.getTask = async (id) => tasks.get(id) as typeof ownedTask | undefined;
  storage.getTaskForUser = async (id, userId) => {
    const task = tasks.get(id);
    return task?.assigned_to === userId
      ? task as typeof ownedTask
      : undefined;
  };
  storage.getUserRoles = async (userId) => [{
    id: `user-role-${userId}`,
    user_id: userId,
    role_id: userId === adminUserId ? "admin-role" : "user-role",
    assigned_by: null,
    assigned_at: new Date(),
  }];
  storage.getAllRoles = async () => [
    {
      id: "admin-role",
      name: "admin",
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: "user-role",
      name: "user",
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];
  storage.getAllUsers = async () => [
    { id: "allocation-user-1", email: "alex@example.com", user_name: "Alex", is_active: true } as any,
    { id: "allocation-user-2", email: "sam@example.com", user_name: "Sam", is_active: true } as any,
  ];
  storage.getProjectAllocationRows = async () => [{
    project_id: "allocation-project-1",
    project_name: "Allocation Fixture",
    project_code: "ALLOC-1",
    project_status: "active",
    project_start_date: new Date("2026-01-01T00:00:00.000Z"),
    project_end_date: null,
    project_actual_end_date: null,
    user_id: "allocation-user-1",
    member_user_type: "internal",
    allocation_percentage: 60,
    joined_at: new Date("2026-01-01T00:00:00.000Z"),
    left_at: null,
  }];
  storage.getOrganizationSettings = async () => ({ time_zone: "UTC" } as any);

  const app = express();
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  storage.getTask = originalStorageMethods.getTask;
  storage.getTaskForUser = originalStorageMethods.getTaskForUser;
  storage.getUserRoles = originalStorageMethods.getUserRoles;
  storage.getAllRoles = originalStorageMethods.getAllRoles;
  storage.getAllUsers = originalStorageMethods.getAllUsers;
  storage.getProjectAllocationRows = originalStorageMethods.getProjectAllocationRows;
  storage.getOrganizationSettings = originalStorageMethods.getOrganizationSettings;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

async function getTask(taskId: string, userId?: string) {
  const response = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
    headers: userId ? { "x-user-id": userId } : undefined,
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

test("GET /api/tasks/:id requires authentication", async () => {
  const response = await getTask(ownedTask.id);

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Authentication required" });
});

test("regular users can retrieve an assigned task", async () => {
  const response = await getTask(ownedTask.id, regularUserId);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, ownedTask);
});

test("regular users cannot retrieve another user's task", async () => {
  const response = await getTask(privateTask.id, regularUserId);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "Task not found" });
});

test("organization admins can retrieve any task", async () => {
  const response = await getTask(privateTask.id, adminUserId);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, privateTask);
});

test("allocations report requires manager or admin access", async () => {
  const anonymous = await fetch(`${baseUrl}/api/reports/allocations`);
  assert.equal(anonymous.status, 401);

  const regular = await fetch(`${baseUrl}/api/reports/allocations`, {
    headers: { "x-user-id": regularUserId },
  });
  assert.equal(regular.status, 403);
});

test("organization admins can retrieve all users and current allocation totals", async () => {
  const response = await fetch(`${baseUrl}/api/reports/allocations`, {
    headers: { "x-user-id": adminUserId },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.reportDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(body.users.length, 2);
  assert.equal(body.users.find((user: any) => user.id === "allocation-user-1").totalAllocationPercentage, 60);
  assert.equal(body.users.find((user: any) => user.id === "allocation-user-1").availableLoadPercentage, 40);
  assert.equal(body.users.find((user: any) => user.id === "allocation-user-2").availableLoadPercentage, 100);
});

test("allocation report downloads preserve the as-of date and include every project row", async () => {
  const asOfDate = "2026-10-06";
  const headers = { "x-user-id": adminUserId };

  const anonymousPdf = await fetch(`${baseUrl}/api/reports/allocations.pdf?asOf=${asOfDate}`);
  assert.equal(anonymousPdf.status, 401);
  const regularExcel = await fetch(`${baseUrl}/api/reports/allocations.xlsx?asOf=${asOfDate}`, {
    headers: { "x-user-id": regularUserId },
  });
  assert.equal(regularExcel.status, 403);

  const pdfResponse = await fetch(`${baseUrl}/api/reports/allocations.pdf?asOf=${asOfDate}`, { headers });
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
  assert.match(pdfResponse.headers.get("content-disposition") ?? "", new RegExp(asOfDate));
  assert.equal(pdf.toString("ascii", 0, 5), "%PDF-");

  const excelResponse = await fetch(`${baseUrl}/api/reports/allocations.xlsx?asOf=${asOfDate}`, { headers });
  const excel = Buffer.from(await excelResponse.arrayBuffer());
  assert.equal(excelResponse.status, 200);
  assert.match(excelResponse.headers.get("content-type") ?? "", /spreadsheetml\.sheet/);
  assert.match(excelResponse.headers.get("content-disposition") ?? "", new RegExp(asOfDate));
  assert.equal(excel.toString("ascii", 0, 2), "PK");

  const workbook = XLSX.read(excel, { type: "buffer" });
  const summaryRows = XLSX.utils.sheet_to_json(workbook.Sheets["User Summary"], { header: 1 }) as any[][];
  const allocationRows = XLSX.utils.sheet_to_json(workbook.Sheets["Project Allocations"], { header: 1 }) as any[][];
  assert.deepEqual(summaryRows[1], ["As of", asOfDate, "Time zone", "UTC"]);
  assert.ok(allocationRows.some((row) =>
    row[0] === "Alex" &&
    row[2] === "Allocation Fixture" &&
    row[9] === 60 &&
    row[10] === 40
  ));
  assert.ok(allocationRows.some((row) => row[0] === "Sam" && row[2] === "No project allocations"));
});