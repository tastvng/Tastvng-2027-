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

/**
 * Generic getter function for any setting in Supabase.
 * Supports adaptive schema formats where columns are named 'id' or 'key' 
 * and payloads are named 'value', 'config' or 'settings'.
 */
export async function getSupabaseSetting<T>(key: string, defaultValue: T): Promise<T> {
  if (!supabase) {
    return defaultValue;
  }
  
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*');
      
    if (error) {
      console.warn(`Warning reading settings table from Supabase for key [${key}]:`, error.message || error);
      return defaultValue;
    }
    
    if (data && data.length > 0) {
      const row = data.find(r => r.key === key || r.id === key);
      if (row) {
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
        return configPayload !== undefined ? (configPayload as T) : defaultValue;
      }
    }
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
    // Remedy 3: Formatter guard - serialize object/array, keep string plain
    const normalizedValue = typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : value;

    // Main Operation: Direct upsert by key with conflict resolution on key
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({ key: key, value: normalizedValue }, { onConflict: 'key' });

    if (!upsertError) {
      return true;
    }

    console.warn(`Direct upsert on Conflict 'key' failed, executing defensive select/update/insert rollback flow:`, upsertError.message);

    // Defensive fallback: Check existence and perform separate UPDATE/INSERT query
    const { data: existingRow, error: selectError } = await supabase
      .from('settings')
      .select('id')
      .eq('key', key)
      .maybeSingle();

    if (!selectError && existingRow) {
      // Record exists, do a targeted UPDATE
      const { error: updateError } = await supabase
        .from('settings')
        .update({ value: normalizedValue })
        .eq('key', key);
      return !updateError;
    } else {
      // Record does not exist, do a targeted INSERT
      const { error: insertError } = await supabase
        .from('settings')
        .insert({ key: key, value: normalizedValue });
      return !insertError;
    }
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
  return rows.map(r => {
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
      dni_reverso_1: r.dni_reverso_1 !== undefined ? r.dni_reverso_1 : (r.dni_revers_1 || r.c1_dni_revers_url || r.c1DniReversUrl || ''),
      dni_reverso_2: r.dni_reverso_2 !== undefined ? r.dni_reverso_2 : (r.dni_revers_2 || r.c2_dni_revers_url || r.c2DniReversUrl || ''),
      extras_seleccionats: Array.isArray(r.extras_seleccionats) ? r.extras_seleccionats : 
                           Array.isArray(r.extrasSeleccionats) ? r.extrasSeleccionats :
                           typeof r.extras_seleccionats === 'string' ? parseJSON(r.extras_seleccionats) : 
                           typeof r.extrasSeleccionats === 'string' ? parseJSON(r.extrasSeleccionats) : [],
      total_pedido: r.total_pedido !== undefined ? Number(r.total_pedido) : (r.totalPedido !== undefined ? Number(r.totalPedido) : undefined),

      estatPagament: r.estatPagament || r.estat_pagament || r.estatpagament || 'PENDENT',
      metodePagament: r.metodePagament || r.metode_pagament || r.metodepagament || null,
      estatDni: r.estatDni || r.estat_dni || r.estatdni || 'PENDENT',
      entregaMaterial: r.entregaMaterial || r.entrega_material || r.entregamaterial || 'PENDENT',

      creadoEn: r.creadoEn || r.creado_en || r.created_at || new Date().toISOString(),
      actualizadoEn: r.actualizadoEn || r.actualizado_en || r.updated_at || new Date().toISOString()
    };
  });
}

/**
 * Downloads all inscriptions directly from the 'inscripciones' table in Supabase.
 */
export async function getSupabaseInscripciones(): Promise<Inscripcio[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('inscripciones')
      .select('*');
      
    if (error) {
      console.warn("Error loading 'inscripciones' table from Supabase, trying fallback table name 'inscripcions':", error.message || error);
      // Fallback
      const resFallback = await supabase.from('inscripcions').select('*');
      if (resFallback.error) {
        console.error("Both 'inscripciones' and 'inscripcions' tables could not be read:", resFallback.error.message);
        return [];
      }
      return parseInscripcionesRows(resFallback.data || []);
    }
    
    return parseInscripcionesRows(data || []);
  } catch (err) {
    console.error("Exception fetching inscriptions from Supabase:", err);
    return [];
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
    
    // Attempt 1: insert/upsert with CamelCase properties
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
        dni_reverso_1: ins.dni_reverso_1 || null,
        dni_reverso_2: ins.dni_reverso_2 || null,
        extras_seleccionats: ins.extras_seleccionats || null,
        total_pedido: ins.total_pedido !== undefined ? ins.total_pedido : null,
        estatPagament: ins.estatPagament,
        metodePagament: ins.metodePagament,
        estatDni: ins.estatDni,
        entregaMaterial: ins.entregaMaterial,
        creadoEn: ins.creadoEn,
        actualizadoEn: ins.actualizadoEn
      });
      
    if (!response.error) return true;
    let lastError = response.error;
    
    // Attempt 2: snake_case columns
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
        dni_reverso_1: ins.dni_reverso_1 || null,
        dni_reverso_2: ins.dni_reverso_2 || null,
        extras_seleccionats: ins.extras_seleccionats || null,
        total_pedido: ins.total_pedido !== undefined ? ins.total_pedido : null,
        estat_pagament: ins.estatPagament,
        metode_pagament: ins.metodePagament,
        estat_dni: ins.estatDni,
        entrega_material: ins.entregaMaterial,
        creado_en: ins.creadoEn,
        actualizado_en: ins.actualizadoEn
      });

    if (!response.error) return true;
    lastError = response.error;

    // Attempt 3: Single JSON value column (payload or data)
    response = await supabase
      .from(tableName)
      .upsert({ id: ins.id, data: ins });
    if (!response.error) return true;

    response = await supabase
      .from(tableName)
      .upsert({ id: ins.id, value: ins });
    if (!response.error) return true;

    // Attempt 4: Fallback Catalan named table using JSON column
    response = await supabase
      .from('inscripcions')
      .upsert({ id: ins.id, data: ins });
    if (!response.error) return true;

    console.error("All adaptive column structure attempts for 'inscripciones' table failed:", response.error);
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
