import { applyCorsHeaders } from "./_cors";

/**
 * Diagnostic Endpoint: GET /api/admin-health
 * Verifies that the serverless runtime and Supabase environment are properly configured.
 * Always returns JSON with Content-Type: application/json.
 */
export default async function adminHealthHandler(req: any, res: any) {
  // Always ensure application/json Content-Type
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Handle CORS
  applyCorsHeaders(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

  const payload = {
    ok: true,
    route: "/api/admin-health",
    supabaseConfigured,
    time: new Date().toISOString()
  };

  return res.status(200).json(payload);
}
