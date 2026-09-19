import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

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
 * Handles CORS and sets security headers on response.
 */
function setCorsAndSecurityHeaders(req: any, res: any) {
  try {
    const origin = req.headers?.origin || '*';
    if (res.setHeader) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Consolidated Email Serverless Handler: /api/email and /api/send-email
 * Entirely self-contained with zero local relative import dependencies to avoid
 * runtime ESM ERR_MODULE_NOT_FOUND crashes on Vercel Node runtime.
 */
export default async function emailHandler(req: any, res: any) {
  try {
    // 1. Ensure JSON header & CORS
    setCorsAndSecurityHeaders(req, res);

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
    // ROUTE 1: Status (GET or action=status)
    // ==========================================
    if (method === 'GET' || action === 'status') {
      const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const port = parseInt(String(process.env.SMTP_PORT || '587').trim(), 10) || 587;
      const user = (process.env.SMTP_USER || '').trim();
      const from = (process.env.SMTP_FROM || user).trim();
      const password = (process.env.SMTP_PASSWORD || '').trim();
      const configured = Boolean(user && password);

      return res.status(200).json({
        ok: true,
        configured,
        host,
        port,
        secure: false,
        userMasked: maskString(user),
        fromMasked: maskString(from),
        user: maskString(user),
        from: maskString(from),
        provider: 'Google Gmail SMTP'
      });
    }

    if (method !== 'POST') {
      return res.status(405).json({
        ok: false,
        emailSent: false,
        error: "SMTP_SEND_FAILED",
        message: `Method ${method} Not Allowed on email endpoint. Use POST.`
      });
    }

    // SMTP Configuration
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = parseInt(String(process.env.SMTP_PORT || '587').trim(), 10) || 587;
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPassword = (process.env.SMTP_PASSWORD || '').trim().replace(/\s+/g, '');
    const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();

    // ==========================================
    // ROUTE 2: Test SMTP connection (action=test)
    // ==========================================
    if (action === 'test') {
      if (!smtpUser || !smtpPassword) {
        console.error("[SMTP Test Error]: Credencials SMTP no configurades.");
        return res.status(500).json({
          ok: false,
          emailSent: false,
          error: "SMTP_SEND_FAILED",
          message: "Credencials SMTP no configurades al servidor (SMTP_USER o SMTP_PASSWORD absents a Vercel)."
        });
      }

      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: false, // Port 587 STARTTLS
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          tls: {
            rejectUnauthorized: false
          }
        });

        await transporter.verify();

        const testTo = body.to || smtpUser;
        const testMail = await transporter.sendMail({
          from: `"Verificació El Tast" <${smtpFrom}>`,
          to: testTo,
          subject: `🧪 Test de Connexió SMTP - El Tast [${new Date().toLocaleTimeString('ca-ES')}]`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #ddd; border-radius: 12px;">
              <h2 style="color: #ff0090; margin-top: 0;">✓ Prova de correu correcta</h2>
              <p>El servidor SMTP està configurat correctament i llest per enviar correus d'inscripció.</p>
              <ul style="color: #555; font-size: 13px;">
                <li>Servidor: ${smtpHost}:${smtpPort} (secure: false)</li>
                <li>Usuari: ${maskString(smtpUser)}</li>
                <li>Hora: ${new Date().toISOString()}</li>
              </ul>
            </div>
          `
        });

        console.log(`[SMTP test ok]: MessageId: ${testMail.messageId} to: ${testTo}`);
        return res.status(200).json({
          ok: true,
          emailSent: true,
          id: testMail.messageId,
          messageId: testMail.messageId
        });
      } catch (testErr: any) {
        console.error("[SMTP Test Error]:", {
          message: testErr?.message,
          code: testErr?.code,
          command: testErr?.command,
          responseCode: testErr?.responseCode,
          host: smtpHost,
          port: smtpPort,
          user: maskString(smtpUser)
        });
        return res.status(500).json({
          ok: false,
          emailSent: false,
          error: "SMTP_SEND_FAILED",
          message: testErr?.message || "Error al verificar la connexió SMTP."
        });
      }
    }

    // =========================================================================
    // ROUTE 3: Send Confirmation Email (default POST or action=send)
    // NOTE: This function NEVER inserts or modifies records in public.inscripciones.
    // It accepts an existing inscription ID or payload and only sends the email.
    // =========================================================================
    if (!smtpUser || !smtpPassword) {
      console.error("[SMTP Send Error]: Credencials SMTP no configurades (SMTP_USER o SMTP_PASSWORD buits).");
      return res.status(500).json({
        ok: false,
        emailSent: false,
        error: "SMTP_SEND_FAILED",
        message: "La configuració SMTP del servidor no està completa (SMTP_USER / SMTP_PASSWORD absents en entorn de Vercel)."
      });
    }

    const inscriptionId = body.id || body.inscriptionId || '';
    let to = "";
    let subject = "Confirmació d'inscripció - El Tast 2027";
    let html = "";
    let attachments: any[] = [];
    let codiSeguiment = body.codiSeguiment || body.emailData?.codiSeguiment || "";

    if (body.emailData) {
      to = body.emailData.to || "";
      subject = body.emailData.subject || subject;
      html = body.emailData.html || "";
      attachments = body.emailData.attachments || [];
    } else if (body.email || body.to) {
      to = body.email || body.to || "";
      subject = body.subject || subject;
      html = body.html || "";
      attachments = body.attachments || [];
    }

    // If only an inscription ID was provided (e.g. from manual retry) and no HTML,
    // look up the existing inscription from Supabase to extract recipient and details.
    if ((!to || !html) && inscriptionId) {
      try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          const { data: ins, error: fetchErr } = await supabase
            .from('inscripciones')
            .select('*')
            .eq('id', inscriptionId)
            .single();

          if (!fetchErr && ins) {
            to = ins.c1Email || ins.c2Email || ins.emailContactoPareja || '';
            codiSeguiment = ins.codiSeguiment || codiSeguiment;
            subject = `Confirmació de preinscripció - El Tast 2027 [${codiSeguiment}]`;
            html = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #eaeaea; border-radius: 16px;">
                <h1 style="color: #ff0090; font-size: 22px; text-align: center;">Preinscripció Confirmada!</h1>
                <p style="text-align: center; color: #555;">Gràcies per la vostra inscripció a El Tast 2027.</p>
                <div style="background: #fdf2f8; border: 1px dashed #ff0090; padding: 15px; border-radius: 12px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 11px; font-family: monospace; color: #be185d;">CODI DE SEGUIMENT</span><br/>
                  <strong style="font-size: 24px; color: #ff0090; font-family: monospace;">${codiSeguiment}</strong>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 20px 0;">
                  <tr><td style="padding: 6px 0; color: #666;">Parella:</td><td style="text-align: right; font-weight: bold;">${ins.c1Nom || ''} &amp; ${ins.c2Nom || ''}</td></tr>
                  <tr><td style="padding: 6px 0; color: #666;">Categoria:</td><td style="text-align: right; font-weight: bold;">${ins.categoria || 'Adult'}</td></tr>
                  <tr><td style="padding: 6px 0; color: #666;">Total a Pagar:</td><td style="text-align: right; font-weight: bold; color: #ff0090; font-size: 18px;">${ins.preuCalculat || 0}€</td></tr>
                </table>
                <p style="font-size: 12px; color: #888; text-align: center; margin-top: 30px;">Associació Cultural El Tast &bull; secretaria@eltast.cat</p>
              </div>
            `;
          }
        }
      } catch (dbErr) {
        console.warn("[SMTP Lookup Inscription warning]:", dbErr);
      }
    }

    if (!to || !html) {
      return res.status(400).json({
        ok: false,
        emailSent: false,
        error: "SMTP_SEND_FAILED",
        message: "Falten camps obligatoris per a l'enviament de correu (destinatari buit o contingut HTML no trobat)."
      });
    }

    to = to.replace(/[\r\n]/g, '').trim();
    subject = subject.replace(/[\r\n]/g, '').trim();

    // Prepare mail attachments
    const mailAttachments: any[] = [];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        const filename = (att.filename || "adjunt.png").replace(/[\r\n\\/]/g, '_');
        if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
          const matches = att.content.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            mailAttachments.push({
              filename,
              content: Buffer.from(matches[2], 'base64'),
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

    // Configure Nodemailer transporter strictly with secure: false for port 587
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // As mandated by Requirement 6
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false
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

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP ok]: MessageId: ${info.messageId} to: ${to} codi: ${codiSeguiment}`);

      // Contract matching Requirement 13
      return res.status(200).json({
        ok: true,
        emailSent: true,
        id: info.messageId,
        messageId: info.messageId
      });
    } catch (sendError: any) {
      // Log real SMTP error without disclosing sensitive credentials (Requirement 9)
      console.error("[SMTP Send Error]:", {
        to,
        codi: codiSeguiment,
        message: sendError?.message || String(sendError),
        code: sendError?.code,
        command: sendError?.command,
        response: sendError?.response,
        responseCode: sendError?.responseCode,
        host: smtpHost,
        port: smtpPort,
        user: maskString(smtpUser)
      });

      // Contract matching Requirement 12
      return res.status(500).json({
        ok: false,
        emailSent: false,
        error: "SMTP_SEND_FAILED",
        message: sendError?.message || "Error al trametre el correu a través de SMTP."
      });
    }
  } catch (fatalError: any) {
    console.error("[FATAL ERROR in /api/email]:", fatalError?.message || fatalError);
    return res.status(500).json({
      ok: false,
      emailSent: false,
      error: "SMTP_SEND_FAILED",
      message: fatalError?.message || "Excepció interna no controlada a la funció de correu."
    });
  }
}
