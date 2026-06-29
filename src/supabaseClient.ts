import { createClient } from '@supabase/supabase-js';
import { Inscripcio } from './types';

const metaEnv = (import.meta as any).env || {};
const envUrl = metaEnv.VITE_SUPABASE_URL || '';
const envAnon = metaEnv.VITE_SUPABASE_ANON_KEY || '';

// Fallback to localStorage keys if env is not defined (e.g. in development/preview)
const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('VITE_SUPABASE_URL') || '' : '';
const localAnon = typeof localStorage !== 'undefined' ? localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '' : '';

const supabaseUrl = envUrl || localUrl;
const supabaseAnonKey = envAnon || localAnon;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Clean logging
if (isSupabaseConfigured) {
  console.log("Supabase client initialized successfully using config: " + (envUrl ? "ENV" : "LocalStorage"));
} else {
  console.log("Supabase is not yet fully configured in your environment. Falling back gracefully to LocalStorage for interface settings.");
}

// In-memory cache to prevent duplicate settings queries during application lifecycle
const settingCache = new Map<string, any>();
let isSettingCacheInitialized = false;

let hasKeyColumn: boolean | null = null;

async function checkKeyColumnExists(): Promise<boolean> {
  if (hasKeyColumn !== null) return hasKeyColumn;
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('settings')
      .select('key')
      .limit(1);
    if (error) {
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        hasKeyColumn = false;
        return false;
      }
      if (error.code === '42P01') {
        // Table does not exist yet
        return false;
      }
      return false;
    }
    hasKeyColumn = true;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Generic getter function for any setting in Supabase.
 * Supports adaptive schema formats where columns are named 'id' or 'key' 
 * and payloads are named 'value', 'config' or 'settings'.
 */
export async function getSupabaseSetting<T>(key: string, defaultValue: T): Promise<T> {
  if (!supabase) {
    return defaultValue;
  }

  // Check memory cache first to completely eliminate redundant fetches
  if (settingCache.has(key)) {
    return settingCache.get(key) as T;
  }

  if (isSettingCacheInitialized) {
    // Cache has been initialized and the key was not found. Cache and return default.
    settingCache.set(key, defaultValue);
    return defaultValue;
  }
  
  try {
    // Safe multi-column schema-agnostic fetch: Query all rows once, then index by either key or id in memory.
    // This avoids throwing a 400 error in Supabase if we queried .eq('key') but the column is 'id', or vice versa.
    const { data, error } = await supabase
      .from('settings')
      .select('*');
      
    if (error) {
      console.warn(`Warning reading settings table from Supabase:`, error.message || error);
      return defaultValue;
    }
    
    if (data && data.length > 0) {
      // Determine if the key column exists directly from rows
      hasKeyColumn = data[0].key !== undefined;

      for (const row of data) {
        const rowKey = row.key !== undefined ? row.key : row.id;
        if (rowKey !== undefined && rowKey !== null) {
          let configPayload = row.value !== undefined ? row.value 
                          : row.config !== undefined ? row.config 
                          : row.settings !== undefined ? row.settings 
                          : row;
          
          if (typeof configPayload === 'string') {
            try {
              configPayload = JSON.parse(configPayload);
            } catch(e) {
              // Not double-serialized
            }
          }
          settingCache.set(String(rowKey), configPayload);
        }
      }
    }

    isSettingCacheInitialized = true;

    if (settingCache.has(key)) {
      return settingCache.get(key) as T;
    }
    
    // Cache the default value if the key does not exist yet to prevent repeated DB misses
    settingCache.set(key, defaultValue);
    return defaultValue;
  } catch (err) {
    console.warn(`Exception fetching settings from Supabase/Settings for key [${key}]:`, err);
    return defaultValue;
  }
}

/**
 * Generic setter function for any setting in Supabase.
 * Adaptive Column Mapping is done automatically.
 */
