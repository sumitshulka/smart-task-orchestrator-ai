import assert from "node:assert/strict";
import test from "node:test";
import { fetchTasksPaginated } from "./tasks";

test("paginated task fetch sends filters and preserves the server total", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const requests: Array<{ url: string; options?: RequestInit }> = [];

  globalThis.localStorage = {
    getItem: () => JSON.stringify({ id: "user-1" }),
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  };
  globalThis.fetch = async (input, options) => {
    requests.push({ url: String(input), options });
    return new Response(JSON.stringify({
      tasks: [{ id: "task-1", assigned_to: "user-1" }],
      total: 42,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await fetchTasksPaginated({
      assignedTo: "user-1",
      status: "In Progress",
      priority: 0,
      teamId: "team-1",
      fromDate: "2026-09-01",
      toDate: "2026-09-30",
      includeOverdue: true,
      offset: 25,
      limit: 25,
    });

    assert.equal(requests.length, 1);
    const requestUrl = new URL(requests[0].url, "http://localhost");
    assert.deepEqual(Object.fromEntries(requestUrl.searchParams), {
      paginated: "true",
      fromDate: "2026-09-01",
      toDate: "2026-09-30",
      assignedTo: "user-1",
      teamId: "team-1",
      status: "In Progress",
      priority: "0",
      offset: "25",
      limit: "25",
      includeOverdue: "true",
    });
    assert.equal(result.total, 42);
    assert.deepEqual(result.tasks[0], {
      id: "task-1",
      assigned_to: "user-1",
      assigned_user: null,
      actual_completion_date: null,
      group_ids: [],
      is_dependent: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
});