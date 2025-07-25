// API client for communicating with our Express server
// Replaces all Supabase client calls

const API_BASE = import.meta.env.VITE_API_BASE || '';

class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}) {
    // Remove leading slash from endpoint if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE}/api${cleanEndpoint}`;

    // Get current user for authentication
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    console.log('API Request:', { url, endpoint, cleanEndpoint, userId: user?.id, method: options.method || 'GET' });

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(user?.id && { 'x-user-id': user.id }),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    // Handle empty response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      const text = await response.text();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response as JSON:', text);
        throw new Error('Invalid JSON response from server');
      }
    }
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

  async deactivateUser(id: string) {
    return this.request(`/users/${id}/deactivate`, {
      method: 'PATCH',
    });
  }

  async activateUser(id: string) {
    return this.request(`/users/${id}/activate`, {
      method: 'PATCH',
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getDeletedUsers() {
    return this.request('/deleted-users');
  }

  async getDeletedUserTasks(id: string) {
    return this.request(`/deleted-users/${id}/tasks`);
  }

  async resetUserPassword(id: string, password: string) {
    return this.request(`/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
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

  async getTaskGroupDetails(id: string) {
    return this.request(`/task-groups/${id}/details`);
  }

  async addTaskGroupMember(groupId: string, userId: string, role?: string) {
    return this.request(`/task-groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  async removeTaskGroupMember(groupId: string, userId: string) {
    return this.request(`/task-groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async addTaskToGroup(groupId: string, taskId: string) {
    return this.request(`/task-groups/${groupId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }



  // Task statuses
  async getTaskStatuses() {
    return this.request('/task-statuses');
  }

  async createTaskStatus(status: { name: string; description?: string; color?: string; sequence_order: number }) {
    return this.request('/task-statuses', {
      method: 'POST',
      body: JSON.stringify(status)
    });
  }

  async updateTaskStatus(id: string, updates: { name?: string; description?: string; color?: string; sequence_order?: number }) {
    return this.request(`/task-statuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteTaskStatus(id: string) {
    return this.request(`/task-statuses/${id}`, {
      method: 'DELETE'
    });
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

  // Generic HTTP methods for flexibility
  async get(endpoint: string) {
    return this.request(endpoint);
  }

  async post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();