export async function saveSupabaseSetting(key: string, value: any): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    // Update/invalidate memory cache first so all consecutive reads see the fresh value
    settingCache.set(key, value);

    // Remedy 3: Formatter guard - serialize object/array, keep string plain
    const normalizedValue = typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : value;

    const keyExistsInTable = await checkKeyColumnExists();
    const isNumericKey = /^\d+$/.test(key);

    let upsertPayload: any = { value: normalizedValue };
    let upsertOptions: any = {};

    if (keyExistsInTable) {
      upsertPayload.key = key;
      // If we have a 'key' column, and the string key is purely numeric, we can also pass it as 'id' to be safe.
      // If it's non-numeric, we MUST NOT pass 'id: key' because id is likely a bigint PK.
      if (isNumericKey) {
        upsertPayload.id = parseInt(key, 10);
      }
      upsertOptions.onConflict = 'key';
    } else {
      // No key column exists, so we must be using 'id' as the text primary key column.
      upsertPayload.id = key;
    }

    const { error: upsertError } = await supabase
      .from('settings')
      .upsert(upsertPayload, upsertOptions);

    if (!upsertError) {
      return true;
    }

    console.warn(`Direct upsert failed, executing defensive fallback flow:`, upsertError.message || upsertError);

    // Update fallback
    if (keyExistsInTable) {
      const { error: updateKeyError } = await supabase
        .from('settings')
        .update({ value: normalizedValue })
        .eq('key', key);
      if (!updateKeyError) return true;
    } else {
      const { error: updateIdError } = await supabase
        .from('settings')
        .update({ value: normalizedValue })
        .eq('id', key);
      if (!updateIdError) return true;
    }

    // Insert fallback
    if (keyExistsInTable) {
      const insertPayload: any = { key: key, value: normalizedValue };
      if (isNumericKey) {
        insertPayload.id = parseInt(key, 10);
      }
      const { error: insertKeyError } = await supabase
        .from('settings')
        .insert(insertPayload);
      if (!insertKeyError) return true;
    } else {
      const { error: insertIdError } = await supabase
        .from('settings')
        .insert({ id: key, value: normalizedValue });
      if (!insertIdError) return true;
    }

    return false;
  } catch (err) {
    console.error(`Exception saving setting to Supabase for key [${key}]:`, err);
    return false;
  }
}

// Keep old exports in case any module is importing them
export async function getSupabaseSettings(): Promise<any | null> {
  return getSupabaseSetting('tast_portada_config_2026', null);
}

export async function saveSupabaseSettings(config: any): Promise<boolean> {
  return saveSupabaseSetting('tast_portada_config_2026', config);
}

/* ==========================================
 * REAL INSCRIPTIONS PERSISTENCE (SUPABASE)
 * ========================================== */

function parseJSON(val: any): any {
  if (typeof val === 'object' && val !== null) return val;
  try {
    return JSON.parse(val);
  } catch(e) {}
  return {};
}

