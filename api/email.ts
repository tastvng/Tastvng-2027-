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
  try {
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
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
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
        const from = (process.env.SMTP_FROM || user).trim();
        const password = (process.env.SMTP_PASSWORD || '').trim();

        const configured = Boolean(user && password);
        const userMasked = maskString(user);
        const fromMasked = maskString(from);

        return res.status(200).json({
          ok: true,
          step: "email_status",
          configured,
          host,
          port,
          userMasked,
          fromMasked,
          user: userMasked,
          from: fromMasked,
          provider: 'Server Environment Variables (Secure)'
        });
      } catch (err: any) {
        console.error("Error in /api/email status:", err);
        return res.status(200).json({
          ok: true,
          step: "email_status",
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
      return res.status(405).json({
        ok: false,
        step: "email_routing",
        error: `Method ${method} Not Allowed on /api/email. Use GET or POST.`,
        code: "METHOD_NOT_ALLOWED"
      });
    }

    const clientIp = getClientIp(req);

    // ==========================================
    // ROUTE 2: Test SMTP Connection (action=test)
    // ==========================================
    if (action === 'test') {
      if (!checkRateLimit('email-test', clientIp, 5, 60 * 1000)) {
        return res.status(429).json({
          ok: false,
          step: "email_test",
          error: "Límit de proves de correu assolit per minut. Si us plau, espereu abans de reintentar.",
          code: "RATE_LIMIT"
        });
      }

      const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

      const authCheck = await verifySupabaseAdminToken(token);
      const isAdmin = Boolean(authCheck && authCheck.valid);
      if (!isAdmin) {
        return res.status(403).json({
          ok: false,
          step: "email_test",
          error: "No autoritzat per executar proves de correu (requereix sessió d'administrador vàlida).",
          code: "UNAUTHORIZED"
        });
      }

      const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const port = parseInt(String(process.env.SMTP_PORT || '587').trim(), 10) || 587;
      const user = (process.env.SMTP_USER || '').trim();
      const pass = (process.env.SMTP_PASSWORD || '').trim().replace(/\s+/g, '');
      const from = (process.env.SMTP_FROM || user).trim();

      if (!user || !pass) {
        return res.status(400).json({
          ok: false,
          step: "email_test",
          error: "Les credencials SMTP no estan configurades al servidor (SMTP_USER o SMTP_PASSWORD buits a Vercel/entorn).",
          code: "CONFIG_MISSING"
        });
      }

      try {
        const isPort465 = port === 465;
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: isPort465,
          auth: { user, pass },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 8000,
          tls: {
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2'
          }
        });

        await transporter.verify();

        const testTo = body.to || user;
        const testMail = await transporter.sendMail({
          from: `"Verificació El Tast" <${from}>`,
          to: testTo,
          subject: `🧪 Test de Connexió SMTP - El Tast [${new Date().toLocaleTimeString('ca-ES')}]`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #ddd; border-radius: 12px;">
              <h2 style="color: #ff0090; margin-top: 0;">✓ Prova de correu correcta</h2>
              <p>El servidor SMTP està configurat correctament i llest per enviar correus d'inscripció.</p>
              <ul style="color: #555; font-size: 13px;">
                <li>Servidor: ${host}:${port}</li>
                <li>Usuari: ${maskString(user)}</li>
                <li>Hora: ${new Date().toISOString()}</li>
              </ul>
            </div>
          `
        });

        console.log(`[EMAIL test ok]: MessageId: ${testMail.messageId} to: ${testTo}`);
        return res.status(200).json({
          ok: true,
          step: "email_test",
          success: true,
          messageId: testMail.messageId
        });
      } catch (err: any) {
        console.error("[EMAIL test error]:", err?.message || err);
        return res.status(500).json({
          ok: false,
          step: "email_test",
          error: `Error verificant el servidor SMTP: ${err.message || String(err)}`,
          code: err.code || "SMTP_TEST_FAILED"
        });
      }
    }

    // ==========================================
    // ROUTE 3: Send Registration Email (action=send)
    // ==========================================
    if (action === 'send') {
      if (!checkRateLimit('email-send', clientIp, 20, 60 * 1000)) {
        return res.status(429).json({
          ok: false,
          step: "email_send",
          error: "Límit d'enviaments assolit. Si us plau, espereu un minut abans de tornar a intentar-ho.",
          code: "RATE_LIMIT"
        });
      }

      const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';
      const authCheck = await verifySupabaseAdminToken(token);
      const isAdmin = Boolean(authCheck && authCheck.valid);

      const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const smtpPort = parseInt(String(process.env.SMTP_PORT || '587').trim(), 10) || 587;
      const smtpUser = (process.env.SMTP_USER || '').trim();
      const smtpPassword = (process.env.SMTP_PASSWORD || '').trim().replace(/\s+/g, '');
      const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();

      if (!smtpPassword || !smtpUser) {
        console.error("[EMAIL error]: Credencials SMTP no configurades a les variables d'entorn.");
        return res.status(500).json({
          ok: false,
          step: "email_send",
          error: "La configuració SMTP del servidor no està completa (SMTP_USER / SMTP_PASSWORD absents en entorn de Vercel).",
          code: "CONFIG_MISSING"
        });
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
        return res.status(400).json({
          ok: false,
          step: "email_send",
          error: "Falten camps obligatoris (destinatari o contingut HTML)",
          code: "MISSING_FIELDS"
        });
      }

      to = to.replace(/[\r\n]/g, '').trim();
      subject = subject.replace(/[\r\n]/g, '').trim();

      if (!isAdmin) {
        const isConfirmationSubject = /(?:Tast|Inscripci|Confirmaci)/i.test(subject);
        const hasValidCode = typeof codiSeguiment === 'string' && /^TAST-202[67]-/i.test(codiSeguiment.trim());

        if (!isConfirmationSubject && !hasValidCode) {
          return res.status(403).json({
            ok: false,
            step: "email_send",
            error: "Petició no autoritzada per a l'enviament de correu extern.",
            code: "FORBIDDEN"
          });
        }

        if (subject.length > 200) {
          return res.status(400).json({
            ok: false,
            step: "email_send",
            error: "L'assumpte del correu supera la longitud màxima permesa.",
            code: "SUBJECT_TOO_LONG"
          });
        }

        if (html.length > 150000) {
          return res.status(400).json({
            ok: false,
            step: "email_send",
            error: "El contingut del correu supera la mida màxima permesa.",
            code: "CONTENT_TOO_LARGE"
          });
        }
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to) || to.length > 150) {
        return res.status(400).json({
          ok: false,
          step: "email_send",
          error: "L'adreça de correu de destinació no té un format vàlid.",
          code: "INVALID_EMAIL"
        });
      }

      let mailAttachments: any[] = [];
      if (attachments && Array.isArray(attachments)) {
        if (attachments.length > 3) {
          return res.status(400).json({
            ok: false,
            step: "email_send",
            error: "Màxim de 3 adjunts permesos.",
            code: "TOO_MANY_ATTACHMENTS"
          });
        }

        for (const att of attachments) {
          const filename = (att.filename || "file.png").replace(/[\r\n\\/]/g, '_');
          const allowedExt = /\.(png|jpg|jpeg|webp|pdf)$/i.test(filename);
          if (!allowedExt) {
            return res.status(400).json({
              ok: false,
              step: "email_send",
              error: `Tipus d'adjunt no permès: ${filename}`,
              code: "INVALID_ATTACHMENT_TYPE"
            });
          }

          if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
            const matches = att.content.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
              const base64Data = matches[2];
              if (base64Data.length > 4 * 1024 * 1024) {
                return res.status(400).json({
                  ok: false,
                  step: "email_send",
                  error: "L'adjunt supera la mida màxima permesa (4MB).",
                  code: "ATTACHMENT_TOO_LARGE"
                });
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
        const portNum = Number(smtpPort) || 587;
        const isPort465 = portNum === 465;
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: portNum,
          secure: isPort465,
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 8000,
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
        console.log(`[EMAIL ok]: MessageId: ${info.messageId} to: ${to}`);
        return res.status(200).json({
          ok: true,
          step: "email_send",
          success: true,
          id: info.messageId,
          messageId: info.messageId
        });
      } catch (error: any) {
        console.error("[EMAIL error]:", {
          to,
          message: error?.message || error,
          code: error?.code
        });
        return res.status(500).json({
          ok: false,
          step: "email_send",
          error: error?.message || "Error al trametre el correu a través de SMTP.",
          code: error?.code || "SMTP_SEND_FAILED"
        });
      }
    }

    return res.status(400).json({
      ok: false,
      step: "email_routing",
      error: `Acció no vàlida a /api/email: ${action}`,
      code: "INVALID_ACTION"
    });
  } catch (fatalError: any) {
    console.error("[FATAL ERROR in /api/email]:", fatalError);
    return res.status(500).json({
      ok: false,
      step: "email_fatal",
      error: fatalError?.message || "Error intern no controlat a la funció de correu.",
      code: fatalError?.code || "UNHANDLED_EXCEPTION"
    });
  }
}
