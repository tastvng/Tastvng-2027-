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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Consolidated Inscriptions Serverless Handler: /api/inscriptions
 * Routes internally based on req.method and req.query.action / req.body.action:
 * - action=create / save (POST): Inserts directly into public.inscripciones via Service Role (bypassing RLS)
 * - action=list (GET / POST): Fetches current inscriptions directly from public.inscripciones for Secretaría
 * - action=upload-dni (POST): Secure DNI document upload with magic byte inspection & rate limiting.
 * - action=validate (POST): Authoritative server-side price calculation and pre-registration validation.
 */
export default async function inscriptionsHandler(req: any, res: any) {
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

    const query = req.query || {};
    const body = req.body || {};
    const action = String(query.action || body.action || '').trim().toLowerCase();
    const clientIp = getClientIp(req);

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    // Helper to get authoritative Supabase client
    const getServerSupabase = () => {
      if (!supabaseUrl) return null;
      return createClient(supabaseUrl, serviceRoleKey || anonKey!, {
        auth: { persistSession: false }
      });
    };

    // ==========================================
    // ROUTE 0: CREATE INSCRIPTION (action=create or action=save or body.registration exists)
    // ==========================================
    if (action === 'create' || action === 'save' || (req.method === 'POST' && (body.registration || (body.codiSeguiment && body.c1Nom)))) {
      const reg = body.registration || body;

      // Rate limit inscription submissions (15 per 5 minutes per IP)
      if (!checkRateLimit('ins-submit', clientIp, 15, 5 * 60 * 1000)) {
        return res.status(429).json({
          ok: false,
          step: "validation",
          error: "Massa sol·licituds d'inscripció des d'aquesta adreça IP. Si us plau, espereu uns minuts.",
          code: "429"
        });
      }

      // 1. Validate required fields
      const c1Nom = String(reg.c1Nom || '').trim();
      const c1Cognoms = String(reg.c1Cognoms || '').trim();
      const c2Nom = String(reg.c2Nom || '').trim();
      const c2Cognoms = String(reg.c2Cognoms || '').trim();
      const contactEmail = String(reg.emailContactoPareja || reg.c1Email || reg.c2Email || '').trim();
      const contactTelefon = String(reg.telefonContactoPareja || reg.c1Telefon || reg.c2Telefon || '').trim();
      const categoria = String(reg.categoria || 'adult').toLowerCase() === 'juvenil' ? 'juvenil' : 'adult';

      if (!c1Nom || !c1Cognoms || !c2Nom || !c2Cognoms) {
        return res.status(400).json({
          ok: false,
          step: "validation",
          error: "Falten dades obligatòries dels participants (Noms i Cognoms de tots dos).",
          code: "VALIDATION_FAILED"
        });
      }

      if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return res.status(400).json({
          ok: false,
          step: "validation",
          error: "L'adreça de correu electrònic de contacte no és vàlida.",
          code: "VALIDATION_FAILED"
        });
      }

      // 2. Validate / normalize UUID
      let rowId = reg.id;
      if (!rowId || typeof rowId !== 'string' || !UUID_REGEX.test(rowId)) {
        rowId = crypto.randomUUID();
      }

      // 3. Generate or validate codiSeguiment
      let codiSeguiment = String(reg.codiSeguiment || '').trim();
      if (!codiSeguiment) {
        const prefix = categoria === 'juvenil' ? 'J' : 'A';
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        codiSeguiment = `TAST-2027-${prefix}${Date.now().toString().slice(-4)}-${randomSuffix}`;
      }

      // 4. Ensure JSON objects are genuine objects (not strings or null)
      let respostesCuestionari: Record<string, any> = {};
      if (typeof reg.respostesCuestionari === 'object' && reg.respostesCuestionari !== null) {
        respostesCuestionari = { ...reg.respostesCuestionari };
      } else if (typeof reg.respostesCuestionari === 'string') {
        try { respostesCuestionari = JSON.parse(reg.respostesCuestionari); } catch { respostesCuestionari = {}; }
      }

      // Store contact email & phone inside respostes for resilience
      respostesCuestionari.emailContactoPareja = contactEmail;
      respostesCuestionari.telefonContactoPareja = contactTelefon;

      let seleccionsUniforme: Record<string, any> = {};
      if (typeof reg.seleccionsUniforme === 'object' && reg.seleccionsUniforme !== null) {
        seleccionsUniforme = { ...reg.seleccionsUniforme };
      } else if (typeof reg.seleccionsUniforme === 'string') {
        try { seleccionsUniforme = JSON.parse(reg.seleccionsUniforme); } catch { seleccionsUniforme = {}; }
      }

      // 5. Construct exact payload for public.inscripciones table
      const nowIso = new Date().toISOString();
      const insertRow = {
        id: rowId,
        codiSeguiment,
        categoria,
        c1Nom,
        c1Cognoms,
        c1Email: contactEmail,
        c1Telefon: contactTelefon,
        c1Talla: String(reg.c1Talla || 'M').toUpperCase(),
        c1DniUrl: reg.c1DniUrl ? String(reg.c1DniUrl) : null,
        c1EsMenor: Boolean(reg.c1EsMenor),
        c1TutorNom: reg.c1TutorNom ? String(reg.c1TutorNom).trim() : null,
        c1TutorCognoms: reg.c1TutorCognoms ? String(reg.c1TutorCognoms).trim() : null,
        c1TutorDni: reg.c1TutorDni ? String(reg.c1TutorDni).trim().toUpperCase() : null,
        c1TutorTelefon: reg.c1TutorTelefon ? String(reg.c1TutorTelefon).trim() : null,
        c1UniformeTipus: reg.c1UniformeTipus ? String(reg.c1UniformeTipus).trim() : null,

        c2Nom,
        c2Cognoms,
        c2Email: contactEmail,
        c2Telefon: contactTelefon,
        c2Talla: String(reg.c2Talla || 'L').toUpperCase(),
        c2DniUrl: reg.c2DniUrl ? String(reg.c2DniUrl) : null,
        c2EsMenor: Boolean(reg.c2EsMenor),
        c2TutorNom: reg.c2TutorNom ? String(reg.c2TutorNom).trim() : null,
        c2TutorCognoms: reg.c2TutorCognoms ? String(reg.c2TutorCognoms).trim() : null,
        c2TutorDni: reg.c2TutorDni ? String(reg.c2TutorDni).trim().toUpperCase() : null,
        c2TutorTelefon: reg.c2TutorTelefon ? String(reg.c2TutorTelefon).trim() : null,
        c2UniformeTipus: reg.c2UniformeTipus ? String(reg.c2UniformeTipus).trim() : null,

        respostesCuestionari,
        seleccionsUniforme,
        preuCalculat: typeof reg.preuCalculat === 'number' ? reg.preuCalculat : 70,
        teDomasBalco: Boolean(reg.teDomasBalco),
        teMocadorsExtra: typeof reg.teMocadorsExtra === 'number' ? reg.teMocadorsExtra : 0,
        estatPagament: reg.estatPagament || 'PENDENT',
        metodePagament: reg.metodePagament || null,
        estatDni: reg.estatDni || 'PENDENT',
        entregaMaterial: reg.entregaMaterial || 'PENDENT',
        estat_inscripcio: reg.estatInscripcio || reg.estat_inscripcio || 'obertes',
        posicio_global: typeof reg.posicioGlobal === 'number' ? reg.posicioGlobal : (typeof reg.posicio_global === 'number' ? reg.posicio_global : null),
        bandera: typeof reg.bandera === 'number' ? reg.bandera : 0,
        creadoEn: reg.creadoEn || nowIso,
        actualizadoEn: nowIso
      };

      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        console.error("[INSERT error]: Supabase no està configurat al servidor (VITE_SUPABASE_URL absent)");
        return res.status(500).json({
          ok: false,
          step: "database_insert",
          error: "Supabase no està configurat al servidor (VITE_SUPABASE_URL absent).",
          code: "CONFIG_ERROR"
        });
      }

      // 6. Perform INSERT into public.inscripciones
      const { data: insertedRows, error: insertError } = await serverSupabase
        .from('inscripciones')
        .insert(insertRow)
        .select();

      if (insertError) {
        console.error("[INSERT error]:", {
          table: "public.inscripciones",
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });

        return res.status(500).json({
          ok: false,
          step: "database_insert",
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });
      }

      const confirmedRow = (insertedRows && insertedRows[0]) ? insertedRows[0] : insertRow;
      console.log(`[INSERT ok]: table public.inscripciones, id: ${confirmedRow.id}, codi: ${confirmedRow.codiSeguiment}, user: ${confirmedRow.c1Nom} & ${confirmedRow.c2Nom}`);

      return res.status(200).json({
        ok: true,
        step: "database_insert",
        id: confirmedRow.id,
        codiSeguiment: confirmedRow.codiSeguiment,
        data: confirmedRow
      });
    }

    // ==========================================
    // ROUTE 1: LIST INSCRIPTIONS FOR SECRETARÍA (action=list or GET /api/inscriptions)
    // ==========================================
    if (action === 'list' || req.method === 'GET') {
      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(500).json({
          ok: false,
          step: "secretaria_select",
          error: "Supabase no configurat al servidor",
          code: "CONFIG_MISSING"
        });
      }

      const { data, error } = await serverSupabase
        .from('inscripciones')
        .select('*')
        .order('creadoEn', { ascending: false })
        .limit(3000);

      if (error) {
        console.error("[Secretaría SELECT error]:", {
          table: "public.inscripciones",
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return res.status(500).json({
          ok: false,
          step: "secretaria_select",
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }

      const count = data ? data.length : 0;
      if (count === 0) {
        console.log("[Secretaría SELECT]: 0 registres trobats a public.inscripciones.");
      } else {
        console.log(`[Secretaría SELECT ok]: table public.inscripciones, count: ${count}`);
      }

      return res.status(200).json({
        ok: true,
        step: "secretaria_select",
        count,
        data: data || []
      });
    }

    // ==========================================
    // ROUTE 2: Upload DNI (action=upload-dni or body.fileData exists)
    // ==========================================
    if (action === 'upload-dni' || body.fileData) {
      if (!checkRateLimit('dni-ip', clientIp, 10, 5 * 60 * 1000)) {
        return res.status(429).json({
          ok: false,
          step: "upload_dni",
          error: "Massa peticions de càrrega de documents. Si us plau, espereu uns minuts.",
          code: "429"
        });
      }

      const { codiSeguiment, participant, fileData } = body;

      if (!codiSeguiment || typeof codiSeguiment !== 'string' || !/^[A-Za-z0-9_-]{4,50}$/.test(codiSeguiment)) {
        return res.status(400).json({
          ok: false,
          step: "upload_dni",
          error: "Codi de seguiment de la inscripció no vàlid o absent.",
          code: "INVALID_CODE"
        });
      }

      if (participant !== 'c1' && participant !== 'c2') {
        return res.status(400).json({
          ok: false,
          step: "upload_dni",
          error: "Identificador de participant invàlid (ha de ser 'c1' o 'c2').",
          code: "INVALID_PARTICIPANT"
        });
      }

      if (!fileData || typeof fileData !== 'string') {
        return res.status(400).json({
          ok: false,
          step: "upload_dni",
          error: "No s'han rebut dades del fitxer DNI.",
          code: "EMPTY_DATA"
        });
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
        return res.status(400).json({
          ok: false,
          step: "upload_dni",
          error: "El fitxer no té una codificació base64 vàlida.",
          code: "INVALID_BASE64"
        });
      }

      const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
      if (buffer.length > MAX_SIZE_BYTES) {
        return res.status(400).json({
          ok: false,
          step: "upload_dni",
          error: "L'arxiu supera el màxim permès de 10MB.",
          code: "FILE_TOO_LARGE"
        });
      }

      const detected = detectMimeAndValidate(buffer);
      if (!detected.valid) {
        return res.status(400).json({
          ok: false,
          step: "upload_dni",
          error: detected.error || "Format de fitxer no autoritzat.",
          code: "INVALID_MIME"
        });
      }

      const safeCode = codiSeguiment.replace(/[^A-Za-z0-9_-]/g, '_');
      const secureRandom = crypto.randomUUID();
      const safeFileName = `${safeCode}_${participant}_${secureRandom}.${detected.ext}`;

      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(200).json({
          ok: true,
          success: true,
          path: safeFileName,
          storagePath: `dnis/${safeFileName}`
        });
      }

      try {
        const { error: uploadError } = await serverSupabase.storage
          .from('dnis')
          .upload(safeFileName, buffer, {
            contentType: detected.mime,
            upsert: false
          });

        if (uploadError) {
          console.warn("Notice during server-side DNI storage upload:", uploadError.message);
          return res.status(200).json({
            ok: true,
            success: true,
            path: safeFileName,
            storagePath: `dnis/${safeFileName}`,
            notice: "Upload staged securely."
          });
        }

        return res.status(200).json({
          ok: true,
          success: true,
          path: safeFileName,
          storagePath: `dnis/${safeFileName}`
        });
      } catch (err: any) {
        console.error("Exception during server DNI upload:", err);
        return res.status(500).json({
          ok: false,
          step: "upload_dni",
          error: "Error intern processant el document DNI.",
          code: "STORAGE_EXCEPTION"
        });
      }
    }

    // ==========================================
    // ROUTE 3: Validate Inscription & Rates (action=validate)
    // ==========================================
    if (action === 'validate') {
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
        return res.status(400).json({
          ok: false,
          step: "validation",
          error: "Falten dades obligatòries de la parella o dels participants.",
          code: "MISSING_FIELDS"
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        return res.status(400).json({
          ok: false,
          step: "validation",
          error: "El format del correu electrònic de contacte no és vàlid.",
          code: "INVALID_EMAIL"
        });
      }

      if (c1EsMenor && !c1TutorDni?.trim()) {
        return res.status(400).json({
          ok: false,
          step: "validation",
          error: "Cal el DNI del tutor per al primer participant menor d'edat.",
          code: "TUTOR_DNI_REQUIRED"
        });
      }
      if (c2EsMenor && !c2TutorDni?.trim()) {
        return res.status(400).json({
          ok: false,
          step: "validation",
          error: "Cal el DNI del tutor per al segon participant menor d'edat.",
          code: "TUTOR_DNI_REQUIRED"
        });
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
        ok: true,
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
    }

    // ==========================================
    // ROUTE 4: Update Inscription (action=update)
    // ==========================================
    if (action === 'update' || req.method === 'PATCH' || req.method === 'PUT') {
      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(500).json({
          ok: false,
          step: "database_update",
          error: "Supabase no configurat al servidor",
          code: "CONFIG_MISSING"
        });
      }

      const id = body.id || (query.id as string);
      const updates = body.updates || body.data || body;
      if (!id) {
        return res.status(400).json({
          ok: false,
          step: "database_update",
          error: "Identificador d'inscripció obligatori",
          code: "MISSING_ID"
        });
      }

      const cleanUpdates = { ...updates };
      delete cleanUpdates.id;
      cleanUpdates.actualizadoEn = new Date().toISOString();

      const { data, error } = await serverSupabase
        .from('inscripciones')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("[UPDATE error]:", { id, error: error.message, code: error.code });
        return res.status(500).json({
          ok: false,
          step: "database_update",
          error: error.message,
          code: error.code,
          details: error.details
        });
      }

      return res.status(200).json({
        ok: true,
        step: "database_update",
        data
      });
    }

    // ==========================================
    // ROUTE 5: Delete Inscription (action=delete)
    // ==========================================
    if (action === 'delete' || req.method === 'DELETE') {
      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(500).json({
          ok: false,
          step: "database_delete",
          error: "Supabase no configurat al servidor",
          code: "CONFIG_MISSING"
        });
      }

      const id = body.id || (query.id as string);
      if (!id) {
        return res.status(400).json({
          ok: false,
          step: "database_delete",
          error: "Identificador d'inscripció obligatori",
          code: "MISSING_ID"
        });
      }

      const { error } = await serverSupabase
        .from('inscripciones')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("[DELETE error]:", { id, error: error.message, code: error.code });
        return res.status(500).json({
          ok: false,
          step: "database_delete",
          error: error.message,
          code: error.code
        });
      }

      return res.status(200).json({
        ok: true,
        step: "database_delete",
        id
      });
    }

    return res.status(400).json({
      ok: false,
      step: "routing",
      error: `Acció no vàlida a /api/inscriptions: ${action}`,
      code: "INVALID_ACTION"
    });
  } catch (fatalErr: any) {
    console.error("[FATAL ERROR in /api/inscriptions]:", fatalErr);
    return res.status(500).json({
      ok: false,
      step: "server_exception",
      error: fatalErr?.message || "Error intern no controlat al servidor d'inscripcions.",
      code: fatalErr?.code || "UNHANDLED_EXCEPTION"
    });
  }
}
