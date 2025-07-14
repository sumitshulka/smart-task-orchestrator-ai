// API client for communicating with our Express server
// Replaces all Supabase client calls

const API_BASE = import.meta.env.VITE_API_BASE || '';

class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // User management
  async getUsers() {
    return this.request('/users');
  }

  async getUser(id: string) {
    return this.request(`/users/${id}`);
  }

  async createUser(user: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, updates: any) {
    return this.request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async bulkUploadUsers(users: any[]) {
    return this.request('/admin/bulk-upload-users', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });
  }

  // Task management
  async getTasks() {
    return this.request('/tasks');
  }

  async getTask(id: string) {
    return this.request(`/tasks/${id}`);
  }

  async createTask(task: any) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(id: string, updates: any) {
    return this.request(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async getTaskActivity(taskId: string) {
    return this.request(`/tasks/${taskId}/activity`);
  }

  async getUserTasks(userId: string) {
    return this.request(`/users/${userId}/tasks`);
  }

  async getTeamTasks(teamId: string) {
    return this.request(`/teams/${teamId}/tasks`);
  }

  // Team management
  async getTeams() {
    return this.request('/teams');
  }

  async getTeam(id: string) {
    return this.request(`/teams/${id}`);
  }

  async createTeam(team: any) {
    return this.request('/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    });
  }

  async updateTeam(id: string, updates: any) {
    return this.request(`/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTeam(id: string) {
    return this.request(`/teams/${id}`, {
      method: 'DELETE',
    });
  }

  async getTeamMembers(teamId: string) {
    return this.request(`/teams/${teamId}/members`);
  }

  async addTeamMember(teamId: string, userId: string, role?: string) {
    return this.request(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  async removeTeamMember(teamId: string, userId: string) {
    return this.request(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // Role management
  async getRoles() {
    return this.request('/roles');
  }

  async createRole(data: any) {
    return this.request('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRole(id: string, data: any) {
    return this.request(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRole(id: string) {
    return this.request(`/roles/${id}`, {
      method: 'DELETE',
    });
  }

  async getUserRoles(userId: string) {
    return this.request(`/users/${userId}/roles`);
  }

  async assignUserRole(userId: string, roleId: string) {
    return this.request(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
    });
  }

  async removeUserRole(userId: string, roleId: string) {
    return this.request(`/users/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    });
  }

  // Task groups
  async getTaskGroups() {
    return this.request('/task-groups');
  }

  async createTaskGroup(group: any) {
    return this.request('/task-groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
  }

  async deleteTaskGroup(id: string) {
    return this.request(`/task-groups/${id}`, {
      method: 'DELETE',
    });
  }

  // Task statuses
  async getTaskStatuses() {
    return this.request('/task-statuses');
  }

  // Role permissions
  async getRolePermissions(roleId: string) {
    return this.request(`/roles/${roleId}/permissions`);
  }

  async createRolePermission(permission: any) {
    return this.request('/role-permissions', {
      method: 'POST',
      body: JSON.stringify(permission),
    });
  }

  async updateRolePermission(id: string, updates: any) {
    return this.request(`/role-permissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteRolePermission(id: string) {
    return this.request(`/role-permissions/${id}`, {
      method: 'DELETE',
    });
  }

  async updateRole(id: string, updates: any) {
    return this.request(`/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }
}

export const apiClient = new ApiClient();