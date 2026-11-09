import { verifySupabaseAdminToken } from "./_supabase-auth.js";
import { sendConfirmationEmail } from "./_send-confirmation.js";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
export const LIGHT_COLUMNS = "id, codiSeguiment, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c1Talla, c1EsMenor, c1TutorNom, c1TutorCognoms, c1TutorDni, c1TutorTelefon, c1UniformeTipus, c2Nom, c2Cognoms, c2Email, c2Telefon, c2Talla, c2EsMenor, c2TutorNom, c2TutorCognoms, c2TutorDni, c2TutorTelefon, c2UniformeTipus, respostesCuestionari, seleccionsUniforme, preuCalculat, teDomasBalco, teMocadorsExtra, pagaments, estatPagament, metodePagament, estatDni, entregaMaterial, estat_inscripcio, posicio_global, bandera, creadoEn, actualizadoEn";

export function getStrictAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  allowed.add('https://tastvng-2027.vercel.app');

  if (process.env.ALLOWED_ORIGINS) {
    const customList = process.env.ALLOWED_ORIGINS.split(',');
    for (const item of customList) {
      const trimmed = item.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }

  if (process.env.APP_URL) {
    const trimmed = process.env.APP_URL.trim();
    if (trimmed) allowed.add(trimmed);
  }

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }

  return allowed;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = getStrictAllowedOrigins();
  if (allowed.has(origin)) return true;
  if (/^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/[a-zA-Z0-9_\-.]+\.run\.app$/.test(origin)) return true;
  return false;
}

export function applyCorsHeaders(
  req: { headers?: Record<string, string | string[] | undefined>; method?: string } | undefined | null,
  res: { setHeader?: (name: string, value: string) => void } | undefined | null,
  allowedMethods: string = 'GET, POST, OPTIONS'
): boolean {
  try {
    const rawOrigin = req?.headers?.origin;
    const origin = typeof rawOrigin === 'string' ? rawOrigin : undefined;
    const isAllowed = isOriginAllowed(origin);

    if (res && typeof res.setHeader === 'function') {
      if (origin && isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else {
        res.setHeader('Access-Control-Allow-Origin', 'https://tastvng-2027.vercel.app');
      }

      res.setHeader('Access-Control-Allow-Methods', allowedMethods);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }

    return isAllowed;
  } catch (err) {
    console.error('Error applying CORS headers:', err);
    return false;
  }
}

// ==========================================
// SELF-CONTAINED RATE LIMITING
// ==========================================

const rateLimitMaps = new Map<string, Map<string, { count: number; resetTime: number }>>();

let cachedCategoryStatus: {
  timestamp: number;
  data: {
    adult: { admitted: number; admitidas: number; admeses: number; waitlist: number; espera: number; limit: number; limite: number; full: boolean; lleno: boolean };
    juvenil: { admitted: number; admitidas: number; admeses: number; waitlist: number; espera: number; limit: number; limite: number; full: boolean; lleno: boolean };
  };
} | null = null;

export function checkRateLimit(
  bucket: string,
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  if (!rateLimitMaps.has(bucket)) {
    rateLimitMaps.set(bucket, new Map());
  }
  const map = rateLimitMaps.get(bucket)!;
  const now = Date.now();
  const current = map.get(key);

  if (!current || now > current.resetTime) {
    map.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count += 1;
  return true;
}

export function getClientIp(req: any): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || req?.ip || 'unknown';
}

// ==========================================
// SELF-CONTAINED CODE ALLOCATION
// ==========================================

export type CodeGroup = 'ADULT' | 'JUVENIL' | 'ESPERA';

export function determineCodeGroup(
  categoria: string | undefined | null,
  isWaitlist: boolean
): CodeGroup {
  if (isWaitlist) {
    return 'ESPERA';
  }
  const cat = String(categoria || 'ADULT').trim().toUpperCase();
  if (cat === 'JUVENIL') {
    return 'JUVENIL';
  }
  return 'ADULT';
}

export function formatCode(group: CodeGroup, seq: number): string {
  const safeSeq = Math.max(1, Math.floor(seq));
  if (group === 'ESPERA') {
    return `LE${String(safeSeq).padStart(5, '0')}`;
  }
  if (group === 'JUVENIL') {
    return `J${String(safeSeq).padStart(4, '0')}`;
  }
  return `A${String(safeSeq).padStart(4, '0')}`;
}

export function extractUsedNumbers(
  codes: (string | null | undefined)[],
  group: CodeGroup
): Set<number> {
  const used = new Set<number>();
  
  const regex = group === 'ESPERA'
    ? /^LE0*([1-9]\d*)$/i
    : group === 'JUVENIL'
      ? /^J0*([1-9]\d*)$/i
      : /^A0*([1-9]\d*)$/i;

  for (const raw of codes) {
    if (!raw) continue;
    const clean = String(raw).trim().toUpperCase();
    const match = clean.match(regex);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        used.add(parsed);
      }
    }
  }

  return used;
}

export function findLowestAvailableNumber(
  usedNumbers: Set<number>,
  existingExactCodes?: Set<string>,
  group?: CodeGroup
): number {
  let candidate = 1;
  while (true) {
    if (!usedNumbers.has(candidate)) {
      if (group && existingExactCodes) {
        const candidateStr = formatCode(group, candidate).toUpperCase();
        if (!existingExactCodes.has(candidateStr)) {
          return candidate;
        }
      } else {
        return candidate;
      }
    }
    candidate++;
  }
}

