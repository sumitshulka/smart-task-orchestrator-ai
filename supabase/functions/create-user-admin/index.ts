
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// CORS headers for browser use
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Read the service role key from env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars!");
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, user_name, password, department, phone, manager, roles } = await req.json();

    if (!email || !password || !user_name || !department) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: corsHeaders
      });
    }

    // 1. CREATE THE USER IN AUTH
    const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: {
          full_name: user_name,
          department,
          phone,
          manager,
        },
        email_confirm: false // Change to true if you want a confirm email to go out
      }),
    });
    const createUserData = await createUserRes.json();

    if (!createUserRes.ok || !createUserData.user?.id) {
      return new Response(JSON.stringify({ error: createUserData.error?.message || createUserData.message || "Auth user creation failed." }), {
        status: 400, headers: corsHeaders
      });
    }
    const userId = createUserData.user.id;

    // 2. ADD TO PUBLIC.USERS
    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify([{
        id: userId,
        email,
        user_name,
        department,
        phone,
        manager,
        created_by: null, // Optionally, pass through the admin's user_id
      }]),
    });
    const usersData = await usersRes.json();
    if (!usersRes.ok) {
      return new Response(JSON.stringify({ error: usersData.message || "User profile insertion failed" }), {
        status: 400, headers: corsHeaders
      });
    }

    // 3. ASSIGN ROLES
    let assignedRoles = [];
    if (roles && Array.isArray(roles) && roles.length > 0) {
      // Get all available roles just once to map name -> id
      const rolesRes = await fetch(`${SUPABASE_URL}/rest/v1/roles`, {
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        }
      });
      const availableRoles = await rolesRes.json();
      const roleMap = {};
      for (const r of availableRoles) {
        roleMap[r.name] = r.id;
      }
      for (const role of roles) {
        const role_id = roleMap[role];
        if (role_id) {
          await fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
            method: "POST",
            headers: {
              "apikey": SERVICE_ROLE_KEY,
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([{
              user_id: userId,
              role_id: role_id,
              assigned_by: null,
            }])
          });
          assignedRoles.push(role);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, assignedRoles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Server error" }), {
      status: 500, headers: corsHeaders
    });
  }
});
