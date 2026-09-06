/**
 * Shared CORS & Security Origin Validation
 * Strict origin allowlist enforcement according to security audit.
 */

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
  req: { headers?: Record<string, string | string[] | undefined>; method?: string } | undefined | null,
  res: { setHeader?: (name: string, value: string) => void } | undefined | null,
  allowedMethods: string = 'GET, POST, OPTIONS'
): boolean {
  try {
    const rawOrigin = req?.headers?.origin;
    const origin = typeof rawOrigin === 'string' ? rawOrigin : undefined;
    const isAllowed = isOriginAllowed(origin);

    if (res && typeof res.setHeader === 'function') {
      if (origin && isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      res.setHeader('Access-Control-Allow-Methods', allowedMethods);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }

    return isAllowed;
  } catch (err) {
    console.error('Error applying CORS headers:', err);
    return false;
  }
}
