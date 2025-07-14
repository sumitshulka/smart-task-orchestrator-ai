
import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await supabase.functions.invoke("create-user-admin", {
    body: payload,
  });
  if (error) {
    throw new Error(error.message ?? "Failed to create user");
  }
  if (data && data.error) {
    throw new Error(data.error || "Failed to create user");
  }
  return data;
}
