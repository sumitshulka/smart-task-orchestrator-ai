import { eq, desc, and, or, ne } from "drizzle-orm";
import { db } from "./db";
import { 
  users, 
  tasks, 
  teams, 
  roles, 
  userRoles, 
  teamMemberships, 
  taskGroups, 
  taskGroupTasks,
  taskGroupMembers,
  taskActivity, 
  taskStatuses,
  taskStatusTransitions,
  rolePermissions,
  deletedUsers,
  deletedTasks,
  organizationSettings,
  User, 
  InsertUser, 
  Task, 
  InsertTask,
  Team,
  InsertTeam,
  Role,
  TaskGroup,
  InsertTaskGroup,
  TaskGroupMember,
  UserRole,
  TeamMembership,
  TaskActivity,
  TaskStatus,
  TaskStatusTransition,
  InsertTaskStatusTransition,
  RolePermission,
  InsertRolePermission,
  DeletedUser,
  DeletedTask,
  InsertDeletedUser,
  InsertDeletedTask,
  OrganizationSettings,
  InsertOrganizationSettings
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deactivateUser(id: string): Promise<User>;
  activateUser(id: string): Promise<User>;
  deleteUser(id: string, deletedBy: string): Promise<{ deletedUser: any; deletedTasksCount: number }>;
  
  // Deleted user operations (admin only)
  getAllDeletedUsers(): Promise<any[]>;
  getDeletedUserTasks(userId: string): Promise<any[]>;
  restoreDeletedUser(id: string): Promise<User>;
  
  // Task operations
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getTasksByUser(userId: string): Promise<Task[]>;
  getTasksByTeam(teamId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  
  // Team operations
  getTeam(id: string): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  getTeamsByUser(userId: string): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<Team>): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  
  // Role operations
  getAllRoles(): Promise<Role[]>;
  createRole(role: any): Promise<Role>;
  updateRole(id: string, updates: Partial<Role>): Promise<Role>;
  deleteRole(id: string): Promise<void>;
  getUserRoles(userId: string): Promise<UserRole[]>;
  assignUserRole(userId: string, roleId: string): Promise<UserRole>;
  removeUserRole(userId: string, roleId: string): Promise<void>;
  
  // Team membership operations
  getTeamMembers(teamId: string): Promise<TeamMembership[]>;
  addTeamMember(teamId: string, userId: string, role?: string): Promise<TeamMembership>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  
  // Task group operations
  getAllTaskGroups(): Promise<TaskGroup[]>;
  getTaskGroupsForUser(userId: string): Promise<TaskGroup[]>;
  createTaskGroup(group: InsertTaskGroup): Promise<TaskGroup>;
  deleteTaskGroup(id: string): Promise<void>;
  getTaskGroupDetails(id: string): Promise<any>;
  getTaskGroupMembers(groupId: string): Promise<any[]>;
  addTaskGroupMember(groupId: string, userId: string, role?: string): Promise<any>;
  removeTaskGroupMember(groupId: string, userId: string): Promise<void>;
  assignTaskToGroup(groupId: string, taskId: string): Promise<void>;
  removeTaskFromGroup(groupId: string, taskId: string): Promise<void>;
  
  // Task activity operations
  getTaskActivity(taskId: string): Promise<TaskActivity[]>;
  logTaskActivity(activity: Omit<TaskActivity, 'id' | 'created_at'>): Promise<TaskActivity>;
  
  // Task status operations
  getAllTaskStatuses(): Promise<TaskStatus[]>;
  createTaskStatus(status: { name: string; description?: string; color?: string; sequence_order: number; is_default?: boolean; can_delete?: boolean }): Promise<TaskStatus>;
  updateTaskStatus(id: string, updates: Partial<TaskStatus>): Promise<TaskStatus>;
  deleteTaskStatus(id: string): Promise<void>;
  getDefaultTaskStatus(): Promise<TaskStatus | undefined>;
  
  // Enhanced status deletion operations
  getTasksByStatus(statusName: string): Promise<Task[]>;
  deleteStatusWithTaskHandling(statusId: string, action: 'delete_tasks' | 'reassign_tasks', newStatusName?: string): Promise<{ deletedTasks: number; reassignedTasks: number }>;
  getStatusDeletionPreview(statusId: string): Promise<{ statusName: string; taskCount: number; availableStatuses: TaskStatus[]; hasTransitions: boolean }>;

  // Role permissions operations
  getRolePermissions(roleId: string): Promise<RolePermission[]>;
  createRolePermission(permission: InsertRolePermission): Promise<RolePermission>;
  updateRolePermission(id: string, updates: Partial<RolePermission>): Promise<RolePermission>;
  deleteRolePermission(id: string): Promise<void>;

  // Timer operations
  getActiveTimerTasks(userId: string): Promise<Task[]>;
  startTaskTimer(taskId: string, userId: string): Promise<Task>;
  pauseTaskTimer(taskId: string, userId: string): Promise<Task>;
  stopTaskTimer(taskId: string, userId: string): Promise<Task>;
  updateTaskTimer(taskId: string, updates: { time_spent_minutes?: number; timer_state?: string; timer_started_at?: Date | null; timer_session_data?: string }): Promise<Task>;

  // Organization settings operations
  getOrganizationSettings(): Promise<OrganizationSettings | undefined>;
  createOrganizationSettings(settings: InsertOrganizationSettings): Promise<OrganizationSettings>;
  updateOrganizationSettings(id: string, updates: Partial<OrganizationSettings>): Promise<OrganizationSettings>;

  // Task status transition operations
  getAllTaskStatusTransitions(): Promise<TaskStatusTransition[]>;
  createTaskStatusTransition(transition: InsertTaskStatusTransition): Promise<TaskStatusTransition>;
  deleteTaskStatusTransition(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.user_name);
  }

  async deactivateUser(id: string): Promise<User> {
    const result = await db.update(users).set({
      is_active: false,
      updated_at: new Date()
    }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async activateUser(id: string): Promise<User> {
    const result = await db.update(users).set({
      is_active: true,
      updated_at: new Date()
    }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string, deletedBy: string): Promise<{ deletedUser: any; deletedTasksCount: number }> {
    // Get user data before deletion
    const user = await this.getUser(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Get user's tasks before deletion
    const userTasks = await db.select().from(tasks).where(eq(tasks.assigned_to, id));

    // Move user to deleted_users table
    const deletedUser = await db.insert(deletedUsers).values({
      id: user.id,
      email: user.email,
      user_name: user.user_name,
      department: user.department,
      phone: user.phone,
      manager: user.manager,
      created_at: user.created_at!,
      updated_at: user.updated_at!,
      deleted_by: deletedBy
    }).returning();

    // Move user's tasks to deleted_tasks table
    let deletedTasksCount = 0;
    for (const task of userTasks) {
      // Get additional task information
      const assignedUser = task.assigned_to ? await this.getUser(task.assigned_to) : null;
      const createdUser = await this.getUser(task.created_by);
      const team = task.team_id ? await this.getTeam(task.team_id) : null;

      await db.insert(deletedTasks).values({
        id: task.id,
        task_number: task.task_number,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date,
        estimated_hours: task.estimated_hours,
        actual_hours: task.actual_hours,
        assigned_to: task.assigned_to,
        assigned_to_name: assignedUser?.user_name || null,
        created_by: task.created_by,
        created_by_name: createdUser?.user_name || 'Unknown',
        team_id: task.team_id,
        team_name: team?.name || null,
        task_group_id: task.task_group_id,
        task_group_name: null, // Will get from task groups later if needed
        start_date: task.start_date,
        completion_date: task.actual_completion_date,
        created_at: task.created_at!,
        updated_at: task.updated_at!,
        deleted_by: deletedBy,
        original_user_id: id
      });
      deletedTasksCount++;
    }

    // Delete user's tasks from active tasks table
    await db.delete(tasks).where(eq(tasks.assigned_to, id));

    // Remove user from teams
    await db.delete(teamMemberships).where(eq(teamMemberships.user_id, id));

    // Remove user from task groups
    await db.delete(taskGroupMembers).where(eq(taskGroupMembers.user_id, id));

    // Remove user roles
    await db.delete(userRoles).where(eq(userRoles.user_id, id));

    // Finally delete the user
    await db.delete(users).where(eq(users.id, id));

    return { deletedUser: deletedUser[0], deletedTasksCount };
  }

  async getAllDeletedUsers(): Promise<any[]> {
    const result = await db.select().from(deletedUsers).orderBy(desc(deletedUsers.deleted_at));
    return result;
  }

  async getDeletedUserTasks(userId: string): Promise<any[]> {
    const result = await db.select().from(deletedTasks)
      .where(eq(deletedTasks.original_user_id, userId))
      .orderBy(desc(deletedTasks.created_at));
    return result;
  }

  async restoreDeletedUser(id: string): Promise<User> {
    // This could be implemented later if needed
    throw new Error('User restoration not implemented yet');
  }

  // Task operations
  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.created_at));
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(
      or(eq(tasks.assigned_to, userId), eq(tasks.created_by, userId))
    ).orderBy(desc(tasks.created_at));
  }

  async getTasksByTeam(teamId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.team_id, teamId)).orderBy(desc(tasks.created_at));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const result = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Team operations
  async getTeam(id: string): Promise<Team | undefined> {
    const result = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        created_by: teams.created_by,
        manager_id: teams.manager_id,
        created_at: teams.created_at,
        manager: {
          id: users.id,
          user_name: users.user_name,
          email: users.email,
        }
      })
      .from(teams)
      .leftJoin(users, eq(teams.manager_id, users.id))
      .where(eq(teams.id, id))
      .limit(1);
    return result[0];
  }

  async getAllTeams(): Promise<Team[]> {
    return await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        created_by: teams.created_by,
        manager_id: teams.manager_id,
        created_at: teams.created_at,
        manager: {
          id: users.id,
          user_name: users.user_name,
          email: users.email,
        }
      })
      .from(teams)
      .leftJoin(users, eq(teams.manager_id, users.id))
      .orderBy(teams.name);
  }

  async getTeamsByUser(userId: string): Promise<Team[]> {
    return await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        created_by: teams.created_by,
        manager_id: teams.manager_id,
        created_at: teams.created_at,
        manager: {
          id: users.id,
          user_name: users.user_name,
          email: users.email,
        }
      })
      .from(teams)
      .leftJoin(users, eq(teams.manager_id, users.id))
      .innerJoin(teamMemberships, eq(teams.id, teamMemberships.team_id))
      .where(eq(teamMemberships.user_id, userId))
      .orderBy(teams.name);
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const result = await db.insert(teams).values(team).returning();
    return result[0];
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
    const result = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return result[0];
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  // Role operations
  async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles);
  }

  async createRole(role: any): Promise<Role> {
    const result = await db.insert(roles).values(role).returning();
    return result[0];
  }

  async updateRole(id: string, updates: Partial<Role>): Promise<Role> {
    const result = await db.update(roles).set(updates).where(eq(roles.id, id)).returning();
    return result[0];
  }

  async deleteRole(id: string): Promise<void> {
    await db.delete(roles).where(eq(roles.id, id));
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    return await db
      .select({
        id: userRoles.id,
        user_id: userRoles.user_id,
        role_id: userRoles.role_id,
        assigned_by: userRoles.assigned_by,
        assigned_at: userRoles.assigned_at,
        role: {
          id: roles.id,
          name: roles.name,
          description: roles.description,
          created_at: roles.created_at,
          updated_at: roles.updated_at,
        }
      })
      .from(userRoles)
      .leftJoin(roles, eq(userRoles.role_id, roles.id))
      .where(eq(userRoles.user_id, userId))
      .limit(10); // Add limit to prevent runaway queries
  }

  async assignUserRole(userId: string, roleId: string): Promise<UserRole> {
    // First, remove any existing roles for this user (enforce single role per user)
    await db.delete(userRoles).where(eq(userRoles.user_id, userId));
    
    // Then assign the new role
    const result = await db.insert(userRoles).values({
      user_id: userId,
      role_id: roleId
    }).returning();
    return result[0];
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await db.delete(userRoles).where(
      and(eq(userRoles.user_id, userId), eq(userRoles.role_id, roleId))
    );
  }

  // Team membership operations
  async getTeamMembers(teamId: string): Promise<TeamMembership[]> {
    return await db
      .select({
        id: teamMemberships.id,
        team_id: teamMemberships.team_id,
        user_id: teamMemberships.user_id,
        role_within_team: teamMemberships.role_within_team,
        joined_at: teamMemberships.joined_at,
        user: {
          id: users.id,
          user_name: users.user_name,
          email: users.email,
        }
      })
      .from(teamMemberships)
      .leftJoin(users, eq(teamMemberships.user_id, users.id))
      .where(eq(teamMemberships.team_id, teamId));
  }

  async addTeamMember(teamId: string, userId: string, role?: string): Promise<TeamMembership> {
    const result = await db.insert(teamMemberships).values({
      team_id: teamId,
      user_id: userId,
      role_within_team: role
    }).returning();
    return result[0];
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await db.delete(teamMemberships).where(
      and(eq(teamMemberships.team_id, teamId), eq(teamMemberships.user_id, userId))
    );
  }

  // Task group operations
  async getAllTaskGroups(): Promise<TaskGroup[]> {
    return await db.select({
      id: taskGroups.id,
      name: taskGroups.name,
      description: taskGroups.description,
      visibility: taskGroups.visibility,
      owner_id: taskGroups.owner_id,
      created_at: taskGroups.created_at,
      owner: {
        id: users.id,
        user_name: users.user_name,
        email: users.email,
      }
    }).from(taskGroups)
    .leftJoin(users, eq(taskGroups.owner_id, users.id));
  }

  // Get task groups visible to a specific user based on their role and permissions
  async getTaskGroupsForUser(userId: string): Promise<TaskGroup[]> {
    const userRoles = await this.getUserRoles(userId);
    const roleNames = userRoles.map(ur => ur.role?.name).filter(Boolean);
    
    const baseSelect = {
      id: taskGroups.id,
      name: taskGroups.name,
      description: taskGroups.description,
      visibility: taskGroups.visibility,
      owner_id: taskGroups.owner_id,
      created_at: taskGroups.created_at,
      owner: {
        id: users.id,
        user_name: users.user_name,
        email: users.email,
      }
    };
    
    // Admin can see all task groups
    if (roleNames.includes('admin')) {
      return await db.select(baseSelect).from(taskGroups)
        .leftJoin(users, eq(taskGroups.owner_id, users.id));
    }
    
    // For managers and team managers, they can see:
    // 1. Their own task groups
    // 2. Public task groups (all_team_members)
    // 3. Manager-only task groups (managers_admin_only)
    if (roleNames.includes('manager') || roleNames.includes('team_manager')) {
      return await db.select(baseSelect).from(taskGroups)
        .leftJoin(users, eq(taskGroups.owner_id, users.id))
        .where(
          or(
            eq(taskGroups.owner_id, userId), // Own task groups
            eq(taskGroups.visibility, 'all_team_members'), // Public groups
            eq(taskGroups.visibility, 'managers_admin_only') // Manager-only groups
          )
        );
    }
    
    // Regular users can only see:
    // 1. Their own task groups
    // 2. Public task groups (all_team_members)
    // 3. Task groups they are explicitly members of
    return await db.select(baseSelect).from(taskGroups)
      .leftJoin(users, eq(taskGroups.owner_id, users.id))
      .where(
        or(
          eq(taskGroups.owner_id, userId), // Own task groups
          eq(taskGroups.visibility, 'all_team_members') // Public groups
        )
      );
  }

  async createTaskGroup(group: InsertTaskGroup): Promise<TaskGroup> {
    const result = await db.insert(taskGroups).values(group).returning();
    return result[0];
  }

  async deleteTaskGroup(id: string): Promise<void> {
    await db.delete(taskGroups).where(eq(taskGroups.id, id));
  }

  async getTaskGroupDetails(id: string): Promise<any> {
    const group = await db.select({
      id: taskGroups.id,
      name: taskGroups.name,
      description: taskGroups.description,
      visibility: taskGroups.visibility,
      owner_id: taskGroups.owner_id,
      created_at: taskGroups.created_at,
      owner: {
        id: users.id,
        user_name: users.user_name,
        email: users.email,
      }
    }).from(taskGroups)
    .leftJoin(users, eq(taskGroups.owner_id, users.id))
    .where(eq(taskGroups.id, id)).limit(1);
    
    if (group.length === 0) {
      throw new Error('Task group not found');
    }

    // Get group tasks with task details
    const groupTasks = await db
      .select({
        id: taskGroupTasks.id,
        task: {
          id: tasks.id,
          task_number: tasks.task_number,
          title: tasks.title,
          description: tasks.description,
          priority: tasks.priority,
          status: tasks.status,
          due_date: tasks.due_date,
          estimated_hours: tasks.estimated_hours,
          assigned_to: tasks.assigned_to,
          assigned_user: {
            id: users.id,
            user_name: users.user_name,
            email: users.email,
          }
        }
      })
      .from(taskGroupTasks)
      .innerJoin(tasks, eq(taskGroupTasks.task_id, tasks.id))
      .leftJoin(users, eq(tasks.assigned_to, users.id))
      .where(eq(taskGroupTasks.group_id, id));

    // Get group members
    const groupMembers = await db
      .select({
        id: taskGroupMembers.id,
        user_id: taskGroupMembers.user_id,
        role: taskGroupMembers.role,
        created_at: taskGroupMembers.created_at,
        user: {
          id: users.id,
          user_name: users.user_name,
          email: users.email,
          department: users.department,
        }
      })
      .from(taskGroupMembers)
      .innerJoin(users, eq(taskGroupMembers.user_id, users.id))
      .where(eq(taskGroupMembers.group_id, id));

    return {
      ...group[0],
      tasks: groupTasks,
      members: groupMembers,
    };
  }

  async getTaskGroupMembers(groupId: string): Promise<any[]> {
    return await db
      .select({
        id: taskGroupMembers.id,
        user_id: taskGroupMembers.user_id,
        role: taskGroupMembers.role,
        created_at: taskGroupMembers.created_at,
        user: {
          id: users.id,
          user_name: users.user_name,
          email: users.email,
          department: users.department,
        }
      })
      .from(taskGroupMembers)
      .innerJoin(users, eq(taskGroupMembers.user_id, users.id))
      .where(eq(taskGroupMembers.group_id, groupId));
  }

  async addTaskGroupMember(groupId: string, userId: string, role: string = 'member'): Promise<any> {
    // Check if user is already a member
    const existingMember = await db.select().from(taskGroupMembers)
      .where(and(
        eq(taskGroupMembers.group_id, groupId),
        eq(taskGroupMembers.user_id, userId)
      ))
      .limit(1);
    
    if (existingMember.length > 0) {
      throw new Error('User is already a member of this group');
    }
    
    const result = await db.insert(taskGroupMembers).values({
      group_id: groupId,
      user_id: userId,
      role,
    }).returning();
    return result[0];
  }

  async removeTaskGroupMember(groupId: string, userId: string): Promise<void> {
    await db.delete(taskGroupMembers).where(
      and(eq(taskGroupMembers.group_id, groupId), eq(taskGroupMembers.user_id, userId))
    );
  }

  async assignTaskToGroup(groupId: string, taskId: string): Promise<void> {
    await db.insert(taskGroupTasks).values({
      group_id: groupId,
      task_id: taskId
    });
  }

  async removeTaskFromGroup(groupId: string, taskId: string): Promise<void> {
    await db.delete(taskGroupTasks).where(
      and(eq(taskGroupTasks.group_id, groupId), eq(taskGroupTasks.task_id, taskId))
    );
  }

  // Task activity operations
  async getTaskActivity(taskId: string): Promise<TaskActivity[]> {
    return await db.select().from(taskActivity)
      .where(eq(taskActivity.task_id, taskId))
      .orderBy(desc(taskActivity.created_at));
  }

  async logTaskActivity(activity: Omit<TaskActivity, 'id' | 'created_at'>): Promise<TaskActivity> {
    console.log("[DEBUG] Logging task activity:", activity);
    const result = await db.insert(taskActivity).values(activity).returning();
    console.log("[DEBUG] Task activity logged successfully:", result[0]);
    return result[0];
  }

  // Task status operations
  async getAllTaskStatuses(): Promise<TaskStatus[]> {
    return await db.select().from(taskStatuses).orderBy(taskStatuses.sequence_order);
  }

  async createTaskStatus(status: { name: string; description?: string; color?: string; sequence_order: number; is_default?: boolean }): Promise<TaskStatus> {
    // If this is being set as default, first remove default from all other statuses
    if (status.is_default) {
      await db.update(taskStatuses).set({ is_default: false }).where(eq(taskStatuses.is_default, true));
    }
    
    const result = await db.insert(taskStatuses).values({
      name: status.name,
      description: status.description || null,
      color: status.color || "#6b7280",
      sequence_order: status.sequence_order,
      is_default: status.is_default || false
    }).returning();
    return result[0];
  }

  async updateTaskStatus(id: string, updates: Partial<TaskStatus>): Promise<TaskStatus> {
    // If this is being set as default, first remove default from all other statuses
    if (updates.is_default) {
      await db.update(taskStatuses).set({ is_default: false }).where(eq(taskStatuses.is_default, true));
    }
    
    const result = await db.update(taskStatuses).set({
      ...updates,
      updated_at: new Date()
    }).where(eq(taskStatuses.id, id)).returning();
    return result[0];
  }

  async deleteTaskStatus(id: string): Promise<void> {
    await db.delete(taskStatuses).where(eq(taskStatuses.id, id));
  }

  async getTasksByStatus(statusName: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.status, statusName));
  }

  async deleteStatusWithTaskHandling(statusId: string, action: 'delete_tasks' | 'reassign_tasks', newStatusName?: string): Promise<{ deletedTasks: number; reassignedTasks: number }> {
    let deletedTasks = 0;
    let reassignedTasks = 0;

    // Get the status to be deleted
    const statusToDelete = await db.select().from(taskStatuses).where(eq(taskStatuses.id, statusId)).limit(1);
    if (statusToDelete.length === 0) {
      throw new Error('Status not found');
    }

    const statusName = statusToDelete[0].name;

    // Get tasks using this status
    const tasksWithStatus = await this.getTasksByStatus(statusName);

    if (action === 'delete_tasks') {
      // Delete all tasks with this status
      for (const task of tasksWithStatus) {
        await this.deleteTask(task.id);
        deletedTasks++;
      }
    } else if (action === 'reassign_tasks' && newStatusName) {
      // Reassign all tasks to new status
      await db.update(tasks)
        .set({ status: newStatusName, updated_at: new Date() })
        .where(eq(tasks.status, statusName));
      reassignedTasks = tasksWithStatus.length;

      // Log activity for each reassigned task
      for (const task of tasksWithStatus) {
        await this.logTaskActivity({
          task_id: task.id,
          action_type: 'status_changed',
          old_value: statusName,
          new_value: newStatusName,
          acted_by: null // System action
        });
      }
    }

    // Delete the status
    await db.delete(taskStatuses).where(eq(taskStatuses.id, statusId));

    return { deletedTasks, reassignedTasks };
  }

  async getStatusDeletionPreview(statusId: string): Promise<{ statusName: string; taskCount: number; availableStatuses: TaskStatus[]; hasTransitions: boolean }> {
    // Get the status to be deleted
    const statusToDelete = await db.select().from(taskStatuses).where(eq(taskStatuses.id, statusId)).limit(1);
    if (statusToDelete.length === 0) {
      throw new Error('Status not found');
    }

    const statusName = statusToDelete[0].name;

    // Count tasks using this status
    const tasksWithStatus = await this.getTasksByStatus(statusName);
    const taskCount = tasksWithStatus.length;

    // Get all other available statuses for reassignment
    const availableStatuses = await db.select().from(taskStatuses).where(ne(taskStatuses.id, statusId));

    // Check if this status has transitions (this would need to be implemented based on how transitions are stored)
    // For now, we'll assume it has transitions if it's not the default status
    const hasTransitions = !statusToDelete[0].is_default;

    return {
      statusName,
      taskCount,
      availableStatuses,
      hasTransitions
    };
  }

  async getDefaultTaskStatus(): Promise<TaskStatus | undefined> {
    const result = await db.select().from(taskStatuses).where(eq(taskStatuses.is_default, true)).limit(1);
    return result[0];
  }

  // Role permissions operations
  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    const result = await db.select().from(rolePermissions).where(eq(rolePermissions.role_id, roleId));
    return result;
  }

  async createRolePermission(permission: InsertRolePermission): Promise<RolePermission> {
    const result = await db.insert(rolePermissions).values(permission).returning();
    return result[0];
  }

  async updateRolePermission(id: string, updates: Partial<RolePermission>): Promise<RolePermission> {
    const result = await db.update(rolePermissions).set({
      ...updates,
      updated_at: new Date()
    }).where(eq(rolePermissions.id, id)).returning();
    return result[0];
  }

  async deleteRolePermission(id: string): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.id, id));
  }

  // Timer operations
  async getActiveTimerTasks(userId: string): Promise<Task[]> {
    const result = await db.select().from(tasks)
      .where(and(
        eq(tasks.assigned_to, userId),
        eq(tasks.timer_state, 'running'),
        eq(tasks.is_time_managed, true)
      ));
    return result;
  }

  async startTaskTimer(taskId: string, userId: string): Promise<Task> {
    // First check if user already has 2 active timers
    const activeTasks = await this.getActiveTimerTasks(userId);
    if (activeTasks.length >= 2) {
      throw new Error('Maximum of 2 active timers allowed. Please stop another timer first.');
    }

    const result = await db.update(tasks).set({
      timer_state: 'running',
      timer_started_at: new Date(),
      updated_at: new Date()
    }).where(eq(tasks.id, taskId)).returning();

    // Log activity
    await this.logTaskActivity({
      task_id: taskId,
      action_type: 'timer_started',
      old_value: 'stopped',
      new_value: 'running',
      acted_by: userId
    });

    return result[0];
  }

  async pauseTaskTimer(taskId: string, userId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    let timeSpent = task.time_spent_minutes || 0;
    
    // Calculate time since timer started if it's running
    if (task.timer_state === 'running' && task.timer_started_at) {
      const now = new Date();
      const startTime = new Date(task.timer_started_at);
      const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      timeSpent += elapsedMinutes;
    }

    const result = await db.update(tasks).set({
      timer_state: 'paused',
      time_spent_minutes: timeSpent,
      timer_started_at: null,
      updated_at: new Date()
    }).where(eq(tasks.id, taskId)).returning();

    // Log activity
    await this.logTaskActivity({
      task_id: taskId,
      action_type: 'timer_paused',
      old_value: 'running',
      new_value: 'paused',
      acted_by: userId
    });

    return result[0];
  }

  async stopTaskTimer(taskId: string, userId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    let timeSpent = task.time_spent_minutes || 0;
    
    // Calculate time since timer started if it's running
    if (task.timer_state === 'running' && task.timer_started_at) {
      const now = new Date();
      const startTime = new Date(task.timer_started_at);
      const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      timeSpent += elapsedMinutes;
    }

    const result = await db.update(tasks).set({
      timer_state: 'stopped',
      time_spent_minutes: timeSpent,
      timer_started_at: null,
      updated_at: new Date()
    }).where(eq(tasks.id, taskId)).returning();

    // Log activity
    await this.logTaskActivity({
      task_id: taskId,
      action_type: 'timer_stopped',
      old_value: task.timer_state,
      new_value: 'stopped',
      acted_by: userId
    });

    return result[0];
  }

  async updateTaskTimer(taskId: string, updates: { time_spent_minutes?: number; timer_state?: string; timer_started_at?: Date | null; timer_session_data?: string }): Promise<Task> {
    const result = await db.update(tasks).set({
      ...updates,
      updated_at: new Date()
    }).where(eq(tasks.id, taskId)).returning();
    return result[0];
  }

  // Organization settings operations
  async getOrganizationSettings(): Promise<OrganizationSettings | undefined> {
    const result = await db.select().from(organizationSettings).limit(1);
    return result[0] || undefined;
  }

  async createOrganizationSettings(settings: InsertOrganizationSettings): Promise<OrganizationSettings> {
    const result = await db.insert(organizationSettings).values(settings).returning();
    return result[0];
  }

  async updateOrganizationSettings(id: string, updates: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    const result = await db.update(organizationSettings).set({
      ...updates,
      updated_at: new Date()
    }).where(eq(organizationSettings.id, id)).returning();
    return result[0];
  }

  // Task status transition operations
  async getAllTaskStatusTransitions(): Promise<TaskStatusTransition[]> {
    return await db.select().from(taskStatusTransitions).orderBy(taskStatusTransitions.created_at);
  }

  async createTaskStatusTransition(transition: InsertTaskStatusTransition): Promise<TaskStatusTransition> {
    const result = await db.insert(taskStatusTransitions).values(transition).returning();
    return result[0];
  }

  async deleteTaskStatusTransition(id: string): Promise<void> {
    await db.delete(taskStatusTransitions).where(eq(taskStatusTransitions.id, id));
  }
}

export const storage = new DatabaseStorage();
