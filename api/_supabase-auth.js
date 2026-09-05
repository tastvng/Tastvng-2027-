// api/_supabase-auth.ts
async function verifySupabaseAdminToken(token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey && !serviceRoleKey || !token) {
    return { valid: false };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const baseClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
      auth: { persistSession: false }
    });
    const { data: { user }, error: userError } = await baseClient.auth.getUser(token);
    if (userError || !user) {
      return { valid: false };
    }
    let profileRole = null;
    if (serviceRoleKey) {
      const { data: profile } = await baseClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
      profileRole = profile?.role || null;
    } else {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      });
      const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
      profileRole = profile?.role || null;
    }
    if (profileRole === "admin") {
      return { valid: true, userId: user.id, email: user.email };
    }
    return { valid: false };
  } catch (err) {
    console.error("Error verifying admin token:", err);
    return { valid: false };
  }
}
export {
  verifySupabaseAdminToken
};
