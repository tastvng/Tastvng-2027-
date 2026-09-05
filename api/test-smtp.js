// api/test-smtp.ts
import nodemailer from "nodemailer";

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

// api/_supabase-auth.ts
async function verifySupabaseAdminToken(token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey && !serviceRoleKey || !token) {
    return { valid: false };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const baseClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
      auth: { persistSession: false }
    });
    const { data: { user }, error: userError } = await baseClient.auth.getUser(token);
    if (userError || !user) {
      return { valid: false };
    }
    let profileRole = null;
    if (serviceRoleKey) {
      const { data: profile } = await baseClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
      profileRole = profile?.role || null;
    } else {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
      });
      const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
      profileRole = profile?.role || null;
    }
    if (profileRole === "admin") {
      return { valid: true, userId: user.id, email: user.email };
    }
    return { valid: false };
  } catch (err) {
    console.error("Error verifying admin token:", err);
    return { valid: false };
  }
}

// api/test-smtp.ts
var rateLimitMap = /* @__PURE__ */ new Map();
var checkRateLimit = (ip, maxRequests, windowMs) => {
  const now = Date.now();
  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (current.count >= maxRequests) {
    return false;
  }
  current.count += 1;
  return true;
};
async function handler(req, res) {
  applyCorsHeaders(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
    if (!checkRateLimit(clientIp, 5, 60 * 1e3)) {
      return res.status(429).json({ error: "L\xEDmit de proves de correu assolit per minut. Si us plau, espereu abans de reintentar." });
    }
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const adminAuth = token ? await verifySupabaseAdminToken(token) : { valid: false };
    if (!adminAuth.valid) {
      return res.status(401).json({ error: "Acc\xE9s no autoritzat. Cal el rol d'administrador ('admin') per provar el servidor SMTP." });
    }
    const { emailData } = req.body || {};
    let to = emailData?.to || req.body?.to || "";
    let subject = emailData?.subject || req.body?.subject || "Prova de connexi\xF3 SMTP - El Tast 2027";
    const html = emailData?.html || req.body?.html || "<p>Aquest \xE9s un correu de prova del servidor SMTP d'El Tast.</p>";
    if (!to) {
      return res.status(400).json({ error: "Cal especificar un destinatari (to) per a la prova." });
    }
    to = to.replace(/[\r\n]/g, "").trim();
    subject = subject.replace(/[\r\n]/g, "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to) || to.length > 150) {
      return res.status(400).json({ error: "L'adre\xE7a de correu t\xE9 un format inv\xE0lid." });
    }
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const portNum = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASSWORD || "";
    const from = process.env.SMTP_FROM || user;
    const senderName = (process.env.SMTP_SENDER_NAME || "Inscripcions El Tast").replace(/[\r\n]/g, "").trim();
    if (!pass || !user) {
      return res.status(500).json({ error: "El servidor no t\xE9 configurades les credencials SMTP (SMTP_USER / SMTP_PASSWORD absents en entorn)." });
    }
    const secure = portNum === 465;
    const transporter = nodemailer.createTransport({
      host,
      port: portNum,
      secure,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: "TLSv1.2"
      }
    });
    const mailOptions = {
      from: `"${senderName}" <${from.replace(/[\r\n]/g, "").trim()}>`,
      to,
      subject,
      html
    };
    const info = await transporter.sendMail(mailOptions);
    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response
    });
  } catch (error) {
    console.error("Error testing SMTP via nodemailer serverless:", error?.message || "Test SMTP failure");
    return res.status(500).json({
      error: "Error al provar la connexi\xF3 a trav\xE9s de SMTP. Comproveu la configuraci\xF3 a les variables d'entorn."
    });
  }
}
export {
  handler as default
};
