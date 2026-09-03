import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import express from "express";
import type { Server } from "node:http";
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