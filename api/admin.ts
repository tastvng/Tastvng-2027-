import { createClient } from "@supabase/supabase-js";
import { applyCorsHeaders } from "./_cors";
import { verifySupabaseAdminToken } from "./_supabase-auth";
import { checkRateLimit, getClientIp } from "./_rate-limit";

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
 * Consolidated Admin Serverless Handler: /api/admin
 * Routes internally based on req.method, req.query.action, and req.body.action:
 * - action=health: Health diagnostic check
 * - action=list / users (GET): List staff and admin users
 * - action=create (POST): Create a new administrator/staff user
 * - action=update (PATCH / POST): Update role or active status
 * - action=delete (DELETE / POST): Delete an administrator/staff user
 */
export default async function adminHandler(req: any, res: any) {
  // Always ensure application/json Content-Type
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // 1. CORS
  applyCorsHeaders(req, res, "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  const method = (req.method || 'GET').toUpperCase();
  const query = req.query || {};
  const body = req.body || {};

  // Resolve target action
  const rawAction = String(query.action || body.action || '').trim().toLowerCase();
  
  // ==========================================
  // ROUTE: Health check (Public / Unauthenticated)
  // ==========================================
  if (rawAction === 'health' || req.url?.includes('health')) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

    return res.status(200).json({
      ok: true,
      route: "/api/admin?action=health",
      supabaseConfigured,
      time: new Date().toISOString()
    });
  }

  // ==========================================
  // Rate limiting for admin mutations
  // ==========================================
  const clientIp = getClientIp(req);
  if (!checkRateLimit('admin', clientIp, 60, 60 * 1000)) {
    return res.status(429).json({ error: "Massa peticions d'administració per minut." });
  }

  // ==========================================
  // Authenticate Admin User via Bearer Token
  // ==========================================
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
      error: "Accés denegat (403): Només els usuaris amb el rol 'admin' a public.profiles poden gestionar el personal."
    });
  }

  // Initialize Supabase Admin with Service Role Key
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[/api/admin] SUPABASE_SERVICE_ROLE_KEY o URL absent en entorn");
    return res.status(500).json({
      error: "Error del servidor: La clau de servei de Supabase no està configurada a les variables d'entorn."
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Helper to extract target ID
  const getTargetUserId = (): string => {
    if (body.id) return String(body.id).trim();
    if (query.id) return String(query.id).trim();
    if (req.params?.id) return String(req.params.id).trim();
    const match = (req.url || '').match(/\/api\/admin\/(?:users\/)?([^?\/]+)/);
    return match ? match[1].trim() : '';
  };

  try {
    // ==========================================
    // ACTION: Create user (POST with action=create or default POST)
    // ==========================================
    if (rawAction === 'create' || (method === 'POST' && !rawAction && body.password)) {
      const nom = String(body.nom || body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const roleRaw = String(body.role || 'staff').trim().toLowerCase();
      const password = String(body.password || '');
      const confirmPassword = String(body.confirmPassword || '');

      if (!nom) {
        return res.status(400).json({ error: "Cal introduir el nom complet del membre." });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "L'adreça de correu electrònic no té un format vàlid." });
      }

      if (roleRaw !== 'admin' && roleRaw !== 'staff') {
        return res.status(400).json({ error: "El rol ha de ser 'admin' o 'staff'." });
      }
      const role: 'admin' | 'staff' = roleRaw;

      if (!password || password.length < 6) {
        return res.status(400).json({ error: "La contrasenya ha de tenir com a mínim 6 caràcters." });
      }

      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ error: "La confirmació de la contrasenya no coincideix." });
      }

      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: nom,
          name: nom,
          role
        }
      });

      if (createError || !createData?.user) {
        console.error("[/api/admin createUser] Error:", createError);
        const errMsg = createError?.message || "Error al crear l'usuari a Supabase Auth";
        if (errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("registered")) {
          return res.status(400).json({ error: `El correu electrònic '${email}' ja està registrat a Supabase Auth.` });
        }
        return res.status(400).json({ error: errMsg });
      }

      const newUser = createData.user;
      const now = new Date().toISOString();

      const { error: profileUpsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.id,
          role,
          created_at: now,
          updated_at: now
        }, { onConflict: 'id' });

      if (profileUpsertError) {
        console.error("[/api/admin profile upsert] Error:", profileUpsertError);
        return res.status(500).json({
          error: `Usuari creat a Auth, però no s'ha pogut vincular el seu rol a public.profiles: ${profileUpsertError.message}`
        });
      }

      return res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email || email,
          name: nom,
          role,
          created_at: now,
          updated_at: now,
          actiu: true,
          isCurrentCaller: false
        },
        message: `Usuari ${nom} (${email}) creat amb èxit amb rol '${role}'.`
      });
    }

    // ==========================================
    // ACTION: Update user (PATCH or POST with action=update)
    // ==========================================
    if (rawAction === 'update' || method === 'PATCH' || (method === 'POST' && (body.role !== undefined || body.actiu !== undefined))) {
      const targetId = getTargetUserId();
      if (!targetId) {
        return res.status(400).json({ error: "Cal especificar l'identificador (id) de l'usuari a modificar." });
      }

      const { role: newRoleRaw, actiu } = body;

      if (newRoleRaw !== undefined) {
        const role = String(newRoleRaw).trim().toLowerCase();
        if (role !== 'admin' && role !== 'staff') {
          return res.status(400).json({ error: "El rol ha de ser estrictament 'admin' o 'staff'." });
        }

        if (targetId === adminAuth.userId && role !== 'admin') {
          return res.status(400).json({
            error: "Mesura de seguretat: No podeu rebaixar el vostre propi rol d'administrador mentre teniu la sessió iniciada."
          });
        }

        const now = new Date().toISOString();
        const { error: profUpdateErr } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: targetId,
            role,
            updated_at: now
          }, { onConflict: 'id' });

        if (profUpdateErr) {
          console.error("[/api/admin update profile] Error:", profUpdateErr);
          return res.status(500).json({ error: `Error actualitzant rol a public.profiles: ${profUpdateErr.message}` });
        }

        await supabaseAdmin.auth.admin.updateUserById(targetId, {
          user_metadata: { role }
        });
      }

      if (typeof actiu === 'boolean') {
        if (targetId === adminAuth.userId && !actiu) {
          return res.status(400).json({
            error: "Mesura de seguretat: No podeu desactivar el vostre propi compte d'administrador."
          });
        }

        const banDuration = actiu ? 'none' : '876000h';
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
          ban_duration: banDuration
        });

        if (banErr) {
          console.error("[/api/admin ban update] Error:", banErr);
          return res.status(500).json({ error: banErr.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Usuari actualitzat correctament a Supabase Auth i public.profiles."
      });
    }

    // ==========================================
    // ACTION: Delete user (DELETE or POST with action=delete)
    // ==========================================
    if (rawAction === 'delete' || method === 'DELETE') {
      const targetId = getTargetUserId();
      if (!targetId) {
        return res.status(400).json({ error: "Cal especificar l'identificador (id) de l'usuari a eliminar." });
      }

      if (targetId === adminAuth.userId) {
        return res.status(400).json({
          error: "Mesura de seguretat: No podeu eliminar el vostre propi compte d'administrador mentre esteu autenticat."
        });
      }

      const { error: delAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (delAuthError) {
        console.error("[/api/admin deleteUser] Error:", delAuthError);
        return res.status(500).json({ error: `Error eliminant l'usuari de Supabase Auth: ${delAuthError.message}` });
      }

      const { error: delProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', targetId);

      if (delProfileError) {
        console.warn("[/api/admin delete profile] Warning:", delProfileError);
      }

      return res.status(200).json({
        success: true,
        message: "L'usuari ha estat eliminat correctament de Supabase Auth i de la llista de personal."
      });
    }

    // ==========================================
    // ACTION: List users (GET or action=list or action=users)
    // ==========================================
    if (method === 'GET' || rawAction === 'list' || rawAction === 'users') {
      const { data: authUsersData, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
      if (authUsersError) {
        console.error("[/api/admin listUsers] Error:", authUsersError);
        return res.status(500).json({ error: `Error consultant Supabase Auth: ${authUsersError.message}` });
      }

      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, created_at, updated_at');

      if (profilesError) {
        console.warn("[/api/admin profiles] Warning:", profilesError);
      }

      const profileMap = new Map<string, { role: string; created_at?: string; updated_at?: string }>();
      if (profilesData && Array.isArray(profilesData)) {
        for (const p of profilesData) {
          profileMap.set(p.id, p);
        }
      }

      const users: SanitizedAdminUser[] = (authUsersData.users || []).map((u) => {
        const p = profileMap.get(u.id);
        const resolvedRole: 'admin' | 'staff' = p?.role === 'admin' ? 'admin' : 'staff';
        const name = (u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuari').trim();
        const isBanned = Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now());

        return {
          id: u.id,
          email: u.email || '',
          name,
          role: resolvedRole,
          created_at: p?.created_at || u.created_at,
          updated_at: p?.updated_at || u.updated_at,
          last_sign_in_at: u.last_sign_in_at || null,
          actiu: !isBanned,
          isCurrentCaller: u.id === adminAuth.userId
        };
      });

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
    }

    return res.status(400).json({ error: `Acció no vàlida o no especificada a /api/admin: ${rawAction || method}` });
  } catch (err: any) {
    console.error("[/api/admin] Excepció inesperada:", err);
    return res.status(500).json({ error: err?.message || "Error intern del servidor al processar la petició d'administració." });
  }
}
