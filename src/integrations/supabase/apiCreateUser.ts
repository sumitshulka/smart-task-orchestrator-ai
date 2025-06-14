
// Calls the edge function to create a user securely as an admin
export async function apiCreateUser(payload: {
  email: string;
  password: string;
  user_name: string;
  department: string;
  phone?: string;
  manager?: string;
  roles?: string[];
}) {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || "https://hzfwmftpyxjtdohxhcgb.supabase.co/functions/v1"}/create-user-admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!resp.ok) {
    const error = await resp.json();
    throw new Error(error.error || "Failed to create user");
  }
  return await resp.json();
}
