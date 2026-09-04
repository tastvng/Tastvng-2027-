import nodemailer from "nodemailer";

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

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
  /^https:\/\/[\w-]+\.run\.app$/
];

export default async function handler(req: any, res: any) {
  // CORS configuration with origin validation
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
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
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
    if (!checkRateLimit(clientIp, 10, 60 * 1000)) {
      return res.status(429).json({ error: "S'ha superat el límit d'enviaments per minut. Si us plau, espereu un moment." });
    }

    const body = req.body || {};

    // Load SMTP credentials STRICTLY from process.env (never from client or database settings)
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

    if (body.emailData) {
      to = body.emailData.to;
      subject = body.emailData.subject || subject;
      html = body.emailData.html;
      attachments = body.emailData.attachments || [];
    } else {
      to = body.email || body.to;
      subject = body.subject || subject;
      html = body.html || "";
      if (body.qrCode) {
        const nombre = body.nombre || "Participant";
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Hola ${nombre},</h2>
            <p>La teva inscripció s'ha realitzat correctament per a l'edició 2027.</p>
            <p>Aquí tens el teu codi QR de confirmació:</p>
            <div style="margin: 20px 0;">
              <img src="${body.qrCode}" alt="Codi QR" style="width: 200px; height: 200px;" />
            </div>
            <p>Presenta aquest codi per recollir el teu material.</p>
          </div>
        `;
      }
    }

    if (!to || !html) {
      return res.status(400).json({ error: "Falten camps obligatoris (destinatari o contingut HTML)" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      return res.status(400).json({ error: "L'adreça de correu de destinació no té un format vàlid." });
    }

    // Process attachments for Nodemailer
    let mailAttachments: any[] = [];
    if (attachments && Array.isArray(attachments)) {
      mailAttachments = attachments.map((att: any) => {
        if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
          const matches = att.content.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const base64Data = matches[2];
            return {
              filename: att.filename || "image.png",
              content: Buffer.from(base64Data, 'base64'),
              cid: att.cid || undefined
            };
          }
        }
        return {
          filename: att.filename,
          content: att.content,
          path: att.path,
          cid: att.cid || att.content_id || undefined
        };
      });
    }

    // Create Nodemailer Transporter with secure TLS enforcement
    const isPort465 = smtpPort === '465';
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: isPort465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const mailOptions = {
      from: `"${process.env.SMTP_SENDER_NAME || 'Inscripcions El Tast'}" <${smtpFrom}>`,
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
    console.error("Error sending email via Nodemailer SMTP (Serverless):", error?.message || error);
    return res.status(500).json({
      error: error.message || "Error al enviar el correo a través de SMTP."
    });
  }
}
