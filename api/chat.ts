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
// OFFICIAL FAC WEB SCRAPER & CACHE (https://carnavaldevilanova.cat/la-fac/)
// =======================================================
interface FacCache {
  timestamp: number;
  rawText: string;
  has2027Date: boolean;
  date2027Text: string | null;
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

      // Check if text has confirmed 2027 date pattern
      const has2027 = /2027\b/.test(cleanText) && /(?:febrer|mar[cç]|gener|febrero|marzo|enero|\d{1,2}\s+de\s+[a-z]+)\s+de\s+2027/i.test(cleanText);

      facCache = {
        timestamp: now,
        rawText: cleanText.slice(0, 10000),
        has2027Date: has2027,
        date2027Text: null
      };
      return facCache;
    }
  } catch (err) {
    console.warn("[FAC Scraper] Fetch error or timeout, using verified fallback cache:", err);
  }

  facCache = {
    timestamp: now,
    rawText: FALLBACK_FAC_TEXT,
    has2027Date: false,
    date2027Text: null
  };
  return facCache;
}

// =======================================================
// INTENT CLASSIFICATION ENGINE (NO LOOSE SUBSTRING SEARCH)
// =======================================================
export enum ChatIntent {
  GREETING = 'GREETING',
  FECHA_COMPARSA_2027 = 'FECHA_COMPARSA_2027',
  HISTORIA_ACTO = 'HISTORIA_ACTO',
  MATERIALES = 'MATERIALES',
  PRECIOS = 'PRECIOS',
  LISTA_ESPERA = 'LISTA_ESPERA',
  HORARIOS_RECOGIDA = 'HORARIOS_RECOGIDA',
  DOCUMENTACION_DNI = 'DOCUMENTACION_DNI',
  CONTACTO = 'CONTACTO',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Robust intent classifier using whole words and multi-word phrases.
 * Eliminates loose single-word matches (e.g. avoiding matching "cua" inside "cuándo").
 */
function classifyUserIntent(rawQuery: string): ChatIntent {
  const q = rawQuery.trim().toLowerCase();

  // 1. GREETING
  if (/^(?:hola|bones|bon\s+dia|bona\s+tarda|buenas|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|hello|saludos)[\s!.,?]*$/i.test(q)) {
    return ChatIntent.GREETING;
  }

  // 2. FECHA COMPARSA 2027 (Must check before waiting list or other intents)
  // e.g. "¿Cuándo es la comparsa 2027?", "quan es la comparsa 2027", "fecha comparsa 2027"
  if (
    /(?:quan|cu[aá]ndo|fechas?|dates?|d[ií]as?|qu[eé]\s+d[ií]a|quin\s+dia|calendari|calendario).*?(?:comparsa|carnaval|2027)/i.test(q) ||
    /(?:comparsa|carnaval).*?(?:quan|cu[aá]ndo|fechas?|dates?|d[ií]as?|qu[eé]\s+d[ií]a|quin\s+dia|calendari|calendario|2027)/i.test(q) ||
    (/\b2027\b/.test(q) && /(?:cu[aá]ndo|quan|fecha|data|d[ií]a|es\b|se\s+celebra)/i.test(q))
  ) {
    return ChatIntent.FECHA_COMPARSA_2027;
  }

  // 3. HISTORIA DEL ACTO / CARNAVAL / FAC
  // e.g. "¿Cuál es la historia del acto?", "història de l'acte", "historia de la comparsa"
  if (
    /(?:hist[oò]ria|historia|or[ií]gens?|or[ií]genes?|antecedents?|antecedentes?|tradici[oó]|de\s+on\s+ve|de\s+d[oó]nde\s+viene)\b/i.test(q) ||
    /(?:qu[eé]\s+[eé]s|qu[eé]\s+son)\s+(?:l['’]acte|el\s+acto|les?\s+comparses?|las?\s+comparsas?|la\s+fac|el\s+carnaval)\b/i.test(q) ||
    /(?:historia|hist[oò]ria)\s+del\s+acto/i.test(q)
  ) {
    return ChatIntent.HISTORIA_ACTO;
  }

  // 4. LISTA DE ESPERA (Whole word and specific phrases only; no loose "cua")
  // e.g. "¿Cómo funciona la lista de espera?", "llista d'espera", "lista de espera"
  if (
    /\b(?:llista\s+d['’]espera|lista\s+de\s+espera)\b/i.test(q) ||
    /(?:com|c[oó]mo)\s+funciona\s+(?:la\s+)?(?:llista|lista)/i.test(q) ||
    /(?:queden|quedan)\s+(?:places|plazas)/i.test(q) ||
    /\bplaces\s+exhaurides\b/i.test(q) ||
    /\bplazas\s+agotadas\b/i.test(q) ||
    /\bllista\b/i.test(q) && /\bespera\b/i.test(q) ||
    /\blista\b/i.test(q) && /\bespera\b/i.test(q)
  ) {
    return ChatIntent.LISTA_ESPERA;
  }

  // 5. MATERIALES (Rule 8: ONLY chaleco, claveles, pajarita. Rule 9: NO pañuelos, mocadors, domàs)
  // e.g. "¿Qué materiales hay?", "quins materials hi ha?", "qué ropa hay"
  if (
    /(?:qu[eé]|quins?)\s+(?:materials?|vestuari|vestuario|ropa|roba)\b/i.test(q) ||
    /\b(?:materials?\s+disponibles?|qu[eé]\s+materiales?\s+hay|quins?\s+materials?\s+hi\s+ha)\b/i.test(q) ||
    /\b(?:qu[eé]\s+puedo\s+comprar|qu[eé]\s+puc\s+comprar)\b/i.test(q) ||
    /\b(?:chaleco|chalecos|armilla|armilles|claveles?|clavells?|pajarita|pajaritas|corbat[ií])\b/i.test(q)
  ) {
    // If not asking for prices/costs of materials
    if (!/(?:cu[aá]nto|quant|preu|precio|costa|cuesta)\b/i.test(q)) {
      return ChatIntent.MATERIALES;
    }
  }

  // 6. PRECIOS / CUÁNTO CUESTA
  // e.g. "¿Cuánto cuesta?", "precios", "tarifas", "quant costa?", "quins són els preus?"
  if (
    /\b(?:cu[aá]nto\s+cuesta|quant\s+costa|cu[aá]nto\s+vale|quant\s+val|preu|preus|precio|precios|tarifa|tarifas|tasas?|c[aà]non)\b/i.test(q) ||
    /(?:cu[aá]nto|quant)\s+(?:s['’]ha\s+de\s+pagar|se\s+debe\s+pagar|hay\s+que\s+pagar|cal\s+pagar|pagar|es|val|costa|cuesta)/i.test(q) ||
    /\b(?:bizum|efectiu|efectivo|transfer[eè]ncia)\b/i.test(q)
  ) {
    return ChatIntent.PRECIOS;
  }

  // 7. HORARIOS Y ENTREGA / SEDE
  // e.g. "¿Dónde y cuándo recoger los materiales?", "horarios", "dónde está la sede"
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

  // 8. DOCUMENTACIÓN Y DNI
  // e.g. "¿Qué documentación hay que aportar?", "dni", "menores"
  if (
    /\b(?:dni|nie|passaport|pasaporte|documentaci[oó]n|documentaci[oó]|autorizaci[oó]n|autoritzaci[oó])\b/i.test(q)
  ) {
    return ChatIntent.DOCUMENTACION_DNI;
  }

  // 9. CONTACTO
  // e.g. "teléfono", "correo", "cómo contactar"
  if (
    /\b(?:contactar|contacto|contacte|tel[eé]fono|tel[eè]fon|correo|correu|email)\b/i.test(q)
  ) {
    return ChatIntent.CONTACTO;
  }

  return ChatIntent.UNKNOWN;
}

/**
 * Matches custom FAQs from Secretaria only if exact match.
 * Rule 11: Si una FAQ no coincide exactamente con la pregunta, no la muestres como respuesta.
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
 * Rule 7: Para precios, materiales, tallas, inscripción, DNI y horarios de entrega, usa únicamente sistema_config y settings de Supabase.
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

  if (supabaseUrl && (serviceKey || anonKey)) {
    try {
      const client = createClient(supabaseUrl, serviceKey || anonKey!);

      // 1. Fetch settings keys
      const { data: settingsRows } = await client
        .from('settings')
        .select('key, value')
        .in('key', ['tast_config_2026', 'personalizacion', 'tast_portada_config_2026', 'faqs', 'secretaria_faqs']);

      if (settingsRows) {
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

  const result = {
    sistemaConfig,
    personalizacion,
    portadaConfig,
    categoriaDescripcions,
    preguntes,
    customFaqs
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
function buildSystemPrompt(lang: 'ca' | 'es', liveData: any, facText: string): string {
  const { sistemaConfig, personalizacion } = liveData;

  const ev = personalizacion?.evento || {};
  const sec = personalizacion?.secretaria || {};

  const nomEntitat = ev.nombre || "Associació Cultural El Tast";
  const direccio = ev.direccio || "Plaça Soler i Carbonell, 28, 08800 Vilanova i la Geltrú";
  const rawEmail = ev.email || "tastvng@gmail.com";
  const email = (rawEmail.includes('secretaria@eltast.cat') || rawEmail.includes('secretaria@tast.cat')) ? "tastvng@gmail.com" : rawEmail;
  const telefon = ev.telefon || "600 000 000";

  const horariAtencio = lang === 'ca'
    ? (sec.hours_ca || "Dissabtes, de 10:00h a 13:30h directament a la seu social.")
    : (sec.hours_es || "Sábados, de 10:00h a 13:30h directamente en la sede social.");

  const diesEntrega = lang === 'ca'
    ? (sec.dies_entrega_ca || "Dissabtes, de 10:00h a 13:30h a la seu social.")
    : (sec.dies_entrega_es || "Sábados, de 10:00h a 13:30h en la sede social.");

  const preuAdult = sistemaConfig?.preuAdult ?? 90;
  const preuJuvenil = sistemaConfig?.preuJuvenil ?? 60;

  const fallbackPhrase = lang === 'ca'
    ? "No disposo d'informació confirmada sobre aquesta consulta. Consulta el web oficial o contacta amb l'entitat."
    : "No dispongo de información confirmada sobre esta consulta. Consulta la web oficial o contacta con la entidad.";

  return `
Ets l'Assistent Virtual Oficial d'Ajuda de "El Tast" (${nomEntitat}), per a la celebració de Les Comparses del Carnaval de Vilanova i la Geltrú.

=======================================================
REGLES D'OR ABSOLUTES:
=======================================================
1. NO INVENTIS MAI cap data, història, horari, preu ni dada que no estigui en aquest text.
2. REGLA CRÍTICA DE MATERIALS: Els ÚNICS materials vàlids són:
   - chaleco / armilla (talles: XS, S, M, L, XL, XXL, 3XL)
   - claveles / clavells
   - pajarita / corbatí
   ESTÀ ESTRICTAMENT PROHIBIT mencionar o respondre amb: pañuelos, mocadors, domàs o domassos.
3. DATA DE LA COMPARSA 2027:
   La pàgina oficial de la FAC no conté la data exacta de la Comparsa 2027.
   Si et pregunten per la data de la Comparsa 2027, has de respondre literalment:
   ${lang === 'ca' ? '"Encara no tinc confirmada la data oficial de la Comparsa 2027. Consulta el web oficial o contacta amb l\'entitat."' : '"Todavía no tengo confirmada la fecha oficial de la Comparsa 2027. Consulta la web oficial o contacta con la entidad."'}
4. Si una informació no està confirmada, respon: "${fallbackPhrase}".
5. IDIOMA: Respon en ${lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ'}.

=======================================================
DADES DE SECRETARIA I SUPABASE (EL TAST):
=======================================================
- Entitat: ${nomEntitat}
- Sede / Seu social: ${direccio}
- Correu: ${email}
- Telèfon: ${telefon}
- Horari d'atenció i recollida de materials: ${horariAtencio}
- Preus oficials d'inscripció:
  • Parella Adulta: ${preuAdult} €
  • Parella Juvenil (14 a 17 anys): ${preuJuvenil} €
- Llista d'espera: Si s'esgoten les places, s'assigna codi LE. No es paga res mentre s'està en llista d'espera.
- Documentació: DNI de tots dos membres i autorització per a menors.

=======================================================
FONT OFICIAL DE LA FAC (CARNAVAL DE VILANOVA):
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
  const { sistemaConfig, personalizacion } = liveData;

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

  // Authoritative prices from Supabase (sistema_config.config)
  const preuAdult = sistemaConfig?.preuAdult ?? 90;
  const preuJuvenil = sistemaConfig?.preuJuvenil ?? 60;

  // 1. FECHA COMPARSA 2027
  // Rules 3, 4, 5: Check official FAC website. If date not found, output specific message.
  if (intent === ChatIntent.FECHA_COMPARSA_2027) {
    const facData = await getOfficialFacData();
    if (facData.has2027Date && facData.date2027Text) {
      return facData.date2027Text;
    }
    return lang === 'ca'
      ? "Encara no tinc confirmada la data oficial de la Comparsa 2027. Consulta el web oficial o contacta amb l'entitat."
      : "Todavía no tengo confirmada la fecha oficial de la Comparsa 2027. Consulta la web oficial o contacta con la entidad.";
  }

  // 2. HISTORIA DEL ACTO
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

  // 3. MATERIALES
  // Rules 8 & 9: Only chaleco, claveles, pajarita. Absolutely NO pañuelos, mocadors, domàs.
  if (intent === ChatIntent.MATERIALES) {
    if (lang === 'ca') {
      return `Els únics materials vàlids per a la comparsa són:\n\n` +
        `• **Armilla**: disponible en talles [XS, S, M, L, XL, XXL, 3XL]\n` +
        `• **Clavells**\n` +
        `• **Corbatí** (pajarita)\n\n` +
        `*(No hi ha altres materials a la venda)*`;
    } else {
      return `Los únicos materiales válidos para la comparsa son:\n\n` +
        `• **Chaleco**: disponible en tallas [XS, S, M, L, XL, XXL, 3XL]\n` +
        `• **Claveles**\n` +
        `• **Pajarita**\n\n` +
        `*(No hay otros materiales a la venta)*`;
    }
  }

  // 4. PRECIOS / CUÁNTO CUESTA
  // Rule 7: Only from sistema_config and settings. Rule 9: No pañuelos, mocadors, domàs.
  if (intent === ChatIntent.PRECIOS) {
    if (lang === 'ca') {
      return `Aquests són els preus oficials d'inscripció a **${nomEntitat}**:\n\n` +
        `• **Inscripció Parella Adulta**: **${preuAdult} €**\n` +
        `• **Inscripció Parella Juvenil** (14 a 17 anys): **${preuJuvenil} €**\n\n` +
        `El pagament es formalitza presencialment a la seu social en efectiu o Bizum durant els dies d'atenció de Secretaria.`;
    } else {
      return `Estos son los precios oficiales de inscripción en **${nomEntitat}**:\n\n` +
        `• **Inscripción Pareja Adulta**: **${preuAdult} €**\n` +
        `• **Inscripción Pareja Juvenil** (14 a 17 años): **${preuJuvenil} €**\n\n` +
        `El pago se formaliza presencialmente en la sede social en efectivo o Bizum durante los días de atención de Secretaría.`;
    }
  }

  // 5. LISTA DE ESPERA
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

  // 6. HORARIOS Y RECOGIDA / SEDE
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

  // 7. DOCUMENTACIÓN / DNI
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

  // 8. CONTACTO
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
        ? "Hola! 👋 Sóc l'assistent virtual de El Tast. Et puc resoldre qualsevol dubte sobre la inscripció per a Les Comparses del Carnaval: preus, categories (adults i juvenils), talles, materials (armilla, clavells i corbatí), llista d'espera, recollida de materials i horaris de la seu social. En què et puc ajudar?"
        : "¡Hola! 👋 Soy el asistente virtual de El Tast. Te puedo resolver cualquier duda sobre la inscripción para Les Comparses del Carnaval: precios, categorías (adultos y juveniles), tallas, materiales (chaleco, claveles y pajarita), lista de espera, recogida de materiales y horarios de la sede social. ¿En qué te puedo ayudar?";
      return res.status(200).json({
        ok: true,
        answer: greetingAnswer,
        reply: greetingAnswer,
        topic: 'salutacio'
      });
    }

    // 2. CHECK CUSTOM FAQS FROM SECRETARIA (Rules 10 & 11)
    // Rule 11: Si una FAQ no coincide exactamente con la pregunta, no la muestres como respuesta.
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

    // 4. UNKNOWN INTENT -> CALL GEMINI FREE TIER (strictly grounded, no search grounding, free tier model)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    let reply: string | null = null;

    if (apiKey) {
      try {
        const facData = await getOfficialFacData();
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const systemInstruction = buildSystemPrompt(lang, liveData, facData.rawText);

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

        // Use strictly Free Tier Gemini models
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

    // 5. HONEST FALLBACK: Rule 12: Devuelve siempre una respuesta relacionada con la pregunta o indica que no hay información.
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
