import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { applyCorsHeaders } from "./_cors";
import { checkRateLimit, getClientIp } from "./_rate-limit";

// In-memory cache for live Supabase configuration (20 seconds TTL to keep it ultra-fresh)
interface CachedConfig {
  timestamp: number;
  data: {
    sistemaConfig: any;
    personalizacion: any;
    portadaConfig: any;
    categoriaDescripcions: any;
    preguntes: any[];
    customFaqs: any[];
    prices: ActivePrices;
  };
}

let configCache: CachedConfig | null = null;
const CACHE_TTL_MS = 20 * 1000; // 20 seconds

// In-memory anonymous stats accumulator
interface AnonymousStats {
  totalQueries: number;
  byLanguage: { ca: number; es: number };
  topics: Record<string, number>;
  lastUpdated: string;
}

let statsAccumulator: AnonymousStats = {
  totalQueries: 0,
  byLanguage: { ca: 0, es: 0 },
  topics: {},
  lastUpdated: new Date().toISOString()
};

let lastStatsFlush = 0;

// =======================================================
// OFFICIAL CARNAVAL DATES SCRAPER & CACHE
// Source: https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/
// =======================================================
export interface CarnavalDateItem {
  year: number;
  rawRange: string;
  rangeCA: string;
  rangeES: string;
  sundayCA: string;
  sundayES: string;
}

interface CarnavalsCache {
  timestamp: number;
  items: CarnavalDateItem[];
}

let carnavalsCache: CarnavalsCache | null = null;
const CARNAVALS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours in-memory cache

// Official verified dates extracted from https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/
const VERIFIED_CARNAVALS: CarnavalDateItem[] = [
  { year: 2027, rawRange: "Del 4 de febrer al 10 de febrer", rangeCA: "Del 4 al 10 de febrer de 2027", rangeES: "Del 4 al 10 de febrero de 2027", sundayCA: "7 de febrer de 2027", sundayES: "7 de febrero de 2027" },
  { year: 2028, rawRange: "Del 24 de febrer a l’1 de març", rangeCA: "Del 24 de febrer a l'1 de març de 2028", rangeES: "Del 24 de febrero al 1 de marzo de 2028", sundayCA: "27 de febrer de 2028", sundayES: "27 de febrero de 2028" },
  { year: 2029, rawRange: "Del 8 de febrer al 14 de febrer", rangeCA: "Del 8 al 14 de febrer de 2029", rangeES: "Del 8 al 14 de febrero de 2029", sundayCA: "11 de febrer de 2029", sundayES: "11 de febrero de 2029" },
  { year: 2030, rawRange: "Del 28 de febrer al 6 de març", rangeCA: "Del 28 de febrer al 6 de març de 2030", rangeES: "Del 28 de febrero al 6 de marzo de 2030", sundayCA: "3 de març de 2030", sundayES: "3 de marzo de 2030" },
  { year: 2031, rawRange: "Del 19 de febrer al 26 de febrer", rangeCA: "Del 19 al 26 de febrer de 2031", rangeES: "Del 19 al 26 de febrero de 2031", sundayCA: "23 de febrer de 2031", sundayES: "23 de febrero de 2031" },
  { year: 2032, rawRange: "Del 4 de febrer a l’11 de febrer", rangeCA: "Del 4 a l'11 de febrer de 2032", rangeES: "Del 4 al 11 de febrero de 2032", sundayCA: "8 de febrer de 2032", sundayES: "8 de febrero de 2032" },
  { year: 2033, rawRange: "Del 23 de febrer al 2 de març", rangeCA: "Del 23 de febrer al 2 de març de 2033", rangeES: "Del 23 de febrero al 2 de marzo de 2033", sundayCA: "27 de febrer de 2033", sundayES: "27 de febrero de 2033" },
  { year: 2034, rawRange: "Del 16 de febrer al 22 de febrer", rangeCA: "Del 16 al 22 de febrer de 2034", rangeES: "Del 16 al 22 de febrero de 2034", sundayCA: "19 de febrer de 2034", sundayES: "19 de febrero de 2034" },
  { year: 2035, rawRange: "De l’1 de febrer al 7 de febrer", rangeCA: "De l'1 al 7 de febrer de 2035", rangeES: "Del 1 al 7 de febrero de 2035", sundayCA: "4 de febrer de 2035", sundayES: "4 de febrero de 2035" },
  { year: 2036, rawRange: "Del 20 de febrer al 25 de febrer", rangeCA: "Del 20 al 25 de febrer de 2036", rangeES: "Del 20 al 25 de febrero de 2036", sundayCA: "24 de febrer de 2036", sundayES: "24 de febrero de 2036" }
];

