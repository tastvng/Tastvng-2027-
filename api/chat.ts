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

/**
 * Categorizes a query into anonymous topic buckets without storing any personal data.
 */
function categorizeQuery(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('preu') || lower.includes('costa') || lower.includes('pagar') || lower.includes('tarifa') || lower.includes('euro') || lower.includes('precio') || lower.includes('cuesta')) {
    return 'preus';
  }
  if (lower.includes('adult') || lower.includes('juvenil') || lower.includes('categoria') || lower.includes('edat') || lower.includes('edad') || lower.includes('menor')) {
    return 'categories';
  }
  if (lower.includes('espera') || lower.includes('llista') || lower.includes('lloc') || lower.includes('cua') || lower.includes('plaza') || lower.includes('lista')) {
    return 'llista_espera';
  }
  if (lower.includes('mocador') || lower.includes('pañuelo') || lower.includes('domas') || lower.includes('domàs') || lower.includes('armilla') || lower.includes('samarreta') || lower.includes('chaleco') || lower.includes('camiseta') || lower.includes('uniforme')) {
    return 'materials';
  }
  if (lower.includes('talla') || lower.includes('mida') || lower.includes('tamany') || lower.includes('tallas')) {
    return 'talles';
  }
  if (lower.includes('dni') || lower.includes('nie') || lower.includes('document') || lower.includes('passaport') || lower.includes('pasaporte')) {
    return 'dni';
  }
  if (lower.includes('bizum') || lower.includes('efectiu') || lower.includes('efectivo') || lower.includes('transferència') || lower.includes('transferencia')) {
    return 'pagaments';
  }
  if (lower.includes('horari') || lower.includes('horario') || lower.includes('recollir') || lower.includes('recollida') || lower.includes('entrega') || lower.includes('direccio') || lower.includes('adreça') || lower.includes('seu') || lower.includes('sede')) {
    return 'horaris_i_recollida';
  }
  if (lower.includes('fac') || lower.includes('federacio') || lower.includes('federación') || lower.includes('carnaval') || lower.includes('comparsa') || lower.includes('caramel')) {
    return 'fac_i_carnaval';
  }
  return 'general';
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
    // Flush to Supabase settings every 5 minutes or every 10 queries
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

  if (supabaseUrl && (serviceKey || anonKey)) {
    try {
      const client = createClient(supabaseUrl, serviceKey || anonKey!);

      // 1. Fetch settings keys
      const { data: settingsRows } = await client
        .from('settings')
        .select('key, value')
        .in('key', ['tast_config_2026', 'personalizacion', 'tast_portada_config_2026']);

      if (settingsRows) {
        for (const row of settingsRows) {
          if (row.key === 'tast_config_2026') sistemaConfig = row.value;
          if (row.key === 'personalizacion') personalizacion = row.value;
          if (row.key === 'tast_portada_config_2026') portadaConfig = row.value;
        }
      }

      // 2. Fetch sistema_config table rows
      const { data: scRows } = await client.from('sistema_config').select('clau, valor');
      if (scRows) {
        for (const r of scRows) {
          if (r.clau === 'descripcions_categories') categoriaDescripcions = r.valor;
          if (r.clau === 'preus' && !sistemaConfig?.preuAdult) {
            sistemaConfig = { ...(sistemaConfig || {}), ...r.valor };
          }
        }
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
    preguntes
  };

  configCache = {
    timestamp: now,
    data: result
  };

  return result;
}

/**
 * Builds the comprehensive dynamic system instruction with live data and FAC knowledge.
 */
function buildSystemPrompt(lang: 'ca' | 'es', liveData: any): string {
  const { sistemaConfig, personalizacion, portadaConfig, categoriaDescripcions, preguntes } = liveData;

  const ev = personalizacion?.evento || {};
  const sec = personalizacion?.secretaria || {};

  // Entity details
  const nomEntitat = ev.nombre || "Associació Cultural El Tast";
  const direccio = ev.direccio || "Plaça Soler i Carbonell, 28, 08800 Vilanova i la Geltrú";
  const rawEmail = ev.email || "tastvng@gmail.com";
  const email = (rawEmail.includes('secretaria@eltast.cat') || rawEmail.includes('secretaria@tast.cat')) ? "tastvng@gmail.com" : rawEmail;
  const telefon = ev.telefon || "600 000 000";

  // Real live schedule & pickup
  const horariAtencio = lang === 'ca'
    ? (sec.hours_ca || "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social.")
    : (sec.hours_es || "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social.");

  const diesEntrega = lang === 'ca'
    ? (sec.dies_entrega_ca || "Dimecres i divendres de 18:00h a 21:30h a la seu social.")
    : (sec.dies_entrega_es || "Miércoles y viernes de 18:00h a 21:30h en la sede social.");

  // Prices
  const preuAdult = sistemaConfig?.preuAdult ?? 130;
  const preuJuvenil = sistemaConfig?.preuJuvenil ?? 95;
  const preuDomas = sistemaConfig?.preuDomasBalco ?? 20;
  const preuMocador = sistemaConfig?.preuMocadorExtra ?? 6;

  // Status
  const estatInscripcions = sistemaConfig?.estatInscripcions || 'obertes';
  const estatText = estatInscripcions === 'obertes'
    ? (lang === 'ca' ? 'Inscripcions Obertes' : 'Inscripciones Abiertas')
    : estatInscripcions === 'espera'
      ? (lang === 'ca' ? "Llista d'espera activa (places completes)" : 'Lista de espera activa (plazas completadas)')
      : (lang === 'ca' ? 'Inscripcions Tancades' : 'Inscripciones Cerradas');

  // Uniform lines and sizes
  const liniesUniforme = sistemaConfig?.liniisUniforme || [
    { nom: "Armilla oficial El Tast", opcions: ["XS", "S", "M", "L", "XL", "XXL", "3XL"] },
    { nom: "Samarreta oficial El Tast", opcions: ["XS", "S", "M", "L", "XL", "XXL"] }
  ];

  const uniformesDesc = liniesUniforme.map((u: any) =>
    `- ${u.nom || u.nomES}: talles disponibles [${(u.opcions || []).join(', ')}]`
  ).join('\n');

  // Dynamic questions summary
  const preguntesDesc = (preguntes && preguntes.length > 0)
    ? preguntes.map((p: any) => `- ${p.titol} (${p.tipus}${p.opcions ? ': ' + p.opcions.join(', ') : ''})`).join('\n')
    : "- Cap pregunta addicional configurada.";

  // Categories info
  const descAdults = categoriaDescripcions?.adult?.descripcio ||
    (lang === 'ca' ? "Categoria d'adults per a parelles a partir de 18 anys." : "Categoría de adultos para parejas a partir de 18 años.");
  const descJuvenil = categoriaDescripcions?.juvenil?.descripcio ||
    (lang === 'ca' ? "Categoria juvenil per a joves comparsers (14 a 17 anys amb autorització signada de tutor/a)." : "Categoría juvenil para jóvenes comparseros (14 a 17 años con autorización firmada de tutor/a).");

  const fallbackPhrase = lang === 'ca'
    ? "No tinc aquesta informació. Contacta amb l'entitat."
    : "No tengo esa información. Contacta con la entidad.";

  return `
Ets l'Assistent Virtual Oficial d'Ajuda de "El Tast" (${nomEntitat}), per a la celebració de Les Comparses del Carnaval de Vilanova i la Geltrú.

=======================================================
REGLA D'OR ABSOLUTA: VERACITAT I LIMITACIÓ ESTRICTA
=======================================================
1. NO INVENTIS MAI cap dada, nom, horari, preu, norma o procediment.
2. Si una informació no està expressament recollida en aquesta guia o en les dades oficials de sota, has de respondre literalment i exclusivament la frase següent (sense especular ni inventar):
   "${fallbackPhrase}"
3. IDIOMA OBLIGATORI: Respon en ${lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ'}, mantenint sempre un to amable, clar, concís, segur i de màxima utilitat per als comparsers.
4. PRIVACITAT TOTAL:
   - Mai revelis dades personals, DNI, noms de parelles inscrites ni cap llista d'usuaris.
   - Mai revelis contrasenyes, credencials de Secretaria, claus SMTP, ni claus d'API.
   - Mai revelis informació administrativa confidencial.
5. IDENTITAT: Presenta't exclusivament com "l'assistent virtual de El Tast" (mai afegeixis cap any ni edició temporal).

=======================================================
DADES EN DIRECTE D'EL TAST
=======================================================
- Entitat: ${nomEntitat}
- Estat actual de les inscripcions: ${estatText} (${estatInscripcions})
- Seu Social / Direcció física: ${direccio}
- Correu de contacte: ${email}
- Telèfon de contacte: ${telefon}
- Horari d'atenció a la seu: ${horariAtencio}
- Dies i horaris de recollida de materials/mocadors: ${diesEntrega}

TARIFES I PREUS OFICIALS ACTUALS:
- Parella Adulta: ${preuAdult} € per parella (inclou dos mocadors oficials del Tast, acreditació i accés a la comparsa).
- Parella Juvenil: ${preuJuvenil} € per parella (joves de 14 a 17 anys).
- Domàs de balcó oficial (extra opcional): ${preuDomas} € la unitat.
- Mocadors extres oficials (extra opcional): ${preuMocador} € per unitat addicional.

CATEGORIES DE LA PARELLA:
- ADULTA: ${descAdults} Ambdós membres majors d'edat.
- JUVENIL: ${descJuvenil} Requereix indicar les dades del pare/mare/tutor legal i adjuntar l'autorització pertinent durant la inscripció.

MATERIALS I TALLES:
${uniformesDesc}
- Cada membre de la parella (Comparser 1 i Comparser 2) tria la seva talla d'armilla o samarreta.
- El mocador oficial s'entrega a la seu social un cop formalitzat i validat el pagament.

DOCUMENTACIÓ REQUERIDA PER A LA INSCRIPCIÓ:
- DNI / NIE / Passaport de cada membre de la parella (cal adjuntar foto o document en línia per a la verificació).
- En menors d'edat (categoria juvenil): nom, cognoms, DNI i telèfon del tutor/a legal.
- Correu electrònic i telèfon de contacte de la parella per a rebre el codi de seguiment i el codi QR oficial.

PAGAMENTS:
- Efectiu a la seu social durant els horaris d'atenció (${horariAtencio}).
- Bizum (si està habilitat per Secretaria a la seu o número oficial).
- Quan el pagament està confirmat, l'estat passa a "PAGAT" i es pot recollir el material.

LLISTA D'ESPERA:
- Si l'aforament o places de la comparsa s'omplen, el sistema activa la llista d'espera oficial amb codis tipus LE00001, LE00002...
- Les inscripcions en llista d'espera no paguen fins que Secretaria no allibera una plaça vacant i són admeses oficialment (passant a codi A0001 per adults o J0001 per juvenils).

PREGUNTES DINÀMIQUES DEL FORMULARI:
${preguntesDesc}

=======================================================
INFORMACIÓ GENERAL DE LA FAC (CARNAVAL DE VILANOVA)
Font oficial: https://carnavaldevilanova.cat/la-fac/
=======================================================
- La Federació d'Associacions pel Carnaval (FAC) és l'organisme responsable d'unir, coordinar i organitzar les entitats vinculades al Carnaval de Vilanova i la Geltrú des de 1989.
- Seu de la FAC: Carrer Major, 39, 08800 Vilanova i la Geltrú.
- Telèfon de la FAC: 93 893 01 01 | Correu: fac@carnavaldevilanova.cat | Web: https://carnavaldevilanova.cat
- El Tast és una entitat associada històrica que participa a les Comparses de Vilanova, respectant la normativa de seguretat, la logística i l'ús sostenible dels caramels (ecocaramels) regulats per la FAC.

FORMAT DE RESPOSTA:
- Sigues clar, concís i agradable.
- Utilitza llistes o punts destacats si la resposta té diversos passos o preus.
- Si l'usuari et saluda, respon cordialment i ofereix la teva ajuda per a les comparses d'El Tast.
`.trim();
}

/**
 * Generates an accurate deterministic response from live Supabase entity settings
 * in case external AI model services are undergoing high demand (503/429 spikes).
 */
function generateDeterministicAnswer(query: string, lang: 'ca' | 'es', liveData: any): string | null {
  const q = query.toLowerCase();
  const { sistemaConfig, personalizacion, categoriaDescripcions } = liveData;

  const ev = personalizacion?.evento || {};
  const sec = personalizacion?.secretaria || {};

  const nomEntitat = ev.nombre || "El Tast";
  const direccio = ev.direccio || "Plaça Soler i Carbonell, 28, 08800 Vilanova i la Geltrú";
  const horari = lang === 'ca'
    ? (sec.hours_ca || "Dimecres i divendres, de 18:00h a 21:30h a la seu social.")
    : (sec.hours_es || "Miércoles y viernes, de 18:00h a 21:30h en la sede social.");

  const preuAdult = sistemaConfig?.preuAdult ?? 130;
  const preuJuvenil = sistemaConfig?.preuJuvenil ?? 95;
  const preuDomas = sistemaConfig?.preuDomasBalco ?? 20;
  const preuMocador = sistemaConfig?.preuMocadorExtra ?? 6;

  // 1. Preus / Tarifes
  if (q.includes('preu') || q.includes('costa') || q.includes('tarifa') || q.includes('pagar') || q.includes('euro') || q.includes('precio') || q.includes('cuesta') || q.includes('cuanto') || q.includes('quant')) {
    if (lang === 'ca') {
      return `Aquests són els preus oficials de les inscripcions a **${nomEntitat}**:\n\n` +
        `• **Parella Adulta**: **${preuAdult} €** (inclou 2 mocadors oficials del Tast, acreditació i accés a la comparsa).\n` +
        `• **Parella Juvenil** (14 a 17 anys): **${preuJuvenil} €** per parella.\n` +
        `• **Domàs de balcó** (opcional): **${preuDomas} €**.\n` +
        `• **Mocadors addicionals** (opcional): **${preuMocador} €** per unitat.\n\n` +
        `El pagament s'efectua de manera presencial a la seu social en efectiu o Bizum durant els dies d'atenció.`;
    } else {
      return `Estos son los precios oficiales de las inscripciones en **${nomEntitat}**:\n\n` +
        `• **Pareja Adulta**: **${preuAdult} €** (incluye 2 pañuelos oficiales de El Tast, acreditación y acceso a la comparsa).\n` +
        `• **Pareja Juvenil** (14 a 17 años): **${preuJuvenil} €** por pareja.\n` +
        `• **Balcón domás** (opcional): **${preuDomas} €**.\n` +
        `• **Pañuelos adicionales** (opcional): **${preuMocador} €** por unidad.\n\n` +
        `El pago se efectúa de manera presencial en la sede social en efectivo o Bizum durante los días de atención.`;
    }
  }

  // 2. Horaris, Seu, Recollida
  if (q.includes('horari') || q.includes('horario') || q.includes('on') || q.includes('donde') || q.includes('seu') || q.includes('sede') || q.includes('recollir') || q.includes('recoger') || q.includes('adreça') || q.includes('direccion') || q.includes('direcció')) {
    if (lang === 'ca') {
      return `La seu social de **${nomEntitat}** està situada a:\n` +
        `📍 **${direccio}**\n\n` +
        `⏰ **Horari d'atenció i recollida de mocadors**: ${horari}\n\n` +
        `Recorda que per a recollir el material cal haver completat la inscripció i tenir el pagament validat per Secretaria.`;
    } else {
      return `La sede social de **${nomEntitat}** está situada en:\n` +
        `📍 **${direccio}**\n\n` +
        `⏰ **Horario de atención y recogida de pañuelos**: ${horari}\n\n` +
        `Recuerda que para recoger el material es necesario haber completado la inscripción y tener el pago validado por Secretaría.`;
    }
  }

  // 3. Categories (Adult / Juvenil)
  if (q.includes('categoria') || q.includes('adult') || q.includes('juvenil') || q.includes('edat') || q.includes('edad') || q.includes('menor')) {
    if (lang === 'ca') {
      return `A **${nomEntitat}** disposem de dues categories:\n\n` +
        `• **Categoria Adulta**: Per a parelles majors de 18 anys (${preuAdult} € per parella).\n` +
        `• **Categoria Juvenil**: Per a joves de 14 a 17 anys (${preuJuvenil} € per parella). Requereix obligatòriament les dades i l'autorització signada pel tutor/a legal.`;
    } else {
      return `En **${nomEntitat}** disponemos de dos categorías:\n\n` +
        `• **Categoría Adulta**: Para parejas mayores de 18 años (${preuAdult} € por pareja).\n` +
        `• **Categoría Juvenil**: Para jóvenes de 14 a 17 años (${preuJuvenil} € por pareja). Requiere obligatoriamente los datos y la autorización firmada por el tutor/a legal.`;
    }
  }

  // 4. Llista d'espera
  if (q.includes('espera') || q.includes('llista') || q.includes('lista') || q.includes('cua') || q.includes('aforament') || q.includes('plazas') || q.includes('places')) {
    if (lang === 'ca') {
      return `**Funcionament de la llista d'espera:**\n` +
        `Si les places estan cobertes, el formulari assigna automàticament un número de llista d'espera (LE...).\n\n` +
        `• **No s'ha de pagar res** mentre estigueu en llista d'espera.\n` +
        `• Tan bon punt s'alliberi una vacant, Secretaria es posarà en contacte amb vosaltres per correu o telèfon per a confirmar la plaça oficial.`;
    } else {
      return `**Funcionamiento de la lista de espera:**\n` +
        `Si las plazas están cubiertas, el formulario asigna automáticamente un número de lista de espera (LE...).\n\n` +
        `• **No se debe pagar nada** mientras estéis en lista de espera.\n` +
        `• En cuanto se libere una vacante, Secretaría se pondrá en contacto con vosotros por correo o teléfono para confirmar la plaza oficial.`;
    }
  }

  // 5. Documentació / DNI
  if (q.includes('dni') || q.includes('nie') || q.includes('passaport') || q.includes('document') || q.includes('foto')) {
    if (lang === 'ca') {
      return `Per a formalitzar la inscripció cal aportar:\n` +
        `• Número i fotografia o còpia del DNI, NIE o Passaport de cada membre de la parella.\n` +
        `• En menors d'edat (categoria juvenil): DNI del tutor/a legal i document d'autorització.\n` +
        `• Les dades personals es guarden de manera xifrada i confidencial únicament per a l'assegurança i la FAC.`;
    } else {
      return `Para formalizar la inscripción es necesario aportar:\n` +
        `• Número y fotografía o copia del DNI, NIE o Pasaporte de cada miembro de la pareja.\n` +
        `• En menores de edad (categoría juvenil): DNI del tutor/a legal y documento de autorización.\n` +
        `• Los datos personales se guardan de forma cifrada y confidencial únicamente para el seguro y la FAC.`;
    }
  }

  // 6. Materials / Talles
  if (q.includes('talla') || q.includes('vestuari') || q.includes('samarreta') || q.includes('armilla') || q.includes('mocador') || q.includes('pañuelo') || q.includes('chaleco') || q.includes('camiseta')) {
    if (lang === 'ca') {
      return `**Materials i talles oficials de El Tast:**\n` +
        `• Cada inscripció inclou 2 mocadors oficials de la comparsa.\n` +
        `• Talles d'armilla i samarreta disponibles des de la XS fins a la 3XL segons el model oficial.\n` +
        `• Podreu afegir domassos de balcó i mocadors extres durant la inscripció.`;
    } else {
      return `**Materiales y tallas oficiales de El Tast:**\n` +
        `• Cada inscripción incluye 2 pañuelos oficiales de la comparsa.\n` +
        `• Tallas de chaleco y camiseta disponibles desde la XS hasta la 3XL según el modelo oficial.\n` +
        `• Podréis añadir balconadas (domàs) y pañuelos extras durante la inscripción.`;
    }
  }

  // 7. Contacte / Secretaria / Correu / Telèfon
  if (q.includes('contact') || q.includes('correu') || q.includes('correo') || q.includes('email') || q.includes('mail') || q.includes('telefon') || q.includes('teléfono') || q.includes('telefono') || q.includes('trucar') || q.includes('llamar') || q.includes('ajuda') || q.includes('ayuda')) {
    const rawEmail = ev.email || "tastvng@gmail.com";
    const email = (rawEmail.includes('secretaria@eltast.cat') || rawEmail.includes('secretaria@tast.cat')) ? "tastvng@gmail.com" : rawEmail;
    const telefon = ev.telefon || "600 000 000";
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
      ? "Has assolit el límit de 5 missatges per minut. Si us plau, espera un moment, consulta les preguntes freqüents a continuació o contacta amb tastvng@gmail.com."
      : "Has alcanzado el límite de 5 mensajes por minuto. Por favor, espera un momento, consulta las preguntas frecuentes a continuación o contacta con tastvng@gmail.com.";
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
      ? "Has assolit el límit diari de 20 consultes per a aquest dispositiu. Pots consultar les preguntes freqüents a continuació o escriure a tastvng@gmail.com."
      : "Has alcanzado el límite diario de 20 consultas para este dispositivo. Puedes consultar las preguntas frecuentes a continuación o escribir a tastvng@gmail.com.";
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

    // The user query can be passed as `message` (single string) or the last message from `messages`
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
    const topic = categorizeQuery(userQuery);

    // 1. GREETING CHECK: Respond immediately without calling Gemini (Zero tokens used)
    const isGreeting = /^(hola|bones|bon dia|bona tarda|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|hello|saludos)[\s!.,?]*$/i.test(userQuery);
    if (isGreeting) {
      const greetingAnswer = lang === 'ca'
        ? "Hola! 👋 Sóc l'assistent virtual de El Tast. Et puc resoldre qualsevol dubte sobre la inscripció per a Les Comparses del Carnaval: preus, categories (adults i juvenils), talles de vestuari, materials, llista d'espera, recollida de mocadors i horaris de la seu social. En què et puc ajudar?"
        : "¡Hola! 👋 Soy el asistente virtual de El Tast. Te puedo resolver cualquier duda sobre la inscripción para Les Comparses del Carnaval: precios, categorías (adultos y juveniles), tallas de vestuario, materiales, lista de espera, recogida de pañuelos y horarios de la sede social. ¿En qué te puedo ayudar?";
      return res.status(200).json({
        ok: true,
        answer: greetingAnswer,
        reply: greetingAnswer,
        topic: 'salutacio'
      });
    }

    // 2. SECRETARIA CUSTOM FAQs & SYSTEM SETTINGS:
    // Try deterministic answer from live Supabase config FIRST (zero cost, immediate response).
    // Only call Gemini if this does not contain the answer.
    const deterministicAnswer = generateDeterministicAnswer(userQuery, lang, liveData);
    if (deterministicAnswer) {
      return res.status(200).json({
        ok: true,
        answer: deterministicAnswer,
        reply: deterministicAnswer,
        topic,
        isFaq: true
      });
    }

    // Check Gemini API key (supports GEMINI_API_KEY, GOOGLE_API_KEY and GOOGLE_GENAI_API_KEY)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    let reply: string | null = null;
    let lastError: any = null;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const systemInstruction = buildSystemPrompt(lang, liveData);

        // Limit conversation context to the last 10 messages max (prevents token inflation)
        const contents: any[] = [];
        if (Array.isArray(messages) && messages.length > 1) {
          const recentTurns = messages.slice(-10, -1);
          for (const turn of recentTurns) {
            const role = turn.role === 'user' ? 'user' : 'model';
            const text = typeof turn.content === 'string' ? turn.content.trim() : '';
            if (text) {
              contents.push({
                role,
                parts: [{ text }]
              });
            }
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: userQuery }]
        });

        // Use strictly Free Tier Gemini models. No paid models (e.g. Pro), no Google Search Grounding.
        const FREE_TIER_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

        for (const modelName of FREE_TIER_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction: systemInstruction + (lang === 'ca'
                  ? "\n\nRESTRICCIÓ DE LONGITUD: Respon sempre amb un màxim de 300 paraules, de forma directa, concisa i clara."
                  : "\n\nRESTRICCIÓN DE LONGITUD: Responde siempre con un máximo de 300 palabras, de forma directa, concisa y clara."),
                temperature: 0.2,
                maxOutputTokens: 600 // Guarantees response stays under 300-400 words without costing extra
              }
            });

            if (response && response.text) {
              reply = response.text.trim();
              break; // Success with Free Tier model
            }
          } catch (modelErr: any) {
            lastError = modelErr;
            const errStr = String(modelErr?.message || modelErr);
            console.warn(`[Chatbot Free Tier] Model ${modelName} encountered issue: ${errStr}.`);
            // Only fall through if it's a quota/503/429/model issue
            if (errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('not found') || errStr.includes('demand')) {
              continue;
            }
          }
        }
      } catch (genAiErr: any) {
        lastError = genAiErr;
        console.error("[Chatbot Error initializing AI]:", genAiErr);
      }
    } else {
      console.warn("[Chatbot Configuration Note] GEMINI_API_KEY is not configured in environment. To activate Gemini Free Tier, add GEMINI_API_KEY in Vercel: Dashboard -> Project Settings -> Environment Variables -> Production (obtain free key from https://aistudio.google.com/apikey).");
      lastError = new Error("GEMINI_API_KEY missing");
    }

    // If Gemini Free Tier responded, return standardized success JSON
    if (reply) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && serviceKey) {
        const client = createClient(supabaseUrl, serviceKey);
        recordAnonymousStats(client, lang, topic).catch(() => {});
      }

      return res.status(200).json({
        ok: true,
        answer: reply,
        reply,
        topic
      });
    }

    // 3. FREE TIER QUOTA EXCEEDED / FALLBACK:
    // If quota is exhausted or AI is unavailable, gracefully return official FAQ information and contact
    // WITHOUT generating an error for the user (zero error experience).
    const ev = liveData?.personalizacion?.evento || {};
    const sec = liveData?.personalizacion?.secretaria || {};
    const preus = liveData?.sistemaConfig || {};
    const direccio = ev.direccio || "Plaça Soler i Carbonell, 28, 08800 Vilanova i la Geltrú";
    const horari = lang === 'ca'
      ? (sec.hours_ca || "Dimecres i divendres, de 18:00h a 21:30h a la seu social.")
      : (sec.hours_es || "Miércoles y viernes, de 18:00h a 21:30h en la sede social.");
    const email = (ev.email && !ev.email.includes('secretaria@')) ? ev.email : "tastvng@gmail.com";

    const gracefulFallback = lang === 'ca'
      ? `En aquest moment pots consultar directament la informació oficial d'**El Tast** o contactar amb nosaltres:\n\n` +
        `• **Preus**: Parella Adulta **${preus.preuAdult ?? 130} €** | Parella Juvenil **${preus.preuJuvenil ?? 95} €**.\n` +
        `• **Seu social**: ${direccio}\n` +
        `• **Horari d'atenció**: ${horari}\n` +
        `• **Contacte directe**: [${email}](mailto:${email})\n\n` +
        `Pots seleccionar també qualsevol de les preguntes freqüents que trobaràs a sota.`
      : `En este momento puedes consultar directamente la información oficial de **El Tast** o contactar con nosotros:\n\n` +
        `• **Precios**: Pareja Adulta **${preus.preuAdult ?? 130} €** | Pareja Juvenil **${preus.preuJuvenil ?? 95} €**.\n` +
        `• **Sede social**: ${direccio}\n` +
        `• **Horario de atención**: ${horari}\n` +
        `• **Contacto directo**: [${email}](mailto:${email})\n\n` +
        `Puedes seleccionar también cualquiera de las preguntas frecuentes que encontrarás abajo.`;

    return res.status(200).json({
      ok: true,
      answer: gracefulFallback,
      reply: gracefulFallback,
      topic,
      isFallback: true
    });
  } catch (err: any) {
    console.error("[Chatbot Global Error]:", err);
    return res.status(200).json({
      ok: true,
      answer: lang === 'ca'
        ? "Per a qualsevol consulta oficial, pots consultar les preguntes freqüents o contactar amb tastvng@gmail.com."
        : "Para cualquier consulta oficial, puedes consultar las preguntas frecuentes o contactar con tastvng@gmail.com.",
      reply: lang === 'ca'
        ? "Per a qualsevol consulta oficial, pots consultar les preguntes freqüents o contactar amb tastvng@gmail.com."
        : "Para cualquier consulta oficial, puedes consultar las preguntas frecuentes o contactar con tastvng@gmail.com.",
      isFallback: true
    });
  }
}
