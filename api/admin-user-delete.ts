import { createClient } from "@supabase/supabase-js";
import { applyCorsHeaders } from "./_cors";
import { verifySupabaseAdminToken } from "./_supabase-auth";

/**
 * Serverless Handler: POST or DELETE /api/admin-user-delete
 * Securely deletes an admin or staff user from Supabase Auth and removes their profile.
 * Crucially, does NOT touch inscriptions, receipts, or any other operational tables.
 * Strictly protected: Requires active session with profiles.role === 'admin'.
 * Always sets Content-Type: application/json and returns pure JSON.
 */
export default async function adminUserDeleteHandler(req: any, res: any) {
  // Always ensure JSON output header
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // Handle CORS
  applyCorsHeaders(req, res, "POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST' && method !== 'DELETE') {
    return res.status(405).json({
      error: `Mètode ${method} no permès a /api/admin-user-delete. Utilitzeu POST o DELETE.`
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
      error: "Accés denegat (403): Només els usuaris amb el rol 'admin' a public.profiles poden donar de baixa personal."
    });
  }

  // 2. Extract target user id from body or query
  const body = req.body || {};
  const targetId = String(body.id || req.query?.id || '').trim();

  if (!targetId) {
    return res.status(400).json({
      error: "Cal especificar l'identificador (id) de l'usuari a eliminar."
    });
  }

  // Prevent self-deletion
  if (targetId === adminAuth.userId) {
    return res.status(400).json({
      error: "Mesura de seguretat: No podeu eliminar el vostre propi compte d'administrador mentre esteu autenticat."
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
    // 4. Delete user from Supabase Auth
    const { error: delAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (delAuthError) {
      console.error("[/api/admin-user-delete] Error eliminant usuari d'Auth:", delAuthError);
      return res.status(500).json({
        error: `Error eliminant l'usuari de Supabase Auth: ${delAuthError.message}`
      });
    }

    // 5. Remove record from public.profiles
    const { error: delProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', targetId);

    if (delProfileError) {
      console.warn("[/api/admin-user-delete] Advertència en eliminar de public.profiles:", delProfileError);
    }

    return res.status(200).json({
      success: true,
      message: "L'usuari ha estat eliminat correctament de Supabase Auth i de la llista de personal."
    });
  } catch (err: any) {
    console.error("[/api/admin-user-delete] Excepció inesperada:", err);
    return res.status(500).json({
      error: err?.message || "Error intern del servidor al donar de baixa l'usuari."
    });
  }
}
