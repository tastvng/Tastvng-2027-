import nodemailer from "nodemailer";

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
  allowedMethods: string = 'POST, OPTIONS'
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

async function verifySupabaseAdminToken(token: string): Promise<{ valid: boolean; userId?: string; email?: string }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || (!supabaseAnonKey && !serviceRoleKey) || !token) {
    return { valid: false };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");

    const baseClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey!, {
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await baseClient.auth.getUser(token);
    if (userError || !user) {
      return { valid: false };
    }

    let profileRole: string | null = null;

    if (serviceRoleKey) {
      const { data: profile } = await baseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      profileRole = profile?.role || null;
    } else {
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

    return { valid: false };
  } catch (err) {
    console.error("Error verifying admin token:", err);
    return { valid: false };
  }
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const checkRateLimit = (ip: string, maxRequests: number, windowMs: number): boolean => {
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

export default async function handler(req: any, res: any) {
  applyCorsHeaders(req, res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp, 5, 60 * 1000)) {
      return res.status(429).json({ error: "Límit de proves de correu assolit per minut. Si us plau, espereu abans de reintentar." });
    }

    // Require REAL admin role for SMTP testing
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const adminAuth = token ? await verifySupabaseAdminToken(token) : { valid: false };
    if (!adminAuth.valid) {
      return res.status(401).json({ error: "Accés no autoritzat. Cal el rol d'administrador ('admin') per provar el servidor SMTP." });
    }

    const { emailData } = req.body || {};
    let to = emailData?.to || req.body?.to || "";
    let subject = emailData?.subject || req.body?.subject || "Prova de connexió SMTP - El Tast 2027";
    const html = emailData?.html || req.body?.html || "<p>Aquest és un correu de prova del servidor SMTP d'El Tast.</p>";

    if (!to) {
      return res.status(400).json({ error: "Cal especificar un destinatari (to) per a la prova." });
    }

    to = to.replace(/[\r\n]/g, '').trim();
    subject = subject.replace(/[\r\n]/g, '').trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to) || to.length > 150) {
      return res.status(400).json({ error: "L'adreça de correu té un format invàlid." });
    }

    // Always use secure server-side environment variables
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const portNum = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASSWORD || '';
    const from = process.env.SMTP_FROM || user;
    const senderName = (process.env.SMTP_SENDER_NAME || 'Inscripcions El Tast').replace(/[\r\n]/g, '').trim();

    if (!pass || !user) {
      return res.status(500).json({ error: "El servidor no té configurades les credencials SMTP (SMTP_USER / SMTP_PASSWORD absents en entorn)." });
    }

    const secure = portNum === 465;
    const transporter = nodemailer.createTransport({
      host,
      port: portNum,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });

    const mailOptions = {
      from: `"${senderName}" <${from.replace(/[\r\n]/g, '').trim()}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response
    });
  } catch (error: any) {
    console.error("Error testing SMTP via nodemailer serverless:", error?.message || "Test SMTP failure");
    return res.status(500).json({
      error: "Error al provar la connexió a través de SMTP. Comproveu la configuració a les variables d'entorn."
    });
  }
}
