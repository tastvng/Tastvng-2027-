/**
 * Shared in-memory rate limiter for serverless endpoints and local server.
 * Prefix with underscore `_` so Vercel excludes it from the Serverless Functions limit.
 */
const rateLimitMaps = new Map<string, Map<string, { count: number; resetTime: number }>>();

export function checkRateLimit(
  bucket: string,
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  if (!rateLimitMaps.has(bucket)) {
    rateLimitMaps.set(bucket, new Map());
  }
  const map = rateLimitMaps.get(bucket)!;
  const now = Date.now();
  const current = map.get(key);

  if (!current || now > current.resetTime) {
    map.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count += 1;
  return true;
}

export function getClientIp(req: any): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || req?.ip || 'unknown';
}
