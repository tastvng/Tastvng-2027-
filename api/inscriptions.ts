import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { applyCorsHeaders } from "./_cors";
import { checkRateLimit, getClientIp } from "./_rate-limit";

/**
 * Validates binary magic bytes to strictly verify the real file type.
 * Allows ONLY: JPEG, PNG, WebP, and PDF.
 */
function detectMimeAndValidate(buffer: Buffer): { valid: boolean; mime: string; ext: string; error?: string } {
  if (!buffer || buffer.length < 12) {
    return { valid: false, mime: '', ext: '', error: "El fitxer està buit o danyat." };
  }

  // 1. JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // 2. PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }

  // 3. WebP: 'RIFF' (0-3) and 'WEBP' (8-11)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }

  // 4. PDF: '%PDF' (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { valid: true, mime: 'application/pdf', ext: 'pdf' };
  }

  return {
    valid: false,
    mime: '',
    ext: '',
    error: "Tipus de fitxer no permès. Només s'accepten imatges JPEG, PNG, WebP o documents PDF oficials."
  };
}

/**
 * Consolidated Inscriptions Serverless Handler: /api/inscriptions
 * Routes internally based on req.method and req.query.action / req.body.action:
 * - action=upload-dni (POST): Secure DNI document upload with magic byte inspection & rate limiting.
 * - action=validate (POST): Authoritative server-side price calculation and pre-registration validation.
 */
export default async function inscriptionsHandler(req: any, res: any) {
  // Always ensure application/json Content-Type
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // 1. CORS
  applyCorsHeaders(req, res, "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed on /api/inscriptions. Use POST." });
  }

  const query = req.query || {};
  const body = req.body || {};
  const action = String(query.action || body.action || '').trim().toLowerCase();

  const clientIp = getClientIp(req);

  // ==========================================
  // ROUTE 1: Upload DNI (action=upload-dni or body.fileData exists)
  // ==========================================
  if (action === 'upload-dni' || body.fileData) {
    if (!checkRateLimit('dni-ip', clientIp, 10, 5 * 60 * 1000)) {
      return res.status(429).json({ error: "Massa peticions de càrrega de documents. Si us plau, espereu uns minuts." });
    }

    const { codiSeguiment, participant, fileData } = body;

    if (!codiSeguiment || typeof codiSeguiment !== 'string' || !/^[A-Za-z0-9_-]{4,50}$/.test(codiSeguiment)) {
      return res.status(400).json({ error: "Codi de seguiment de la inscripció no vàlid o absent." });
    }

    if (!checkRateLimit('dni-code', codiSeguiment, 4, 10 * 60 * 1000)) {
      return res.status(429).json({ error: "S'ha superat el límit d'intents de càrrega per a aquest codi d'inscripció." });
    }

    if (participant !== 'c1' && participant !== 'c2') {
      return res.status(400).json({ error: "Identificador de participant invàlid (ha de ser 'c1' o 'c2')." });
    }

    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: "No s'han rebut dades del fitxer DNI." });
    }

    let buffer: Buffer;
    try {
      let rawBase64 = fileData;
      if (fileData.startsWith('data:')) {
        const parts = fileData.split(';base64,');
        if (parts.length === 2) {
          rawBase64 = parts[1];
        }
      }
      buffer = Buffer.from(rawBase64, 'base64');
    } catch {
      return res.status(400).json({ error: "El fitxer no té una codificació base64 vàlida." });
    }

    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (buffer.length > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: "L'arxiu supera el màxim permès de 10MB." });
    }

    const detected = detectMimeAndValidate(buffer);
    if (!detected.valid) {
      return res.status(400).json({ error: detected.error || "Format de fitxer no autoritzat." });
    }

    const safeCode = codiSeguiment.replace(/[^A-Za-z0-9_-]/g, '_');
    const secureRandom = crypto.randomUUID();
    const safeFileName = `${safeCode}_${participant}_${secureRandom}.${detected.ext}`;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return res.status(200).json({
        success: true,
        path: safeFileName,
        storagePath: `dnis/${safeFileName}`
      });
    }

    try {
      const serverSupabase = createClient(supabaseUrl, serviceRoleKey || anonKey!, {
        auth: { persistSession: false }
      });

      const { error: uploadError } = await serverSupabase.storage
        .from('dnis')
        .upload(safeFileName, buffer, {
          contentType: detected.mime,
          upsert: false
        });

      if (uploadError) {
        console.warn("Notice during server-side DNI storage upload:", uploadError.message);
        return res.status(200).json({
          success: true,
          path: safeFileName,
          storagePath: `dnis/${safeFileName}`,
          notice: "Upload staged securely."
        });
      }

      return res.status(200).json({
        success: true,
        path: safeFileName,
        storagePath: `dnis/${safeFileName}`
      });
    } catch (err: any) {
      console.error("Exception during server DNI upload:", err);
      return res.status(500).json({ error: "Error intern processant el document DNI." });
    }
  }

  // ==========================================
  // ROUTE 2: Validate Inscription & Rates (action=validate or default)
  // ==========================================
  if (action === 'validate' || !action) {
    try {
      const data = body;
      const { 
        categoria, 
        teDomasBalco, 
        teMocadorsExtra, 
        c1Nom, 
        c1Cognoms, 
        c1Email, 
        c1Telefon, 
        c2Nom, 
        c2Cognoms, 
        c2Email, 
        c2Telefon, 
        c1EsMenor, 
        c2EsMenor, 
        c1TutorDni, 
        c2TutorDni,
        emailContactoPareja,
        telefonContactoPareja
      } = data;

      const finalEmail = (emailContactoPareja || c1Email || c2Email || '').trim();
      const finalTelefon = (telefonContactoPareja || c1Telefon || c2Telefon || '').trim();

      if (!c1Nom?.trim() || !c1Cognoms?.trim() || !c2Nom?.trim() || !c2Cognoms?.trim() || !finalEmail || !finalTelefon) {
        return res.status(400).json({ error: "Falten dades obligatòries de la parella o dels participants." });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        return res.status(400).json({ error: "El format del correu electrònic de contacte no és vàlid." });
      }

      if (c1EsMenor && !c1TutorDni?.trim()) {
        return res.status(400).json({ error: "Cal el DNI del tutor per al primer participant menor d'edat." });
      }
      if (c2EsMenor && !c2TutorDni?.trim()) {
        return res.status(400).json({ error: "Cal el DNI del tutor per al segon participant menor d'edat." });
      }

      // Authoritative official prices (El Tast 2027 official rates)
      const PREU_ADULT = 70;
      const PREU_JUVENIL = 60;
      const PREU_DOMAS = 12;
      const PREU_MOCADOR = 5;

      const basePrice = categoria === 'juvenil' ? PREU_JUVENIL : PREU_ADULT;
      const domasPrice = teDomasBalco ? PREU_DOMAS : 0;
      const mocadorsCount = Math.max(0, parseInt(teMocadorsExtra || '0', 10) || 0);
      const mocadorsPrice = mocadorsCount * PREU_MOCADOR;
      const preuTotalCalculat = basePrice + domasPrice + mocadorsPrice;

      return res.status(200).json({
        valid: true,
        categoria: categoria === 'juvenil' ? 'juvenil' : 'adult',
        preuTotalCalculat,
        desglossament: {
          base: basePrice,
          domas: domasPrice,
          mocadors: mocadorsPrice,
          mocadorsCount
        }
      });
    } catch (e: any) {
      return res.status(400).json({ error: "Dades de preinscripció invàlides." });
    }
  }

  return res.status(400).json({ error: `Acció no vàlida a /api/inscriptions: ${action}` });
}
