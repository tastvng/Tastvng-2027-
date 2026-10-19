/**
 * Shared confirmation email sending helper
 * Used by api/inscriptions.ts (automatic sending upon registration),
 * api/email.ts (manual sending from admin and retry-pending endpoint),
 * and background workers.
 */

import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { calculateInscriptionOrderBreakdown } from "../src/utils/orderCalculations";

export interface SendConfirmationOptions {
  inscriptionId: string;
  language?: string;
  isCorrection?: boolean;
  to?: string;
}

export interface SendConfirmationResult {
  ok: boolean;
  emailSent: boolean;
  messageId?: string;
  error?: string;
  message?: string;
}

function maskString(str: string): string {
  if (!str) return '***';
  if (str.length <= 4) return '***';
  return str.substring(0, 2) + '***' + str.substring(str.length - 2);
}

export async function sendConfirmationEmail(options: SendConfirmationOptions): Promise<SendConfirmationResult> {
  const { inscriptionId } = options;
  if (!inscriptionId) {
    return {
      ok: false,
      emailSent: false,
      error: "MISSING_INSCRIPTION_ID",
      message: "Identificador d'inscripció obligatori."
    };
  }

  // 1. SMTP Credentials verification
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = parseInt(String(process.env.SMTP_PORT || '587').trim(), 10) || 587;
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPassword = (process.env.SMTP_PASSWORD || '').trim().replace(/\s+/g, '');
  const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();

  if (!smtpUser || !smtpPassword) {
    console.error("[sendConfirmationEmail] Credencials SMTP no configurades (SMTP_USER o SMTP_PASSWORD absents).");
    return {
      ok: false,
      emailSent: false,
      error: "SMTP_NOT_CONFIGURED",
      message: "Credencials SMTP no configurades al servidor (SMTP_USER o SMTP_PASSWORD absents)."
    };
  }

  // 2. Supabase Client setup
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      ok: false,
      emailSent: false,
      error: "CONFIG_MISSING",
      message: "Supabase no està configurat al servidor."
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // 3. Fetch inscription using ONLY existing columns (estat_inscripcio, posicio_global)
  const { data: ins, error: fetchErr } = await supabase
    .from('inscripciones')
    .select('id, codiSeguiment, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c1Talla, c1UniformeTipus, c2Nom, c2Cognoms, c2Email, c2Telefon, c2Talla, c2UniformeTipus, preuCalculat, respostesCuestionari, seleccionsUniforme, estat_inscripcio, posicio_global')
    .eq('id', inscriptionId)
    .single();

  if (fetchErr || !ins) {
    console.error("[sendConfirmationEmail] Error consultant la inscripció:", fetchErr);
    return {
      ok: false,
      emailSent: false,
      error: "INSCRIPTION_NOT_FOUND",
      message: fetchErr ? `Error consultant la inscripció: ${fetchErr.message}` : "Inscripció no trobada a la base de dades."
    };
  }

  const rawResp = typeof ins.respostesCuestionari === 'object' && ins.respostesCuestionari !== null
    ? ins.respostesCuestionari
    : (typeof ins.respostesCuestionari === 'string' ? JSON.parse(ins.respostesCuestionari || '{}') : {});

  const codiSeguiment = (ins.codiSeguiment || '').trim();

  // Stop if tracking code is empty
  if (!codiSeguiment) {
    const nowIso = new Date().toISOString();
    try {
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
    } catch {}

    return {
      ok: false,
      emailSent: false,
      error: "TRACKING_CODE_EMPTY",
      message: "El codi de seguiment real de la inscripció està buit a Supabase. S'ha aturat l'enviament del correu."
    };
  }

  // Determine recipient email
  const to = (options.to || (ins as any).emailContactoPareja || rawResp.emailContactoPareja || ins.c1Email || ins.c2Email || '').trim();
  if (!to || !to.includes('@')) {
    return {
      ok: false,
      emailSent: false,
      error: "INVALID_RECIPIENT",
      message: "Destinatari de correu buit o no vàlid."
    };
  }

  const lang = options.language === 'es' ? 'es' : 'ca';
  const isCorrection = Boolean(options.isCorrection);

  const isAdult = String(ins.categoria || '').trim().toUpperCase() === 'ADULT';
  const categoriaLabel = isAdult 
    ? (lang === 'ca' ? 'PARELLA ADULTA' : 'PAREJA ADULTA') 
    : (lang === 'ca' ? 'PARELLA JUVENIL' : 'PAREJA JUVENIL');

  const isWaitlist = ins.estat_inscripcio === 'llista_espera' || ins.estat_inscripcio === 'espera';
  const posicio = ins.posicio_global;
  const contactPhone = ((ins as any).telefonContactoPareja || ins.c1Telefon || ins.c2Telefon || rawResp.telefonContactoPareja || rawResp.telefonContacteParella || '').trim();

  // Load configuration and preguntes from Supabase
  let config: any = null;
  try {
    const { data: pregRows, error: pregErr } = await supabase
      .from('preguntes')
      .select('id, titol, tipus, opcions, requerit, activa, ordre, condicio, ambit, presentacio, descripcio, preus, concepte, concepte_es')
      .order('ordre', { ascending: true });

    if (pregErr) {
      console.warn("[sendConfirmationEmail] Error consultant taula preguntes:", pregErr.message);
    }

    const mappedPreguntes = (pregRows || []).map((row: any, idx: number) => {
      let cond: any = null;
      if (row.condicio) {
        let parsed = row.condicio;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        if (parsed && typeof parsed === 'object' && parsed.preguntaId) {
          cond = { preguntaId: String(parsed.preguntaId), valor: String(parsed.valor) };
        }
      }

      let cleanPreus: Record<string, number> | undefined = undefined;
      if (row.preus) {
        let parsed = row.preus;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const m: Record<string, number> = {};
          for (const [k, v] of Object.entries(parsed)) {
            const num = Number(v);
            if (!isNaN(num) && num >= 0) m[k] = num;
          }
          if (Object.keys(m).length > 0) cleanPreus = m;
        }
      }

      return {
        id: String(row.id),
        titol: String(row.titol || ''),
        tipus: (row.tipus || 'text') as 'text' | 'select' | 'boolean',
        opcions: Array.isArray(row.opcions)
          ? row.opcions
          : (typeof row.opcions === 'string' ? JSON.parse(row.opcions) : undefined),
        requerit: !!row.requerit,
        activa: row.activa !== false,
        ordre: typeof row.ordre === 'number' ? row.ordre : idx,
        descripcio: row.descripcio ? String(row.descripcio) : undefined,
        condicio: cond,
        ambit: row.ambit === 'comparser' ? 'comparser' : 'parella',
        presentacio: row.presentacio === 'botons' ? 'botons' : 'desplegable',
        preus: cleanPreus,
        concepte: row.concepte ? String(row.concepte) : undefined,
        concepteES: (row.concepte_es ?? row.concepteES) ? String(row.concepte_es ?? row.concepteES) : undefined
      };
    });

    let dbConfigVal: any = null;
    try {
      const { data: stRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'tast_config_2026')
        .maybeSingle();
      if (stRow?.value) {
        dbConfigVal = typeof stRow.value === 'string' ? JSON.parse(stRow.value) : stRow.value;
      }
    } catch {}

    config = {
      ...(dbConfigVal && typeof dbConfigVal === 'object' ? dbConfigVal : {}),
      preguntesFormulari: mappedPreguntes
    };
  } catch (err: any) {
    console.warn("[sendConfirmationEmail] Excepció carregant preguntes:", err?.message || err);
  }

  const breakdown = calculateInscriptionOrderBreakdown(ins as any, config, lang);
  const totalCalculat = breakdown.totalCalculat;

  if (typeof ins.preuCalculat === 'number' && !isNaN(ins.preuCalculat) && ins.preuCalculat !== totalCalculat) {
    console.warn(`[sendConfirmationEmail] Advertència de total: el total calculat per al correu (${totalCalculat}€) no coincideix amb ins.preuCalculat (${ins.preuCalculat}€) per a la inscripció ${ins.id || codiSeguiment}.`);
  }

  const prefixSubject = isCorrection ? (lang === 'ca' ? '[VERSIÓ CORREGIDA] ' : '[VERSIÓN CORREGIDA] ') : '';
  const subject = `${prefixSubject}Confirmació de preinscripció - El Tast 2027 [CODI DE SEGUIMENT: ${codiSeguiment}]`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(codiSeguiment)}`;

  const correctionBannerHtml = isCorrection ? `
    <div style="background-color: #fef3c7; border: 1.5px solid #f59e0b; padding: 14px 18px; border-radius: 14px; text-align: center; margin-bottom: 22px; font-weight: bold; color: #92400e; font-size: 13px; line-height: 1.4;">
      ⚠️ ${lang === 'ca' ? 'Aquesta és una versió corregida de la vostra inscripció amb les dades i el desglossament de materials actualitzats.' : 'Esta es una versión corregida de su inscripción con los datos y el desglose de materiales actualizados.'}
    </div>
  ` : '';

  let breakdownRows = `
    <tr style="border-bottom: 1px solid #f0f0f2;">
      <td style="padding: 10px 8px; font-weight: 600; color: #111115;">Quota inscripció (${breakdown.categoriaNom || categoriaLabel})</td>
      <td style="padding: 10px 8px; text-align: center; font-family: monospace;">1</td>
      <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #666;">Inscripció</td>
      <td style="padding: 10px 8px; text-align: right; font-family: monospace;">${Number(breakdown.categoriaQuotaBase).toFixed(2)}€</td>
      <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-family: monospace;">${Number(breakdown.categoriaQuotaBase).toFixed(2)}€</td>
    </tr>
  `;

  for (const mat of breakdown.materials) {
    breakdownRows += `
      <tr style="border-bottom: 1px solid #f0f0f2;">
        <td style="padding: 10px 8px; font-weight: 600; color: #111115;">${mat.nom}</td>
        <td style="padding: 10px 8px; text-align: center; font-family: monospace;">${mat.quantitat}</td>
        <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #666;">${mat.modalitat || '—'}</td>
        <td style="padding: 10px 8px; text-align: right; font-family: monospace;">${Number(mat.preuUnitari).toFixed(2)}€</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-family: monospace;">${Number(mat.subtotal).toFixed(2)}€</td>
      </tr>
    `;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e4e8; border-radius: 24px; background-color: #ffffff; color: #111115;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #ff0090; color: #ffffff; padding: 10px 24px; font-size: 13px; font-weight: bold; border-radius: 50px; letter-spacing: 1px; display: inline-block; text-transform: uppercase;">
          EL TAST
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
          CODI DE SEGUIMENT: ${codiSeguiment}
        </span>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; padding: 14px; background-color: #f8f9fa; border: 1px solid #e1e1e6; border-radius: 18px;">
          <img src="${qrUrl}" alt="QR Codi" width="180" height="180" style="display: block; border-radius: 10px;" />
        </div>
      </div>

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
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              ${lang === 'ca' ? 'Correu de contacte:' : 'Correo de contacto:'}
            </td>
            <td style="padding: 6px 0; text-align: right; color: #374151; font-family: monospace;">
              ${to || '—'}
            </td>
          </tr>
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

  // Configure Nodemailer transporter (secure: false for port 587 STARTTLS)
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
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
    to: to.replace(/[\r\n]/g, '').trim(),
    subject: subject.replace(/[\r\n]/g, '').trim(),
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[sendConfirmationEmail ok]: MessageId: ${info.messageId} to: ${to} codi: ${codiSeguiment}`);

    const nowIso = new Date().toISOString();
    try {
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
    } catch (statusErr) {
      console.warn("[sendConfirmationEmail status save warning]:", statusErr);
    }

    return {
      ok: true,
      emailSent: true,
      messageId: info.messageId
    };
  } catch (sendError: any) {
    console.error("[sendConfirmationEmail Error]:", {
      to,
      codi: codiSeguiment,
      message: sendError?.message || String(sendError),
      code: sendError?.code,
      host: smtpHost,
      port: smtpPort,
      user: maskString(smtpUser)
    });

    const nowIso = new Date().toISOString();
    const errMsg = sendError?.message || String(sendError);
    try {
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
          mailError: errMsg,
          estatCorreu: 'fallat'
        },
        actualizadoEn: nowIso
      }).eq('id', inscriptionId);
    } catch (statusErr) {
      console.warn("[sendConfirmationEmail error status save warning]:", statusErr);
    }

    return {
      ok: false,
      emailSent: false,
      error: "SMTP_SEND_FAILED",
      message: errMsg
    };
  }
}
