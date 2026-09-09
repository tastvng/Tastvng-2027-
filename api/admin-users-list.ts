import { createClient } from "@supabase/supabase-js";
import { applyCorsHeaders } from "./_cors";
import { verifySupabaseAdminToken } from "./_supabase-auth";

export interface SanitizedAdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  created_at: string;
  updated_at?: string;
  last_sign_in_at?: string | null;
  actiu: boolean;
  isCurrentCaller?: boolean;
}

/**
 * Serverless Handler: GET /api/admin-users-list
 * Lists all real authenticated users from Supabase auth.users crossed with public.profiles.
 * Strictly protected: Requires active session with profiles.role === 'admin'.
 * Always sets Content-Type: application/json and returns pure JSON.
 */
export default async function adminUsersListHandler(req: any, res: any) {
  // Always ensure JSON output header
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // Handle CORS
  applyCorsHeaders(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: `Mètode ${req.method} no permès a /api/admin-users-list. Utilitzeu GET.`
    });
  }

  // 1. Authenticate calling administrator
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return res.status(401).json({
      error: "Accés no autoritzat (401): Cal una capçalera Authorization: Bearer <token> amb sessió activa."
    });
  }

  const adminAuth = await verifySupabaseAdminToken(token);
  if (!adminAuth.valid || !adminAuth.userId) {
    return res.status(403).json({
      error: "Accés denegat (403): Només els usuaris amb el rol 'admin' a public.profiles poden llistar el personal."
    });
  }

  // 2. Initialize Supabase Admin with Service Role Key (server-side only)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[/api/admin-users-list] SUPABASE_SERVICE_ROLE_KEY o URL absent en entorn");
    return res.status(500).json({
      error: "Error del servidor: La clau de servei de Supabase no està configurada a les variables d'entorn."
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // 3. Query all users from auth.users
    const { data: authUsersData, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (authUsersError) {
      console.error("[/api/admin-users-list] Error llistant auth.users:", authUsersError);
      return res.status(500).json({
        error: `Error consultant Supabase Auth: ${authUsersError.message}`
      });
    }

    // 4. Query all roles from public.profiles
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, created_at, updated_at');

    if (profilesError) {
      console.warn("[/api/admin-users-list] Warning consultant public.profiles:", profilesError);
    }

    const profileMap = new Map<string, { role: string; created_at?: string; updated_at?: string }>();
    if (profilesData && Array.isArray(profilesData)) {
      for (const p of profilesData) {
        profileMap.set(p.id, p);
      }
    }

    // 5. Cross auth.users with public.profiles by user.id
    const users: SanitizedAdminUser[] = (authUsersData.users || []).map((u) => {
      const p = profileMap.get(u.id);
      const resolvedRole: 'admin' | 'staff' = p?.role === 'admin' ? 'admin' : 'staff';
      const name = (u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuari').trim();
      const isBanned = Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now());

      return {
        id: u.id,
        email: u.email || '',
        name: name,
        role: resolvedRole,
        created_at: p?.created_at || u.created_at,
        updated_at: p?.updated_at || u.updated_at,
        last_sign_in_at: u.last_sign_in_at || null,
        actiu: !isBanned,
        isCurrentCaller: u.id === adminAuth.userId
      };
    });

    // 6. Sort users: current caller first, then other admins, then staff, alphabetical by email
    users.sort((a, b) => {
      if (a.isCurrentCaller) return -1;
      if (b.isCurrentCaller) return 1;
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return a.email.localeCompare(b.email);
    });

    return res.status(200).json({
      success: true,
      users,
      count: users.length
    });
  } catch (err: any) {
    console.error("[/api/admin-users-list] Excepció inesperada:", err);
    return res.status(500).json({
      error: err?.message || "Error intern del servidor al processar el llistat de personal."
    });
  }
}
