import type { VercelRequest, VercelResponse } from "@vercel/node";

function getStrictAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  allowed.add('https://tastvng-2027.vercel.app');

  if (process.env.ALLOWED_ORIGINS) {
    for (const item of process.env.ALLOWED_ORIGINS.split(',')) {
      const trimmed = item.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }

  if (process.env.APP_URL) {
    const trimmed = process.env.APP_URL.trim();
    if (trimmed) allowed.add(trimmed);
  }

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }

  return allowed;
}

function applyCorsHeaders(
  req: { headers?: Record<string, string | string[] | undefined> } | undefined | null,
  res: { setHeader?: (name: string, value: string) => void } | undefined | null,
  allowedMethods: string = 'GET, OPTIONS'
): boolean {
  try {
    if (!res || typeof res.setHeader !== 'function') return false;

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", allowedMethods);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    const rawOrigin = req?.headers?.origin;
    const origin = (Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin)?.trim();

    if (origin) {
      const allowedOrigins = getStrictAllowedOrigins();
      if (allowedOrigins.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function maskString(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    const local = parts[0];
    const domain = parts.slice(1).join('@');
    const maskedLocal = local.length > 2 ? local.slice(0, 2) + '***' : local + '***';
    return `${maskedLocal}@${domain}`;
  }
  return trimmed.length > 2 ? trimmed.slice(0, 2) + '***' : trimmed + '***';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Apply CORS and security headers defensively
    applyCorsHeaders(req as any, res as any, "GET, OPTIONS");

    // 2. Handle HTTP OPTIONS preflight
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // 3. Restrict to GET method
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // 4. Safely extract environment variables without throwing
    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const portRaw = process.env.SMTP_PORT || '587';
    const port = parseInt(String(portRaw).trim(), 10) || 587;
    const user = (process.env.SMTP_USER || '').trim();
    const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    const password = (process.env.SMTP_PASSWORD || '').trim();

    // Check if both user and password exist for a complete SMTP configuration
    const configured = Boolean(user && password);

    // 5. Safely mask credentials - NEVER return passwords or raw secrets
    const userMasked = maskString(user);
    const fromMasked = maskString(from);

    return res.status(200).json({
      configured,
      host,
      port,
      userMasked,
      fromMasked,
      user: userMasked,
      from: fromMasked,
      provider: 'Server Environment Variables (Secure)'
    });
  } catch (err) {
    console.error("Safe handler error in /api/smtp-status:", err);
    // Never return HTTP 500 — respond gracefully with configured: false
    return res.status(200).json({
      configured: false,
      host: 'smtp.gmail.com',
      port: 587,
      userMasked: '',
      fromMasked: '',
      provider: 'Server Environment Variables (Fallback)'
    });
  }
}