function parseInscripcionesRows(rows: any[]): Inscripcio[] {
  if (!rows) return [];
  return rows.filter(Boolean).map(r => {
    // Fallback if the whole object was saved inside a single JSON field
    if (r.value && typeof r.value === 'object') return r.value;
    if (r.data && typeof r.data === 'object') return r.data;
    if (r.payload && typeof r.payload === 'object') return r.payload;
    if (r.config && typeof r.config === 'object') return r.config;

    // Standard column parse with snake_case and casing fallback modes
    return {
      id: r.id || r.key || '',
      codiSeguiment: r.codiSeguiment !== undefined ? r.codiSeguiment 
                    : (r.codi_seguiment || r.codiseguiment || ''),
      categoria: r.categoria || 'ADULT',
      
      c1Nom: r.c1Nom !== undefined ? r.c1Nom : (r.c1_nom || r.c1nom || ''),
      c1Cognoms: r.c1Cognoms !== undefined ? r.c1Cognoms : (r.c1_cognoms || r.c1cognoms || ''),
      c1Email: r.c1Email !== undefined ? r.c1Email : (r.c1_email || r.c1email || ''),
      c1Telefon: r.c1Telefon !== undefined ? r.c1Telefon : (r.c1_telefon || r.c1telefon || ''),
      c1Talla: r.c1Talla !== undefined ? r.c1Talla : (r.c1_talla || r.c1talla || ''),
      c1DniUrl: r.c1DniUrl !== undefined ? r.c1DniUrl : (r.c1_dni_url || r.c1dni_url || r.c1_dni || r.c1dni || ''),
      c1EsMenor: r.c1EsMenor !== undefined ? !!r.c1EsMenor : !!(r.c1_es_menor || r.c1esmenor),
      c1TutorNom: r.c1TutorNom !== undefined ? r.c1TutorNom : (r.c1_tutor_nom || r.c1tutornom || ''),
      c1TutorCognoms: r.c1TutorCognoms !== undefined ? r.c1TutorCognoms : (r.c1_tutor_cognoms || r.c1tutorcognoms || ''),
      c1TutorDni: r.c1TutorDni !== undefined ? r.c1TutorDni : (r.c1_tutor_dni || r.c1tutordni || ''),
      c1TutorTelefon: r.c1TutorTelefon !== undefined ? r.c1TutorTelefon : (r.c1_tutor_telefon || r.c1tutortelefon || ''),
      c1UniformeTipus: r.c1UniformeTipus !== undefined ? r.c1UniformeTipus : (r.c1_uniforme_tipus || r.c1uniformetipus || ''),

      c2Nom: r.c2Nom !== undefined ? r.c2Nom : (r.c2_nom || r.c2nom || ''),
      c2Cognoms: r.c2Cognoms !== undefined ? r.c2Cognoms : (r.c2_cognoms || r.c2cognoms || ''),
      c2Email: r.c2Email !== undefined ? r.c2Email : (r.c2_email || r.c2email || ''),
      c2Telefon: r.c2Telefon !== undefined ? r.c2Telefon : (r.c2_telefon || r.c2telefon || ''),
      c2Talla: r.c2Talla !== undefined ? r.c2Talla : (r.c2_talla || r.c2talla || ''),
      c2DniUrl: r.c2DniUrl !== undefined ? r.c2DniUrl : (r.c2_dni_url || r.c2dni_url || r.c2_dni || r.c2dni || ''),
      c2EsMenor: r.c2EsMenor !== undefined ? !!r.c2EsMenor : !!(r.c2_es_menor || r.c2esmenor),
      c2TutorNom: r.c2TutorNom !== undefined ? r.c2TutorNom : (r.c2_tutor_nom || r.c2tutornom || ''),
      c2TutorCognoms: r.c2TutorCognoms !== undefined ? r.c2TutorCognoms : (r.c2_tutor_cognoms || r.c2tutorcognoms || ''),
      c2TutorDni: r.c2TutorDni !== undefined ? r.c2TutorDni : (r.c2_tutor_dni || r.c2tutordni || ''),
      c2TutorTelefon: r.c2TutorTelefon !== undefined ? r.c2TutorTelefon : (r.c2_tutor_telefon || r.c2tutortelefon || ''),
      c2UniformeTipus: r.c2UniformeTipus !== undefined ? r.c2UniformeTipus : (r.c2_uniforme_tipus || r.c2uniformetipus || ''),

      respostesCuestionari: typeof r.respostesCuestionari === 'object' && r.respostesCuestionari ? r.respostesCuestionari :
                            typeof r.respostes_cuestionari === 'object' && r.respostes_cuestionari ? r.respostes_cuestionari :
                            typeof r.respostes === 'object' && r.respostes ? r.respostes :
                            parseJSON(r.respostesCuestionari || r.respostes_cuestionari || r.respostes || '{}'),
      
      seleccionsUniforme: typeof r.seleccionsUniforme === 'object' && r.seleccionsUniforme ? r.seleccionsUniforme :
                          typeof r.seleccions_uniforme === 'object' && r.seleccions_uniforme ? r.seleccions_uniforme :
                          parseJSON(r.seleccionsUniforme || r.seleccions_uniforme || '{}'),

      preuCalculat: Number(r.preuCalculat !== undefined ? r.preuCalculat : (r.preu_calculat || r.preucalculat || 0)),
      teDomasBalco: r.teDomasBalco !== undefined ? !!r.teDomasBalco : !!(r.te_domas_balco || r.tedomasbalco),
      teMocadorsExtra: Number(r.teMocadorsExtra !== undefined ? r.teMocadorsExtra : (r.te_mocadors_extra || r.temocadorsextra || 0)),

      estatPagament: r.estatPagament || r.estat_pagament || r.estatpagament || 'PENDENT',
      metodePagament: r.metodePagament || r.metode_pagament || r.metodepagament || null,
      estatDni: r.estatDni || r.estat_dni || r.estatdni || 'PENDENT',
      entregaMaterial: r.entregaMaterial || r.entrega_material || r.entregamaterial || 'PENDENT',
      estatInscripcio: r.estatInscripcio || r.estat_inscripcio || r.estatinscripcio || 'obertes',
      posicioGlobal: r.posicioGlobal !== undefined ? Number(r.posicioGlobal) : (r.posicio_global !== undefined ? Number(r.posicio_global) : undefined),
      bandera: r.bandera !== undefined ? Number(r.bandera) : (r.bandera !== undefined ? Number(r.bandera) : 0),

      creadoEn: r.creadoEn || r.creado_en || r.created_at || new Date().toISOString(),
      actualizadoEn: r.actualizadoEn || r.actualizado_en || r.updated_at || new Date().toISOString()
    };
  });
}

