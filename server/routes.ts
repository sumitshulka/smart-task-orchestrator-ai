import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { licenseManager, APP_ID } from "./license-manager";
import { insertUserSchema, insertTaskSchema, insertTeamSchema, insertTaskGroupSchema, insertRoleSchema, insertOfficeLocationSchema, userRoles } from "@shared/schema";
import { db } from "./db";
import bcrypt from "bcrypt";

// Role-based access control middleware
// Cache roles and user roles to avoid repeated database calls
let rolesCache: any[] = [];
let rolesCacheTime = 0;
const userRolesCache = new Map<string, { roles: string[]; time: number }>();
const CACHE_TTL = 60000; // 1 minute cache

function requireRole(allowedRoles: string[]) {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check user roles cache first
      const userCacheEntry = userRolesCache.get(userId);
      let roleNames: string[];
      
      if (userCacheEntry && Date.now() - userCacheEntry.time < CACHE_TTL) {
        roleNames = userCacheEntry.roles;
      } else {
        // Get user roles (this query is already optimized with indexes)
        const userRoles = await storage.getUserRoles(userId);
        
        // Use cached roles if available and fresh
        let allRoles = rolesCache;
        if (!allRoles.length || Date.now() - rolesCacheTime > CACHE_TTL) {
          allRoles = await storage.getAllRoles();
          rolesCache = allRoles;
          rolesCacheTime = Date.now();
        }
        
        roleNames = userRoles.map(ur => {
          const role = allRoles.find(r => r.id === ur.role_id);
          return role?.name;
        }).filter(Boolean);
        
        // Cache user roles
        userRolesCache.set(userId, { roles: roleNames, time: Date.now() });
      }

      // Check if user has any of the allowed roles
      const hasPermission = allowedRoles.some(role => roleNames.includes(role)) || 
                           roleNames.includes('admin'); // Admin always has access

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      req.userRoles = roleNames;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: "Authorization failed" });
    }
  };
}

