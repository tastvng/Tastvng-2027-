// api/_cors.ts
function getStrictAllowedOrigins() {
  const allowed = /* @__PURE__ */ new Set();
  allowed.add("https://tastvng-2027.vercel.app");
  if (process.env.ALLOWED_ORIGINS) {
    const customList = process.env.ALLOWED_ORIGINS.split(",");
    for (const item of customList) {
      const trimmed = item.trim();
      if (trimmed) {
        allowed.add(trimmed);
      }
    }
  }
  if (process.env.APP_URL) {
    const trimmed = process.env.APP_URL.trim();
    if (trimmed) {
      allowed.add(trimmed);
    }
  }
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
    allowed.add("http://localhost:5173");
    allowed.add("http://127.0.0.1:5173");
  }
  return allowed;
}
function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowed = getStrictAllowedOrigins();
  return allowed.has(origin);
}
function applyCorsHeaders(req, res, allowedMethods = "GET, POST, OPTIONS") {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : void 0;
  const isAllowed = isOriginAllowed(origin);
  if (origin && isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", allowedMethods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  return isAllowed;
}
export {
  applyCorsHeaders,
  getStrictAllowedOrigins,
  isOriginAllowed
};