const CAMEL_COLUMNS = "id, codiSeguiment, categoria, c1Nom, c1Cognoms, c1Email, c1Telefon, c1Talla, c1EsMenor, c1TutorNom, c1TutorCognoms, c1TutorDni, c1TutorTelefon, c1UniformeTipus, c2Nom, c2Cognoms, c2Email, c2Telefon, c2Talla, c2EsMenor, c2TutorNom, c2TutorCognoms, c2TutorDni, c2TutorTelefon, c2UniformeTipus, respostesCuestionari, seleccionsUniforme, preuCalculat, teDomasBalco, teMocadorsExtra, estatPagament, metodePagament, estatDni, entregaMaterial, estat_inscripcio, posicio_global, bandera, creadoEn, actualizadoEn";

const SNAKE_COLUMNS = "id, codi_seguiment, categoria, c1_nom, c1_cognoms, c1_email, c1_telefon, c1_talla, c1_es_menor, c1_tutor_nom, c1_tutor_cognoms, c1_tutor_dni, c1_tutor_telefon, c1_uniforme_tipus, c2_nom, c2_cognoms, c2_email, c2_telefon, c2_talla, c2_es_menor, c2_tutor_nom, c2_tutor_cognoms, c2_tutor_dni, c2_tutor_telefon, c2_uniforme_tipus, respostes_cuestionari, seleccions_uniforme, preu_calculat, te_domas_balco, te_mocadors_extra, estat_pagament, metode_pagament, estat_dni, entrega_material, estat_inscripcio, posicio_global, bandera, creado_en, actualizado_en";

/**
 * Downloads lightweight metadata of inscriptions from Supabase (excluding highly heavy Base64 DNI blobs).
 */
export async function getSupabaseInscripciones(): Promise<Inscripcio[]> {
  if (!supabase) return [];
  try {
    // Attempt 1: Fetch using camelCase column list (excluding heavy DNI files) with safety limit of 2000
    const { data, error } = await supabase
      .from('inscripciones')
      .select(CAMEL_COLUMNS)
      .limit(2000);
      
    if (!error && data) {
      return parseInscripcionesRows(data);
    }
    
    // Attempt 2: Fetch using snake_case column list for 'inscripciones' table silently
    const resSnake = await supabase
      .from('inscripciones')
      .select(SNAKE_COLUMNS)
      .limit(2000);
      
    if (!resSnake.error && resSnake.data) {
      return parseInscripcionesRows(resSnake.data);
    }
    
    // Attempt 3: Try fallback table 'inscripcions' with camelCase columns silently
    const resFallbackCamel = await supabase
      .from('inscripcions')
      .select(CAMEL_COLUMNS)
      .limit(2000);
      
    if (!resFallbackCamel.error && resFallbackCamel.data) {
      return parseInscripcionesRows(resFallbackCamel.data);
    }

    // Attempt 4: Try fallback table 'inscripcions' with snake_case columns silently
    const resFallbackSnake = await supabase
      .from('inscripcions')
      .select(SNAKE_COLUMNS)
      .limit(2000);
      
    if (!resFallbackSnake.error && resFallbackSnake.data) {
      return parseInscripcionesRows(resFallbackSnake.data);
    }

    // Safe Fallback 1: Select '*' limited to 100 entries only from 'inscripciones'
    const resStar = await supabase
      .from('inscripciones')
      .select('*')
      .limit(100);
      
    if (!resStar.error && resStar.data) {
      return parseInscripcionesRows(resStar.data);
    }

    // Safe Fallback 2: Select '*' from fallback table 'inscripcions'
    const resStarFallback = await supabase
      .from('inscripcions')
      .select('*')
      .limit(100);
      
    if (!resStarFallback.error && resStarFallback.data) {
      return parseInscripcionesRows(resStarFallback.data);
    }

    // If ALL attempts failed, log a single warning with details
    console.warn("All column-specific and table fallback attempts for loading inscriptions from Supabase failed.", {
      attempt1Error: error?.message || error,
      attempt2Error: resSnake.error?.message || resSnake.error,
      attempt3Error: resFallbackCamel.error?.message || resFallbackCamel.error,
      attempt4Error: resFallbackSnake.error?.message || resFallbackSnake.error,
      starError: resStar.error?.message || resStar.error,
      starFallbackError: resStarFallback.error?.message || resStarFallback.error
    });

    return [];
  } catch (err) {
    console.error("Exception fetching inscriptions from Supabase:", err);
    return [];
  }
}

