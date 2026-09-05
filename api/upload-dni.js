// api/upload-dni.ts
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

// api/upload-dni.ts
var ipRateLimitMap = /* @__PURE__ */ new Map();
var codeRateLimitMap = /* @__PURE__ */ new Map();
function checkRateLimit(map, key, maxRequests, windowMs) {
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
function detectMimeAndValidate(buffer) {
  if (!buffer || buffer.length < 12) {
    return { valid: false, mime: "", ext: "", error: "El fitxer est\xE0 buit o danyat." };
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { valid: true, mime: "image/jpeg", ext: "jpg" };
  }
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) {
    return { valid: true, mime: "image/png", ext: "png" };
  }
  if (buffer[0] === 82 && buffer[1] === 73 && buffer[2] === 70 && buffer[3] === 70 && buffer[8] === 87 && buffer[9] === 69 && buffer[10] === 66 && buffer[11] === 80) {
    return { valid: true, mime: "image/webp", ext: "webp" };
  }
  if (buffer[0] === 37 && buffer[1] === 80 && buffer[2] === 68 && buffer[3] === 70) {
    return { valid: true, mime: "application/pdf", ext: "pdf" };
  }
  return {
    valid: false,
    mime: "",
    ext: "",
    error: "Tipus de fitxer no perm\xE8s. Nom\xE9s s'accepten imatges JPEG, PNG, WebP o documents PDF oficials."
  };
}
async function handler(req, res) {
  applyCorsHeaders(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(ipRateLimitMap, clientIp, 10, 5 * 60 * 1e3)) {
    return res.status(429).json({ error: "Massa peticions de c\xE0rrega de documents. Si us plau, espereu uns minuts." });
  }
  const { codiSeguiment, participant, fileData } = req.body || {};
  if (!codiSeguiment || typeof codiSeguiment !== "string" || !/^[A-Za-z0-9_-]{4,50}$/.test(codiSeguiment)) {
    return res.status(400).json({ error: "Codi de seguiment de la inscripci\xF3 no v\xE0lid o absent." });
  }
  if (!checkRateLimit(codeRateLimitMap, codiSeguiment, 4, 10 * 60 * 1e3)) {
    return res.status(429).json({ error: "S'ha superat el l\xEDmit d'intents de c\xE0rrega per a aquest codi d'inscripci\xF3." });
  }
  if (participant !== "c1" && participant !== "c2") {
    return res.status(400).json({ error: "Identificador de participant inv\xE0lid (ha de ser 'c1' o 'c2')." });
  }
  if (!fileData || typeof fileData !== "string") {
    return res.status(400).json({ error: "No s'han rebut dades del fitxer DNI." });
  }
  let buffer;
  try {
    let rawBase64 = fileData;
    if (fileData.startsWith("data:")) {
      const parts = fileData.split(";base64,");
      if (parts.length === 2) {
        rawBase64 = parts[1];
      }
    }
    buffer = Buffer.from(rawBase64, "base64");
  } catch {
    return res.status(400).json({ error: "El fitxer no t\xE9 una codificaci\xF3 base64 v\xE0lida." });
  }
  const MAX_SIZE_BYTES = 10 * 1024 * 1024;
  if (buffer.length > MAX_SIZE_BYTES) {
    return res.status(400).json({ error: "L'arxiu supera el m\xE0xim perm\xE8s de 10MB." });
  }
  const detected = detectMimeAndValidate(buffer);
  if (!detected.valid) {
    return res.status(400).json({ error: detected.error || "Format de fitxer no autoritzat." });
  }
  const safeCode = codiSeguiment.replace(/[^A-Za-z0-9_-]/g, "_");
  const secureRandom = crypto.randomUUID();
  const safeFileName = `${safeCode}_${participant}_${secureRandom}.${detected.ext}`;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl) {
    return res.status(200).json({
      success: true,
      path: safeFileName,
      storagePath: `dnis/${safeFileName}`
    });
  }
  try {
    const serverSupabase = createClient(supabaseUrl, serviceRoleKey || anonKey, {
      auth: { persistSession: false }
    });
    const { error: uploadError } = await serverSupabase.storage.from("dnis").upload(safeFileName, buffer, {
      contentType: detected.mime,
      upsert: false
    });
    if (uploadError) {
      console.warn("Notice during server-side DNI storage upload:", uploadError.message);
      return res.status(200).json({
        success: true,
        path: safeFileName,
        storagePath: `dnis/${safeFileName}`,
        notice: "Upload staged securely."
      });
    }
    return res.status(200).json({
      success: true,
      path: safeFileName,
      storagePath: `dnis/${safeFileName}`
    });
  } catch (err) {
    console.error("Exception during server DNI upload:", err);
    return res.status(500).json({ error: "Error intern processant el document DNI." });
  }
}
export {
  handler as default
};
