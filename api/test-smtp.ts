import nodemailer from "nodemailer";

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

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
  /^https:\/\/[\w-]+\.run\.app$/
];

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = 
      origin === process.env.APP_URL ||
      ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin)) ||
      origin === `http://${req.headers.host}` ||
      origin === `https://${req.headers.host}`;

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
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

    const { emailData } = req.body || {};
    const to = emailData?.to || req.body?.to;
    const subject = emailData?.subject || req.body?.subject || "Prova de connexió SMTP - El Tast 2027";
    const html = emailData?.html || req.body?.html || "<p>Aquest és un correu de prova del servidor SMTP d'El Tast.</p>";

    if (!to) {
      return res.status(400).json({ error: "Cal especificar un destinatari (to) per a la prova." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      return res.status(400).json({ error: "L'adreça de correu té un format invàlid." });
    }

    // Always prefer secure server-side environment variables
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const portNum = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASSWORD || '';
    const from = process.env.SMTP_FROM || user;
    const senderName = process.env.SMTP_SENDER_NAME || 'Inscripcions El Tast';

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
      }
    });

    const mailOptions = {
      from: `"${senderName}" <${from}>`,
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
    console.error("Error testing SMTP via nodemailer serverless:", error?.message || error);
    return res.status(500).json({
      error: error.message || "Error al provar la connexió a través de SMTP."
    });
  }
}
