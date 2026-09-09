import { createClient } from "@supabase/supabase-js";
import { applyCorsHeaders } from "./_cors";
import { verifySupabaseAdminToken } from "./_supabase-auth";

/**
 * Interface representing sanitized admin / staff user data sent to client.
 * Strictly NEVER includes password hashes, salt or raw credentials.
 */
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
 * Serverless & Express handler for /api/admin/users
 * Protected: Requires authenticated user with profiles.role === 'admin'
 */
export default async function adminUsersHandler(req: any, res: any) {
  // Always ensure JSON output header
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // 1. CORS headers
  applyCorsHeaders(req, res, "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  // 2. Authentication & Admin Authorization check
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return res.status(401).json({
      error: "Accés no autoritzat. Cal una capçalera Authorization Bearer vàlida."
    });
  }

  const adminAuth = await verifySupabaseAdminToken(token);
  if (!adminAuth.valid || !adminAuth.userId) {
    return res.status(403).json({
      error: "Accés denegat: Només els usuaris amb el rol 'admin' a public.profiles poden gestionar el personal."
    });
  }

  // 3. Supabase Service Role Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[/api/admin/users] Mancança de variables de configuració de Supabase");
    return res.status(500).json({
      error: "Error del servidor: SUPABASE_SERVICE_ROLE_KEY no està disponible en l'entorn del backend."
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const method = (req.method || 'GET').toUpperCase();

  // Helper to extract user ID from params, query or URL
  const getTargetUserId = (): string => {
    if (req.params?.id) return String(req.params.id).trim();
    if (req.query?.id) return String(req.query.id).trim();
    const match = (req.url || '').match(/\/api\/admin\/users\/([^?\/]+)/);
    return match ? match[1].trim() : '';
  };

  try {
    // ==========================================
    // GET: List all users from auth.users + profiles
    // ==========================================
    if (method === 'GET') {
      const { data: authUsersData, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
      if (authUsersError) {
        console.error("[/api/admin/users GET] Error listUsers:", authUsersError);
        return res.status(500).json({ error: authUsersError.message });
      }

      // Fetch all roles from profiles table
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, created_at, updated_at');

      if (profilesError) {
        console.error("[/api/admin/users GET] Error profiles:", profilesError);
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
          name: name,
          role: resolvedRole,
          created_at: p?.created_at || u.created_at,
          updated_at: p?.updated_at || u.updated_at,
          last_sign_in_at: u.last_sign_in_at || null,
          actiu: !isBanned,
          isCurrentCaller: u.id === adminAuth.userId
        };
      });

      // Sort: Current caller first, then other admins, then staff
      users.sort((a, b) => {
        if (a.isCurrentCaller) return -1;
        if (b.isCurrentCaller) return 1;
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.email.localeCompare(b.email);
      });

      return res.json({ success: true, users });
    }

    // ==========================================
    // POST: Create a new user with Supabase Auth
    // ==========================================
    if (method === 'POST') {
      const body = req.body || {};
      const nom = String(body.nom || body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const roleRaw = String(body.role || 'staff').trim().toLowerCase();
      const password = String(body.password || '');
      const confirmPassword = String(body.confirmPassword || '');

      // Validation
      if (!nom) {
        return res.status(400).json({ error: "Cal introduir el nom complet del membre." });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "L'adreça de correu electrònic no té un format vàlid." });
      }

      if (roleRaw !== 'admin' && roleRaw !== 'staff') {
        return res.status(400).json({ error: "El rol ha de ser estrictament 'admin' o 'staff'." });
      }
      const role: 'admin' | 'staff' = roleRaw;

      if (!password || password.length < 6) {
        return res.status(400).json({ error: "La contrasenya ha de tenir com a mínim 6 caràcters." });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: "La confirmació de la contrasenya no coincideix." });
      }

      // Create user in Supabase Auth securely
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: nom,
          name: nom,
          role: role
        }
      });

      if (createError || !createData?.user) {
        console.error("[/api/admin/users POST] Error en createUser:", createError);
        const errMsg = createError?.message || "Error al crear l'usuari a Supabase Auth";
        if (errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("registered")) {
          return res.status(400).json({ error: `El correu electrònic '${email}' ja està registrat a Supabase Auth.` });
        }
        return res.status(400).json({ error: errMsg });
      }

      const newUser = createData.user;
      const now = new Date().toISOString();

      // Upsert profile in public.profiles
      const { error: profileUpsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.id,
          role: role,
          created_at: now,
          updated_at: now
        }, { onConflict: 'id' });

      if (profileUpsertError) {
        console.error("[/api/admin/users POST] Error upserting profile:", profileUpsertError);
        return res.status(500).json({
          error: `Usuari d'Auth creat, però ha fallat l'assignació del perfil a public.profiles: ${profileUpsertError.message}`
        });
      }

      const sanitizedUser: SanitizedAdminUser = {
        id: newUser.id,
        email: newUser.email || email,
        name: nom,
        role: role,
        created_at: now,
        updated_at: now,
        actiu: true,
        isCurrentCaller: false
      };

      return res.status(201).json({
        success: true,
        user: sanitizedUser,
        message: `Membre ${nom} (${email}) creat amb èxit amb rol ${role}.`
      });
    }

    // ==========================================
    // PATCH: Update user role or active status
    // ==========================================
    if (method === 'PATCH') {
      const targetId = getTargetUserId();
      if (!targetId) {
        return res.status(400).json({ error: "Cal especificar l'identificador (id) de l'usuari a modificar." });
      }

      const body = req.body || {};
      const { role: newRoleRaw, actiu } = body;

      // Updating role
      if (newRoleRaw !== undefined) {
        const role = String(newRoleRaw).trim().toLowerCase();
        if (role !== 'admin' && role !== 'staff') {
          return res.status(400).json({ error: "El rol ha de ser estrictament 'admin' o 'staff'." });
        }

        // Prevent self-demotion if caller is modifying their own role
        if (targetId === adminAuth.userId && role !== 'admin') {
          return res.status(400).json({
            error: "Mesura de seguretat: No podeu rebaixar el vostre propi rol d'administrador mentre esteu autenticat."
          });
        }

        const now = new Date().toISOString();
        const { error: profUpdateErr } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: targetId,
            role: role,
            updated_at: now
          }, { onConflict: 'id' });

        if (profUpdateErr) {
          console.error("[/api/admin/users PATCH] Error actualitzant perfil:", profUpdateErr);
          return res.status(500).json({ error: `Error actualitzant rol a public.profiles: ${profUpdateErr.message}` });
        }

        // Keep metadata synchronized in Auth
        await supabaseAdmin.auth.admin.updateUserById(targetId, {
          user_metadata: { role }
        });
      }

      // Updating active / banned state
      if (typeof actiu === 'boolean') {
        if (targetId === adminAuth.userId && !actiu) {
          return res.status(400).json({
            error: "Mesura de seguretat: No podeu desactivar el vostre propi compte d'administrador."
          });
        }

        const banDuration = actiu ? 'none' : '876000h'; // ~100 years if inactive
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
          ban_duration: banDuration
        });

        if (banErr) {
          console.error("[/api/admin/users PATCH] Error modificant estat d'accés:", banErr);
          return res.status(500).json({ error: banErr.message });
        }
      }

      return res.json({ success: true, message: "Usuari actualitzat correctament." });
    }

    // ==========================================
    // DELETE: Delete user from Auth & profiles
    // ==========================================
    if (method === 'DELETE') {
      const targetId = getTargetUserId();
      if (!targetId) {
        return res.status(400).json({ error: "Cal especificar l'identificador (id) de l'usuari a eliminar." });
      }

      // Prevent self-deletion
      if (targetId === adminAuth.userId) {
        return res.status(400).json({
          error: "Mesura de seguretat: No podeu eliminar el vostre propi compte d'administrador en ús."
        });
      }

      // Delete user from Supabase Auth
      const { error: delAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (delAuthError) {
        console.error("[/api/admin/users DELETE] Error deleteUser:", delAuthError);
        return res.status(500).json({ error: `Error eliminant usuari d'Auth: ${delAuthError.message}` });
      }

      // Remove from profiles (NEVER touches inscripcions or other functional tables)
      const { error: delProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', targetId);

      if (delProfileError) {
        console.warn("[/api/admin/users DELETE] Warning removing from profiles:", delProfileError);
      }

      return res.json({
        success: true,
        message: "L'usuari ha estat eliminat correctament de Supabase Auth i de la llista de personal."
      });
    }

    return res.status(405).json({ error: `Mètode HTTP ${method} no permès.` });
  } catch (err: any) {
    console.error("[/api/admin/users] Excepció no controlada:", err);
    return res.status(500).json({ error: err?.message || "Error intern del servidor al processar la petició." });
  }
}
