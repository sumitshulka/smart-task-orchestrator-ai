
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars!");
  throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars!");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      console.error("[LOG] Failed to parse body:", rawBody, err);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log("[LOG] Incoming payload:", JSON.stringify(payload));

    const { email, user_name, password, department, phone, manager, roles } = payload;

    if (!email || !password || !user_name || !department) {
      console.warn("[LOG] Missing required fields:", { email, password, user_name, department });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: corsHeaders
      });
    }

    // 1. CREATE THE USER IN AUTH
    console.log("[LOG] Creating user in Auth service for email:", email);
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
        email_confirm: false
      }),
    });

    const createUserData = await createUserRes.json();
    console.log("[LOG] createUserRes:", createUserRes.status, createUserRes.statusText, JSON.stringify(createUserData));

    if (!createUserRes.ok || !createUserData.user?.id) {
      console.error("[LOG] Auth user creation failed:", createUserData);
      return new Response(JSON.stringify({ error: createUserData.error?.message || createUserData.message || "Auth user creation failed." }), {
        status: 400, headers: corsHeaders
      });
    }
    const userId = createUserData.user.id;
    console.log("[LOG] Auth user created with id:", userId);

    // 2. ADD TO PUBLIC.USERS
    console.log("[LOG] Inserting user profile row into users table.");
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
        created_by: null,
      }]),
    });
    const usersData = await usersRes.json();
    console.log("[LOG] usersRes:", usersRes.status, usersRes.statusText, JSON.stringify(usersData));
    if (!usersRes.ok) {
      console.error("[LOG] User profile insertion failed.", usersData);
      return new Response(JSON.stringify({ error: usersData.message || "User profile insertion failed" }), {
        status: 400, headers: corsHeaders
      });
    }

    // 3. ASSIGN ROLES
    let assignedRoles = [];
    if (roles && Array.isArray(roles) && roles.length > 0) {
      // Get all available roles just once to map name -> id
      console.log("[LOG] Assigning roles:", JSON.stringify(roles));
      const rolesRes = await fetch(`${SUPABASE_URL}/rest/v1/roles`, {
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        }
      });
      const availableRoles = await rolesRes.json();
      const roleMap: Record<string, any> = {};
      for (const r of availableRoles) {
        roleMap[r.name] = r.id;
      }
      for (const role of roles) {
        const role_id = roleMap[role];
        if (role_id) {
          const urRes = await fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
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
          const urData = await urRes.json();
          console.log(`[LOG] user_roles insert for ${role}:`, urRes.status, urRes.statusText, JSON.stringify(urData));
          assignedRoles.push(role);
        } else {
          console.warn(`[LOG] Role ${role} not found in roleMap.`);
        }
      }
    } else {
      console.log("[LOG] No roles to assign.");
    }

    console.log("[LOG] Success. Responding to client with user_id:", userId, "assignedRoles:", assignedRoles);
    return new Response(JSON.stringify({ success: true, user_id: userId, assignedRoles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[LOG] Unhandled error:", err && (err.message || JSON.stringify(err)));
    return new Response(JSON.stringify({ error: err.message || "Server error" }), {
      status: 500, headers: corsHeaders
    });
  }
});
