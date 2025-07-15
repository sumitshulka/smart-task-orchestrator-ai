
// Creates a user via API endpoint instead of edge function
export async function apiCreateUser(payload: {
  email: string;
  password: string;
  user_name: string;
  department: string;
  phone?: string;
  manager?: string;
  roles?: string[];
}) {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error: any) {
    throw new Error(error.message ?? "Failed to create user");
  }
}
