
import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Role[];
}

// Fetch all user_roles with role info for each user
export async function fetchUserRoles() {
  const { data, error } = await supabase
    .from("user_roles")
    .select("*, role:roles(*)");
  if (error) throw error;
  return data as UserRole[];
}

// Assign role to user
export async function addRoleToUser(user_id: string, role_id: string, assigned_by: string | null) {
  const { data, error } = await supabase
    .from("user_roles")
    .insert([{ user_id, role_id, assigned_by }]);
  if (error) throw error;
  return data;
}

// Remove role from user
export async function removeRoleFromUser(user_id: string, role_id: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .delete()
    .match({ user_id, role_id });
  if (error) throw error;
  return data;
}

