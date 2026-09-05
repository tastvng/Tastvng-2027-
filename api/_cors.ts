/**
 * Shared CORS & Security Origin Validation
 * Strict origin allowlist enforcement according to security audit.
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Returns the exact set of authorized origins.
 * Strictly forbids wildcards (*.vercel.app, *.run.app) and Host header spoofing.
 */
export function getStrictAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();

  // 1. Mandatory canonical production domain
  allowed.add('https://tastvng-2027.vercel.app');

  // 2. Explicitly configured origins via ALLOWED_ORIGINS environment variable
  // Accepts a comma-separated list of exact domains (e.g. "https://tastvng-2027.vercel.app,http://localhost:5173")
  if (process.env.ALLOWED_ORIGINS) {
    const customList = process.env.ALLOWED_ORIGINS.split(',');
    for (const item of customList) {
      const trimmed = item.trim();
      if (trimmed) {
        allowed.add(trimmed);
      }
    }
  }

  // 3. Explicit APP_URL if set in environment
  if (process.env.APP_URL) {
    const trimmed = process.env.APP_URL.trim();
    if (trimmed) {
      allowed.add(trimmed);
    }
  }

  // 4. Localhost allowed ONLY in local development / non-production environments
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }

  return allowed;
}

/**
 * Checks if the given origin is strictly allowed.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowed = getStrictAllowedOrigins();
  return allowed.has(origin);
}

/**
 * Applies strict CORS and security headers to HTTP response.
 * Returns true if the origin is authorized.
 */
export function applyCorsHeaders(
  req: { headers: Record<string, string | string[] | undefined>; method?: string },
  res: { setHeader: (name: string, value: string) => void },
  allowedMethods: string = 'GET, POST, OPTIONS'
): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const isAllowed = isOriginAllowed(origin);

  if (origin && isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  return isAllowed;
}

/**
 * Verifies that a Supabase bearer token belongs to a legitimate administrator.
 * Authenticated alone is NOT sufficient: role must be 'admin' in public.profiles.
 */
export async function verifySupabaseAdminToken(token: string): Promise<{ valid: boolean; userId?: string; email?: string }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || (!supabaseAnonKey && !serviceRoleKey) || !token) {
    return { valid: false };
  }

  try {
    // 1. Verify token and retrieve user
    const baseClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey!, {
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await baseClient.auth.getUser(token);
    if (userError || !user) {
      return { valid: false };
    }

    // 2. Check role in public.profiles using service role if available, or user client with token
    let profileRole: string | null = null;

    if (serviceRoleKey) {
      const { data: profile } = await baseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      profileRole = profile?.role || null;
    } else {
      // Query with authenticated user context
      const userClient = createClient(supabaseUrl, supabaseAnonKey!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      });
      const { data: profile } = await userClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      profileRole = profile?.role || null;
    }

    if (profileRole === 'admin') {
      return { valid: true, userId: user.id, email: user.email };
    }

    // 3. Fallback bootstrap: official administrator email
    if (user.email && user.email.toLowerCase() === 'secretaria@eltast.cat') {
      return { valid: true, userId: user.id, email: user.email };
    }

    return { valid: false };
  } catch (err) {
    console.error("Error verifying admin token:", err);
    return { valid: false };
  }
}
