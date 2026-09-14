/**
 * Health Check Serverless Handler: /api/health
 * Public, low-overhead endpoint for service monitors and uptime pings.
 * Completely self-contained to ensure seamless execution on Vercel Serverless.
 */
export default async function healthHandler(req: any, res: any) {
  const origin = req?.headers?.origin || '*';
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  if ((req.method || '').toUpperCase() === "OPTIONS") {
    if (typeof res.status === 'function') {
      return res.status(200).end();
    }
    if (typeof res.writeHead === 'function') {
      res.writeHead(200);
      return res.end();
    }
    return res.end ? res.end() : undefined;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const payload = {
    ok: true,
    status: "ok",
    service: "Tast 2027 API",
    uptime: process.uptime ? process.uptime() : undefined,
    supabaseConfigured: Boolean(supabaseUrl && (serviceRoleKey || anonKey)),
    hasUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasAnonKey: Boolean(anonKey),
    timestamp: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(payload);
  if (typeof res.status === 'function') {
    if (typeof res.json === 'function') {
      return res.status(200).json(payload);
    }
    return res.status(200).end(jsonStr);
  }
  if (typeof res.writeHead === 'function') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(jsonStr);
  }
  return res.end ? res.end(jsonStr) : undefined;
}
