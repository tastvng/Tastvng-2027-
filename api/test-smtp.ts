import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

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

const ALLOWED_ORIGINS = [
  'https://tastvng-2027.vercel.app',
  'https://tastvng-2027-.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

async function verifySupabaseAdminToken(token: string): Promise<boolean> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !token) return false;
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    return !error && !!user;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = 
      ALLOWED_ORIGINS.includes(origin) ||
      origin === process.env.APP_URL ||
      origin === `http://${req.headers.host}` ||
      origin === `https://${req.headers.host}`;

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

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

    // Require admin session for SMTP testing
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const isAdmin = token ? await verifySupabaseAdminToken(token) : false;
    if (!isAdmin) {
      return res.status(401).json({ error: "Accés no autoritzat. Cal una sessió d'administrador vàlida per provar el servidor SMTP." });
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
