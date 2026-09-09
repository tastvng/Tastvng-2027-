import { createClient } from "@supabase/supabase-js";
import { applyCorsHeaders } from "./_cors";
import { verifySupabaseAdminToken } from "./_supabase-auth";

/**
 * Serverless Handler: POST or PATCH /api/admin-user-update
 * Updates an admin or staff member's role or active status.
 * Strictly protected: Requires active session with profiles.role === 'admin'.
 * Always sets Content-Type: application/json and returns pure JSON.
 */
export default async function adminUserUpdateHandler(req: any, res: any) {
  // Always ensure JSON output header
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // Handle CORS
  applyCorsHeaders(req, res, "POST, PATCH, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST' && method !== 'PATCH') {
    return res.status(405).json({
      error: `Mètode ${method} no permès a /api/admin-user-update. Utilitzeu POST o PATCH.`
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
      error: "Accés denegat (403): Només els usuaris amb el rol 'admin' a public.profiles poden modificar el personal."
    });
  }

  // 2. Extract inputs from body or query
  const body = req.body || {};
  const targetId = String(body.id || req.query?.id || '').trim();
  const { role: newRoleRaw, actiu } = body;

  if (!targetId) {
    return res.status(400).json({
      error: "Cal especificar l'identificador (id) de l'usuari a modificar."
    });
  }

  // 3. Supabase Admin client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: "Error del servidor: La clau de servei de Supabase no està configurada a les variables d'entorn."
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // 4. Update Role if specified
    if (newRoleRaw !== undefined) {
      const role = String(newRoleRaw).trim().toLowerCase();
      if (role !== 'admin' && role !== 'staff') {
        return res.status(400).json({ error: "El rol ha de ser estrictament 'admin' o 'staff'." });
      }

      // Prevent self-demotion
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
          role: role,
          updated_at: now
        }, { onConflict: 'id' });

      if (profUpdateErr) {
        console.error("[/api/admin-user-update] Error actualitzant perfil:", profUpdateErr);
        return res.status(500).json({
          error: `Error actualitzant rol a public.profiles: ${profUpdateErr.message}`
        });
      }

      // Synchronize metadata in Supabase Auth
      await supabaseAdmin.auth.admin.updateUserById(targetId, {
        user_metadata: { role }
      });
    }

    // 5. Update active/banned status if specified
    if (typeof actiu === 'boolean') {
      if (targetId === adminAuth.userId && !actiu) {
        return res.status(400).json({
          error: "Mesura de seguretat: No podeu desactivar el vostre propi compte d'administrador."
        });
      }

      const banDuration = actiu ? 'none' : '876000h'; // ~100 years ban if disabled
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
        ban_duration: banDuration
      });

      if (banErr) {
        console.error("[/api/admin-user-update] Error modificant estat d'accés:", banErr);
        return res.status(500).json({ error: banErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Usuari actualitzat correctament a Supabase Auth i public.profiles."
    });
  } catch (err: any) {
    console.error("[/api/admin-user-update] Excepció inesperada:", err);
    return res.status(500).json({
      error: err?.message || "Error intern del servidor al modificar l'usuari."
    });
  }
}
