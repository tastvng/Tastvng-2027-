import { applyCorsHeaders } from "./_cors";

/**
 * Health Check Serverless Handler: /api/health
 * Public, low-overhead endpoint for service monitors and uptime pings.
 */
export default async function healthHandler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  applyCorsHeaders(req, res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  return res.status(200).json({
    status: "ok",
    service: "Tast 2027 API",
    uptime: process.uptime ? process.uptime() : undefined,
    supabaseConfigured: Boolean(supabaseUrl && (serviceRoleKey || anonKey)),
    timestamp: new Date().toISOString()
  });
}
