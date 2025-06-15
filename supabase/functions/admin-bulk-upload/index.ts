
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

// CORS headers for browser access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check method
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get env variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    let users = body.users;
    if (!Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: "No users array in payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize and validate users: require at least email, user_name is optional
    users = users
      .map((u) => ({
        email: (u.email || u.Email || "").trim(),
        user_name: u.user_name || u["Employee Name"] || "",
        department: u.department || u.Department || "",
        manager: u.manager || u.Manager || "",
        phone: u.phone || u.Phone || "",
        organization: u.organization || "Main", // fallback
      }))
      .filter((u) => u.email && /^[\w.-]+@[\w.-]+\.\w+$/.test(u.email));

    if (users.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid users to process." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing emails in the users table (case-insensitive)
    const emails = users.map((u) => u.email.toLowerCase());
    const { data: existingUsers, error: queryError } = await supabase
      .from("users")
      .select("email")
      .in("email", emails);

    const existingEmailSet = new Set(
      (existingUsers || []).map((u) => (u.email || "").toLowerCase())
    );

    const toInsert = users.filter((u) => !existingEmailSet.has(u.email.toLowerCase()));
    const skipped = users.filter((u) => existingEmailSet.has(u.email.toLowerCase()));

    let insertCount = 0;
    let insertError = null;

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from("users").insert(
        toInsert.map((u) => ({
          email: u.email,
          user_name: u.user_name,
          department: u.department || null,
          manager: u.manager || null,
          phone: u.phone || null,
          organization: u.organization || null,
          created_by: null, // Could attach a user if desired
        }))
      );
      insertCount = toInsert.length;
      if (insertErr) {
        insertError = insertErr.message || insertErr.details || "Insert failed";
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertCount,
        skipped: skipped.length,
        skipped_emails: skipped.map((u) => u.email),
        error: insertError,
        status: insertError ? "partial" : "success",
        message: insertError
          ? `Inserted ${insertCount}, skipped ${skipped.length} (duplicates), error: ${insertError}`
          : `Inserted ${insertCount}, skipped ${skipped.length} (duplicates).`,
      }),
      { status: insertError ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    let errorMessage = "An unexpected error occurred.";
    if (e instanceof SyntaxError) errorMessage = "Invalid JSON payload.";
    else if (typeof e === "object" && e && "message" in e) errorMessage = String(e.message);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