/**
 * Downloads a single inscription by ID with all details (including heavy binary DNI attachments).
 */
export async function getSupabaseInscripcionById(id: string): Promise<Inscripcio | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('inscripciones')
      .select('*')
      .eq('id', id)
      .maybeSingle();
      
    if (error || !data) {
      // try fallback table name
      const resFallback = await supabase
        .from('inscripcions')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (resFallback.error || !resFallback.data) {
        return null;
      }
      return parseInscripcionesRows([resFallback.data])[0] || null;
    }
    return parseInscripcionesRows([data])[0] || null;
  } catch (err) {
    console.error("Exception fetching single inscription details by ID:", err);
    return null;
  }
}

/**
 * Saves and updates a single inscription on the 'inscripciones' table (Supabase).
 * Uses robust attempts to handle standard schema types across camelCase and snake_case databases.
 */
export async function saveSupabaseInscripcion(ins: Inscripcio): Promise<boolean> {
  if (!supabase) return false;
  try {
    const tableName = 'inscripciones';
    
    // Attempt 1: Best match using exact verified columns (CamelCase standard, snake_case for status & position)
    let response = await supabase
      .from(tableName)
      .upsert({
        id: ins.id,
        codiSeguiment: ins.codiSeguiment,
        categoria: ins.categoria,
        c1Nom: ins.c1Nom,
        c1Cognoms: ins.c1Cognoms,
        c1Email: ins.c1Email,
        c1Telefon: ins.c1Telefon,
        c1Talla: ins.c1Talla,
        c1DniUrl: ins.c1DniUrl,
        c1EsMenor: ins.c1EsMenor || false,
        c1TutorNom: ins.c1TutorNom || null,
        c1TutorCognoms: ins.c1TutorCognoms || null,
        c1TutorDni: ins.c1TutorDni || null,
        c1TutorTelefon: ins.c1TutorTelefon || null,
        c1UniformeTipus: ins.c1UniformeTipus || null,
        c2Nom: ins.c2Nom,
        c2Cognoms: ins.c2Cognoms,
        c2Email: ins.c2Email,
        c2Telefon: ins.c2Telefon,
        c2Talla: ins.c2Talla,
        c2DniUrl: ins.c2DniUrl,
        c2EsMenor: ins.c2EsMenor || false,
        c2TutorNom: ins.c2TutorNom || null,
        c2TutorCognoms: ins.c2TutorCognoms || null,
        c2TutorDni: ins.c2TutorDni || null,
        c2TutorTelefon: ins.c2TutorTelefon || null,
        c2UniformeTipus: ins.c2UniformeTipus || null,
        respostesCuestionari: ins.respostesCuestionari,
        seleccionsUniforme: ins.seleccionsUniforme || {},
        preuCalculat: ins.preuCalculat,
        teDomasBalco: ins.teDomasBalco,
        teMocadorsExtra: ins.teMocadorsExtra,
        estatPagament: ins.estatPagament,
        metodePagament: ins.metodePagament,
        estatDni: ins.estatDni,
        entregaMaterial: ins.entregaMaterial,
        estat_inscripcio: ins.estatInscripcio || 'obertes',
        posicio_global: ins.posicioGlobal || null,
        bandera: ins.bandera !== undefined ? ins.bandera : 0,
        creadoEn: ins.creadoEn,
        actualizadoEn: ins.actualizadoEn
      });
      
    if (!response.error) return true;
    let lastError = response.error;
    
    // Attempt 2: Full SnakeCase fallback columns
    response = await supabase
      .from(tableName)
      .upsert({
        id: ins.id,
        codi_seguiment: ins.codiSeguiment,
        categoria: ins.categoria,
        c1_nom: ins.c1Nom,
        c1_cognoms: ins.c1Cognoms,
        c1_email: ins.c1Email,
        c1_telefon: ins.c1Telefon,
        c1_talla: ins.c1Talla,
        c1_dni_url: ins.c1DniUrl,
        c1_es_menor: ins.c1EsMenor || false,
        c1_tutor_nom: ins.c1TutorNom || null,
        c1_tutor_cognoms: ins.c1TutorCognoms || null,
        c1_tutor_dni: ins.c1TutorDni || null,
        c1_tutor_telefon: ins.c1TutorTelefon || null,
        c1_uniforme_tipus: ins.c1UniformeTipus || null,
        c2_nom: ins.c2Nom,
        c2_cognoms: ins.c2Cognoms,
        c2_email: ins.c2Email,
        c2_telefon: ins.c2Telefon,
        c2_talla: ins.c2Talla,
        c2_dni_url: ins.c2DniUrl,
        c2_es_menor: ins.c2EsMenor || false,
        c2_tutor_nom: ins.c2TutorNom || null,
        c2_tutor_cognoms: ins.c2TutorCognoms || null,
        c2_tutor_dni: ins.c2TutorDni || null,
        c2_tutor_telefon: ins.c2TutorTelefon || null,
        c2_uniforme_tipus: ins.c2UniformeTipus || null,
        respostes_cuestionari: ins.respostesCuestionari,
        seleccions_uniforme: ins.seleccionsUniforme || {},
        preu_calculat: ins.preuCalculat,
        te_domas_balco: ins.teDomasBalco,
        te_mocadors_extra: ins.teMocadorsExtra,
        estat_pagament: ins.estatPagament,
        metode_pagament: ins.metodePagament,
        estat_dni: ins.estatDni,
        entrega_material: ins.entregaMaterial,
        estat_inscripcio: ins.estatInscripcio || 'obertes',
        posicio_global: ins.posicioGlobal || null,
        bandera: ins.bandera !== undefined ? ins.bandera : 0,
        creado_en: ins.creadoEn,
        actualizado_en: ins.actualizadoEn
      });

    if (!response.error) return true;
    lastError = response.error;

    console.error("All adaptive column structure attempts for 'inscripciones' table failed:", lastError);
    return false;
  } catch (err) {
    console.error("Exception saving inscription to Supabase:", err);
    return false;
  }
}

