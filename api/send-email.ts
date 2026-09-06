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

// In-memory rate limiting map for serverless environment
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
  // CORS configuration with strict origin validation
  applyCorsHeaders(req, res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp, 6, 60 * 1000)) {
      return res.status(429).json({ error: "S'ha superat el límit d'enviaments per minut. Si us plau, espereu un moment." });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const adminAuth = token ? await verifySupabaseAdminToken(token) : { valid: false };
    const isAdmin = adminAuth.valid;

    const body = req.body || {};

    // Load SMTP credentials STRICTLY from process.env
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPassword = process.env.SMTP_PASSWORD || '';
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || '';

    if (!smtpPassword || !smtpUser) {
      return res.status(500).json({ error: "La configuració SMTP del servidor no està completa (SMTP_USER / SMTP_PASSWORD absents en entorn)." });
    }

    // Extract values based on payload format
    let to = "";
    let subject = "Confirmació d'inscripció - El Tast 2027";
    let html = "";
    let attachments: any[] = [];
    const codiSeguiment = body.codiSeguiment || body.emailData?.codiSeguiment || "";

    if (body.emailData) {
      to = body.emailData.to || "";
      subject = body.emailData.subject || subject;
      html = body.emailData.html || "";
      attachments = body.emailData.attachments || [];
    } else {
      to = body.email || body.to || "";
      subject = body.subject || subject;
      html = body.html || "";
    }

    if (!to || !html) {
      return res.status(400).json({ error: "Falten camps obligatoris (destinatari o contingut HTML)" });
    }

    // Sanitize CRLF injection from subject and recipient
    to = to.replace(/[\r\n]/g, '').trim();
    subject = subject.replace(/[\r\n]/g, '').trim();

    // Anti-relay protection: If not authenticated admin, verify context
    if (!isAdmin) {
      const isConfirmationSubject = /(?:Tast|Inscripci|Confirmaci)/i.test(subject);
      const hasValidCode = typeof codiSeguiment === 'string' && /^TAST-202[67]-/i.test(codiSeguiment.trim());

      if (!isConfirmationSubject && !hasValidCode) {
        return res.status(403).json({ error: "Petició no autoritzada per a l'enviament de correu extern." });
      }

      if (subject.length > 200) {
        return res.status(400).json({ error: "L'assumpte del correu supera la longitud màxima permesa." });
      }

      if (html.length > 150000) {
        return res.status(400).json({ error: "El contingut del correu supera la mida màxima permesa." });
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to) || to.length > 150) {
      return res.status(400).json({ error: "L'adreça de correu de destinació no té un format vàlid." });
    }

    // Process and validate attachments
    let mailAttachments: any[] = [];
    if (attachments && Array.isArray(attachments)) {
      if (attachments.length > 3) {
        return res.status(400).json({ error: "Màxim de 3 adjunts permesos." });
      }

      for (const att of attachments) {
        const filename = (att.filename || "file.png").replace(/[\r\n\\/]/g, '_');
        const allowedExt = /\.(png|jpg|jpeg|webp|pdf)$/i.test(filename);
        if (!allowedExt) {
          return res.status(400).json({ error: `Tipus d'adjunt no permès: ${filename}` });
        }

        if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
          const matches = att.content.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const base64Data = matches[2];
            // 3MB limit on attachment
            if (base64Data.length > 4 * 1024 * 1024) {
              return res.status(400).json({ error: "L'adjunt supera la mida màxima permesa." });
            }
            mailAttachments.push({
              filename,
              content: Buffer.from(base64Data, 'base64'),
              cid: att.cid ? att.cid.replace(/[^a-zA-Z0-9_-]/g, '') : undefined
            });
            continue;
          }
        }

        mailAttachments.push({
          filename,
          content: att.content,
          path: att.path,
          cid: att.cid ? att.cid.replace(/[^a-zA-Z0-9_-]/g, '') : undefined
        });
      }
    }

    // Create Nodemailer Transporter with strict TLS enforcement
    const portNum = parseInt(smtpPort, 10);
    const isPort465 = portNum === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: portNum,
      secure: isPort465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });

    const senderName = (process.env.SMTP_SENDER_NAME || 'Inscripcions El Tast').replace(/[\r\n]/g, '').trim();
    const mailOptions = {
      from: `"${senderName}" <${smtpFrom.replace(/[\r\n]/g, '').trim()}>`,
      to,
      subject,
      html,
      attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      id: info.messageId,
      messageId: info.messageId
    });
  } catch (error: any) {
    console.error("Error sending email via Nodemailer SMTP (Serverless):", error?.message || "Transport error");
    return res.status(500).json({
      error: "Error al trametre el correu a través de SMTP."
    });
  }
}
