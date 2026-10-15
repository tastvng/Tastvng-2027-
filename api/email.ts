import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseAdminToken } from "./_supabase-auth.js";
import { sendConfirmationEmail } from "./_send-confirmation.js";

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

    // ==========================================
    // ROUTE 2.5: Retry Pending Emails (action=retry-pending)
    // Protected admin action: Retries up to 5 emails with mailEstat != 'enviat'
    // ==========================================
    if (action === 'retry-pending') {
      const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
      const token = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7).trim()
        : '';

      let isAdmin = false;
      if (token) {
        try {
          const authRes = await verifySupabaseAdminToken(token);
          isAdmin = !!authRes.valid;
        } catch {
          isAdmin = false;
        }
      }

      if (!isAdmin) {
        return res.status(401).json({
          ok: false,
          error: "UNAUTHORIZED",
          message: "Es requereix autorització d'administrador per reintentar correus pendents."
        });
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        return res.status(500).json({ ok: false, error: "CONFIG_MISSING", message: "Supabase no configurat" });
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: rows, error: qErr } = await supabase
        .from('inscripciones')
        .select('id, codiSeguiment, respostesCuestionari')
        .order('creadoEn', { ascending: false })
        .limit(100);

      if (qErr) {
        return res.status(500).json({ ok: false, error: qErr.message });
      }

      const pendingRows = (rows || []).filter((r: any) => {
        const code = (r.codiSeguiment || '').trim();
        if (!code) return false;
        const resp = typeof r.respostesCuestionari === 'object' && r.respostesCuestionari
          ? r.respostesCuestionari
          : (typeof r.respostesCuestionari === 'string' ? JSON.parse(r.respostesCuestionari || '{}') : {});
        const isEnviat = (r as any).mailEnviat === true || resp.mailEnviat === true || resp.mailEstat === 'enviat' || resp.estatCorreu === 'enviat';
        return !isEnviat;
      });

      const batch = pendingRows.slice(0, 5);
      const results = [];
      for (const item of batch) {
        try {
          const sendRes = await sendConfirmationEmail({ inscriptionId: item.id });
          results.push({ id: item.id, ...sendRes });
        } catch (err: any) {
          results.push({ id: item.id, ok: false, emailSent: false, error: err?.message || String(err) });
        }
      }

      return res.status(200).json({
        ok: true,
        pendingTotal: pendingRows.length,
        retriedCount: batch.length,
        results
      });
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

    // If inscriptionId is provided, look up existing inscription from Supabase
    // selecting ONLY the columns needed for the email, STRICTLY EXCLUDING c1DniUrl and c2DniUrl (Point 1).
    if (inscriptionId) {
      try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          const { data: ins, error: fetchErr } = await supabase
            .from('inscripciones')
            .select('id, codiSeguiment, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c2Nom, c2Cognoms, c2Email, c2Telefon, preuCalculat, respostesCuestionari, seleccionsUniforme, estat_inscripcio, posicio_global')
            .eq('id', inscriptionId)
            .single();

          if (fetchErr || !ins) {
            console.error("[Email fetch inscription error]:", fetchErr);
            return res.status(404).json({
              ok: false,
              emailSent: false,
              error: "INSCRIPTION_NOT_FOUND",
              message: fetchErr ? `Error consultant la inscripció: ${fetchErr.message}` : "Inscripció no trobada a la base de dades."
            });
          }

          const lang = body.language === 'es' ? 'es' : 'ca';
          const isCorrection = Boolean(body.isCorrection);
          const rawResp = typeof ins.respostesCuestionari === 'object' && ins.respostesCuestionari !== null
            ? ins.respostesCuestionari
            : (typeof ins.respostesCuestionari === 'string' ? JSON.parse(ins.respostesCuestionari || '{}') : {});

          to = (body.to || body.email || (ins as any).emailContactoPareja || rawResp.emailContactoPareja || ins.c1Email || ins.c2Email || '').trim();
          codiSeguiment = (ins.codiSeguiment || (ins as any).codi_seguiment || (ins as any).codigo || codiSeguiment || '').trim();

          const isAdult = String(ins.categoria || '').trim().toUpperCase() === 'ADULT';
          const categoriaLabel = isAdult 
            ? (lang === 'ca' ? 'PARELLA ADULTA' : 'PAREJA ADULTA') 
            : (lang === 'ca' ? 'PARELLA JUVENIL' : 'PAREJA JUVENIL');

          const isWaitlist = ins.estat_inscripcio === 'llista_espera' ||
                             ins.estat_inscripcio === 'espera';

          const posicio = ins.posicio_global;
          const contactPhone = ((ins as any).telefonContactoPareja || ins.c1Telefon || ins.c2Telefon || rawResp.telefonContactoPareja || '').trim();

            // Unified official total calculation (Point 6):
            // 45 base quota + 30 per armilla where c1Vol/c2Vol is true + 8 * clavells + 10 * corbati + 5 per each breakfast 'Sí'
            let armillesCount = 0;
            const selUni = typeof ins.seleccionsUniforme === 'object' && ins.seleccionsUniforme !== null ? ins.seleccionsUniforme : {};
            const firstUni = Object.values(selUni)[0] as any;
            if (firstUni) {
              if (firstUni.c1Vol === true) armillesCount++;
              if (firstUni.c2Vol === true) armillesCount++;
            }

            const clavellsQty = Math.max(0, parseInt(String(rawResp.clavells_qty || 0), 10) || 0);
            const corbatiQty = Math.max(0, parseInt(String(rawResp.corbati_qty || 0), 10) || 0);

            let esmorzarCount = 0;
            Object.keys(rawResp).forEach(k => {
              if (k.startsWith('preg-') && (k.endsWith('__c1') || k.endsWith('__c2'))) {
                const val = String(rawResp[k] || '').trim().toLowerCase();
                if (val === 'sí' || val === 'si') esmorzarCount++;
              }
            });

            const quotaBase = 45;
            const armillesTotal = armillesCount * 30;
            const clavellsTotal = clavellsQty * 8;
            const corbatiTotal = corbatiQty * 10;
            const esmorzarTotal = esmorzarCount * 5;
            const totalCalculat = quotaBase + armillesTotal + clavellsTotal + corbatiTotal + esmorzarTotal;

            const prefixSubject = isCorrection ? (lang === 'ca' ? '[VERSIÓ CORREGIDA] ' : '[VERSIÓN CORREGIDA] ') : '';
            subject = codiSeguiment
              ? `${prefixSubject}Confirmació de preinscripció - El Tast 2027 [CODI DE SEGUIMENT: ${codiSeguiment}]`
              : `${prefixSubject}Confirmació de preinscripció - El Tast 2027`;

            const qrUrl = codiSeguiment
              ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(codiSeguiment)}`
              : '';

            const correctionBannerHtml = isCorrection ? `
              <div style="background-color: #fef3c7; border: 1.5px solid #f59e0b; padding: 14px 18px; border-radius: 14px; text-align: center; margin-bottom: 22px; font-weight: bold; color: #92400e; font-size: 13px; line-height: 1.4;">
                ⚠️ ${lang === 'ca' ? 'Aquesta és una versió corregida de la vostra inscripció amb les dades i el desglossament de materials actualitzats.' : 'Esta es una versión corregida de su inscripción con los datos y el desglose de materiales actualizados.'}
              </div>
            ` : '';

            // Build itemized table rows
            let breakdownRows = `
              <tr style="border-bottom: 1px solid #f0f0f2;">
                <td style="padding: 10px 8px; font-weight: 600; color: #111115;">Quota inscripció (${categoriaLabel})</td>
                <td style="padding: 10px 8px; text-align: center; font-family: monospace;">1</td>
                <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #666;">Inscripció</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace;">45.00€</td>
                <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-family: monospace;">45.00€</td>
              </tr>
            `;

            if (armillesCount > 0) {
              breakdownRows += `
                <tr style="border-bottom: 1px solid #f0f0f2;">
                  <td style="padding: 10px 8px; font-weight: 600; color: #111115;">Armilla oficial</td>
                  <td style="padding: 10px 8px; text-align: center; font-family: monospace;">${armillesCount}</td>
                  <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #666;">Vestuari</td>
                  <td style="padding: 10px 8px; text-align: right; font-family: monospace;">30.00€</td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-family: monospace;">${armillesTotal}.00€</td>
                </tr>
              `;
            }

            if (clavellsQty > 0) {
              breakdownRows += `
                <tr style="border-bottom: 1px solid #f0f0f2;">
                  <td style="padding: 10px 8px; font-weight: 600; color: #111115;">Clavells</td>
                  <td style="padding: 10px 8px; text-align: center; font-family: monospace;">${clavellsQty}</td>
                  <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #666;">Complements</td>
                  <td style="padding: 10px 8px; text-align: right; font-family: monospace;">8.00€</td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-family: monospace;">${clavellsTotal}.00€</td>
                </tr>
              `;
            }

            if (corbatiQty > 0) {
              breakdownRows += `
                <tr style="border-bottom: 1px solid #f0f0f2;">
                  <td style="padding: 10px 8px; font-weight: 600; color: #111115;">Corbatí</td>
                  <td style="padding: 10px 8px; text-align: center; font-family: monospace;">${corbatiQty}</td>
                  <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #666;">Complements</td>
                  <td style="padding: 10px 8px; text-align: right; font-family: monospace;">10.00€</td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-family: monospace;">${corbatiTotal}.00€</td>
                </tr>
              `;
            }

            if (esmorzarCount > 0) {
              breakdownRows += `
                <tr style="border-bottom: 1px solid #f0f0f2;">
                  <td style="padding: 10px 8px; font-weight: 600; color: #111115;">Esmorzar de Comparsers</td>
                  <td style="padding: 10px 8px; text-align: center; font-family: monospace;">${esmorzarCount}</td>
                  <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #666;">Tiquets</td>
                  <td style="padding: 10px 8px; text-align: right; font-family: monospace;">5.00€</td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-family: monospace;">${esmorzarTotal}.00€</td>
                </tr>
              `;
            }

            html = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e4e8; border-radius: 24px; background-color: #ffffff; color: #111115;">
                <div style="text-align: center; margin-bottom: 25px;">
                  <span style="background-color: #ff0090; color: #ffffff; padding: 10px 24px; font-size: 13px; font-weight: bold; border-radius: 50px; letter-spacing: 1px; display: inline-block; text-transform: uppercase;">
                    ASSOCIACIÓ CULTURAL EL TAST
                  </span>
                </div>
                ${correctionBannerHtml}
                <div style="text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 11px; font-weight: 800; color: #ff0090; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                    ${lang === 'ca' ? 'COMPROVANT OFICIAL DE REGISTRE' : 'COMPROBANTE OFICIAL DE REGISTRO'}
                  </span>
                  <h1 style="color: #111115; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">
                    El Tast &bull; Comparses 2027
                  </h1>
                </div>

                <div style="background-color: #fcf6fa; border: 1.5px dashed #ff0090; padding: 18px; border-radius: 18px; text-align: center; margin-bottom: 28px;">
                  <span style="font-size: 11px; font-family: monospace; color: #cc0073; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; display: block; margin-bottom: 6px;">
                    CODI DE SEGUIMENT
                  </span>
                  <span style="font-size: 24px; font-family: monospace; font-weight: 950; color: #ff0090; letter-spacing: 1.5px; display: block;">
                    ${codiSeguiment ? `CODI DE SEGUIMENT: ${codiSeguiment}` : `<span style="color: #dc2626; font-size: 14px;">⚠️ ERROR: CODI DE SEGUIMENT BUIT</span>`}
                  </span>
                </div>

                ${qrUrl ? `
                <div style="text-align: center; margin: 24px 0;">
                  <div style="display: inline-block; padding: 14px; background-color: #f8f9fa; border: 1px solid #e1e1e6; border-radius: 18px;">
                    <img src="${qrUrl}" alt="QR Codi" width="180" height="180" style="display: block; border-radius: 10px;" />
                  </div>
                </div>
                ` : ''}

                <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 18px 0; margin-bottom: 24px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px; width: 40%;">
                        ${lang === 'ca' ? 'Parella:' : 'Pareja:'}
                      </td>
                      <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #111115;">
                        ${ins.c1Nom || ''} ${ins.c1Cognoms || ''} &amp; ${ins.c2Nom || ''} ${ins.c2Cognoms || ''}
                      </td>
                    </tr>
                    ${to ? `
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                        ${lang === 'ca' ? 'Correu de contacte:' : 'Correo de contacto:'}
                      </td>
                      <td style="padding: 6px 0; text-align: right; color: #374151; font-family: monospace;">
                        ${to}
                      </td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                        ${lang === 'ca' ? 'Telèfon de contacte:' : 'Teléfono de contacto:'}
                      </td>
                      <td style="padding: 6px 0; text-align: right; color: #374151; font-family: monospace;">
                        ${contactPhone || '—'}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                        ${lang === 'ca' ? 'Categoria:' : 'Categoría:'}
                      </td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #111115;">
                        <span style="background-color: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-family: monospace;">
                          ${categoriaLabel}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                        ${lang === 'ca' ? 'Estat d’inscripció:' : 'Estado de inscripción:'}
                      </td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold;">
                        ${isWaitlist
                          ? `<span style="color: #b45309; background-color: #fef3c7; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 6px; font-size: 11px;">${lang === 'ca' ? "LLISTA D'ESPERA" : "LISTA DE ESPERA"}</span>`
                          : `<span style="color: #047857; background-color: #d1fae5; border: 1px solid #10b981; padding: 2px 8px; border-radius: 6px; font-size: 11px;">${lang === 'ca' ? "OBERTA" : "ABIERTA"}</span>`
                        }
                      </td>
                    </tr>
                    ${posicio ? `
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                        ${lang === 'ca' ? 'Posició global assignada:' : 'Posición global asignada:'}
                      </td>
                      <td style="padding: 6px 0; text-align: right; font-weight: 900; color: #ff0090; font-family: monospace;">
                        #${posicio}
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </div>

                <div style="margin-bottom: 28px;">
                  <span style="font-size: 11px; font-weight: 800; color: #111115; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                    ${lang === 'ca' ? 'DESGLOSSAMENT OFICIAL DE MATERIALS I QUOTA:' : 'DESGLOSE OFICIAL DE MATERIALES Y CUOTA:'}
                  </span>
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;" cellpadding="0" cellspacing="0">
                    <thead>
                      <tr style="background-color: #f8f9fa; border-bottom: 2px solid #e1e1e6; text-transform: uppercase; font-size: 10px; color: #666670;">
                        <th style="padding: 10px 8px; text-align: left;">Concepte</th>
                        <th style="padding: 10px 8px; text-align: center;">Quantitat</th>
                        <th style="padding: 10px 8px; text-align: center;">Modalitat</th>
                        <th style="padding: 10px 8px; text-align: right;">Preu unitari</th>
                        <th style="padding: 10px 8px; text-align: right;">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${breakdownRows}
                    </tbody>
                    <tfoot>
                      <tr style="border-top: 2px solid #ff0090; background-color: #fcf6fa;">
                        <td colspan="4" style="padding: 14px 8px; font-weight: 900; font-size: 13px; color: #111115; text-transform: uppercase;">
                          TOTAL A PAGAR:
                        </td>
                        <td style="padding: 14px 8px; text-align: right; font-weight: 950; color: #ff0090; font-size: 20px; font-family: monospace;">
                          ${totalCalculat}€
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p style="font-size: 12px; color: #888; text-align: center; margin-top: 30px;">Associació Cultural El Tast &bull; tastvng@gmail.com</p>
              </div>
            `;
        }
      } catch (dbErr) {
        console.warn("[SMTP Lookup Inscription warning]:", dbErr);
      }
    }

    // If codiSeguiment is empty and inscriptionId is provided, look it up from Supabase
    if (!codiSeguiment && inscriptionId) {
      try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          const { data: ins } = await supabase
            .from('inscripciones')
            .select('codiSeguiment, codi_seguiment, codigo')
            .eq('id', inscriptionId)
            .maybeSingle();
          if (ins) {
            codiSeguiment = (ins.codiSeguiment || (ins as any).codi_seguiment || (ins as any).codigo || '').trim();
          }
        }
      } catch (e) {
        console.warn("[SMTP resolve codi warning]:", e);
      }
    }

    // REQUIREMENT 8: Stop sending if tracking code is empty
    if (!codiSeguiment) {
      if (inscriptionId) {
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
            const nowIso = new Date().toISOString();
            const { data: cur } = await supabase.from('inscripciones').select('respostesCuestionari').eq('id', inscriptionId).maybeSingle();
            let curResp = cur?.respostesCuestionari || {};
            if (typeof curResp === 'string') {
              try { curResp = JSON.parse(curResp); } catch { curResp = {}; }
            }
            await supabase.from('inscripciones').update({
              respostesCuestionari: {
                ...(typeof curResp === 'object' && curResp !== null ? curResp : {}),
                mailEnviat: false,
                mailData: nowIso,
                mailEstat: 'pendent',
                mailError: "El codi de seguiment real de la inscripció està buit a Supabase.",
                estatCorreu: 'pendent'
              },
              actualizadoEn: nowIso
            }).eq('id', inscriptionId);
          }
        } catch {}
      }

      return res.status(400).json({
        ok: false,
        emailSent: false,
        error: "TRACKING_CODE_EMPTY",
        message: "El codi de seguiment real de la inscripció està buit a Supabase. S'ha aturat l'enviament del correu."
      });
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

      // Persist success status into Supabase
      if (inscriptionId) {
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
            const nowIso = new Date().toISOString();
            const { data: cur } = await supabase.from('inscripciones').select('respostesCuestionari').eq('id', inscriptionId).maybeSingle();
            let curResp = cur?.respostesCuestionari || {};
            if (typeof curResp === 'string') {
              try { curResp = JSON.parse(curResp); } catch { curResp = {}; }
            }
            await supabase.from('inscripciones').update({
              respostesCuestionari: {
                ...(typeof curResp === 'object' && curResp !== null ? curResp : {}),
                mailEnviat: true,
                mailData: nowIso,
                mailEstat: 'enviat',
                mailError: null,
                estatCorreu: 'enviat',
                dataUltimCorreu: nowIso
              },
              actualizadoEn: nowIso
            }).eq('id', inscriptionId);
          }
        } catch (dbErr) {
          console.warn("[SMTP status save warning]:", dbErr);
        }
      }

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

      // Persist failure status into Supabase
      if (inscriptionId) {
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
            const nowIso = new Date().toISOString();
            const { data: cur } = await supabase.from('inscripciones').select('respostesCuestionari').eq('id', inscriptionId).maybeSingle();
            let curResp = cur?.respostesCuestionari || {};
            if (typeof curResp === 'string') {
              try { curResp = JSON.parse(curResp); } catch { curResp = {}; }
            }
            await supabase.from('inscripciones').update({
              respostesCuestionari: {
                ...(typeof curResp === 'object' && curResp !== null ? curResp : {}),
                mailEnviat: false,
                mailData: nowIso,
                mailEstat: 'fallat',
                mailError: sendError?.message || String(sendError),
                estatCorreu: 'fallat'
              },
              actualizadoEn: nowIso
            }).eq('id', inscriptionId);
          }
        } catch (dbErr) {
          console.warn("[SMTP error save warning]:", dbErr);
        }
      }

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