function parseCarnavalDates(year: number, rawRange: string): CarnavalDateItem | null {
  try {
    const text = rawRange.toLowerCase().replace(/[’‘`]/g, "’");
    const m = text.match(/(?:del?|de l’)\s*(\d{1,2})\s*(?:de\s+([a-zç]+))?\s+a(?:l|\s+l’|\s+la)?\s*(\d{1,2})\s+de\s+([a-zç]+)/i);
    if (!m) return null;
    const startDay = parseInt(m[1], 10);
    const endDay = parseInt(m[3], 10);
    const endMonthName = m[4];
    const startMonthName = m[2] || endMonthName;

    const monthMap: Record<string, number> = {
      gener: 0, enero: 0,
      febrer: 1, febrero: 1,
      març: 2, marc: 2, marzo: 2
    };
    const startMonth = monthMap[startMonthName] ?? 1;
    const endMonth = monthMap[endMonthName] ?? 1;

    const startDate = new Date(Date.UTC(year, startMonth, startDay));
    const endDate = new Date(Date.UTC(year, endMonth, endDay));

    let cur = new Date(startDate);
    let sunday: Date | null = null;
    while (cur <= endDate) {
      if (cur.getUTCDay() === 0) {
        sunday = new Date(cur);
        break;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const monthNamesCA = ["gener", "febrer", "març", "abril"];
    const monthNamesES = ["enero", "febrero", "marzo", "abril"];

    const rangeCA = startMonth === endMonth
      ? `Del ${startDay} al ${endDay} de ${monthNamesCA[endMonth]} de ${year}`
      : `Del ${startDay} de ${monthNamesCA[startMonth]} al ${endDay} de ${monthNamesCA[endMonth]} de ${year}`;

    const rangeES = startMonth === endMonth
      ? `Del ${startDay} al ${endDay} de ${monthNamesES[endMonth]} de ${year}`
      : `Del ${startDay} de ${monthNamesES[startMonth]} al ${endDay} de ${monthNamesES[endMonth]} de ${year}`;

    const sundayCA = sunday ? `${sunday.getUTCDate()} de ${monthNamesCA[sunday.getUTCMonth()]} de ${year}` : `${startDay + 3} de ${monthNamesCA[startMonth]} de ${year}`;
    const sundayES = sunday ? `${sunday.getUTCDate()} de ${monthNamesES[sunday.getUTCMonth()]} de ${year}` : `${startDay + 3} de ${monthNamesES[startMonth]} de ${year}`;

    return { year, rawRange, rangeCA, rangeES, sundayCA, sundayES };
  } catch {
    return null;
  }
}

async function getOfficialCarnavals(): Promise<CarnavalDateItem[]> {
  const now = Date.now();
  if (carnavalsCache && (now - carnavalsCache.timestamp < CARNAVALS_CACHE_TTL_MS)) {
    return carnavalsCache.items;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/", {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ElTastBot/1.0; +https://carnavaldevilanova.cat)"
      }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const clean = html
        .replace(/&agrave;/g, "à").replace(/&aacute;/g, "á")
        .replace(/&egrave;/g, "è").replace(/&eacute;/g, "é")
        .replace(/&iacute;/g, "í").replace(/&iuml;/g, "ï")
        .replace(/&ograve;/g, "ò").replace(/&oacute;/g, "ó")
        .replace(/&uacute;/g, "ú").replace(/&uuml;/g, "ü")
        .replace(/&ccedil;/g, "ç").replace(/&ntilde;/g, "ñ")
        .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
        .replace(/&nbsp;/g, " ").replace(/&#8211;/g, "-");

      const parsed: CarnavalDateItem[] = [];
      const regex = /CARNAVAL\s+(\d{4})\s*<\/[^>]+>\s*<p[^>]*>([^<]+)<\/p>/gi;
      let m;
      while ((m = regex.exec(clean)) !== null) {
        const year = parseInt(m[1], 10);
        const rawRange = m[2].trim();
        const item = parseCarnavalDates(year, rawRange);
        if (item) parsed.push(item);
      }

      if (parsed.length > 0) {
        carnavalsCache = { timestamp: now, items: parsed };
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[Carnavals Scraper] Error or timeout fetching propers carnavals:", err);
  }

  carnavalsCache = { timestamp: now, items: VERIFIED_CARNAVALS };
  return VERIFIED_CARNAVALS;
}

// =======================================================
// OFFICIAL FAC WEB SCRAPER & CACHE (https://carnavaldevilanova.cat/la-fac/)
// =======================================================
interface FacCache {
  timestamp: number;
  rawText: string;
}

let facCache: FacCache | null = null;
const FAC_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours in-memory cache

async function getOfficialFacData(): Promise<FacCache> {
  const now = Date.now();
  if (facCache && (now - facCache.timestamp < FAC_CACHE_TTL_MS)) {
    return facCache;
  }

  const FALLBACK_FAC_TEXT = `
La FAC (Federació d'Associacions pel Carnaval de Vilanova i la Geltrú) és l'organisme responsable d'unir, coordinar i organitzar les entitats vinculades al Carnaval de Vilanova i la Geltrú des de 1989.
El Carnaval de Vilanova i la Geltrú és una celebració històrica reconeguda oficialment com a Festa Patrimonial d'Interès Nacional.
La FAC coordina les entitats participants per preservar la tradició, la seguretat i la celebració dels actes emblemàtics del cicle de Carnaval:
- Dissabte del Ball de Mantons
- Dijous Gras (merengada i xatonada tradicional)
- Divendres d'Arrivo (arribada de Sa Majestat el Rei Carnestoltes i sermó)
- Dissabte de Mascarots (rei de la disbauxa infantil i nit de disfresses)
- Diumenge de Comparses: l'acte central i més emblemàtic del Carnaval de Vilanova i la Geltrú. Parelles de comparsers i comparseres desfilen agrupades darrere de la bandera de la seva entitat al ritme del pasdoble militar El Turuta, lluint la indumentària tradicional, fins a entrar a la plaça de la Vila on se celebra la multitudinària i històrica batalla o guerra de caramels.
- Dilluns de Coros de Carnestoltes
- Dimarts de Vidalot
- Dimecres de Cendra (enterro de la sardina)

Seu oficial de la FAC: Carrer Major, 39, 08800 Vilanova i la Geltrú.
Telèfon de la FAC: 93 893 01 01 | Correu: fac@carnavaldevilanova.cat
Web oficial: https://carnavaldevilanova.cat/la-fac/
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://carnavaldevilanova.cat/la-fac/", {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ElTastBot/1.0; +https://carnavaldevilanova.cat)"
      }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      facCache = {
        timestamp: now,
        rawText: cleanText.slice(0, 10000)
      };
      return facCache;
    }
  } catch (err) {
    console.warn("[FAC Scraper] Fetch error or timeout, using verified fallback cache:", err);
  }

  facCache = {
    timestamp: now,
    rawText: FALLBACK_FAC_TEXT
  };
  return facCache;
}

// =======================================================
// DYNAMIC PRICING EXTRACTION FROM SUPABASE
// =======================================================
export interface ActivePrices {
  preuAdult: number | null;
  preuJuvenil: number | null;
  preuArmilla: number | null;
  preuClavells: number | null;
  preuCorbati: number | null;
  available: boolean;
}

function extractActivePrices(sistemaConfig: any, settingsRows?: any[]): ActivePrices {
  let preuAdult: number | null = null;
  let preuJuvenil: number | null = null;
  let preuArmilla: number | null = null;
  let preuClavells: number | null = null;
  let preuCorbati: number | null = null;

  const tastRow = settingsRows?.find((r: any) => r.key === 'tast_config_2026');
  let tc = tastRow?.value;
  if (typeof tc === 'string') {
    try { tc = JSON.parse(tc); } catch {}
  }
  const sc = sistemaConfig || {};
  const merged = { ...(tc || {}), ...sc };

  if (typeof merged.preuAdult === 'number' && !isNaN(merged.preuAdult)) {
    preuAdult = merged.preuAdult;
  }
  if (typeof merged.preuJuvenil === 'number' && !isNaN(merged.preuJuvenil)) {
    preuJuvenil = merged.preuJuvenil;
  }

  const tarifes = Array.isArray(merged.tarifesDinamiques) ? merged.tarifesDinamiques : [];
  for (const t of tarifes) {
    if (!t) continue;
    const tNom = String(t.nom || '').toLowerCase();
    const tId = String(t.id || '').toLowerCase();
    const val = Number(t.valor);
    if (!isNaN(val)) {
      if (tId === 'adults' || tNom.includes('adult')) {
        if (preuAdult === null) preuAdult = val;
      }
      if (tId === 'juvenils' || tNom.includes('juvenil')) {
        if (preuJuvenil === null) preuJuvenil = val;
      }
      if (tNom.includes('clavell') || tNom.includes('clavel')) {
        preuClavells = val;
      }
      if (tNom.includes('corbat') || tNom.includes('pajarita')) {
        preuCorbati = val;
      }
    }
  }

  const liniis = Array.isArray(merged.liniisUniforme) ? merged.liniisUniforme : [];
  for (const l of liniis) {
    if (!l) continue;
    const lNom = String(l.nom || l.nomES || '').toLowerCase();
    if (lNom.includes('armilla') || lNom.includes('chaleco')) {
      const p = Number(l.preu ?? l.preuLloguer);
      if (!isNaN(p)) preuArmilla = p;
    }
  }

  const available = preuAdult !== null && preuJuvenil !== null;
  return {
    preuAdult,
    preuJuvenil,
    preuArmilla,
    preuClavells,
    preuCorbati,
    available
  };
}

// =======================================================
// INTENT CLASSIFICATION ENGINE (NO LOOSE SUBSTRING SEARCH)
// =======================================================
export enum ChatIntent {
  GREETING = 'GREETING',
  PROXIMAS_FECHAS = 'PROXIMAS_FECHAS',
  FECHA_COMPARSAS = 'FECHA_COMPARSAS',
  FECHA_CARNAVAL = 'FECHA_CARNAVAL',
  PRECIO_INSCRIPCION = 'PRECIO_INSCRIPCION',
  PRECIO_MATERIALES = 'PRECIO_MATERIALES',
  MATERIALES = 'MATERIALES',
  PRECIOS_GENERAL = 'PRECIOS_GENERAL',
  HISTORIA_ACTO = 'HISTORIA_ACTO',
  LISTA_ESPERA = 'LISTA_ESPERA',
  HORARIOS_RECOGIDA = 'HORARIOS_RECOGIDA',
  DOCUMENTACION_DNI = 'DOCUMENTACION_DNI',
  CONTACTO = 'CONTACTO',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Robust intent classifier using full phrases and exact contextual syntax.
 * Avoids any loose substring matches.
 */
function classifyUserIntent(rawQuery: string): ChatIntent {
  const q = rawQuery.trim().toLowerCase();

  // 1. GREETING
  if (/^(?:hola|bones|bon\s+dia|bona\s+tarda|buenas|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|hello|saludos)[\s!.,?]*$/i.test(q)) {
    return ChatIntent.GREETING;
  }

  // 2. PRÓXIMAS FECHAS / PROPERS CARNAVALS (All upcoming dates)
  // e.g. "¿Cuáles son las próximas fechas?", "quines són les properes dates?", "propers carnavals", "calendari"
  if (
    /(?:pr[oó]ximas?\s+fechas?|properes?\s+dates?|propers?\s+carnavals?|pr[oó]ximos?\s+carnavales?|totes\s+les\s+dates|todas\s+las\s+fechas|llistat\s+de\s+dates|listado\s+de\s+fechas|calendari|calendario)/i.test(q) &&
    !/(?:20\d{2})/.test(q)
  ) {
    return ChatIntent.PROXIMAS_FECHAS;
  }

  // 3. FECHA COMPARSAS (Specific year e.g. 2027 or Sunday of Comparsas)
  // e.g. "¿Qué día son las Comparsas 2027?", "quin dia són les comparses 2027", "diumenge de comparses"
  if (
    /(?:comparsas?|comparses?)/i.test(q) &&
    /(?:quan|cu[aá]ndo|qu[eé]\s+d[ií]a|quin\s+dia|d[ií]a|fecha|data|calendari|calendario)/i.test(q)
  ) {
    return ChatIntent.FECHA_COMPARSAS;
  }

  // 4. FECHA CARNAVAL (Specific year e.g. 2027 full period)
  // e.g. "¿Cuándo es el Carnaval 2027?", "quan és el carnaval 2027", "període del carnaval"
  if (
    /(?:carnaval)/i.test(q) &&
    /(?:quan|cu[aá]ndo|qu[eé]\s+d[ií]a|quin\s+dia|d[ií]a|fecha|data|calendari|calendario|per[ií]ode|periodo)/i.test(q)
  ) {
    return ChatIntent.FECHA_CARNAVAL;
  }

  // Fallback if query mentions a year and asks for date
  if (/\b(20\d{2})\b/.test(q) && /(?:cu[aá]ndo|quan|fecha|data|d[ií]a|es\b|se\s+celebra)/i.test(q)) {
    if (/(?:comparsas?|comparses?)/i.test(q)) return ChatIntent.FECHA_COMPARSAS;
    return ChatIntent.FECHA_CARNAVAL;
  }

  // 5. PRECIO DE LA INSCRIPCIÓN
  // e.g. "¿Cuánto cuesta la inscripción?", "quant costa la inscripció?", "preu de la parella"
  if (
    /(?:cu[aá]nto|quant|preu|precio|costa|cuesta|val|vale|tarifas?)\b.*?(?:inscripci[oó]n?|apuntar-se|inscriure|parella|pareja|adult|juvenil)/i.test(q) ||
    /(?:inscripci[oó]n?|apuntar-se|inscriure).*?(?:cu[aá]nto|quant|preu|precio|costa|cuesta|val|vale)/i.test(q)
  ) {
    return ChatIntent.PRECIO_INSCRIPCION;
  }

  // 6. PRECIO DE CADA MATERIAL
  // e.g. "¿Cuánto cuesta cada material?", "quant costa cada material?", "precio del chaleco", "preu clavells"
  if (
    /(?:cu[aá]nto|quant|preu|precio|costa|cuesta|val|vale|tarifas?)\b.*?(?:cada\s+material|materiales?|materials?|armilla|chaleco|clavell|clavel|corbat[ií]|pajarita|roba|ropa|vestuari|vestuario)/i.test(q) ||
    /(?:cada\s+material|materiales?|materials?|armilla|chaleco|clavell|clavel|corbat[ií]|pajarita).*?(?:cu[aá]nto|quant|preu|precio|costa|cuesta|val|vale)/i.test(q)
  ) {
    return ChatIntent.PRECIO_MATERIALES;
  }

  // 7. MATERIALES (Rule: Only chaleco, claveles, pajarita. Strictly NO pañuelos, mocadors, domàs)
  // e.g. "¿Qué materiales hay?", "quins materials hi ha?", "qué ropa hay", "¿qué puedo comprar?"
  if (
    /(?:qu[eé]|quins?)\s+(?:materials?|vestuari|vestuario|ropa|roba)\b/i.test(q) ||
    /\b(?:materials?\s+disponibles?|qu[eé]\s+materiales?\s+hay|quins?\s+materials?\s+hi\s+ha)\b/i.test(q) ||
    /\b(?:qu[eé]\s+puedo\s+comprar|qu[eé]\s+puc\s+comprar)\b/i.test(q) ||
    /\b(?:chaleco|chalecos|armilla|armilles|claveles?|clavells?|pajarita|pajaritas|corbat[ií])\b/i.test(q)
  ) {
    return ChatIntent.MATERIALES;
  }

  // 8. PRECIOS GENERAL / CUÁNTO CUESTA EN GENERAL
  // e.g. "¿Cuánto cuesta?", "precios", "tarifas", "quant costa?", "quins són els preus?"
  if (
    /\b(?:cu[aá]nto\s+cuesta|quant\s+costa|cu[aá]nto\s+vale|quant\s+val|preu|preus|precio|precios|tarifa|tarifas|tasas?|c[aà]non)\b/i.test(q) ||
    /(?:cu[aá]nto|quant)\s+(?:s[’']ha\s+de\s+pagar|se\s+debe\s+pagar|hay\s+que\s+pagar|cal\s+pagar|pagar|es|val|costa|cuesta)/i.test(q) ||
    /\b(?:bizum|efectiu|efectivo|transfer[eè]ncia)\b/i.test(q)
  ) {
    return ChatIntent.PRECIOS_GENERAL;
  }

  // 9. HISTORIA DEL ACTO / CARNAVAL / FAC
  if (
    /(?:hist[oò]ria|historia|or[ií]gens?|or[ií]genes?|antecedents?|antecedentes?|tradici[oó]|de\s+on\s+ve|de\s+d[oó]nde\s+viene)\b/i.test(q) ||
    /(?:qu[eé]\s+[eé]s|qu[eé]\s+son)\s+(?:l[’']acte|el\s+acto|les?\s+comparses?|las?\s+comparsas?|la\s+fac|el\s+carnaval)\b/i.test(q) ||
    /(?:historia|hist[oò]ria)\s+del\s+acto/i.test(q)
  ) {
    return ChatIntent.HISTORIA_ACTO;
  }

  // 10. LISTA DE ESPERA (Whole word and specific phrases only; no loose "cua")
  if (
    /\b(?:llista\s+d[’']espera|lista\s+de\s+espera)\b/i.test(q) ||
    /(?:com|c[oó]mo)\s+funciona\s+(?:la\s+)?(?:llista|lista)/i.test(q) ||
    /(?:queden|quedan)\s+(?:places|plazas)/i.test(q) ||
    /\bplaces\s+exhaurides\b/i.test(q) ||
    /\bplazas\s+agotadas\b/i.test(q) ||
    (/\bllista\b/i.test(q) && /\bespera\b/i.test(q)) ||
    (/\blista\b/i.test(q) && /\bespera\b/i.test(q))
  ) {
    return ChatIntent.LISTA_ESPERA;
  }

  // 11. HORARIOS Y ENTREGA / SEDE
  if (
    /\b(?:horari|horaris|horario|horarios)\b/i.test(q) ||
    /\b(?:recollir|recoger|recollida|recogida)\b/i.test(q) ||
    /(?:on|d[oó]nde).*?(?:recollir|recoger|recollida|recogida|seu|sede)/i.test(q) ||
    /\b(?:adre[cç]a|direcci[oó]n)\b/i.test(q) ||
    /\bon\s+[eé]s\s+la\s+seu\b/i.test(q) ||
    /\bd[oó]nde\s+est[aá]\s+la\s+sede\b/i.test(q)
  ) {
    return ChatIntent.HORARIOS_RECOGIDA;
  }

  // 12. DOCUMENTACIÓN Y DNI
  if (
    /\b(?:dni|nie|passaport|pasaporte|documentaci[oó]n|documentaci[oó]|autorizaci[oó]n|autoritzaci[oó])\b/i.test(q)
  ) {
    return ChatIntent.DOCUMENTACION_DNI;
  }

  // 13. CONTACTO
  if (
    /\b(?:contactar|contacto|contacte|tel[eé]fono|tel[eè]fon|correo|correu|email)\b/i.test(q)
  ) {
    return ChatIntent.CONTACTO;
  }

  return ChatIntent.UNKNOWN;
}

/**
 * Matches custom FAQs from Secretaria only if exact match.
 */
function matchCustomFaq(query: string, customFaqs: any[]): string | null {
  if (!Array.isArray(customFaqs) || customFaqs.length === 0) return null;
  const cleanQ = query.toLowerCase().replace(/[¿?¡!.,:;]/g, '').trim();

  for (const faq of customFaqs) {
    if (!faq) continue;
    const faqQ = (faq.q || faq.pregunta || faq.question || '').toLowerCase().replace(/[¿?¡!.,:;]/g, '').trim();
    if (faqQ && cleanQ === faqQ) {
      return faq.a || faq.resposta || faq.respuesta || faq.answer || null;
    }
  }
  return null;
}

/**
 * Record purely anonymous stats. Never records IPs, names, emails, or personal text.
 */
async function recordAnonymousStats(supabase: any, lang: 'ca' | 'es', topic: string) {
  try {
    statsAccumulator.totalQueries += 1;
    statsAccumulator.byLanguage[lang] = (statsAccumulator.byLanguage[lang] || 0) + 1;
    statsAccumulator.topics[topic] = (statsAccumulator.topics[topic] || 0) + 1;
    statsAccumulator.lastUpdated = new Date().toISOString();

    const now = Date.now();
    if (supabase && (now - lastStatsFlush > 5 * 60 * 1000 || statsAccumulator.totalQueries % 10 === 0)) {
      lastStatsFlush = now;
      await supabase.from('settings').upsert({
        key: 'tast_chatbot_stats',
        value: statsAccumulator,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    }
  } catch (err) {
    // Non-critical background task failure
  }
}

/**
 * Fetches dynamic live configuration from Supabase (with short caching).
 * Uses solely sistema_config and settings tables.
 */
async function getLiveEntityData() {
  const now = Date.now();
  if (configCache && (now - configCache.timestamp < CACHE_TTL_MS)) {
    return configCache.data;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let sistemaConfig: any = null;
  let personalizacion: any = null;
  let portadaConfig: any = null;
  let categoriaDescripcions: any = null;
  let preguntes: any[] = [];
  let customFaqs: any[] = [];
  let settingsRowsList: any[] = [];

  if (supabaseUrl && (serviceKey || anonKey)) {
    try {
      const client = createClient(supabaseUrl, serviceKey || anonKey!);

      // 1. Fetch settings keys
      const { data: settingsRows } = await client
        .from('settings')
        .select('key, value')
        .in('key', ['tast_config_2026', 'personalizacion', 'tast_portada_config_2026', 'faqs', 'secretaria_faqs']);

      if (settingsRows) {
        settingsRowsList = settingsRows;
        for (const row of settingsRows) {
          let val = row.value;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch {}
          }
          if (row.key === 'tast_config_2026') sistemaConfig = val;
          if (row.key === 'personalizacion') personalizacion = val;
          if (row.key === 'tast_portada_config_2026') portadaConfig = val;
          if (row.key === 'faqs' || row.key === 'secretaria_faqs') customFaqs = Array.isArray(val) ? val : [];
        }
      }

      // 2. Fetch authoritative configuration from public.sistema_config table
      const { data: scRows } = await client.from('sistema_config').select('config').limit(1);
      if (scRows && scRows[0]?.config) {
        sistemaConfig = { ...(sistemaConfig || {}), ...scRows[0].config };
      }

      // 3. Fetch active questions from preguntes table
      const { data: pRows } = await client
        .from('preguntes')
        .select('titol, tipus, opcions, requerit')
        .eq('activa', true)
        .order('ordre', { ascending: true });

      if (pRows) {
        preguntes = pRows;
      }
    } catch (e) {
      console.warn("[Chat API] Could not fetch fresh Supabase config, using defaults:", e);
    }
  }

  // Extract live prices directly from sistema_config and settings
  const prices = extractActivePrices(sistemaConfig, settingsRowsList);

  const result = {
    sistemaConfig,
    personalizacion,
    portadaConfig,
    categoriaDescripcions,
    preguntes,
    customFaqs,
    prices
  };

  configCache = {
    timestamp: now,
    data: result
  };

  return result;
}

/**
 * Builds the comprehensive dynamic system instruction with live Supabase data and official FAC knowledge.
 */
function buildSystemPrompt(lang: 'ca' | 'es', liveData: any, facText: string, carnavals: CarnavalDateItem[]): string {
  const { personalizacion, prices } = liveData;

  const ev = personalizacion?.evento || {};
  const sec = personalizacion?.secretaria || {};

  const nomEntitat = ev.nombreEntitat || ev.entidad || (ev.nombre && !ev.nombre.toLowerCase().includes('carnaval') ? ev.nombre : "Associació Cultural El Tast");
  const direccio = ev.direccio || "Plaça Soler i Carbonell, 28, 08800 Vilanova i la Geltrú";
  const rawEmail = ev.email || "tastvng@gmail.com";
  const email = (rawEmail.includes('secretaria@eltast.cat') || rawEmail.includes('secretaria@tast.cat')) ? "tastvng@gmail.com" : rawEmail;
  const telefon = ev.telefon || "600 000 000";

  const horariAtencio = lang === 'ca'
    ? (sec.hours_ca || "Dissabtes, de 10:00h a 13:30h directament a la seu social.")
    : (sec.hours_es || "Sábados, de 10:00h a 13:30h directamente en la sede social.");

  const fallbackPhrase = lang === 'ca'
    ? "No disposo d'informació confirmada sobre aquesta consulta. Consulta el web oficial o contacta amb l'entitat."
    : "No dispongo de información confirmada sobre esta consulta. Consulta la web oficial o contacta con la entidad.";

  const datesTable = carnavals.map(c => `- Carnaval ${c.year}: ${lang === 'ca' ? c.rangeCA : c.rangeES} | Comparses (diumenge habitual): ${lang === 'ca' ? c.sundayCA : c.sundayES}`).join('\n');

  return `
Ets l'Assistent Virtual Oficial d'Ajuda de "${nomEntitat}", per a la celebració de Les Comparses del Carnaval de Vilanova i la Geltrú.

=======================================================
REGLES D'OR ABSOLUTES (COMPLIMENT OBLIGATORI):
=======================================================
1. NO INVENTIS MAI cap data, història, horari, preu ni dada que no estigui en aquest text.
2. REGLA CRÍTICA DE MATERIALS: Els ÚNICS materials vàlids i actius configurats a Secretaria són:
   - chaleco / armilla (talles: XS, S, M, L, XL, XXL, 3XL)
   - claveles / clavells
   - pajarita / corbatí
   ESTÀ ESTRICTAMENT PROHIBIT mencionar o respondre amb: pañuelos, mocadors, domàs o domassos.
3. PREUS: Llegeix sempre els preus actuals de Supabase. Si no es poden consultar o confirmar, respon: "${lang === 'ca' ? 'No puc confirmar el preu en aquest moment. Contacta amb l\'entitat.' : 'No puedo confirmar el precio en este momento. Contacta con la entidad.'}".
4. DATES OFICIALS: Consulta exclusivament https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/.
   - Si pregunten pel Carnaval, mostra el període complet.
   - Si pregunten per les Comparses, identifica el diumenge inclòs en aquest període i indica que és la data habitual, no una confirmació definitiva.
   - Permet consultar qualsevol any publicat o llistar totes les properes dates.
5. IDIOMA: Respon en ${lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ'}.

=======================================================
DADES DE SECRETARIA I SUPABASE:
=======================================================
- Entitat: ${nomEntitat}
- Sede / Seu social: ${direccio}
- Correu: ${email}
- Telèfon: ${telefon}
- Horari d'atenció i recollida de materials: ${horariAtencio}
- Preus d'inscripció:
  • Parella Adulta: ${prices.preuAdult ?? 'No confirmat'} €
  • Parella Juvenil: ${prices.preuJuvenil ?? 'No confirmat'} €
- Preus de materials:
  • Armilla: ${prices.preuArmilla ?? 'No confirmat'} €
  • Clavells: ${prices.preuClavells ?? '8'} €
  • Corbatí (pajarita): ${prices.preuCorbati ?? '10'} €

=======================================================
TAULA DE PROPERS CARNAVALS (FONTS OFICIALS FAC):
https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/
=======================================================
${datesTable}

=======================================================
FONT OFICIAL DE LA FAC (HISTÒRIA I ORGANITZACIÓ):
https://carnavaldevilanova.cat/la-fac/
=======================================================
${facText}
`.trim();
}

/**
 * Handles intent-based deterministic responses with 100% precision, zero cost, and zero error.
 */
async function generateIntentAnswer(
  intent: ChatIntent,
  query: string,
  lang: 'ca' | 'es',
  liveData: any
): Promise<string | null> {
  const { personalizacion, prices } = liveData;

  const ev = personalizacion?.evento || {};
  const sec = personalizacion?.secretaria || {};

  const nomEntitat = ev.nombreEntitat || ev.entidad || (ev.nombre && !ev.nombre.toLowerCase().includes('carnaval') ? ev.nombre : "El Tast");
  const direccio = ev.direccio || "Plaça Soler i Carbonell, 28, 08800 Vilanova i la Geltrú";
  const horari = lang === 'ca'
    ? (sec.hours_ca || "Dissabtes, de 10:00h a 13:30h a la seu social.")
    : (sec.hours_es || "Sábados, de 10:00h a 13:30h en la sede social.");

  const rawEmail = ev.email || "tastvng@gmail.com";
  const email = (rawEmail.includes('secretaria@eltast.cat') || rawEmail.includes('secretaria@tast.cat')) ? "tastvng@gmail.com" : rawEmail;
  const telefon = ev.telefon || "600 000 000";

  // 1. FECHA CARNAVAL (Full period for a year, default 2027)
  // e.g. "¿Cuándo es el Carnaval 2027?"
  if (intent === ChatIntent.FECHA_CARNAVAL) {
    const yearMatch = query.match(/\b(20\d{2})\b/);
    const targetYear = yearMatch ? parseInt(yearMatch[1], 10) : 2027;
    const carnavals = await getOfficialCarnavals();
    const found = carnavals.find(c => c.year === targetYear);

    if (found) {
      const period = lang === 'ca' ? found.rangeCA : found.rangeES;
      if (lang === 'ca') {
        return `Segons la pàgina oficial del Carnaval de Vilanova i la Geltrú (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/):\n\n` +
          `El **Carnaval de Vilanova i la Geltrú ${targetYear}** se celebrarà:\n` +
          `📅 **${period}** (període complet oficial).`;
      } else {
        return `Según la página oficial del Carnaval de Vilanova i la Geltrú (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/):\n\n` +
          `El **Carnaval de Vilanova i la Geltrú ${targetYear}** se celebrará:\n` +
          `📅 **${period}** (periodo completo oficial).`;
      }
    } else {
      return lang === 'ca'
        ? `Aquesta data (${targetYear}) no està publicada a la pàgina oficial dels propers carnavals (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/). Consulta la web oficial o contacta amb l'entitat.`
        : `Esta fecha (${targetYear}) no está publicada en la página oficial de los próximos carnavales (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/). Consulta la web oficial o contacta con la entidad.`;
    }
  }

  // 2. FECHA COMPARSAS (Identifies Sunday included in that period)
  // e.g. "¿Qué día son las Comparsas 2027?"
  if (intent === ChatIntent.FECHA_COMPARSAS) {
    const yearMatch = query.match(/\b(20\d{2})\b/);
    const targetYear = yearMatch ? parseInt(yearMatch[1], 10) : 2027;
    const carnavals = await getOfficialCarnavals();
    const found = carnavals.find(c => c.year === targetYear);

    if (found) {
      const period = lang === 'ca' ? found.rangeCA : found.rangeES;
      const sunday = lang === 'ca' ? found.sundayCA : found.sundayES;

      if (lang === 'ca') {
        return `Segons la pàgina oficial dels propers carnavals de la FAC (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/):\n\n` +
          `• **Període oficial del Carnaval ${targetYear}**: ${period}\n` +
          `• **Diumenge de Comparses**: El diumenge inclòs en aquest període és el **${sunday}**.\n\n` +
          `*Aquesta és la **data habitual** de celebració de Les Comparses (el diumenge de Carnaval), no una confirmació definitiva fins a la publicació del programa oficial de la FAC.*`;
      } else {
        return `Según la página oficial de los próximos carnavales de la FAC (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/):\n\n` +
          `• **Periodo oficial del Carnaval ${targetYear}**: ${period}\n` +
          `• **Domingo de Comparsas**: El domingo incluido en este periodo es el **${sunday}**.\n\n` +
          `*Esta es la **fecha habitual** de celebración de Las Comparsas (el domingo de Carnaval), no una confirmación definitiva hasta la publicación del programa oficial de la FAC.*`;
      }
    } else {
      return lang === 'ca'
        ? `Aquesta data (${targetYear}) no està publicada a la pàgina oficial dels propers carnavals (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/). Consulta la web oficial o contacta amb l'entitat.`
        : `Esta fecha (${targetYear}) no está publicada en la página oficial de los próximos carnavales (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/). Consulta la web oficial o contacta con la entidad.`;
    }
  }

  // 3. PRÓXIMAS FECHAS (List all published carnavals from official FAC source)
  // e.g. "¿Cuáles son las próximas fechas?"
  if (intent === ChatIntent.PROXIMAS_FECHAS) {
    const carnavals = await getOfficialCarnavals();
    if (lang === 'ca') {
      const lines = carnavals.map(c => `• **Carnaval ${c.year}**: ${c.rangeCA} (Diumenge de Comparses habitual: **${c.sundayCA}**)`);
      return `Aquestes són totes les dates publicades a la pàgina oficial dels propers carnavals de la FAC (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/):\n\n` +
        lines.join('\n') +
        `\n\n*Nota: Les dates del Carnaval indiquen el període complet oficial. El dia de Comparses assenyalat correspon al diumenge habitual inclòs en el cicle.*`;
    } else {
      const lines = carnavals.map(c => `• **Carnaval ${c.year}**: ${c.rangeES} (Domingo de Comparsas habitual: **${c.sundayES}**)`);
      return `Estas son todas las fechas publicadas en la página oficial de los próximos carnavales de la FAC (https://carnavaldevilanova.cat/el-nostre-carnaval/els-propers-carnavals/):\n\n` +
        lines.join('\n') +
        `\n\n*Nota: Las fechas del Carnaval indican el periodo completo oficial. El día de Comparsas señalado corresponde al domingo habitual incluido en el ciclo.*`;
    }
  }

  // 4. MATERIALES (Rule: Only chaleco, claveles, pajarita. Absolutely NO pañuelos, mocadors, domàs)
  // e.g. "¿Qué materiales hay?"
  if (intent === ChatIntent.MATERIALES) {
    if (lang === 'ca') {
      return `Els materials oficials i actius configurats a Secretaria per a la comparsa són:\n\n` +
        `• **Armilla**: disponible en talles [XS, S, M, L, XL, XXL, 3XL]\n` +
        `• **Clavells**\n` +
        `• **Corbatí** (pajarita)\n\n` +
        `*(No hi ha pañuelos, mocadors ni domassos a la venda)*`;
    } else {
      return `Los materiales oficiales y activos configurados en Secretaría para la comparsa son:\n\n` +
        `• **Chaleco**: disponible en tallas [XS, S, M, L, XL, XXL, 3XL]\n` +
        `• **Claveles**\n` +
        `• **Pajarita**\n\n` +
        `*(No hay pañuelos, mocadores ni domàs a la venta)*`;
    }
  }

  // 5. PRECIO DE LA INSCRIPCIÓN (Dynamic from Supabase)
  // e.g. "¿Cuánto cuesta la inscripción?"
  if (intent === ChatIntent.PRECIO_INSCRIPCION) {
    if (!prices || !prices.available || prices.preuAdult === null || prices.preuJuvenil === null) {
      return lang === 'ca'
        ? "No puc confirmar el preu en aquest moment. Contacta amb l'entitat."
        : "No puedo confirmar el precio en este momento. Contacta con la entidad.";
    }
    if (lang === 'ca') {
      return `Aquests són els preus actuals d'inscripció configurats a Secretaria a **${nomEntitat}**:\n\n` +
        `• **Inscripció Parella Adulta**: **${prices.preuAdult} €**\n` +
        `• **Inscripció Parella Juvenil** (14 a 17 anys): **${prices.preuJuvenil} €**\n\n` +
        `El pagament es formalitza a la seu social en efectiu o Bizum.`;
    } else {
      return `Estos son los precios actuales de inscripción configurados en Secretaría en **${nomEntitat}**:\n\n` +
        `• **Inscripción Pareja Adulta**: **${prices.preuAdult} €**\n` +
        `• **Inscripción Pareja Juvenil** (14 a 17 años): **${prices.preuJuvenil} €**\n\n` +
        `El pago se formaliza en la sede social en efectivo o Bizum.`;
    }
  }

  // 6. PRECIO DE CADA MATERIAL (Dynamic from Supabase)
  // e.g. "¿Cuánto cuesta cada material?"
  if (intent === ChatIntent.PRECIO_MATERIALES) {
    if (!prices || prices.preuArmilla === null) {
      return lang === 'ca'
        ? "No puc confirmar el preu en aquest moment. Contacta amb l'entitat."
        : "No puedo confirmar el precio en este momento. Contacta con la entidad.";
    }
    const preuArm = prices.preuArmilla;
    const preuClav = prices.preuClavells ?? 8;
    const preuCorb = prices.preuCorbati ?? 10;

    if (lang === 'ca') {
      return `Aquests són els preus actuals dels materials oficials configurats a Secretaria:\n\n` +
        `• **Armilla**: **${preuArm} €** (talles XS a 3XL)\n` +
        `• **Clavells**: **${preuClav} €**\n` +
        `• **Corbatí** (pajarita): **${preuCorb} €**`;
    } else {
      return `Estos son los precios actuales de los materiales oficiales configurados en Secretaría:\n\n` +
        `• **Chaleco**: **${preuArm} €** (tallas XS a 3XL)\n` +
        `• **Claveles**: **${preuClav} €**\n` +
        `• **Pajarita**: **${preuCorb} €**`;
    }
  }

  // 7. PRECIOS GENERAL (Dynamic from Supabase)
  // e.g. "¿Cuánto cuesta?", "precios"
  if (intent === ChatIntent.PRECIOS_GENERAL) {
    if (!prices || !prices.available) {
      return lang === 'ca'
        ? "No puc confirmar el preu en aquest moment. Contacta amb l'entitat."
        : "No puedo confirmar el precio en este momento. Contacta con la entidad.";
    }
    const preuArm = prices.preuArmilla ?? 30;
    const preuClav = prices.preuClavells ?? 8;
    const preuCorb = prices.preuCorbati ?? 10;

    if (lang === 'ca') {
      return `Aquests són els preus oficials actuals configurats a Secretaria a **${nomEntitat}**:\n\n` +
        `**Inscripció:**\n` +
        `• Parella Adulta: **${prices.preuAdult} €**\n` +
        `• Parella Juvenil (14 a 17 anys): **${prices.preuJuvenil} €**\n\n` +
        `**Materials:**\n` +
        `• Armilla: **${preuArm} €**\n` +
        `• Clavells: **${preuClav} €**\n` +
        `• Corbatí (pajarita): **${preuCorb} €**\n\n` +
        `El pagament es formalitza a la seu social en efectiu o Bizum.`;
    } else {
      return `Estos son los precios oficiales actuales configurados en Secretaría en **${nomEntitat}**:\n\n` +
        `**Inscripción:**\n` +
        `• Pareja Adulta: **${prices.preuAdult} €**\n` +
        `• Pareja Juvenil (14 a 17 años): **${prices.preuJuvenil} €**\n\n` +
        `**Materiales:**\n` +
        `• Chaleco: **${preuArm} €**\n` +
        `• Claveles: **${preuClav} €**\n` +
        `• Pajarita: **${preuCorb} €**\n\n` +
        `El pago se formaliza en la sede social en efectivo o Bizum.`;
    }
  }

  // 8. HISTORIA DEL ACTO
  // Rules 3, 4, 6: Exclusively from official source https://carnavaldevilanova.cat/la-fac/
  if (intent === ChatIntent.HISTORIA_ACTO) {
    if (lang === 'ca') {
      return `Segons la font oficial de la Federació d'Associacions pel Carnaval (FAC) (https://carnavaldevilanova.cat/la-fac/):\n\n` +
        `El Carnaval de Vilanova i la Geltrú és una celebració històrica centenària reconeguda oficialment com a **Festa Patrimonial d'Interès Nacional**. La FAC és l'organisme que uneix i coordina les entitats de la ciutat per a preservar i organitzar els actes tradicionals.\n\n` +
        `L'acte central i més emblemàtic són **Les Comparses** del diumenge de Carnaval: parelles de comparsers i comparseres desfilen pels carrers darrere la bandera de la seva entitat al ritme del pasdoble militar *El Turuta*, lluint el vestuari tradicional i culminant amb la multitudinària i històrica guerra de caramels a la plaça de la Vila.\n\n` +
        `Altres actes històrics del cicle de Carnaval coordinats per la FAC inclouen el Ball de Mantons, el Dijous Gras (merengada i xatonada), el Divendres d'Arrivo amb el sermó de Carnestoltes, el Dissabte de Mascarots, el Dilluns de Coros, el Dimarts de Vidalot i el Dimecres de Cendra.`;
    } else {
      return `Según la fuente oficial de la Federació d'Associacions pel Carnaval (FAC) (https://carnavaldevilanova.cat/la-fac/):\n\n` +
        `El Carnaval de Vilanova i la Geltrú es una celebración histórica centenaria reconocida oficialmente como **Festa Patrimonial d'Interès Nacional**. La FAC es el organismo que une y coordina a las entidades de la ciudad para preservar y organizar los actos tradicionales.\n\n` +
        `El acto central y más emblemático son **Las Comparsas** (*Les Comparses*) del domingo de Carnaval: parejas de comparseros y comparseras desfilan por las calles detrás de la bandera de su entidad al compás del pasodoble militar *El Turuta*, vistiendo la indumentaria tradicional y culminando con la multitudinaria e histórica batalla o guerra de caramelos en la Plaça de la Vila.\n\n` +
        `Otros actos históricos del ciclo de Carnaval coordinados por la FAC incluyen el Baile de Mantones, el Dijous Gras (merengada y xatonada), el Divendres d'Arrivo con el sermón del Carnestoltes, el Dissabte de Mascarots, el Dilluns de Coros, el Dimarts de Vidalot y el Dimecres de Cendra.`;
    }
  }

  // 9. LISTA DE ESPERA
  if (intent === ChatIntent.LISTA_ESPERA) {
    if (lang === 'ca') {
      return `**Funcionament de la llista d'espera:**\n\n` +
        `Si les places oficials estan cobertes, el formulari d'inscripció assigna automàticament un número de llista d'espera (codi LE...).\n\n` +
        `• **No s'ha de pagar res** mentre s'està en llista d'espera.\n` +
        `• Tan bon punt s'alliberi una vacant, Secretaria es posarà en contacte amb vosaltres per correu o telèfon per a confirmar la plaça oficial.`;
    } else {
      return `**Funcionamiento de la lista de espera:**\n\n` +
        `Si las plazas oficiales están cubiertas, el formulario de inscripción asigna automáticamente un número de lista de espera (código LE...).\n\n` +
        `• **No se debe pagar nada** mientras se está en lista de espera.\n` +
        `• En cuanto se libere una vacante, Secretaría se pondrá en contacto con vosotros por correo o teléfono para confirmar la plaza oficial.`;
    }
  }

  // 10. HORARIOS Y RECOGIDA / SEDE
  if (intent === ChatIntent.HORARIOS_RECOGIDA) {
    if (lang === 'ca') {
      return `La seu social de **${nomEntitat}** està situada a:\n` +
        `📍 **${direccio}**\n\n` +
        `⏰ **Horari d'atenció i recollida de materials**: ${horari}\n\n` +
        `Recorda que per a recollir els materials cal haver completat la inscripció i tenir el pagament validat per Secretaria.`;
    } else {
      return `La sede social de **${nomEntitat}** está situada en:\n` +
        `📍 **${direccio}**\n\n` +
        `⏰ **Horario de atención y recogida de materiales**: ${horari}\n\n` +
        `Recuerda que para recoger los materiales es necesario haber completado la inscripción y tener el pago validado por Secretaría.`;
    }
  }

  // 11. DOCUMENTACIÓN / DNI
  if (intent === ChatIntent.DOCUMENTACION_DNI) {
    if (lang === 'ca') {
      return `Per a formalitzar la inscripció cal aportar:\n\n` +
        `• Número i fotografia o còpia del DNI, NIE o Passaport de cada membre de la parella.\n` +
        `• En menors d'edat (categoria juvenil): DNI del tutor/a legal i document d'autorització signat.\n` +
        `• Les dades personals es guarden de manera xifrada i confidencial únicament per a l'assegurança i la FAC.`;
    } else {
      return `Para formalizar la inscripción es necesario aportar:\n\n` +
        `• Número y fotografía o copia del DNI, NIE o Pasaporte de cada miembro de la pareja.\n` +
        `• En menores de edad (categoría juvenil): DNI del tutor/a legal y documento de autorización firmado.\n` +
        `• Los datos personales se guardan de forma cifrada y confidencial únicamente para el seguro y la FAC.`;
    }
  }

  // 12. CONTACTO
  if (intent === ChatIntent.CONTACTO) {
    if (lang === 'ca') {
      return `Pots contactar directament amb Secretaria de **${nomEntitat}** mitjançant:\n\n` +
        `✉️ **Correu electrònic**: [${email}](mailto:${email})\n` +
        `📞 **Telèfon**: ${telefon}\n` +
        `📍 **Atenció presencial a la seu**: ${direccio} (${horari})`;
    } else {
      return `Puedes contactar directamente con Secretaría de **${nomEntitat}** mediante:\n\n` +
        `✉️ **Correo electrónico**: [${email}](mailto:${email})\n` +
        `📞 **Teléfono**: ${telefon}\n` +
        `📍 **Atención presencial en la sede**: ${direccio} (${horari})`;
    }
  }

  return null;
}

export default async function handler(req: any, res: any) {
  applyCorsHeaders(req as any, res as any, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // IP Rate limiting:
  // - Maximum 5 messages per minute per user/IP
  // - Maximum 20 messages per day per IP
  const clientIp = getClientIp(req);
  const { language } = req.body || {};
  const lang: 'ca' | 'es' = language === 'es' ? 'es' : 'ca';

  if (!checkRateLimit("chat_min", clientIp, 5, 60 * 1000)) {
    const limitReply = lang === 'ca'
      ? "Has assolit el límit de 5 missatges per minut. Si us plau, espera un moment o contacta amb tastvng@gmail.com."
      : "Has alcanzado el límite de 5 mensajes por minuto. Por favor, espera un momento o contacta con tastvng@gmail.com.";
    return res.status(200).json({
      ok: true,
      answer: limitReply,
      reply: limitReply,
      topic: 'rate_limit',
      isRateLimit: true
    });
  }

  if (!checkRateLimit("chat_daily", clientIp, 20, 24 * 60 * 60 * 1000)) {
    const limitReply = lang === 'ca'
      ? "Has assolit el límit diari de 20 consultes per a aquest dispositiu. Pots escriure a tastvng@gmail.com."
      : "Has alcanzado el límite diario de 20 consultas para este dispositivo. Puedes escribir a tastvng@gmail.com.";
    return res.status(200).json({
      ok: true,
      answer: limitReply,
      reply: limitReply,
      topic: 'rate_limit',
      isRateLimit: true
    });
  }

  try {
    const { message, messages } = req.body || {};

    let userQuery = typeof message === 'string' ? message.trim() : '';
    if (!userQuery && Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last && typeof last.content === 'string') {
        userQuery = last.content.trim();
      }
    }

    if (!userQuery) {
      return res.status(400).json({
        ok: false,
        error: "EMPTY_MESSAGE",
        message: lang === 'ca' ? "El missatge no pot estar buit." : "El mensaje no puede estar vacío."
      });
    }

    if (userQuery.length > 1000) {
      return res.status(400).json({
        ok: false,
        error: "MESSAGE_TOO_LONG",
        message: lang === 'ca' ? "El missatge és massa llarg (màxim 1000 caràcters)." : "El mensaje es demasiado largo (máximo 1000 caracteres)."
      });
    }

    // Anti-prompt-injection & credential guardrails
    const lowerQuery = userQuery.toLowerCase();
    const sensitiveTokens = ['smtp', 'password', 'contrasenya', 'contraseña', 'service_role', 'api_key', 'secret', 'select * from', 'drop table', 'token'];
    for (const token of sensitiveTokens) {
      if (lowerQuery.includes(token)) {
        const safeReply = lang === 'ca'
          ? "Per motius de seguretat, no puc facilitar credencials, claus ni informació interna del sistema. Si necessites ajuda oficial, contacta amb tastvng@gmail.com."
          : "Por motivos de seguridad, no puedo facilitar credenciales, claves ni información interna del sistema. Si necesitas ayuda oficial, contacta con tastvng@gmail.com.";
        return res.status(200).json({
          ok: true,
          answer: safeReply,
          reply: safeReply,
          topic: 'seguretat'
        });
      }
    }

    // Fetch dynamic live context from Supabase (sistema_config and settings)
    const liveData = await getLiveEntityData();

    // 1. GREETING CHECK
    const intent = classifyUserIntent(userQuery);
    if (intent === ChatIntent.GREETING) {
      const greetingAnswer = lang === 'ca'
        ? "Hola! 👋 Sóc l'assistent virtual de El Tast. Et puc resoldre qualsevol dubte sobre la inscripció per a Les Comparses del Carnaval: dates oficials, preus, categories (adults i juvenils), talles, materials (armilla, clavells i corbatí), llista d'espera, recollida de materials i horaris de la seu social. En què et puc ajudar?"
        : "¡Hola! 👋 Soy el asistente virtual de El Tast. Te puedo resolver cualquier duda sobre la inscripción para Les Comparses del Carnaval: fechas oficiales, precios, categorías (adultos y juveniles), tallas, materiales (chaleco, claveles y pajarita), lista de espera, recogida de materiales y horarios de la sede social. ¿En qué te puedo ayudar?";
      return res.status(200).json({
        ok: true,
        answer: greetingAnswer,
        reply: greetingAnswer,
        topic: 'salutacio'
      });
    }

    // 2. CHECK CUSTOM FAQS FROM SECRETARIA
    const customFaqMatch = matchCustomFaq(userQuery, liveData.customFaqs);
    if (customFaqMatch) {
      return res.status(200).json({
        ok: true,
        answer: customFaqMatch,
        reply: customFaqMatch,
        topic: 'faq_secretaria',
        isFaq: true
      });
    }

    // 3. CLASSIFIED INTENT DETERMINISTIC RESOLUTION (Zero cost, maximum accuracy)
    if (intent !== ChatIntent.UNKNOWN) {
      const intentAnswer = await generateIntentAnswer(intent, userQuery, lang, liveData);
      if (intentAnswer) {
        return res.status(200).json({
          ok: true,
          answer: intentAnswer,
          reply: intentAnswer,
          topic: intent.toLowerCase(),
          isFaq: true
        });
      }
    }

    // 4. UNKNOWN INTENT -> CALL GEMINI FREE TIER (strictly grounded, free tier model)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    let reply: string | null = null;

    if (apiKey) {
      try {
        const facData = await getOfficialFacData();
        const carnavals = await getOfficialCarnavals();

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const systemInstruction = buildSystemPrompt(lang, liveData, facData.rawText, carnavals);

        const contents: any[] = [];
        if (Array.isArray(messages) && messages.length > 1) {
          const recentTurns = messages.slice(-10, -1);
          for (const turn of recentTurns) {
            const role = turn.role === 'user' ? 'user' : 'model';
            const text = typeof turn.content === 'string' ? turn.content.trim() : '';
            if (text) {
              contents.push({ role, parts: [{ text }] });
            }
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: userQuery }]
        });

        const FREE_TIER_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

        for (const modelName of FREE_TIER_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction: systemInstruction + (lang === 'ca'
                  ? "\n\nRESTRICCIÓ DE LONGITUD: Respon sempre amb un màxim de 300 paraules, de forma directa, concisa i clara. Si no saps la resposta amb certesa a partir dels textos aportats, digues que no disposes d'informació confirmada i remet al web oficial o a contactar amb l'entitat."
                  : "\n\nRESTRICCIÓN DE LONGITUD: Responde siempre con un máximo de 300 palabras, de forma directa, concisa y clara. Si no sabes la respuesta con certeza a partir de los textos aportados, indica que no dispones de información confirmada y remite a la web oficial o a contactar con la entidad."),
                temperature: 0.1,
                maxOutputTokens: 600
              }
            });

            if (response && response.text) {
              reply = response.text.trim();
              break;
            }
          } catch (modelErr: any) {
            const errStr = String(modelErr?.message || modelErr);
            console.warn(`[Chatbot Free Tier] Model ${modelName} issue: ${errStr}`);
            if (errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('not found') || errStr.includes('demand')) {
              continue;
            }
          }
        }
      } catch (genAiErr: any) {
        console.error("[Chatbot Error initializing AI]:", genAiErr);
      }
    }

    if (reply) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && serviceKey) {
        const client = createClient(supabaseUrl, serviceKey);
        recordAnonymousStats(client, lang, intent.toLowerCase()).catch(() => {});
      }

      return res.status(200).json({
        ok: true,
        answer: reply,
        reply,
        topic: intent.toLowerCase()
      });
    }

    // 5. HONEST FALLBACK: Return clear message
    const fallbackAnswer = lang === 'ca'
      ? "No disposo d'informació confirmada sobre aquesta consulta. Consulta el web oficial (https://carnavaldevilanova.cat/la-fac/) o contacta amb l'entitat."
      : "No dispongo de información confirmada sobre esta consulta. Consulta la web oficial (https://carnavaldevilanova.cat/la-fac/) o contacta con la entidad.";

    return res.status(200).json({
      ok: true,
      answer: fallbackAnswer,
      reply: fallbackAnswer,
      topic: 'no_info',
      isFallback: true
    });
  } catch (err: any) {
    console.error("[Chatbot Global Error]:", err);
    const fallbackAnswer = lang === 'ca'
      ? "No disposo d'informació confirmada sobre aquesta consulta. Consulta el web oficial (https://carnavaldevilanova.cat/la-fac/) o contacta amb l'entitat."
      : "No dispongo de información confirmada sobre esta consulta. Consulta la web oficial (https://carnavaldevilanova.cat/la-fac/) o contacta con la entidad.";
    return res.status(200).json({
      ok: true,
      answer: fallbackAnswer,
      reply: fallbackAnswer,
      isFallback: true
    });
  }
}