export function allocateNextCode(
  existingCodes: (string | null | undefined)[],
  group: CodeGroup
): string {
  const existingSet = new Set<string>();
  for (const c of existingCodes) {
    if (c) existingSet.add(String(c).trim().toUpperCase());
  }

  const usedNumbers = extractUsedNumbers(existingCodes, group);
  const nextNum = findLowestAvailableNumber(usedNumbers, existingSet, group);
  return formatCode(group, nextNum);
}

export function isLegacyCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return String(code).trim().toUpperCase().startsWith('TAST-');
}

// In-process serialized queue to prevent concurrent requests in the same container from colliding
let inMemoryLockQueue: Promise<any> = Promise.resolve();

/**
 * Distributed lock on Supabase `settings` table (key: 'lock_code_allocation')
 * with TTL to guarantee strict atomicity across concurrent clients.
 */
async function acquireDistributedLock(supabase: any, lockToken: string, maxWaitMs = 7000): Promise<boolean> {
  const start = Date.now();
  const lockKey = 'lock_code_allocation';
  const ttlMs = 8000;

  while (Date.now() - start < maxWaitMs) {
    try {
      const { data: current } = await supabase
        .from('settings')
        .select('value')
        .eq('key', lockKey)
        .maybeSingle();

      const val = (current?.value as any) || {};
      const isLocked = val.token && (Date.now() - (val.locked_at || 0) < ttlMs);

      if (!isLocked) {
        const now = Date.now();
        const { data: updated, error } = await supabase
          .from('settings')
          .upsert({
            key: lockKey,
            value: { token: lockToken, locked_at: now },
            updated_at: new Date().toISOString()
          })
          .select();

        if (!error && updated && updated.length > 0 && (updated[0].value as any)?.token === lockToken) {
          return true;
        }
      }
    } catch (e) {
      console.warn("Notice checking code allocation lock:", e);
    }
    await new Promise(r => setTimeout(r, 60));
  }
  return false;
}

async function releaseDistributedLock(supabase: any, lockToken: string): Promise<void> {
  const lockKey = 'lock_code_allocation';
  try {
    await supabase
      .from('settings')
      .update({
        value: { token: null, locked_at: 0 },
        updated_at: new Date().toISOString()
      })
      .eq('key', lockKey)
      .eq('value->>token', lockToken);
  } catch (err) {
    console.warn("Notice releasing lock:", err);
  }
}

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

