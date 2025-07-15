import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertTaskSchema, insertTeamSchema, insertTaskGroupSchema, insertRoleSchema, userRoles } from "@shared/schema";
import { db } from "./db";
import bcrypt from "bcrypt";

// Role-based access control middleware
function requireRole(allowedRoles: string[]) {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user roles
      const userRoles = await storage.getUserRoles(userId);
      const allRoles = await storage.getAllRoles();
      
      const roleNames = userRoles.map(ur => {
        const role = allRoles.find(r => r.id === ur.role_id);
        return role?.name;
      }).filter(Boolean);

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
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
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

  // Task management routes - Authenticated access
  app.get("/api/tasks", requireAnyAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      res.json(tasks);
    } catch (error) {
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
      
      // Validate the update data using the insert schema (partial update)
      const updateData = insertTaskSchema.partial().parse(req.body);
      
      const task = await storage.updateTask(req.params.id, updateData);
      
      // Log task update activity
      if (oldTask && req.body.status && oldTask.status !== req.body.status) {
        await storage.logTaskActivity({
          task_id: task.id,
          action_type: "status_changed",
          old_value: oldTask.status,
          new_value: req.body.status,
          acted_by: req.body.updated_by || task.assigned_to || task.created_by,
        });
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
  app.get("/api/task-groups", async (req, res) => {
    try {
      const groups = await storage.getAllTaskGroups();
      res.json(groups);
    } catch (error) {
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

  const httpServer = createServer(app);
  return httpServer;
}