/**
 * Removes an inscription by its ID.
 */
export async function deleteSupabaseInscripcion(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    let response = await supabase
      .from('inscripciones')
      .delete()
      .eq('id', id);
    if (!response.error) return true;
    
    // Fallback Catalan
    response = await supabase
      .from('inscripcions')
      .delete()
      .eq('id', id);
    if (response.error) {
      console.error("Error deleting inscription from Supabase ('inscripciones' and 'inscripcions' tables failed):", response.error.message);
    }
    return !response.error;
  } catch(e) {
    console.error("Exception deleting inscription from Supabase:", e);
    return false;
  }
}

/**
 * Mass deletes multiple inscriptions by ID.
 */
export async function deleteMultipleSupabaseInscripciones(ids: string[]): Promise<boolean> {
  if (!supabase) return false;
  try {
    let response = await supabase
      .from('inscripciones')
      .delete()
      .in('id', ids);
    if (!response.error) return true;
    
    // Fallback Catalan
    response = await supabase
      .from('inscripcions')
      .delete()
      .in('id', ids);
    if (response.error) {
      console.error("Error mass deleting inscriptions from Supabase:", response.error.message);
    }
    return !response.error;
  } catch(e) {
    console.error("Exception deleting multi inscriptions from Supabase:", e);
    return false;
  }
}

/**
 * Deletes all registrations completely.
 */
export async function clearAllSupabaseInscripciones(): Promise<boolean> {
  if (!supabase) return false;
  try {
    let response = await supabase
      .from('inscripciones')
      .delete()
      .neq('id', '_dummy_placeholder_id_string_that_does_not_exist_');
    if (!response.error) return true;
    
    // Fallback Catalan
    response = await supabase
      .from('inscripcions')
      .delete()
      .neq('id', '_dummy_placeholder_id_string_that_does_not_exist_');
    if (response.error) {
      console.error("Error clearing inscriptions from Supabase ('inscripciones' and 'inscripcions' tables failed):", response.error.message);
    }
    return !response.error;
  } catch(e) {
    console.error("Exception clearing inscriptions from Supabase:", e);
    return false;
  }
}