// Convenience middleware functions
const requireAdmin = requireRole(['admin']);
const requireManagerOrAdmin = requireRole(['admin', 'manager', 'team_manager']);
const requireAnyAuthenticated = async (req: any, res: any, next: any) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// Get user's visibility scope for data filtering
async function getUserVisibilityScope(userId: string): Promise<{ scope: string; roleNames: string[] }> {
  try {
    // Check user roles cache first
    const userCacheEntry = userRolesCache.get(userId);
    let roleNames: string[];
    
    if (userCacheEntry && Date.now() - userCacheEntry.time < CACHE_TTL) {
      roleNames = userCacheEntry.roles;
    } else {
      // Get user roles
      const userRoles = await storage.getUserRoles(userId);
      
      // Use cached roles if available
      let allRoles = rolesCache;
      if (!allRoles.length || Date.now() - rolesCacheTime > CACHE_TTL) {
        allRoles = await storage.getAllRoles();
        rolesCache = allRoles;
        rolesCacheTime = Date.now();
      }
      
      roleNames = userRoles.map(ur => {
        const role = allRoles.find(r => r.id === ur.role_id);
        return role?.name;
      }).filter(Boolean);
      
      // Cache user roles
      userRolesCache.set(userId, { roles: roleNames, time: Date.now() });
    }

    // Determine visibility scope based on roles
    let scope = "user"; // Default to most restrictive
    
    if (roleNames.includes('admin')) {
      scope = "organization";
    } else if (roleNames.includes('manager') || roleNames.includes('team_manager')) {
      scope = "team";
    }
    
    return { scope, roleNames };
  } catch (error) {
    console.error('Error getting user visibility scope:', error);
    return { scope: "user", roleNames: [] };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check password if user has one, otherwise allow login with any password (for migrated users)
      if (user.password_hash) {
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }
      
      // Return user info (excluding password)
      const { password_hash, ...userInfo } = user;
      res.json(userInfo);
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // User management routes - Admin/Manager only
  app.get("/api/users", requireManagerOrAdmin, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { scope, roleNames } = await getUserVisibilityScope(userId);
      
      let users;
      
      if (scope === "organization") {
        // Admin can see all users
        users = await storage.getAllUsers();
      } else if (scope === "team") {
        // Manager/Team Manager can only see their direct reports and team members
        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(403).json({ error: "User not found" });
        }
        
        // Get all users where current user is the manager
        const allUsers = await storage.getAllUsers();
        const directReports = allUsers.filter(user => user.manager === userId);
        
        // Also get users in the same teams as the current user
        const userTeams = await storage.getTeamsByUser(userId);
        const teamMemberIds = new Set<string>();
        
        for (const team of userTeams) {
          const teamMembers = await storage.getTeamMembers(team.id);
          teamMembers.forEach(member => teamMemberIds.add(member.user_id));
        }
        
        // Combine direct reports and team members, avoiding duplicates
        const visibleUserIds = new Set([
          ...directReports.map(u => u.id),
          ...teamMemberIds,
          userId // Include self
        ]);
        
        users = allUsers.filter(user => visibleUserIds.has(user.id));
      } else {
        // Regular user can only see themselves
        users = [await storage.getUser(userId)].filter(Boolean);
      }
      
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/users/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Deactivate user (admin only)
  app.patch("/api/users/:id/deactivate", requireAdmin, async (req, res) => {
    try {
      const user = await storage.deactivateUser(req.params.id);
      res.json(user);
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ error: "Failed to deactivate user" });
    }
  });

  // Activate user (admin only)
  app.patch("/api/users/:id/activate", requireAdmin, async (req, res) => {
    try {
      const user = await storage.activateUser(req.params.id);
      res.json(user);
    } catch (error) {
      console.error("Error activating user:", error);
      res.status(500).json({ error: "Failed to activate user" });
    }
  });

  // Reset user password (admin only)
  app.patch("/api/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user's password
      const updatedUser = await storage.updateUser(id, {
        password_hash: hashedPassword,
        updated_at: new Date()
      });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const deletedBy = req.headers['x-user-id'];
      if (!deletedBy) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const result = await storage.deleteUser(req.params.id, deletedBy);
      res.json(result);
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Get deleted users (admin only)
  app.get("/api/deleted-users", requireAdmin, async (req, res) => {
    try {
      const deletedUsers = await storage.getAllDeletedUsers();
      res.json(deletedUsers);
    } catch (error) {
      console.error("Error fetching deleted users:", error);
      res.status(500).json({ error: "Failed to fetch deleted users" });
    }
  });

  // Get deleted user tasks (admin only)
  app.get("/api/deleted-users/:id/tasks", requireAdmin, async (req, res) => {
    try {
      const tasks = await storage.getDeletedUserTasks(req.params.id);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching deleted user tasks:", error);
      res.status(500).json({ error: "Failed to fetch deleted user tasks" });
    }
  });

  // Bulk user upload (replacing Supabase Edge Function)
  app.post("/api/admin/bulk-upload-users", async (req, res) => {
    try {
      let { users } = req.body;
      if (!Array.isArray(users)) {
        return res.status(400).json({ error: "No users array in payload." });
      }

      // Normalize and validate users
      users = users
        .map((u) => ({
          email: (u.email || u.Email || "").trim(),
          user_name: u.user_name || u["Employee Name"] || "",
          department: u.department || u.Department || "",
          manager: u.manager || u.Manager || "",
          phone: u.phone || u.Phone || "",
        }))
        .filter((u) => u.email && /^[\w.-]+@[\w.-]+\.\w+$/.test(u.email));

      if (users.length === 0) {
        return res.status(400).json({ error: "No valid users to process." });
      }

      // Check for existing emails
      const allUsers = await storage.getAllUsers();
      const existingEmailSet = new Set(allUsers.map((u) => u.email.toLowerCase()));

      const toInsert = users.filter((u) => !existingEmailSet.has(u.email.toLowerCase()));
      const skipped = users.filter((u) => existingEmailSet.has(u.email.toLowerCase()));

      let insertCount = 0;
      let insertError = null;

      // Insert new users
      for (const user of toInsert) {
        try {
          await storage.createUser(user);
          insertCount++;
        } catch (error) {
          insertError = `Failed to insert user ${user.email}`;
          break;
        }
      }

      res.json({
        success: true,
        inserted: insertCount,
        skipped: skipped.length,
        skipped_emails: skipped.map((u) => u.email),
        error: insertError,
        status: insertError ? "partial" : "success",
        message: insertError
          ? `Inserted ${insertCount}, skipped ${skipped.length} (duplicates), error: ${insertError}`
          : `Inserted ${insertCount}, skipped ${skipped.length} (duplicates).`,
      });
    } catch (error) {
      res.status(500).json({ error: "An unexpected error occurred." });
    }
  });

  // Task management routes - Visibility-aware access
  app.get("/api/tasks", requireAnyAuthenticated, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { scope, roleNames } = await getUserVisibilityScope(userId);
      
      let tasks;
      
      if (scope === "organization") {
        // Admin can see all tasks
        tasks = await storage.getAllTasks();
      } else if (scope === "team") {
        // Manager/Team Manager can see tasks for their team members
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        
        // Get all users that this manager can see (including themselves)
        const allUsers = await storage.getAllUsers();
        const visibleUserIds = allUsers
          .filter(u => u.manager === userId || u.id === userId)
          .map(u => u.id);
        
        // Get tasks for visible users only
        const allTasks = await storage.getAllTasks();
        tasks = allTasks.filter(task => visibleUserIds.includes(task.assigned_to));
      } else {
        // User scope - can only see their own tasks
        tasks = await storage.getTasksByUser(userId);
      }
      
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks with visibility scope:', error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", requireAnyAuthenticated, async (req, res) => {
    try {
      console.log("[DEBUG] Task creation request body:", JSON.stringify(req.body, null, 2));
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      
      // Log task creation activity
      await storage.logTaskActivity({
        task_id: task.id,
        action_type: "created",
        new_value: task.title,
        acted_by: task.created_by,
      });
      
      res.status(201).json(task);
    } catch (error) {
      console.error("[ERROR] Task creation failed:", error);
      if (error instanceof Error) {
        console.error("[ERROR] Error message:", error.message);
      }
      res.status(400).json({ 
        error: "Invalid task data", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.patch("/api/tasks/:id", requireAnyAuthenticated, async (req, res) => {
    try {
      console.log("[DEBUG] Task update request body:", JSON.stringify(req.body, null, 2));
      const oldTask = await storage.getTask(req.params.id);
      
      // Check daily hour limit if task is being completed
      if (req.body.status === "completed" && oldTask && oldTask.status !== "completed") {
        const userId = req.headers['x-user-id'] as string || oldTask.assigned_to || oldTask.created_by;
        const settings = await storage.getOrganizationSettings();
        
        if (settings?.daily_hour_limit_enabled) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          // Get all user tasks for today
          const userTasks = await storage.getTasksByUser(userId);
          const todayTasks = userTasks.filter(task => {
            const taskDate = task.updated_at ? new Date(task.updated_at) : new Date(task.created_at);
            return taskDate >= today && taskDate < tomorrow;
          });
          
          // Calculate current daily hours
          let currentDailyHours = 0;
          for (const task of todayTasks) {
            if (task.id === oldTask.id) continue; // Skip the current task being updated
            
            if (task.is_time_managed && task.time_spent_minutes > 0) {
              currentDailyHours += task.time_spent_minutes / 60;
            } else if (!task.is_time_managed && task.status === 'completed' && task.estimated_hours > 0) {
              currentDailyHours += task.estimated_hours;
            }
          }
          
          // Calculate hours for current task being completed
          let taskHours = 0;
          if (oldTask.is_time_managed && oldTask.time_spent_minutes > 0) {
            taskHours = oldTask.time_spent_minutes / 60;
          } else if (!oldTask.is_time_managed && oldTask.estimated_hours > 0) {
            taskHours = oldTask.estimated_hours;
          }
          
          const totalHours = currentDailyHours + taskHours;
          
          if (totalHours > settings.max_daily_hours_limit) {
            return res.status(400).json({
              error: "Daily hour limit exceeded",
              details: `Completing this task would result in ${totalHours.toFixed(1)} hours for today, which exceeds the daily limit of ${settings.max_daily_hours_limit} hours. Current daily hours: ${currentDailyHours.toFixed(1)}, Task hours: ${taskHours.toFixed(1)}.`
            });
          }
        }
      }
      
      // Validate the update data using the insert schema (partial update)
      const updateData = insertTaskSchema.partial().parse(req.body);
      
      const task = await storage.updateTask(req.params.id, updateData);
      const userId = req.headers['x-user-id'] as string || task.assigned_to || task.created_by;
      
      // Log various activity changes
      if (oldTask) {
        console.log("[DEBUG] Checking for activity changes - userId:", userId);
        // Status change
        if (req.body.status && oldTask.status !== req.body.status) {
          console.log("[DEBUG] Status change detected:", oldTask.status, "->", req.body.status);
          await storage.logTaskActivity({
            task_id: task.id,
            action_type: "status_changed",
            old_value: oldTask.status,
            new_value: req.body.status,
            acted_by: userId,
          });
          console.log("[DEBUG] Status change activity logged");
        }
        
        // Assignment change
        if (req.body.assigned_to && oldTask.assigned_to !== req.body.assigned_to) {
          const oldUser = oldTask.assigned_to ? await storage.getUser(oldTask.assigned_to) : null;
          const newUser = req.body.assigned_to ? await storage.getUser(req.body.assigned_to) : null;
          await storage.logTaskActivity({
            task_id: task.id,
            action_type: "assignment_changed",
            old_value: oldUser?.user_name || "Unassigned",
            new_value: newUser?.user_name || "Unassigned",
            acted_by: userId,
          });
        }
        
        // Priority change
        if (req.body.priority !== undefined && oldTask.priority !== req.body.priority) {
          const priorityNames = { 1: "Low", 2: "Medium", 3: "High", 4: "Critical" };
          await storage.logTaskActivity({
            task_id: task.id,
            action_type: "priority_changed",
            old_value: priorityNames[oldTask.priority as keyof typeof priorityNames] || `${oldTask.priority}`,
            new_value: priorityNames[req.body.priority as keyof typeof priorityNames] || `${req.body.priority}`,
            acted_by: userId,
          });
        }
        
        // Due date change
        if (req.body.due_date && oldTask.due_date !== req.body.due_date) {
          await storage.logTaskActivity({
            task_id: task.id,
            action_type: "due_date_changed",
            old_value: oldTask.due_date ? new Date(oldTask.due_date).toLocaleDateString() : "No due date",
            new_value: new Date(req.body.due_date).toLocaleDateString(),
            acted_by: userId,
          });
        }
        
        // Title change
        if (req.body.title && oldTask.title !== req.body.title) {
          await storage.logTaskActivity({
            task_id: task.id,
            action_type: "title_changed",
            old_value: oldTask.title,
            new_value: req.body.title,
            acted_by: userId,
          });
        }
        
        // Description change
        if (req.body.description && oldTask.description !== req.body.description) {
          await storage.logTaskActivity({
            task_id: task.id,
            action_type: "description_changed",
            old_value: oldTask.description || "No description",
            new_value: req.body.description,
            acted_by: userId,
          });
        }
      }
      
      res.json(task);
    } catch (error) {
      console.error("[ERROR] Task update failed:", error);
      if (error instanceof Error) {
        console.error("[ERROR] Error message:", error.message);
      }
      res.status(500).json({ 
        error: "Failed to update task", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.delete("/api/tasks/:id", requireAnyAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      const userId = req.headers['x-user-id'] as string;
      
      if (task) {
        // Log task deletion activity before deleting
        await storage.logTaskActivity({
          task_id: task.id,
          action_type: "deleted",
          new_value: `Task "${task.title}" was deleted`,
          acted_by: userId,
        });
      }
      
      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Task activity routes
  app.get("/api/tasks/:id/activity", async (req, res) => {
    try {
      const activity = await storage.getTaskActivity(req.params.id);
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task activity" });
    }
  });

  // Timer routes
  app.get("/api/users/:userId/active-timers", requireAnyAuthenticated, async (req, res) => {
    try {
      const activeTasks = await storage.getActiveTimerTasks(req.params.userId);
      res.json(activeTasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active timers" });
    }
  });

  app.post("/api/tasks/:id/timer/start", requireAnyAuthenticated, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const task = await storage.startTaskTimer(req.params.id, userId);
      
      // Log timer start activity
      await storage.logTaskActivity({
        task_id: task.id,
        action_type: "timer_started",
        new_value: "Timer started",
        acted_by: userId,
      });
      
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to start timer" });
    }
  });

  app.post("/api/tasks/:id/timer/pause", requireAnyAuthenticated, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const task = await storage.pauseTaskTimer(req.params.id, userId);
      
      // Log timer pause activity
      await storage.logTaskActivity({
        task_id: task.id,
        action_type: "timer_paused",
        new_value: "Timer paused",
        acted_by: userId,
      });
      
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to pause timer" });
    }
  });

  app.post("/api/tasks/:id/timer/stop", requireAnyAuthenticated, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const task = await storage.stopTaskTimer(req.params.id, userId);
      
      // Log timer stop activity
      await storage.logTaskActivity({
        task_id: task.id,
        action_type: "timer_stopped",
        new_value: `Timer stopped (Total: ${task.time_spent_minutes}m)`,
        acted_by: userId,
      });
      
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to stop timer" });
    }
  });

  // Team management routes - Manager/Admin only
  app.get("/api/teams", requireManagerOrAdmin, async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/:id", async (req, res) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  app.post("/api/teams", requireManagerOrAdmin, async (req, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);
      res.status(201).json(team);
    } catch (error) {
      res.status(400).json({ error: "Invalid team data" });
    }
  });

  app.patch("/api/teams/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      const team = await storage.updateTeam(req.params.id, req.body);
      res.json(team);
    } catch (error) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  // Team membership routes
  app.get("/api/teams/:id/members", async (req, res) => {
    try {
      const members = await storage.getTeamMembers(req.params.id);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.post("/api/teams/:teamId/members", async (req, res) => {
    try {
      const { userId, role } = req.body;
      const membership = await storage.addTeamMember(req.params.teamId, userId, role);
      res.status(201).json(membership);
    } catch (error) {
      res.status(400).json({ error: "Failed to add team member" });
    }
  });

  app.delete("/api/teams/:teamId/members/:userId", async (req, res) => {
    try {
      await storage.removeTeamMember(req.params.teamId, req.params.userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  // Role management routes - Admin only for modifications, authenticated for read
  app.get("/api/roles", requireAnyAuthenticated, async (req, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.post("/api/roles", requireAdmin, async (req, res) => {
    try {
      const roleData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(roleData);
      res.status(201).json(role);
    } catch (error) {
      res.status(400).json({ error: "Invalid role data" });
    }
  });

  app.put("/api/roles/:id", requireAdmin, async (req, res) => {
    try {
      const role = await storage.updateRole(req.params.id, req.body);
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteRole(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Get all user-role relationships
  app.get("/api/user-roles", async (req, res) => {
    try {
      const allUserRoles = await db.select().from(userRoles);
      res.json(allUserRoles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user roles" });
    }
  });

  app.get("/api/users/:id/roles", async (req, res) => {
    try {
      const userRoles = await storage.getUserRoles(req.params.id);
      res.json(userRoles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user roles" });
    }
  });

  app.post("/api/users/:userId/roles", requireAdmin, async (req, res) => {
    try {
      const { roleId } = req.body;
      const userRole = await storage.assignUserRole(req.params.userId, roleId);
      res.status(201).json(userRole);
    } catch (error) {
      res.status(400).json({ error: "Failed to assign role" });
    }
  });

  app.delete("/api/users/:userId/roles/:roleId", requireAdmin, async (req, res) => {
    try {
      await storage.removeUserRole(req.params.userId, req.params.roleId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove role" });
    }
  });

  // Task group routes
  app.get("/api/task-groups", requireAnyAuthenticated, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const groups = await storage.getTaskGroupsForUser(userId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching task groups:', error);
      res.status(500).json({ error: "Failed to fetch task groups" });
    }
  });

  app.post("/api/task-groups", requireManagerOrAdmin, async (req, res) => {
    try {
      const groupData = insertTaskGroupSchema.parse(req.body);
      const group = await storage.createTaskGroup(groupData);
      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ error: "Invalid task group data" });
    }
  });

  app.delete("/api/task-groups/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      await storage.deleteTaskGroup(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task group" });
    }
  });

  app.get("/api/task-groups/:id/details", async (req, res) => {
    try {
      const details = await storage.getTaskGroupDetails(req.params.id);
      res.json(details);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task group details" });
    }
  });

  app.get("/api/task-groups/:id/members", async (req, res) => {
    try {
      const members = await storage.getTaskGroupMembers(req.params.id);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task group members" });
    }
  });

  app.post("/api/task-groups/:id/members", requireManagerOrAdmin, async (req, res) => {
    try {
      const { userId, role } = req.body;
      const member = await storage.addTaskGroupMember(req.params.id, userId, role);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ error: "Failed to add task group member" });
    }
  });

  app.delete("/api/task-groups/:id/members/:userId", requireManagerOrAdmin, async (req, res) => {
    try {
      await storage.removeTaskGroupMember(req.params.id, req.params.userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove task group member" });
    }
  });

  // Task-group assignment endpoints
  app.post("/api/task-groups/:groupId/tasks", requireAnyAuthenticated, async (req, res) => {
    try {
      const { taskId } = req.body;
      const { groupId } = req.params;
      
      await storage.assignTaskToGroup(groupId, taskId);
      res.status(201).json({ success: true, message: "Task assigned to group" });
    } catch (error) {
      console.error('Error assigning task to group:', error);
      res.status(500).json({ error: "Failed to assign task to group" });
    }
  });

  app.delete("/api/task-groups/:groupId/tasks/:taskId", requireAnyAuthenticated, async (req, res) => {
    try {
      const { groupId, taskId } = req.params;
      
      await storage.removeTaskFromGroup(groupId, taskId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing task from group:', error);
      res.status(500).json({ error: "Failed to remove task from group" });
    }
  });

  // Task status routes - Read open, modify admin only
  app.get("/api/task-statuses", requireAnyAuthenticated, async (req, res) => {
    try {
      const statuses = await storage.getAllTaskStatuses();
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task statuses" });
    }
  });

  // Get default task status
  app.get("/api/task-statuses/default", async (req, res) => {
    try {
      const defaultStatus = await storage.getDefaultTaskStatus();
      res.json(defaultStatus);
    } catch (error) {
      console.error("Error fetching default task status:", error);
      res.status(500).json({ error: "Failed to fetch default task status" });
    }
  });

  // User tasks by assignment
  app.get("/api/users/:id/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasksByUser(req.params.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user tasks" });
    }
  });

  // Team tasks
  app.get("/api/teams/:id/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasksByTeam(req.params.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team tasks" });
    }
  });

  // Task Group member management routes
  app.post("/api/task-groups/:id/members", requireAnyAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, role = 'member' } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      const member = await storage.addTaskGroupMember(id, userId, role);
      res.status(201).json(member);
    } catch (error) {
      console.error("Failed to add task group member:", error);
      res.status(500).json({ error: "Failed to add task group member" });
    }
  });

  app.delete("/api/task-groups/:id/members/:userId", requireAnyAuthenticated, async (req, res) => {
    try {
      const { id, userId } = req.params;
      await storage.removeTaskGroupMember(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove task group member:", error);
      res.status(500).json({ error: "Failed to remove task group member" });
    }
  });

  // Task Group task assignment routes
  app.post("/api/task-groups/:id/tasks", requireAnyAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { taskId } = req.body;
      
      if (!taskId) {
        return res.status(400).json({ error: "taskId is required" });
      }
      
      // Note: This endpoint would need to be implemented in storage
      // For now, we'll just return success as task-group relationships 
      // are managed through the existing task creation/assignment process
      res.json({ success: true, message: "Task assigned to group" });
    } catch (error) {
      console.error("Failed to add task to group:", error);
      res.status(500).json({ error: "Failed to add task to group" });
    }
  });

  // Role permissions
  app.get("/api/roles/:roleId/permissions", async (req, res) => {
    try {
      const { roleId } = req.params;
      const permissions = await storage.getRolePermissions(roleId);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/role-permissions", requireAdmin, async (req, res) => {
    try {
      const permission = await storage.createRolePermission(req.body);
      res.json(permission);
    } catch (error) {
      res.status(500).json({ error: "Failed to create role permission" });
    }
  });

  app.patch("/api/role-permissions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const permission = await storage.updateRolePermission(id, req.body);
      res.json(permission);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role permission" });
    }
  });

  app.delete("/api/role-permissions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRolePermission(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete role permission" });
    }
  });

  app.patch("/api/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const role = await storage.updateRole(id, req.body);
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  // Task status management routes - Admin only
  app.post("/api/task-statuses", requireAdmin, async (req, res) => {
    try {
      const { name, description, color, sequence_order } = req.body;
      if (!name || typeof sequence_order !== 'number') {
        return res.status(400).json({ error: "Name and sequence_order are required" });
      }
      
      const status = await storage.createTaskStatus({
        name,
        description,
        color: color || "#6b7280",
        sequence_order
      });
      res.status(201).json(status);
    } catch (error) {
      console.error("Failed to create task status:", error);
      res.status(500).json({ error: "Failed to create task status" });
    }
  });

  app.patch("/api/task-statuses/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const status = await storage.updateTaskStatus(id, req.body);
      res.json(status);
    } catch (error) {
      console.error("Failed to update task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  app.delete("/api/task-statuses/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTaskStatus(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete task status:", error);
      res.status(500).json({ error: "Failed to delete task status" });
    }
  });

  app.get("/api/task-statuses/:id/deletion-preview", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      console.log("Getting deletion preview for status ID:", id);
      const preview = await storage.getStatusDeletionPreview(id);
      console.log("Deletion preview result:", preview);
      res.json(preview);
    } catch (error) {
      console.error("Failed to get status deletion preview:", error);
      console.error("Error details:", error.message, error.stack);
      res.status(500).json({ error: "Failed to get status deletion preview", details: error.message });
    }
  });

  app.post("/api/task-statuses/:id/delete-with-handling", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, newStatusName } = req.body;
      
      if (!action || !['delete_tasks', 'reassign_tasks'].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'delete_tasks' or 'reassign_tasks'" });
      }

      if (action === 'reassign_tasks' && !newStatusName) {
        return res.status(400).json({ error: "newStatusName is required when action is 'reassign_tasks'" });
      }

      const result = await storage.deleteStatusWithTaskHandling(id, action, newStatusName);
      res.json(result);
    } catch (error) {
      console.error("Failed to delete status with task handling:", error);
      res.status(500).json({ error: "Failed to delete status with task handling" });
    }
  });

  // Task status transition endpoints
  app.get("/api/task-status-transitions", requireAnyAuthenticated, async (req, res) => {
    try {
      const transitions = await storage.getAllTaskStatusTransitions();
      res.json(transitions);
    } catch (error) {
      console.error("Failed to get task status transitions:", error);
      res.status(500).json({ error: "Failed to get task status transitions" });
    }
  });

  app.post("/api/task-status-transitions", requireAdmin, async (req, res) => {
    try {
      const { from_status, to_status } = req.body;
      if (!from_status || !to_status) {
        return res.status(400).json({ error: "from_status and to_status are required" });
      }
      
      const transition = await storage.createTaskStatusTransition({
        from_status,
        to_status
      });
      res.status(201).json(transition);
    } catch (error) {
      console.error("Failed to create task status transition:", error);
      res.status(500).json({ error: "Failed to create task status transition" });
    }
  });

  app.delete("/api/task-status-transitions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTaskStatusTransition(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete task status transition:", error);
      res.status(500).json({ error: "Failed to delete task status transition" });
    }
  });

  // Organization settings routes - Managers can read, Admin can modify
  app.get("/api/organization-settings", requireManagerOrAdmin, async (req, res) => {
    try {
      const settings = await storage.getOrganizationSettings();
      res.json(settings);
    } catch (error) {
      console.error("Failed to fetch organization settings:", error);
      res.status(500).json({ error: "Failed to fetch organization settings" });
    }
  });

  app.post("/api/organization-settings", requireAdmin, async (req, res) => {
    try {
      console.log("Creating organization settings with data:", req.body);
      
      // Validate the request body
      const { insertOrganizationSettingsSchema } = await import("../shared/schema");
      const validatedData = insertOrganizationSettingsSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      
      const settings = await storage.createOrganizationSettings(validatedData);
      res.status(201).json(settings);
    } catch (error) {
      console.error("Failed to create organization settings:", error);
      console.error("Request body:", req.body);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create organization settings", details: error.message });
      }
    }
  });

  app.patch("/api/organization-settings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      console.log("Updating organization settings with ID:", id, "and data:", req.body);
      
      // Validate the request body (partial update)
      const { insertOrganizationSettingsSchema } = await import("../shared/schema");
      const validatedData = insertOrganizationSettingsSchema.partial().parse(req.body);
      console.log("Validated data:", validatedData);
      
      const settings = await storage.updateOrganizationSettings(id, validatedData);
      res.json(settings);
    } catch (error) {
      console.error("Failed to update organization settings:", error);
      console.error("Request body:", req.body);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update organization settings", details: error.message });
      }
    }
  });

  // Office location routes
  app.get("/api/office-locations", requireManagerOrAdmin, async (req, res) => {
    try {
      const locations = await storage.getAllOfficeLocations();
      res.json(locations);
    } catch (error) {
      console.error("Failed to fetch office locations:", error);
      res.status(500).json({ error: "Failed to fetch office locations" });
    }
  });

  app.get("/api/office-locations/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      const location = await storage.getOfficeLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ error: "Office location not found" });
      }
      res.json(location);
    } catch (error) {
      console.error("Failed to fetch office location:", error);
      res.status(500).json({ error: "Failed to fetch office location" });
    }
  });

  app.post("/api/office-locations", requireManagerOrAdmin, async (req, res) => {
    try {
      console.log("Office location creation request body:", req.body);
      const locationData = insertOfficeLocationSchema.parse(req.body);
      console.log("Parsed location data:", locationData);
      const location = await storage.createOfficeLocation(locationData);
      res.status(201).json(location);
    } catch (error) {
      console.error("Failed to create office location:", error);
      if (error.name === 'ZodError') {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create office location" });
      }
    }
  });

  app.patch("/api/office-locations/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      const location = await storage.updateOfficeLocation(req.params.id, req.body);
      res.json(location);
    } catch (error) {
      console.error("Failed to update office location:", error);
      res.status(500).json({ error: "Failed to update office location" });
    }
  });

  app.delete("/api/office-locations/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      await storage.deleteOfficeLocation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete office location:", error);
      res.status(500).json({ error: "Failed to delete office location" });
    }
  });

  // License Management Routes (Admin only)
  app.get("/api/license/status", requireAdmin, async (req, res) => {
    try {
      console.log("License status endpoint hit");
      
      // First try to find any license in the database since we don't have client ID in headers
      const allLicenses = await storage.getAllLicenses();
      console.log("Found licenses:", allLicenses.length);
      
      if (allLicenses.length > 0) {
        const activeLicense = allLicenses.find(l => l.isActive) || allLicenses[0];
        const status = await licenseManager.getLicenseStatus(activeLicense.clientId);
        console.log("License status result:", status);
        res.json(status);
      } else {
        console.log("No licenses found in database");
        res.json({
          hasLicense: false,
          isValid: false,
          message: 'No license found'
        });
      }
    } catch (error) {
      console.error("Failed to get license status:", error);
      res.status(500).json({ 
        error: "Failed to get license status", 
        details: error.message,
        stack: error.stack 
      });
    }
  });

  app.post("/api/license/acquire", requireAdmin, async (req, res) => {
    try {
      const { clientId, appId, baseUrl, licenseManagerUrl } = req.body;
      
      if (!clientId || !appId || !baseUrl) {
        return res.status(400).json({ error: "clientId, appId, and baseUrl are required" });
      }

      if (licenseManagerUrl) {
        licenseManager.setLicenseManagerUrl(licenseManagerUrl);
      }

      const result = await licenseManager.acquireLicense(clientId, baseUrl, appId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Failed to acquire license:", error);
      res.status(500).json({ error: "Failed to acquire license" });
    }
  });

  app.post("/api/license/validate", requireAdmin, async (req, res) => {
    try {
      const { licenseManagerUrl } = req.body;
      
      if (!licenseManagerUrl) {
        return res.status(400).json({ error: "licenseManagerUrl is required" });
      }

      // Set the license manager URL
      licenseManager.setLicenseManagerUrl(licenseManagerUrl);

      // Get the client ID from the current user's license in database
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      // Get the first license from database (assuming one license per installation)
      const licenses = await storage.getAllLicenses();
      const license = licenses[0];
      
      if (!license) {
        return res.status(404).json({ 
          valid: false,
          message: 'No license found in database' 
        });
      }

      // Extract complete domain from request headers (including subdomain for Replit dev URLs)
      const origin = req.headers.origin || req.headers.host || 'localhost';
      const domain = origin.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      
      // For development, use the actual Replit dev URL instead of baseUrl
      const devDomain = domain.includes('replit.dev') ? domain : 'localhost';

      console.log(`Request headers - Origin: ${req.headers.origin}, Host: ${req.headers.host}`);
      console.log(`Extracted domain: ${domain}`);
      console.log(`Using domain for validation: ${devDomain}`);
      console.log(`Validating license for client: ${license.clientId}, domain: ${devDomain}`);
      
      const result = await licenseManager.validateLicense(license.clientId, devDomain);
      res.json(result);
    } catch (error) {
      console.error("Failed to validate license:", error);
      res.status(500).json({ error: "Failed to validate license" });
    }
  });

  app.get("/api/license/user-limits", requireAdmin, async (req, res) => {
    try {
      const clientId = req.headers['x-client-id'] as string || 'default-client';
      const limits = await licenseManager.getUserLimits(clientId);
      res.json({ limits });
    } catch (error) {
      console.error("Failed to get user limits:", error);
      res.status(500).json({ error: "Failed to get user limits" });
    }
  });

  app.post("/api/license/check-user-limit", requireAdmin, async (req, res) => {
    try {
      const { clientId, currentUserCount } = req.body;
      
      if (!clientId || typeof currentUserCount !== 'number') {
        return res.status(400).json({ error: "clientId and currentUserCount are required" });
      }

      const result = await licenseManager.checkUserLimit(clientId, currentUserCount);
      res.json(result);
    } catch (error) {
      console.error("Failed to check user limit:", error);
      res.status(500).json({ error: "Failed to check user limit" });
    }
  });

  app.get("/api/license/current", requireAdmin, async (req, res) => {
    try {
      const clientId = req.headers['x-client-id'] as string || 'default-client';
      const license = await licenseManager.getCurrentLicense(clientId);
      
      if (!license) {
        return res.status(404).json({ error: "No license found" });
      }

      // Return limited license info (don't expose sensitive data)
      const safeLicense = {
        id: license.id,
        applicationId: license.applicationId,
        clientId: license.clientId,
        subscriptionType: license.subscriptionType,
        validTill: license.validTill,
        isActive: license.isActive,
        lastValidated: license.lastValidated,
        createdAt: license.createdAt,
        updatedAt: license.updatedAt
      };

      res.json(safeLicense);
    } catch (error) {
      console.error("Failed to get current license:", error);
      res.status(500).json({ error: "Failed to get current license" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
