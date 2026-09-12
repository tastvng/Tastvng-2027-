import { createClient } from "@supabase/supabase-js";
import { applyCorsHeaders } from "./_cors.ts";
import { verifySupabaseAdminToken } from "./_supabase-auth.ts";

/**
 * Consolidated Config Serverless Handler: /api/config
 * Manages dynamic questionnaire and system settings.
 * - GET: Retrieves questionnaire questions (public, filtered by active).
 * - POST: Saves or bulk updates questionnaire questions (Admin Auth required).
 * - DELETE: Deletes a questionnaire question by ID (Admin Auth required).
 */
export default async function configHandler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  applyCorsHeaders(req, res, "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  const method = (req.method || 'GET').toUpperCase();
  const query = req.query || {};
  const body = req.body || {};
  const action = String(query.action || body.action || 'preguntes').trim().toLowerCase();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    return res.status(500).json({ error: "Supabase no configurat al servidor." });
  }

  try {
    // ==========================================
    // GET: List questions (action=preguntes / questions)
    // ==========================================
    if (method === 'GET') {
      const client = createClient(supabaseUrl, serviceRoleKey || anonKey!, {
        auth: { persistSession: false }
      });

      const onlyActive = query.active !== 'false';
      let dbQuery = client.from('preguntes').select('*').order('ordre', { ascending: true });
      if (onlyActive) {
        dbQuery = dbQuery.eq('activa', true);
      }

      const { data, error } = await dbQuery;
      if (error) {
        console.error("[/api/config GET preguntes] Error:", error);
        return res.status(500).json({ error: error.message || error });
      }

      return res.status(200).json({ data: data || [] });
    }

    // ==========================================
    // Admin Authentication required for mutations
    // ==========================================
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    const adminAuth = token ? await verifySupabaseAdminToken(token) : { valid: false };
    if (!adminAuth.valid) {
      return res.status(401).json({ error: "No autoritzat com a administrador." });
    }

    if (!serviceRoleKey) {
      return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY absent en entorn." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // ==========================================
    // POST: Save or synchronize questions
    // ==========================================
    if (method === 'POST') {
      const preguntes = body.preguntes || body.questions;
      if (!Array.isArray(preguntes)) {
        return res.status(400).json({ error: "El camp 'preguntes' ha de ser una llista." });
      }

      const currentIds = preguntes.map(p => String(p.id));

      const { data: existingRows } = await adminClient.from('preguntes').select('id');
      if (existingRows && existingRows.length > 0) {
        const idsToDelete = existingRows
          .map(r => String(r.id))
          .filter(id => !currentIds.includes(id));

        if (idsToDelete.length > 0) {
          const { error: delErr } = await adminClient.from('preguntes').delete().in('id', idsToDelete);
          if (delErr) {
            console.error("[/api/config POST delete removed] Error:", delErr);
            return res.status(500).json({ error: delErr.message });
          }
        }
      }

      if (preguntes.length > 0) {
        const payload = preguntes.map((p, index) => ({
          id: String(p.id),
          titol: String(p.titol || ''),
          tipus: p.tipus || 'text',
          opcions: p.tipus === 'select' && Array.isArray(p.opcions) && p.opcions.length > 0 ? p.opcions : null,
          requerit: !!p.requerit,
          activa: !!p.activa,
          ordre: typeof p.ordre === 'number' ? p.ordre : index,
          updated_at: new Date().toISOString()
        }));

        const { error: upErr } = await adminClient.from('preguntes').upsert(payload, { onConflict: 'id' });
        if (upErr) {
          console.error("[/api/config POST upsert] Error:", upErr);
          return res.status(500).json({ error: upErr.message });
        }
      }

      return res.status(200).json({ success: true, count: preguntes.length });
    }

    // ==========================================
    // DELETE: Delete a question by ID
    // ==========================================
    if (method === 'DELETE') {
      const targetId = String(query.id || body.id || req.params?.id || '').trim();
      if (!targetId) {
        return res.status(400).json({ error: "Cal especificar l'identificador (id) de la pregunta a eliminar." });
      }

      const { error } = await adminClient.from('preguntes').delete().eq('id', targetId);
      if (error) {
        console.error("[/api/config DELETE] Error:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, id: targetId });
    }

    return res.status(405).json({ error: `Mètode HTTP ${method} no permès a /api/config.` });
  } catch (err: any) {
    console.error("[/api/config] Error no controlat:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
