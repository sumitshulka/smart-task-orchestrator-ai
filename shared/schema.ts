import { pgTable, text, uuid, timestamp, integer, boolean, pgEnum, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Organization settings table
export const organizationSettings = pgTable("organization_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_name: text("organization_name").notNull().default("My Organization"),
  date_format: text("date_format").notNull().default("MM/dd/yyyy"),
  time_zone: text("time_zone").notNull().default("UTC"),
  // Daily hour limit settings (separate from benchmarking)
  daily_hour_limit_enabled: boolean("daily_hour_limit_enabled").default(true),
  max_daily_hours_limit: integer("max_daily_hours_limit").default(14),
  // Benchmarking settings
  benchmarking_enabled: boolean("benchmarking_enabled").default(false),
  min_hours_per_day: integer("min_hours_per_day").default(0),
  max_hours_per_day: integer("max_hours_per_day").default(8),
  min_hours_per_week: integer("min_hours_per_week").default(0),
  max_hours_per_week: integer("max_hours_per_week").default(40),
  min_hours_per_month: integer("min_hours_per_month").default(0),
  max_hours_per_month: integer("max_hours_per_month").default(160),
  allow_user_level_override: boolean("allow_user_level_override").default(false),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Core users table (integrates with Supabase Auth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(), // matches auth.users.id from Supabase
  email: text("email").notNull().unique(),
  user_name: text("user_name"),
  department: text("department"),
  phone: text("phone"),
  manager: text("manager"),
  is_active: boolean("is_active").default(true),
  // Benchmarking fields (only used if organization allows user-level override)
  benchmarking_excluded: boolean("benchmarking_excluded").default(false),
  custom_min_hours_per_day: integer("custom_min_hours_per_day"),
  custom_max_hours_per_day: integer("custom_max_hours_per_day"),
  custom_min_hours_per_week: integer("custom_min_hours_per_week"),
  custom_max_hours_per_week: integer("custom_max_hours_per_week"),
  custom_min_hours_per_month: integer("custom_min_hours_per_month"),
  custom_max_hours_per_month: integer("custom_max_hours_per_month"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Deleted users table for admin-only access
export const deletedUsers = pgTable("deleted_users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  user_name: text("user_name"),
  department: text("department"),
  phone: text("phone"),
  manager: text("manager"),
  created_at: timestamp("created_at").notNull(),
  updated_at: timestamp("updated_at").notNull(),
  deleted_at: timestamp("deleted_at").defaultNow().notNull(),
  deleted_by: uuid("deleted_by").notNull(),
});

// Deleted tasks table for admin-only access
export const deletedTasks = pgTable("deleted_tasks", {
  id: uuid("id").primaryKey(),
  task_number: integer("task_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("new"),
  due_date: timestamp("due_date"),
  estimated_hours: integer("estimated_hours"),
  actual_hours: integer("actual_hours").default(0),
  assigned_to: uuid("assigned_to"),
  assigned_to_name: text("assigned_to_name"),
  created_by: uuid("created_by").notNull(),
  created_by_name: text("created_by_name").notNull(),
  team_id: uuid("team_id"),
  team_name: text("team_name"),
  task_group_id: uuid("task_group_id"),
  task_group_name: text("task_group_name"),
  start_date: timestamp("start_date"),
  completion_date: timestamp("completion_date"),
  created_at: timestamp("created_at").notNull(),
  updated_at: timestamp("updated_at").notNull(),
  deleted_at: timestamp("deleted_at").defaultNow().notNull(),
  deleted_by: uuid("deleted_by").notNull(),
  original_user_id: uuid("original_user_id").notNull(),
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
  manager_id: uuid("manager_id").references(() => users.id), // Team manager
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
  is_default: boolean("is_default").default(false), // Only one status can be default
  can_delete: boolean("can_delete").default(true), // Whether tasks with this status can be deleted
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Task status transitions
export const taskStatusTransitions = pgTable("task_status_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  from_status: text("from_status").notNull(), // Store status names directly
  to_status: text("to_status").notNull(), // Store status names directly
  created_at: timestamp("created_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_number: serial("task_number").unique(), // Human-readable task ID
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
  // Timer-related fields
  is_time_managed: boolean("is_time_managed").default(false),
  timer_state: text("timer_state").default("stopped"), // stopped, running, paused
  time_spent_minutes: integer("time_spent_minutes").default(0), // Total time spent in minutes
  timer_started_at: timestamp("timer_started_at"), // When current timer session started
  timer_session_data: text("timer_session_data"), // JSON data for timer sessions
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

export const taskGroupMembers = pgTable("task_group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  group_id: uuid("group_id").notNull().references(() => taskGroups.id),
  user_id: uuid("user_id").notNull().references(() => users.id),
  role: text("role").default("member"), // "member" or "manager"
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
  groupMembers: many(taskGroupMembers),
}));

export const taskGroupTasksRelations = relations(taskGroupTasks, ({ one }) => ({
  group: one(taskGroups, { fields: [taskGroupTasks.group_id], references: [taskGroups.id] }),
  task: one(tasks, { fields: [taskGroupTasks.task_id], references: [tasks.id] }),
}));

export const taskGroupMembersRelations = relations(taskGroupMembers, ({ one }) => ({
  group: one(taskGroups, { fields: [taskGroupMembers.group_id], references: [taskGroups.id] }),
  user: one(users, { fields: [taskGroupMembers.user_id], references: [users.id] }),
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
}).extend({
  due_date: z.union([z.date(), z.string().transform((str) => str === "" ? null : new Date(str))]).nullable().optional(),
  start_date: z.union([z.date(), z.string().transform((str) => str === "" ? null : new Date(str))]).nullable().optional(),
  actual_completion_date: z.union([z.date(), z.string().transform((str) => str === "" ? null : new Date(str))]).nullable().optional(),
  priority: z.union([z.number(), z.string().transform((str) => parseInt(str, 10))]).optional(),
  estimated_hours: z.union([z.number(), z.string().transform((str) => parseInt(str, 10))]).nullable().optional(),
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

export const insertDeletedUserSchema = createInsertSchema(deletedUsers).omit({
  deleted_at: true,
});

export const insertDeletedTaskSchema = createInsertSchema(deletedTasks).omit({
  deleted_at: true,
});

export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettings).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertTaskStatusTransitionSchema = createInsertSchema(taskStatusTransitions).omit({
  id: true,
  created_at: true,
});

export const insertOfficeLocationSchema = createInsertSchema(officeLocations).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// License management schema
export const licenses = pgTable('licenses', {
  id: serial('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  clientId: text('client_id').notNull(),
  licenseKey: text('license_key').notNull(),
  subscriptionType: text('subscription_type').notNull(),
  validTill: timestamp('valid_till').notNull(),
  mutualKey: text('mutual_key').notNull(), // Encrypted
  checksum: text('checksum').notNull(),
  subscriptionData: text('subscription_data').notNull(), // Encrypted JSON
  baseUrl: text('base_url'),
  isActive: boolean('is_active').default(true),
  lastValidated: timestamp('last_validated'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertLicenseSchema = createInsertSchema(licenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true
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
export type TaskGroupMember = typeof taskGroupMembers.$inferSelect;
export type DeletedUser = typeof deletedUsers.$inferSelect;
export type DeletedTask = typeof deletedTasks.$inferSelect;
export type InsertDeletedUser = z.infer<typeof insertDeletedUserSchema>;
export type InsertDeletedTask = z.infer<typeof insertDeletedTaskSchema>;
export type InsertOrganizationSettings = z.infer<typeof insertOrganizationSettingsSchema>;
export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type InsertTaskStatusTransition = z.infer<typeof insertTaskStatusTransitionSchema>;
export type TaskStatusTransition = typeof taskStatusTransitions.$inferSelect;
export type InsertOfficeLocation = z.infer<typeof insertOfficeLocationSchema>;
export type OfficeLocation = typeof officeLocations.$inferSelect;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type License = typeof licenses.$inferSelect;
