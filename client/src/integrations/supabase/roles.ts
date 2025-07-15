
export type Role = {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type UserRole = {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string | null;
  role: Role;
};

export async function fetchRoles() {
  try {
    const response = await fetch('/api/roles');
    if (!response.ok) {
      throw new Error(`Failed to fetch roles: ${response.statusText}`);
    }
    return await response.json() as Role[];
  } catch (error: any) {
    throw new Error(error.message ?? "Failed to fetch roles");
  }
}

// Fetch all user_roles with role info for each user
export async function fetchUserRoles() {
  try {
    const response = await fetch('/api/user-roles');
    if (!response.ok) {
      throw new Error(`Failed to fetch user roles: ${response.statusText}`);
    }
    return await response.json() as UserRole[];
  } catch (error: any) {
    throw new Error(error.message ?? "Failed to fetch user roles");
  }
}

// Assign role to user
export async function addRoleToUser(user_id: string, role_id: string, assigned_by: string | null) {
  try {
    const response = await fetch('/api/user-roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ user_id, role_id, assigned_by }),
    });
    if (!response.ok) {
      throw new Error(`Failed to assign role: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(error.message ?? "Failed to assign role");
  }
}

// Remove role from user
export async function removeRoleFromUser(user_id: string, role_id: string) {
  try {
    const response = await fetch(`/api/user-roles/${user_id}/${role_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to remove role: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(error.message ?? "Failed to remove role");
  }
}

