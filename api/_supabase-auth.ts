/**
 * Shared Supabase Admin Authentication Verification
 * Validates caller's JWT against Supabase Auth and strictly enforces admin role
 * exclusively using server-authoritative sources: public.profiles and public.is_admin().
 *
 * NOTE: user_metadata is NEVER used for administrative authorization.
 */

export async function verifySupabaseAdminToken(token: string): Promise<{ valid: boolean; userId?: string; email?: string }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || (!supabaseAnonKey && !serviceRoleKey) || !token) {
    return { valid: false };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");

    // 1. Verify JWT token and retrieve authenticated user from Supabase Auth
    const authClient = createClient(supabaseUrl, supabaseAnonKey || serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return { valid: false };
    }

    const user = userData.user;
    const userId = user.id;

    // 2. PRIMARY CHECK: Query public.profiles using service_role key if available
    // Service role bypasses RLS safely on backend to read the authoritative role
    if (serviceRoleKey) {
      try {
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: profile, error: profileErr } = await adminClient
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (!profileErr && profile?.role === 'admin') {
          return { valid: true, userId, email: user.email };
        }
      } catch (err) {
        console.warn("[_supabase-auth] Warning checking role via serviceRoleKey:", err);
      }
    }

    // 3. FALLBACK CHECK: Query under user's authenticated context (via RLS / public.is_admin())
    // Used when SUPABASE_SERVICE_ROLE_KEY is not defined in environment
    if (supabaseAnonKey) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } }
        });

        try {
          await userClient.auth.setSession({ access_token: token, refresh_token: '' });
        } catch {
          // ignore session init failure
        }

        // 3a. Check official SECURITY DEFINER function public.is_admin()
        try {
          const { data: rpcIsAdmin, error: rpcErr } = await userClient.rpc('is_admin');
          if (!rpcErr && rpcIsAdmin === true) {
            return { valid: true, userId, email: user.email };
          }
        } catch {
          // ignore RPC error and fallback to direct table query
        }

        // 3b. Check public.profiles under user's authenticated context (RLS: USING (id = auth.uid()))
        const { data: profile, error: profileErr } = await userClient
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (!profileErr && profile?.role === 'admin') {
          return { valid: true, userId, email: user.email };
        }
      } catch (userClientErr) {
        console.warn("[_supabase-auth] Warning checking role via user client:", userClientErr);
      }
    }

    // If neither server-authoritative source confirms role === 'admin', access is strictly denied
    return { valid: false };
  } catch (err) {
    console.error("[_supabase-auth] Exception verifying admin token:", err);
    return { valid: false };
  }
}
