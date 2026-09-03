import {
  and,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { tasks } from "@shared/schema";

export type TaskQueryFilters = {
  assignedTo?: string;
  teamId?: string;
  status?: string;
  priority?: number;
  fromDate?: string;
  toDate?: string;
  offset?: number;
  limit?: number;
  includeOverdue?: boolean;
};

export type TaskVisibilityScope = "user" | "team" | "organization";

export function hasTaskQueryParams(query: Record<string, unknown>): boolean {
  return [
    "fromDate",
    "toDate",
    "assignedTo",
    "teamId",
    "status",
    "priority",
    "offset",
    "limit",
    "includeOverdue",
    "paginated",
  ].some((key) => query[key] !== undefined);
}

function getTaskQueryValue(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${key} query parameter`);
  }
  return value;
}

function getTaskQueryInteger(
  query: Record<string, unknown>,
  key: string,
  minimum: number,
): number | undefined {
  const value = getTaskQueryValue(query, key);
  if (value === undefined) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`Invalid ${key} query parameter`);
  }
  return parsed;
}

export function getTaskQueryFilters(
  query: Record<string, unknown>,
): TaskQueryFilters {
  const fromDate = getTaskQueryValue(query, "fromDate");
  const toDate = getTaskQueryValue(query, "toDate");
  for (const [key, value] of [["fromDate", fromDate], ["toDate", toDate]]) {
    if (value && Number.isNaN(new Date(value).getTime())) {
      throw new Error(`Invalid ${key} query parameter`);
    }
  }

  return {
    fromDate,
    toDate,
    assignedTo: getTaskQueryValue(query, "assignedTo"),
    teamId: getTaskQueryValue(query, "teamId"),
    status: getTaskQueryValue(query, "status"),
    priority: getTaskQueryInteger(query, "priority", -1),
    offset: getTaskQueryInteger(query, "offset", 0),
    limit: getTaskQueryInteger(query, "limit", 1),
    includeOverdue: getTaskQueryValue(query, "includeOverdue") === "true",
  };
}

/**
 * Apply the server-side assignment boundary after parsing caller filters.
 * Organization admins may query all assignees or one selected assignee.
 */
export function applyTaskVisibilityScope(
  filters: TaskQueryFilters,
  scope: TaskVisibilityScope,
  userId: string,
): TaskQueryFilters {
  return scope === "user"
    ? { ...filters, assignedTo: userId }
    : { ...filters };
}

export function getTeamVisibleUserIds(
  userId: string,
  users: ReadonlyArray<{ id: string; manager?: string | null }>,
): string[] {
  return users
    .filter((user) => user.manager === userId || user.id === userId)
    .map((user) => user.id);
}

/**
 * Build the single condition shared by the count and task-row queries.
 * Keeping this in one function prevents pagination from changing visibility.
 */
export function buildTaskQueryConditions(
  filters: TaskQueryFilters,
  visibleUserIds?: string[],
  now = new Date(),
): SQL | undefined {
  if (visibleUserIds && visibleUserIds.length === 0) {
    return sql`false`;
  }

  const conditions: SQL[] = [];

  if (visibleUserIds) {
    conditions.push(inArray(tasks.assigned_to, visibleUserIds));
  }
  if (filters.assignedTo) {
    conditions.push(eq(tasks.assigned_to, filters.assignedTo));
  }
  if (filters.teamId) {
    conditions.push(eq(tasks.team_id, filters.teamId));
  }
  if (filters.status && filters.status !== "all") {
    conditions.push(ilike(tasks.status, `%${filters.status}%`));
  }
  if (filters.priority !== undefined && filters.priority !== -1) {
    conditions.push(eq(tasks.priority, filters.priority));
  }

  const dateConditions: SQL[] = [];
  if (filters.fromDate) {
    dateConditions.push(gte(tasks.created_at, new Date(filters.fromDate)));
  }
  if (filters.toDate) {
    dateConditions.push(lte(tasks.created_at, new Date(filters.toDate)));
  }

  if (dateConditions.length > 0) {
    const createdAtCondition = and(...dateConditions);
    if (!createdAtCondition) {
      throw new Error("Unable to build task date condition");
    }

    if (filters.includeOverdue) {
      const overdueCondition = and(
        lt(tasks.due_date, now),
        sql`lower(${tasks.status}) NOT IN ('completed', 'done', 'verified', 'closed', 'resolved')`,
      );
      if (!overdueCondition) {
        throw new Error("Unable to build overdue task condition");
      }
      const overdueAwareCondition = or(createdAtCondition, overdueCondition);
      if (!overdueAwareCondition) {
        throw new Error("Unable to build overdue-aware task condition");
      }
      conditions.push(overdueAwareCondition);
    } else {
      conditions.push(createdAtCondition);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}