async function verifyAdmin(req: any): Promise<boolean> {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return false;
  try {
    const result = await verifySupabaseAdminToken(token);
    return !!result.valid;
  } catch (err) {
    console.error("[api/inscriptions] Error verifying admin token:", err);
    return false;
  }
}

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
      const isAdminCaller = await verifyAdmin(req);
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

      // 1.1 Strict verification: Informative video must be completed before saving registration
      if (reg.videoWatched !== true && !reg.video_watched) {
        return res.status(400).json({
          ok: false,
          step: "validation",
          error: "⚠️ Per continuar, cal veure el vídeo informatiu complet.",
          code: "VIDEO_NOT_COMPLETED"
        });
      }

      // 2. Validate / normalize UUID
      let rowId = reg.id;
      if (!rowId || typeof rowId !== 'string' || !UUID_REGEX.test(rowId)) {
        rowId = crypto.randomUUID();
      }

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

      // 3. Determine if waitlist or normal category
      let isWaitlist = reg.estatInscripcio === 'llista_espera' ||
                         reg.estatInscripcio === 'espera' ||
                         reg.estat_inscripcio === 'espera' ||
                         reg.estat_inscripcio === 'llista_espera' ||
                         Boolean(reg.llistaEspera);

      // Automatic Category Quota Check (Point 2):
      // If manual state was 'obertes', check if the category quota limit has been reached
      let catLimit = 0;
      if (!isWaitlist) {
        try {
          const limitKey = categoria === 'juvenil' ? 'categoria_juvenil_limit' : 'categoria_adulta_limit';
          const { data: limitRow } = await serverSupabase
            .from('settings')
            .select('value')
            .eq('key', limitKey)
            .maybeSingle();

          if (limitRow) {
            const rawVal = (typeof limitRow.value === 'object' && limitRow.value !== null && 'value' in limitRow.value)
              ? limitRow.value.value
              : limitRow.value;
            catLimit = Math.max(0, parseInt(String(rawVal ?? '0'), 10) || 0);
          }

          if (catLimit > 0) {
            const { count, error: cntErr } = await serverSupabase
              .from('inscripciones')
              .select('id', { count: 'exact', head: true })
              .ilike('categoria', categoria === 'juvenil' ? '%juvenil%' : '%adult%')
              .or('estat_inscripcio.is.null,estat_inscripcio.not.in.(espera,llista_espera)');

            if (!cntErr && typeof count === 'number' && count >= catLimit) {
              console.log(`[CATEGORY_QUOTA_FULL] Category ${categoria} reached quota limit of ${catLimit} (current admitted: ${count}). Forcing waitlist.`);
              isWaitlist = true;
            }
          }
        } catch (limitErr) {
          console.warn("Notice checking category quota limit before insert:", limitErr);
        }
      }

      const codeGroup = determineCodeGroup(categoria, isWaitlist);
      let codiSeguiment = String(reg.codiSeguiment || '').trim();
      // If code was not already pre-allocated or matches legacy format, initialize empty for atomic allocation
      if (isLegacyCode(codiSeguiment)) {
        codiSeguiment = '';
      }

      // 4. Ensure JSON objects are genuine objects (not strings or null)
      let respostesCuestionari: Record<string, any> = {};
      if (typeof reg.respostesCuestionari === 'object' && reg.respostesCuestionari !== null) {
        respostesCuestionari = { ...reg.respostesCuestionari };
      } else if (typeof reg.respostesCuestionari === 'string') {
        try { respostesCuestionari = JSON.parse(reg.respostesCuestionari); } catch { respostesCuestionari = {}; }
      }

      // Purge legacy contact and internal fields from questionnaire answers (do NOT delete mail status or materials)
      const FORBIDDEN_RESPOSTES_KEYS = [
        'domas_qty', 'mocadors_qty', 'correuContacteParella',
        'telefonContacteParella', 'emailContactoPareja', 'telefonContactoPareja',
        'teDomasBalco', 'teMocadorsExtra'
      ];
      FORBIDDEN_RESPOSTES_KEYS.forEach(k => delete respostesCuestionari[k]);

      // Initialize mail tracking in respostesCuestionari
      respostesCuestionari.mailEnviat = reg.mailEnviat !== undefined ? reg.mailEnviat : false;
      respostesCuestionari.mailData = reg.mailData || null;
      respostesCuestionari.mailError = reg.mailError || null;
      respostesCuestionari.mailEstat = reg.mailEstat || 'pendent';
      respostesCuestionari.estatCorreu = reg.mailEstat || 'pendent';

      // Preserve selected materials in respostesCuestionari so they are persisted to Supabase
      if (Array.isArray(reg.extresSeleccionats) && reg.extresSeleccionats.length > 0) {
        respostesCuestionari.extresSeleccionats = reg.extresSeleccionats;
      }
      if (reg.clavells !== undefined) respostesCuestionari.clavells = reg.clavells;
      if (reg.corbati !== undefined) respostesCuestionari.corbati = reg.corbati;

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
        c1Talla: reg.c1Talla ? String(reg.c1Talla).toUpperCase().trim() : '',
        c1DniUrl: reg.c1DniUrl && !String(reg.c1DniUrl).startsWith('data:') ? String(reg.c1DniUrl) : null,
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
        c2Talla: reg.c2Talla ? String(reg.c2Talla).toUpperCase().trim() : '',
        c2DniUrl: reg.c2DniUrl && !String(reg.c2DniUrl).startsWith('data:') ? String(reg.c2DniUrl) : null,
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
        estatPagament: isAdminCaller ? (reg.estatPagament || 'PENDENT') : 'PENDENT',
        metodePagament: isAdminCaller ? (reg.metodePagament || null) : null,
        pagaments: isAdminCaller ? (Array.isArray(reg.pagaments) ? reg.pagaments : []) : [],
        estatDni: reg.estatDni || 'PENDENT',
        entregaMaterial: reg.entregaMaterial || 'PENDENT',
        estat_inscripcio: isWaitlist ? 'espera' : (reg.estatInscripcio || reg.estat_inscripcio || 'obertes'),
        bandera: typeof reg.bandera === 'number' ? reg.bandera : 0,
        creadoEn: reg.creadoEn || nowIso,
        actualizadoEn: nowIso
      };

      // 4. Before inserting, verify if another inscription already exists with the same email
      // and the exact same two members (Point 5). The same email with different couples is valid!
      try {
        const { data: existingRows, error: dupCheckErr } = await serverSupabase
          .from('inscripciones')
          .select('c1Nom, c1Cognoms, c2Nom, c2Cognoms, c1Email, c2Email');

        if (dupCheckErr) {
          console.error("[DUPLICATE_CHECK_ERROR] Error comprobant parelles duplicades a public.inscripciones:", dupCheckErr);
        }

        const norm = (s: string) => (s || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
        const myEmail = contactEmail.toLowerCase();
        const myC1 = `${norm(c1Nom)} ${norm(c1Cognoms)}`;
        const myC2 = `${norm(c2Nom)} ${norm(c2Cognoms)}`;

        const coupleAlreadyExists = (existingRows || []).some((r: any) => {
          const rEmail = (r.c1Email || r.c2Email || '').trim().toLowerCase();
          if (rEmail !== myEmail) return false;
          const rC1 = `${norm(r.c1Nom)} ${norm(r.c1Cognoms)}`;
          const rC2 = `${norm(r.c2Nom)} ${norm(r.c2Cognoms)}`;
          return (
            (myC1 === rC1 && myC2 === rC2) ||
            (myC1 === rC2 && myC2 === rC1)
          );
        });

        if (coupleAlreadyExists) {
          return res.status(409).json({
            ok: false,
            step: "validation",
            error: "Aquesta parella ja consta inscrita amb aquest correu electrònic. Si necessiteu fer canvis, contacteu amb secretaria.",
            code: "COUPLE_ALREADY_REGISTERED"
          });
        }
      } catch (chkErr) {
        console.warn("Notice checking couple duplicate on server:", chkErr);
      }

      // 5. Insert directly into public.inscripciones WITHOUT pre-calculating code or position (Point 4).
      // The database trigger assigns codiSeguiment and posicio_global. Read it back via .select().
      let insertedRow: any = null;
      try {
        const { data, error: insertError } = await serverSupabase
          .from('inscripciones')
          .insert(insertRow)
          .select('id, codiSeguiment, posicio_global, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c2Nom, c2Cognoms, c2Email, c2Telefon, preuCalculat, respostesCuestionari')
          .single();

        if (insertError) {
          throw insertError;
        }
        insertedRow = data;
      } catch (err: any) {
        console.error("[INSERT error]:", {
          table: "public.inscripciones",
          message: err?.message,
          code: err?.code,
          details: err?.details
        });

        return res.status(500).json({
          ok: false,
          step: "database_insert",
          error: err?.message || "Error en desar la inscripció a la base de dades.",
          code: err?.code || "INSERT_FAILED",
          details: err?.details
        });
      }

      // 5.1 Concurrency & Quota overflow handling (Point 3):
      // If inserted as admitted with an active limit, verify that its arrival order did not exceed the limit.
      if (!isWaitlist && catLimit > 0) {
        try {
          const { data: admittedRows, error: postCountErr } = await serverSupabase
            .from('inscripciones')
            .select('id, creadoEn, codiSeguiment')
            .ilike('categoria', categoria === 'juvenil' ? '%juvenil%' : '%adult%')
            .or('estat_inscripcio.is.null,estat_inscripcio.not.in.(espera,llista_espera)')
            .order('creadoEn', { ascending: true });

          if (!postCountErr && Array.isArray(admittedRows)) {
            const myIndex = admittedRows.findIndex((r: any) => r.id === insertedRow.id);
            if (myIndex >= catLimit) {
              console.warn(`[CONCURRENCY_QUOTA_OVERFLOW] Inscription ${insertedRow.id} exceeded limit ${catLimit} (pos ${myIndex + 1}). Reassigning to waitlist.`);

              const { data: allCodes } = await serverSupabase
                .from('inscripciones')
                .select('codiSeguiment');
              const codesList = (allCodes || []).map((r: any) => r.codiSeguiment).filter(Boolean);
              const newWaitlistCode = allocateNextCode(codesList, 'ESPERA');

              const nowUpdateIso = new Date().toISOString();
              const { data: updatedRow, error: updateErr } = await serverSupabase
                .from('inscripciones')
                .update({
                  estat_inscripcio: 'espera',
                  codiSeguiment: newWaitlistCode,
                  actualizadoEn: nowUpdateIso
                })
                .eq('id', insertedRow.id)
                .select('id, codiSeguiment, posicio_global, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c2Nom, c2Cognoms, c2Email, c2Telefon, preuCalculat, respostesCuestionari')
                .single();

              if (!updateErr && updatedRow) {
                insertedRow = updatedRow;
              } else {
                insertedRow.codiSeguiment = newWaitlistCode;
                insertedRow.estat_inscripcio = 'espera';
              }
              isWaitlist = true;
            }
          }
        } catch (postCheckErr) {
          console.warn("Notice checking concurrency quota overflow:", postCheckErr);
        }
      }

      // Invalidate memory cache so subsequent category-status calls see fresh counts
      cachedCategoryStatus = null;

      const confirmedCode = (insertedRow?.codiSeguiment || '').trim();
      const confirmedPosition = insertedRow?.posicio_global;

      console.log(`[INSERT ok]: table public.inscripciones, id: ${insertedRow.id}, codi: ${confirmedCode}, posicio: ${confirmedPosition}`);

      // 6. Automatic Email Sending (Point 3):
      // Just after saving and with code assigned, trigger the confirmation email directly without HTTP.
      let mailSentOk = false;
      let mailSendError: string | null = null;

      try {
        const mailResult = await sendConfirmationEmail({
          inscriptionId: insertedRow.id,
          language: reg.language || 'ca'
        });
        if (mailResult.ok && mailResult.emailSent) {
          mailSentOk = true;
        } else {
          mailSendError = mailResult.message || mailResult.error || "Error enviant correu";
        }
      } catch (mErr: any) {
        mailSendError = mErr?.message || String(mErr);
      }

      if (!mailSentOk) {
        try {
          const nowIso = new Date().toISOString();
          const { data: cur } = await serverSupabase
            .from('inscripciones')
            .select('respostesCuestionari')
            .eq('id', insertedRow.id)
            .maybeSingle();
          let curResp = cur?.respostesCuestionari || {};
          if (typeof curResp === 'string') {
            try { curResp = JSON.parse(curResp); } catch { curResp = {}; }
          }
          await serverSupabase.from('inscripciones').update({
            respostesCuestionari: {
              ...(typeof curResp === 'object' && curResp !== null ? curResp : {}),
              mailEnviat: false,
              mailData: nowIso,
              mailEstat: 'pendent',
              mailError: mailSendError || "Pendent d'enviament automàtic",
              estatCorreu: 'pendent'
            },
            actualizadoEn: nowIso
          }).eq('id', insertedRow.id);
        } catch (statusErr) {
          console.warn("Could not set initial mail status to pendent:", statusErr);
        }
      }

      return res.status(200).json({
        ok: true,
        step: "database_insert",
        id: insertedRow.id,
        codiSeguiment: confirmedCode,
        posicioGlobal: confirmedPosition,
        isWaitlist: Boolean(isWaitlist),
        estatInscripcio: isWaitlist ? 'espera' : 'obertes',
        mailSent: mailSentOk,
        mailEstat: mailSentOk ? 'enviat' : 'pendent',
        data: {
          ...insertedRow,
          isWaitlist: Boolean(isWaitlist),
          estat_inscripcio: isWaitlist ? 'espera' : (insertedRow?.estat_inscripcio || 'obertes'),
          codiSeguiment: confirmedCode,
          posicioGlobal: confirmedPosition
        }
      });
    }

    // ==========================================
    // ROUTE: PUBLIC CATEGORY STATUS & ADMISSION QUOTAS (action=category-status)
    // Protected against abuse: Soft IP rate limit + 30s memory cache + Cache-Control: public, max-age=30
    // Strictly NO personal data: returns only admitted, waitlist, limit, and full booleans.
    // ==========================================
    if (action === 'category-status' || action === 'category_status' || action === 'estat-categories') {
      if (res.setHeader) {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
      }

      // Soft rate limiting per IP (60 requests per 1 minute)
      if (!checkRateLimit('cat-status', clientIp, 60, 60 * 1000)) {
        return res.status(429).json({
          ok: false,
          error: "Massa peticions de comprovació d'aforament. Espereu uns segons."
        });
      }

      const now = Date.now();
      if (cachedCategoryStatus && (now - cachedCategoryStatus.timestamp < 30000)) {
        return res.status(200).json({
          ok: true,
          ...cachedCategoryStatus.data
        });
      }

      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(200).json({
          ok: true,
          adult: { admitted: 0, admitidas: 0, admeses: 0, waitlist: 0, espera: 0, limit: 0, limite: 0, full: false, lleno: false },
          juvenil: { admitted: 0, admitidas: 0, admeses: 0, waitlist: 0, espera: 0, limit: 0, limite: 0, full: false, lleno: false }
        });
      }

      try {
        // 1. Fetch category limits from settings table
        const { data: limitRows } = await serverSupabase
          .from('settings')
          .select('key, value')
          .in('key', ['categoria_adulta_limit', 'categoria_juvenil_limit']);

        const parseLimit = (key: string): number => {
          const row = (limitRows || []).find((r: any) => r.key === key);
          if (!row) return 0;
          const raw = (typeof row.value === 'object' && row.value !== null && 'value' in row.value)
            ? row.value.value
            : row.value;
          return Math.max(0, parseInt(String(raw ?? '0'), 10) || 0);
        };

        const adultLimit = parseLimit('categoria_adulta_limit');
        const juvenilLimit = parseLimit('categoria_juvenil_limit');

        // 2. Fetch all inscriptions' categoria and estat_inscripcio
        const { data: insRows, error: insErr } = await serverSupabase
          .from('inscripciones')
          .select('categoria, estat_inscripcio');

        if (insErr) {
          console.error("[CATEGORY_STATUS] Error fetching inscriptions count:", insErr);
          return res.status(500).json({ ok: false, error: insErr.message });
        }

        let adultAdmitted = 0;
        let adultWaitlist = 0;
        let juvenilAdmitted = 0;
        let juvenilWaitlist = 0;

        for (const r of (insRows || [])) {
          const cat = String(r.categoria || 'adult').toLowerCase();
          const isWait = r.estat_inscripcio === 'espera' || r.estat_inscripcio === 'llista_espera';
          if (cat.includes('juvenil')) {
            if (isWait) juvenilWaitlist++;
            else juvenilAdmitted++;
          } else {
            if (isWait) adultWaitlist++;
            else adultAdmitted++;
          }
        }

        const adultFull = adultLimit > 0 && adultAdmitted >= adultLimit;
        const juvenilFull = juvenilLimit > 0 && juvenilAdmitted >= juvenilLimit;

        const payload = {
          adult: {
            admitted: adultAdmitted,
            admitidas: adultAdmitted,
            admeses: adultAdmitted,
            waitlist: adultWaitlist,
            espera: adultWaitlist,
            limit: adultLimit,
            limite: adultLimit,
            full: adultFull,
            lleno: adultFull
          },
          juvenil: {
            admitted: juvenilAdmitted,
            admitidas: juvenilAdmitted,
            admeses: juvenilAdmitted,
            waitlist: juvenilWaitlist,
            espera: juvenilWaitlist,
            limit: juvenilLimit,
            limite: juvenilLimit,
            full: juvenilFull,
            lleno: juvenilFull
          }
        };

        cachedCategoryStatus = { timestamp: now, data: payload };
        return res.status(200).json({ ok: true, ...payload });
      } catch (err: any) {
        console.error("[CATEGORY_STATUS] Unexpected error:", err);
        return res.status(500).json({ ok: false, error: err.message || "Error intern" });
      }
    }

    // ==========================================
    // ROUTE: ALLOCATE NEXT CODE (action=allocate-code or action=get-next-code)
    // ==========================================
    if (action === 'allocate-code' || action === 'get-next-code') {
      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(500).json({ ok: false, error: "Supabase no configurat" });
      }

      const isWaitlist = Boolean(
        body.isWaitlist ?? 
        (body.estatInscripcio === 'llista_espera' || query.estatInscripcio === 'llista_espera' || body.llistaEspera)
      );
      const categoria = body.categoria || query.categoria || 'adult';
      const codeGroup = determineCodeGroup(categoria, isWaitlist);
      const excludeCode = String(body.excludeCode || query.excludeCode || '').trim();

      const { data: existingRows, error: fetchErr } = await serverSupabase
        .from('inscripciones')
        .select('codiSeguiment');

      if (fetchErr) {
        return res.status(500).json({ ok: false, error: fetchErr.message });
      }

      let codesList = (existingRows || []).map((r: any) => r.codiSeguiment).filter(Boolean);
      if (excludeCode) {
        codesList = codesList.filter((c: string) => c.toUpperCase() !== excludeCode.toUpperCase());
      }

      const nextCode = allocateNextCode(codesList, codeGroup);
      return res.status(200).json({
        ok: true,
        codiSeguiment: nextCode,
        group: codeGroup
      });
    }

    // ==========================================
    // ROUTE: GET SINGLE INSCRIPTION (action=get or action=get-by-id)
    // ==========================================
    if (action === 'get' || action === 'get-by-id') {
      const targetId = String(query.id || body.id || '').trim();
      const targetCodi = String(query.codi || body.codi || '').trim();
      const isAdminCaller = await verifyAdmin(req);

      // If queried by code without admin auth, return ONLY non-personal fields for public confirmation
      const isPublicCodeQuery = !isAdminCaller && Boolean(targetCodi);

      if (!isAdminCaller && !isPublicCodeQuery) {
        return res.status(401).json({
          ok: false,
          error: "No autoritzat: Es requereix token d'administrador vàlid.",
          code: "UNAUTHORIZED"
        });
      }

      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(500).json({
          ok: false,
          error: "Supabase no configurat al servidor",
          code: "CONFIG_MISSING"
        });
      }

      if (!targetId && !targetCodi) {
        return res.status(400).json({ ok: false, error: "ID o Codi de seguiment requerit." });
      }

      const selectedColumns = isPublicCodeQuery
        ? 'codiSeguiment, categoria, estatPagament, preuCalculat'
        : 'id, codiSeguiment, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c1Talla, c1DniUrl, c1EsMenor, c1TutorNom, c1TutorCognoms, c1TutorDni, c1TutorTelefon, c1UniformeTipus, c2Nom, c2Cognoms, c2Email, c2Telefon, c2Talla, c2DniUrl, c2EsMenor, c2TutorNom, c2TutorCognoms, c2TutorDni, c2TutorTelefon, c2UniformeTipus, respostesCuestionari, seleccionsUniforme, preuCalculat, teDomasBalco, teMocadorsExtra, pagaments, estatPagament, metodePagament, estatDni, entregaMaterial, estat_inscripcio, posicio_global, bandera, creadoEn, actualizadoEn';

      let q = serverSupabase.from('inscripciones').select(selectedColumns);
      if (targetId) {
        q = q.eq('id', targetId);
      } else {
        q = q.eq('codiSeguiment', targetCodi);
      }

      const { data, error } = await q.maybeSingle();

      if (error || !data) {
        return res.status(404).json({ ok: false, error: "Inscripció no trobada" });
      }

      return res.status(200).json({
        ok: true,
        data
      });
    }

    // ==========================================
    // ROUTE 1: LIST INSCRIPTIONS FOR SECRETARÍA (action=list or GET with no specific action)
    // ==========================================
    if (action === 'list' || (!action && req.method === 'GET')) {
      if (!await verifyAdmin(req)) {
        return res.status(401).json({
          ok: false,
          error: "No autoritzat: Es requereix token d'administrador vàlid.",
          code: "UNAUTHORIZED"
        });
      }
      const serverSupabase = getServerSupabase();
      if (!serverSupabase) {
        return res.status(500).json({
          ok: false,
          step: "secretaria_select",
          error: "Supabase no configurat al servidor",
          code: "CONFIG_MISSING"
        });
      }

      const LISTING_COLUMNS = "id, codiSeguiment, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c1Talla, c1EsMenor, c1TutorNom, c1TutorCognoms, c1TutorDni, c1TutorTelefon, c1UniformeTipus, c2Nom, c2Cognoms, c2Email, c2Telefon, c2Talla, c2EsMenor, c2TutorNom, c2TutorCognoms, c2TutorDni, c2TutorTelefon, c2UniformeTipus, respostesCuestionari, seleccionsUniforme, preuCalculat, teDomasBalco, teMocadorsExtra, pagaments, estatPagament, metodePagament, estatDni, entregaMaterial, estat_inscripcio, posicio_global, bandera, creadoEn, actualizadoEn";

      const { data, error } = await serverSupabase
        .from('inscripciones')
        .select(LISTING_COLUMNS)
        .order('creadoEn', { ascending: false })
        .order('id', { ascending: true })
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
          console.error("Error during server-side DNI storage upload:", uploadError.message);
          return res.status(500).json({
            ok: false,
            step: "upload_dni",
            error: uploadError.message,
            code: "STORAGE_UPLOAD_ERROR"
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
    // ROUTE: GENERATE SIGNED DNI URL (action=signed-dni-url or action=get-dni-url)
    // ==========================================
    if (action === 'signed-dni-url' || action === 'get-dni-url') {
      if (!await verifyAdmin(req)) {
        return res.status(401).json({
          ok: false,
          error: "No autoritzat: Es requereix token d'administrador vàlid.",
          code: "UNAUTHORIZED"
        });
      }
      try {
        const rawPath = String(body.path || query.path || '').trim();
        if (!rawPath) {
          return res.status(400).json({ ok: false, error: "Ruta de fitxer requerida." });
        }

        if (rawPath.includes('..')) {
          return res.status(400).json({ ok: false, error: "Ruta de fitxer no vàlida." });
        }

        const cleanPath = rawPath
          .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/dnis\//, '')
          .replace(/^storage:\/\/dnis\//, '')
          .replace(/^dnis\//, '');

        const serverSupabase = getServerSupabase();
        if (!serverSupabase) {
          return res.status(500).json({ ok: false, error: "Supabase no configurat al servidor." });
        }

        // Generate signed URL with 3600 seconds (1 hour) expiration
        const { data: signedData, error: signError } = await serverSupabase.storage
          .from('dnis')
          .createSignedUrl(cleanPath, 3600);

        if (signError || !signedData?.signedUrl) {
          console.warn("[SIGNED DNI URL ERROR]:", signError?.message || signError);
          return res.status(404).json({
            ok: false,
            error: signError?.message || "No s'ha pogut generar l'enllaç signat per al document DNI."
          });
        }

        return res.status(200).json({
          ok: true,
          signedUrl: signedData.signedUrl,
          expiresIn: 3600
        });
      } catch (dniErr: any) {
        console.error("Error generating signed DNI URL:", dniErr);
        return res.status(500).json({
          ok: false,
          error: dniErr?.message || "Error intern generant l'enllaç del DNI."
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

      // Authoritative official prices fetched dynamically from settings & sistema_config
      let preuAdult = 45;
      let preuJuvenil = 45;

      const serverSupabase = getServerSupabase();
      if (serverSupabase) {
        try {
          const { data: settingsRow } = await serverSupabase
            .from('settings')
            .select('value')
            .eq('key', 'tast_config_2026')
            .maybeSingle();

          let configVal = settingsRow?.value;
          if (typeof configVal === 'string') {
            try { configVal = JSON.parse(configVal); } catch {}
          }

          if (!configVal) {
            const { data: scRows } = await serverSupabase
              .from('sistema_config')
              .select('config')
              .limit(1);
            if (scRows && scRows[0]?.config) {
              configVal = scRows[0].config;
            }
          }

          if (configVal) {
            if (typeof configVal.preuAdult === 'number' && !isNaN(configVal.preuAdult)) {
              preuAdult = configVal.preuAdult;
            }
            if (typeof configVal.preuJuvenil === 'number' && !isNaN(configVal.preuJuvenil)) {
              preuJuvenil = configVal.preuJuvenil;
            }
            if (Array.isArray(configVal.tarifesDinamiques)) {
              const ad = configVal.tarifesDinamiques.find((t: any) => t.id === 'adults' || String(t.nom || '').toLowerCase().includes('adult'));
              const ju = configVal.tarifesDinamiques.find((t: any) => t.id === 'juvenils' || String(t.nom || '').toLowerCase().includes('juvenil'));
              if (ad && !isNaN(Number(ad.valor))) preuAdult = Number(ad.valor);
              if (ju && !isNaN(Number(ju.valor))) preuJuvenil = Number(ju.valor);
            }
          }
        } catch (e) {
          console.warn("Notice fetching dynamic pricing from settings/sistema_config:", e);
        }
      }

      const basePrice = categoria === 'juvenil' ? preuJuvenil : preuAdult;
      const preuTotalCalculat = basePrice;

      return res.status(200).json({
        ok: true,
        valid: true,
        categoria: categoria === 'juvenil' ? 'juvenil' : 'adult',
        preuTotalCalculat,
        desglossament: {
          base: basePrice
        }
      });
    }

    // ==========================================
    // ROUTE 4: Update Inscription (action=update)
    // ==========================================
    if (action === 'update' || req.method === 'PATCH' || req.method === 'PUT') {
      if (!await verifyAdmin(req)) {
        return res.status(401).json({
          ok: false,
          error: "No autoritzat: Es requereix token d'administrador vàlid.",
          code: "UNAUTHORIZED"
        });
      }
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

      const cleanUpdates: Record<string, any> = { ...updates };
      delete cleanUpdates.id;
      cleanUpdates.actualizadoEn = new Date().toISOString();

      // Ensure extresSeleccionats is never sent as a top-level column; merge into respostesCuestionari
      if (cleanUpdates.extresSeleccionats !== undefined || cleanUpdates.extres_seleccionats !== undefined) {
        const extVal = cleanUpdates.extresSeleccionats !== undefined ? cleanUpdates.extresSeleccionats : cleanUpdates.extres_seleccionats;
        delete cleanUpdates.extresSeleccionats;
        delete cleanUpdates.extres_seleccionats;
        const currentResp = cleanUpdates.respostesCuestionari || {};
        cleanUpdates.respostesCuestionari = {
          ...(typeof currentResp === 'object' && currentResp !== null ? currentResp : {}),
          extresSeleccionats: extVal
        };
      }

      // Sanitize non-existent top-level columns before sending to Supabase
      delete cleanUpdates.emailContactoPareja;
      delete cleanUpdates.telefonContactoPareja;
      delete cleanUpdates.c1Vol;
      delete cleanUpdates.c2Vol;
      delete cleanUpdates.clavells;
      delete cleanUpdates.corbati;
      delete cleanUpdates.extresSeleccionats;
      delete cleanUpdates.extres_seleccionats;

      // Prevent base64 images from ever being saved in DNI columns (Point 1 & 3)
      if (typeof cleanUpdates.c1DniUrl === 'string' && cleanUpdates.c1DniUrl.startsWith('data:')) {
        delete cleanUpdates.c1DniUrl;
      }
      if (typeof cleanUpdates.c2DniUrl === 'string' && cleanUpdates.c2DniUrl.startsWith('data:')) {
        delete cleanUpdates.c2DniUrl;
      }

      // Check duplicate codiSeguiment if code is being manually updated (Point 4)
      if (cleanUpdates.codiSeguiment) {
        const codeToCheck = String(cleanUpdates.codiSeguiment).trim();
        const { data: dupCheck } = await serverSupabase
          .from('inscripciones')
          .select('id')
          .ilike('codiSeguiment', codeToCheck)
          .neq('id', id)
          .maybeSingle();
        if (dupCheck) {
          return res.status(400).json({
            ok: false,
            step: "database_update",
            error: `El codi de seguiment "${codeToCheck}" ja està assignat a una altra inscripció.`,
            code: "DUPLICATE_CODE"
          });
        }
      }

      // Read previous row for history audit and merging
      const { data: previousRow } = await serverSupabase
        .from('inscripciones')
        .select(LIGHT_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      // Always merge respostesCuestionari with existing DB row - NEVER replace (Point 2)
      if (cleanUpdates.respostesCuestionari && typeof cleanUpdates.respostesCuestionari === 'object') {
        let existingResp = previousRow?.respostesCuestionari || {};
        if (typeof existingResp === 'string') {
          try { existingResp = JSON.parse(existingResp); } catch { existingResp = {}; }
        }
        cleanUpdates.respostesCuestionari = {
          ...(typeof existingResp === 'object' && existingResp !== null ? existingResp : {}),
          ...cleanUpdates.respostesCuestionari
        };
      }

      // Filter to only columns that actually exist in the table schema
      const VALID_UPDATE_COLUMNS = new Set([
        'codiSeguiment', 'categoria',
        'c1Nom', 'c1Cognoms', 'c1Email', 'c1Telefon', 'c1Talla', 'c1DniUrl', 'c1EsMenor', 'c1TutorNom', 'c1TutorCognoms', 'c1TutorDni', 'c1TutorTelefon', 'c1UniformeTipus',
        'c2Nom', 'c2Cognoms', 'c2Email', 'c2Telefon', 'c2Talla', 'c2DniUrl', 'c2EsMenor', 'c2TutorNom', 'c2TutorCognoms', 'c2TutorDni', 'c2TutorTelefon', 'c2UniformeTipus',
        'respostesCuestionari', 'seleccionsUniforme', 'preuCalculat', 'teDomasBalco', 'teMocadorsExtra',
        'pagaments', 'estatPagament', 'metodePagament', 'estatDni', 'entregaMaterial', 'estat_inscripcio', 'posicio_global', 'bandera', 'actualizadoEn'
      ]);

      const finalDbUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(cleanUpdates)) {
        if (VALID_UPDATE_COLUMNS.has(key)) {
          finalDbUpdates[key] = value;
        }
      }

      const { data, error } = await serverSupabase
        .from('inscripciones')
        .update(finalDbUpdates)
        .eq('id', id)
        .select(LIGHT_COLUMNS)
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

      cachedCategoryStatus = null;

      // Record manual edit history if fields changed
      if (previousRow) {
        try {
          const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
          const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
          const adminInfo = token ? await verifySupabaseAdminToken(token) : { valid: false };
          const modifiedBy = adminInfo.email || adminInfo.userId || 'admin';
          const historyRows: any[] = [];

          for (const [key, val] of Object.entries(finalDbUpdates)) {
            if (key === 'actualizadoEn') continue;
            const prevVal = (previousRow as any)[key];
            const prevStr = typeof prevVal === 'object' && prevVal !== null ? JSON.stringify(prevVal) : String(prevVal ?? '');
            const newStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
            if (prevStr !== newStr) {
              historyRows.push({
                inscripcion_id: id,
                codi_seguiment: cleanUpdates.codiSeguiment || previousRow.codiSeguiment || '',
                camp: key,
                valor_anterior: prevStr,
                valor_nou: newStr,
                modificat_per: modifiedBy,
                modificat_el: new Date().toISOString()
              });
            }
          }

          if (historyRows.length > 0) {
            await serverSupabase.from('inscripciones_historial').insert(historyRows);
          }
        } catch (hErr) {
          // Non-blocking: table might not exist yet before SQL execution
          console.warn("[Historial notice]: inscripciones_historial recording skipped or table not created yet:", hErr);
        }
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
      if (!await verifyAdmin(req)) {
        return res.status(401).json({
          ok: false,
          error: "No autoritzat: Es requereix token d'administrador vàlid.",
          code: "UNAUTHORIZED"
        });
      }
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

      cachedCategoryStatus = null;

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
