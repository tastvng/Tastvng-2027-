import nodemailer from "nodemailer";
import { applyCorsHeaders } from "./_cors";
import { verifySupabaseAdminToken } from "./_supabase-auth";
import { checkRateLimit, getClientIp } from "./_rate-limit";

function maskString(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    const local = parts[0];
    const domain = parts.slice(1).join('@');
    const maskedLocal = local.length > 2 ? local.slice(0, 2) + '***' : local + '***';
    return `${maskedLocal}@${domain}`;
  }
  return trimmed.length > 2 ? trimmed.slice(0, 2) + '***' : trimmed + '***';
}

/**
 * Consolidated Email Serverless Handler: /api/email
 * Routes internally based on req.method and req.query.action / req.body.action:
 * - action=status (GET or POST): Returns secure, masked SMTP configuration status.
 * - action=test (POST): Sends a test email to verify SMTP configuration (Requires Admin Auth).
 * - action=send (POST): Sends registration confirmation and official notifications.
 */
export default async function emailHandler(req: any, res: any) {
  // Always ensure application/json Content-Type
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // 1. CORS
  applyCorsHeaders(req, res, "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  const method = (req.method || 'GET').toUpperCase();
  const query = req.query || {};
  const body = req.body || {};
  const action = String(query.action || body.action || '').trim().toLowerCase();

  // ==========================================
  // ROUTE 1: SMTP Status (GET or action=status)
  // ==========================================
  if (method === 'GET' || action === 'status') {
    try {
      const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const portRaw = process.env.SMTP_PORT || '587';
      const port = parseInt(String(portRaw).trim(), 10) || 587;
      const user = (process.env.SMTP_USER || '').trim();
      const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
      const password = (process.env.SMTP_PASSWORD || '').trim();

      const configured = Boolean(user && password);
      const userMasked = maskString(user);
      const fromMasked = maskString(from);

      return res.status(200).json({
        configured,
        host,
        port,
        userMasked,
        fromMasked,
        user: userMasked,
        from: fromMasked,
        provider: 'Server Environment Variables (Secure)'
      });
    } catch (err) {
      console.error("Error in /api/email status:", err);
      return res.status(200).json({
        configured: false,
        host: 'smtp.gmail.com',
        port: 587,
        userMasked: '',
        fromMasked: '',
        provider: 'Server Environment Variables (Fallback)'
      });
    }
  }

  if (method !== 'POST') {
    return res.status(405).json({ error: `Method ${method} Not Allowed on /api/email. Use GET or POST.` });
  }

  const clientIp = getClientIp(req);

  // ==========================================
  // ROUTE 2: Test SMTP Connection (action=test)
  // ==========================================
  if (action === 'test') {
    if (!checkRateLimit('email-test', clientIp, 5, 60 * 1000)) {
      return res.status(429).json({ error: "Límit de proves de correu assolit per minut. Si us plau, espereu abans de reintentar." });
    }

    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    const adminAuth = token ? await verifySupabaseAdminToken(token) : { valid: false };
    if (!adminAuth.valid) {
      return res.status(401).json({ error: "Accés no autoritzat. Cal el rol d'administrador ('admin') per provar el servidor SMTP." });
    }

    const { emailData } = body;
    let to = emailData?.to || body.to || "";
    let subject = emailData?.subject || body.subject || "Prova de connexió SMTP - El Tast 2027";
    const html = emailData?.html || body.html || "<p>Aquest és un correu de prova del servidor SMTP d'El Tast.</p>";

    if (!to) {
      return res.status(400).json({ error: "Cal especificar un destinatari (to) per a la prova." });
    }

    to = to.replace(/[\r\n]/g, '').trim();
    subject = subject.replace(/[\r\n]/g, '').trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to) || to.length > 150) {
      return res.status(400).json({ error: "L'adreça de correu té un format invàlid." });
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const portNum = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASSWORD || '';
    const from = process.env.SMTP_FROM || user;
    const senderName = (process.env.SMTP_SENDER_NAME || 'Inscripcions El Tast').replace(/[\r\n]/g, '').trim();

    if (!pass || !user) {
      return res.status(500).json({ error: "El servidor no té configurades les credencials SMTP (SMTP_USER / SMTP_PASSWORD absents en entorn)." });
    }

    try {
      const secure = portNum === 465;
      const transporter = nodemailer.createTransport({
        host,
        port: portNum,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
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
      console.error("Error testing SMTP in /api/email:", error?.message || error);
      return res.status(500).json({
        error: "Error al provar la connexió a través de SMTP. Comproveu la configuració a les variables d'entorn."
      });
    }
  }

  // ==========================================
  // ROUTE 3: Send Email (action=send or default POST)
  // ==========================================
  if (action === 'send' || !action || action === 'email') {
    if (!checkRateLimit('email-send', clientIp, 8, 60 * 1000)) {
      return res.status(429).json({ error: "S'ha superat el límit d'enviaments per minut. Si us plau, espereu un moment." });
    }

    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const adminAuth = token ? await verifySupabaseAdminToken(token) : { valid: false };
    const isAdmin = adminAuth.valid;

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPassword = process.env.SMTP_PASSWORD || '';
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || '';

    if (!smtpPassword || !smtpUser) {
      return res.status(500).json({ error: "La configuració SMTP del servidor no està completa (SMTP_USER / SMTP_PASSWORD absents en entorn)." });
    }

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
      attachments = body.attachments || [];
    }

    if (!to || !html) {
      return res.status(400).json({ error: "Falten camps obligatoris (destinatari o contingut HTML)" });
    }

    to = to.replace(/[\r\n]/g, '').trim();
    subject = subject.replace(/[\r\n]/g, '').trim();

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to) || to.length > 150) {
      return res.status(400).json({ error: "L'adreça de correu de destinació no té un format vàlid." });
    }

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

    try {
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
      console.error("Error sending email via Nodemailer in /api/email:", error?.message || error);
      return res.status(500).json({
        error: "Error al trametre el correu a través de SMTP."
      });
    }
  }

  return res.status(400).json({ error: `Acció no vàlida a /api/email: ${action}` });
}
