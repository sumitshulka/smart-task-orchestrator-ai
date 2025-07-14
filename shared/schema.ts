import { pgTable, text, uuid, timestamp, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Core users table (integrates with Supabase Auth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(), // matches auth.users.id from Supabase
  email: text("email").notNull().unique(),
  user_name: text("user_name"),
  department: text("department"),
  phone: text("phone"),
  manager: text("manager"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Roles table
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  visibility_scope: text("visibility_scope").notNull().default("user"), // user, manager, team, organization
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// User roles mapping
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role_id: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  assigned_by: uuid("assigned_by"),
  assigned_at: timestamp("assigned_at").defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  created_by: uuid("created_by").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Team memberships
export const teamMemberships = pgTable("team_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role_within_team: text("role_within_team"),
  joined_at: timestamp("joined_at").defaultNow(),
});

// Departments table
export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Office locations
export const officeLocations = pgTable("office_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  location_name: text("location_name").notNull(),
  address: text("address").notNull(),
  location_manager: uuid("location_manager"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Task statuses
export const taskStatuses = pgTable("task_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6b7280"), // Default gray color
  sequence_order: integer("sequence_order").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Task status transitions
export const taskStatusTransitions = pgTable("task_status_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  from_status: uuid("from_status").references(() => taskStatuses.id),
  to_status: uuid("to_status").references(() => taskStatuses.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  priority: integer("priority"),
  due_date: timestamp("due_date"),
  start_date: timestamp("start_date"),
  estimated_hours: integer("estimated_hours"),
  status: text("status").notNull().default("pending"),
  type: text("type").notNull(),
  created_by: uuid("created_by").notNull().references(() => users.id),
  assigned_to: uuid("assigned_to").references(() => users.id),
  team_id: uuid("team_id").references(() => teams.id),
  dependencyTaskId: uuid("dependencyTaskId"),
  actual_completion_date: timestamp("actual_completion_date"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Subtasks
export const subtasks = pgTable("subtasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").notNull().references(() => tasks.id),
  title: text("title").notNull(),
  description: text("description"),
  assigned_to: uuid("assigned_to").references(() => users.id),
  due_date: timestamp("due_date"),
  estimated_hours: integer("estimated_hours"),
  status: text("status").notNull().default("pending"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Task dependencies
export const taskDependencies = pgTable("task_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").notNull().references(() => tasks.id),
  depends_on_task_id: uuid("depends_on_task_id").notNull().references(() => tasks.id),
});

// Task attachments
export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").notNull().references(() => tasks.id),
  filename: text("filename"),
  file_url: text("file_url").notNull(),
  mimetype: text("mimetype"),
  uploaded_by: uuid("uploaded_by").references(() => users.id),
  uploaded_at: timestamp("uploaded_at").defaultNow(),
});

// Task activity/audit log
export const taskActivity = pgTable("task_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").notNull().references(() => tasks.id),
  action_type: text("action_type").notNull(),
  old_value: text("old_value"),
  new_value: text("new_value"),
  acted_by: uuid("acted_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Task groups
export const taskGroups = pgTable("task_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull().default("private"),
  owner_id: uuid("owner_id").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Task group tasks mapping
export const taskGroupTasks = pgTable("task_group_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  group_id: uuid("group_id").notNull().references(() => taskGroups.id),
  task_id: uuid("task_id").notNull().references(() => tasks.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Role permissions for granular access control
export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  role_id: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  resource: text("resource").notNull(), // Menu/feature identifier (e.g., 'user-management', 'tasks')
  permission_level: integer("permission_level").notNull().default(0), // 0=None, 1=View, 2=View+Update, 3=View+Update+Create, 4=Full
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  teamMemberships: many(teamMemberships),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  taskActivities: many(taskActivity),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  permissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.user_id], references: [users.id] }),
  role: one(roles, { fields: [userRoles.role_id], references: [roles.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  createdBy: one(users, { fields: [teams.created_by], references: [users.id] }),
  memberships: many(teamMemberships),
  tasks: many(tasks),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  team: one(teams, { fields: [teamMemberships.team_id], references: [teams.id] }),
  user: one(users, { fields: [teamMemberships.user_id], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  createdBy: one(users, { fields: [tasks.created_by], references: [users.id], relationName: "createdTasks" }),
  assignedTo: one(users, { fields: [tasks.assigned_to], references: [users.id], relationName: "assignedTasks" }),
  team: one(teams, { fields: [tasks.team_id], references: [teams.id] }),
  subtasks: many(subtasks),
  dependencies: many(taskDependencies, { relationName: "taskDependencies" }),
  dependents: many(taskDependencies, { relationName: "dependentTasks" }),
  attachments: many(taskAttachments),
  activities: many(taskActivity),
  groupTasks: many(taskGroupTasks),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, { fields: [subtasks.task_id], references: [tasks.id] }),
  assignedTo: one(users, { fields: [subtasks.assigned_to], references: [users.id] }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, { fields: [taskDependencies.task_id], references: [tasks.id], relationName: "taskDependencies" }),
  dependsOnTask: one(tasks, { fields: [taskDependencies.depends_on_task_id], references: [tasks.id], relationName: "dependentTasks" }),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, { fields: [taskAttachments.task_id], references: [tasks.id] }),
  uploadedBy: one(users, { fields: [taskAttachments.uploaded_by], references: [users.id] }),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
  task: one(tasks, { fields: [taskActivity.task_id], references: [tasks.id] }),
  actedBy: one(users, { fields: [taskActivity.acted_by], references: [users.id] }),
}));

export const taskGroupsRelations = relations(taskGroups, ({ one, many }) => ({
  owner: one(users, { fields: [taskGroups.owner_id], references: [users.id] }),
  groupTasks: many(taskGroupTasks),
}));

export const taskGroupTasksRelations = relations(taskGroupTasks, ({ one }) => ({
  group: one(taskGroups, { fields: [taskGroupTasks.group_id], references: [taskGroups.id] }),
  task: one(tasks, { fields: [taskGroupTasks.task_id], references: [tasks.id] }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.role_id], references: [roles.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  id: z.string().uuid().optional(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  created_at: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  visibility_scope: z.enum(["user", "manager", "team", "organization"]).default("user")
});

export const insertTaskGroupSchema = createInsertSchema(taskGroups).omit({
  id: true,
  created_at: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  permission_level: z.number().min(0).max(4).default(0)
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertTaskGroup = z.infer<typeof insertTaskGroupSchema>;
export type TaskGroup = typeof taskGroups.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type TaskActivity = typeof taskActivity.$inferSelect;
export type TaskStatus = typeof taskStatuses.$inferSelect;
