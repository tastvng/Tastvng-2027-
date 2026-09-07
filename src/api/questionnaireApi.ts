/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured, logSupabaseWriteDiagnostic } from '../supabaseClient';
import { PreguntaDinamica } from '../types';

export interface CargarPreguntesResult {
  data: PreguntaDinamica[] | null;
  source: 'preguntes' | 'fallback';
  error?: any;
  count: number;
}

/**
 * Cargar preguntas desde Supabase con diagnósticos detallados.
 * Utiliza la tabla 'preguntes' como fuente primaria.
 * Si onlyActive es true, filtra solo aquellas con activa === true y respeta el orden 'ordre'.
 */
export async function cargarPreguntesDetallat(onlyActive: boolean = false): Promise<CargarPreguntesResult> {
  // Intent 1: Directe a Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('preguntes')
        .select('*')
        .order('ordre', { ascending: true });

      if (onlyActive) {
        query = query.eq('activa', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Cüestionari Diagnòstic] Error exacte de Supabase al carregar de la taula "preguntes":', error);
      } else if (data !== null && Array.isArray(data)) {
        const mapped: PreguntaDinamica[] = data.map((row: any, idx: number) => ({
          id: String(row.id),
          titol: String(row.titol || ''),
          tipus: (row.tipus || 'text') as 'text' | 'select' | 'boolean',
          opcions: Array.isArray(row.opcions)
            ? row.opcions
            : (typeof row.opcions === 'string' ? JSON.parse(row.opcions) : undefined),
          requerit: !!row.requerit,
          activa: !!row.activa,
          ordre: typeof row.ordre === 'number' ? row.ordre : idx
        }));

        // Ordenar explícitament pel camp ordre
        mapped.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

        console.log(`[Cüestionari Diagnòstic] Font usada: preguntes (Supabase). Nombre de preguntes carregades: ${mapped.length} (només actives: ${onlyActive}).`);
        return {
          data: mapped,
          source: 'preguntes',
          count: mapped.length
        };
      }
    } catch (err) {
      console.error('[Cüestionari Diagnòstic] Excepció en connexió directa amb Supabase:', err);
    }
  }

  // Intent 2: Proxy API del servidor (/api/preguntes) si la consulta directa falla
  try {
    const url = `/api/preguntes?active=${onlyActive ? 'true' : 'false'}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      if (json && Array.isArray(json.data)) {
        const mapped: PreguntaDinamica[] = json.data.map((row: any, idx: number) => ({
          id: String(row.id),
          titol: String(row.titol || ''),
          tipus: (row.tipus || 'text') as 'text' | 'select' | 'boolean',
          opcions: Array.isArray(row.opcions)
            ? row.opcions
            : (typeof row.opcions === 'string' ? JSON.parse(row.opcions) : undefined),
          requerit: !!row.requerit,
          activa: !!row.activa,
          ordre: typeof row.ordre === 'number' ? row.ordre : idx
        }));

        mapped.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

        console.log(`[Cüestionari Diagnòstic] Font usada: preguntes (via /api/preguntes). Nombre de preguntes carregades: ${mapped.length} (només actives: ${onlyActive}).`);
        return {
          data: mapped,
          source: 'preguntes',
          count: mapped.length
        };
      }
    }
  } catch (apiErr) {
    console.warn('[Cüestionari Diagnòstic] Avís: La consulta a /api/preguntes no ha respost:', apiErr);
  }

  // Si ambdues fallen, retornar error amb source fallback
  console.warn('[Cüestionari Diagnòstic] Font usada: fallback (config.preguntesFormulari). Supabase no disponible o taula inaccesible.');
  return {
    data: null,
    source: 'fallback',
    error: 'No s\'han pogut recuperar les preguntes de Supabase.',
    count: 0
  };
}

/**
 * Cargar preguntas des de Supabase.
 * Retorna l'array de preguntes si Supabase respon amb èxit (fins i tot si és buit []),
 * o una llista buida si la càrrega falla completament.
 */
export async function cargarPreguntes(onlyActive: boolean = false): Promise<PreguntaDinamica[]> {
  const result = await cargarPreguntesDetallat(onlyActive);
  return result.data || [];
}

/**
 * Guardar una lista completa de preguntas en Supabase mediante sincronización y upsert.
 * Retorna { success: true } o { success: false, error: ... }.
 * NO amaga els errors: si falla a Supabase, retorna success = false.
 */
export async function guardarPreguntes(preguntes: PreguntaDinamica[]): Promise<{ success: boolean; error?: string }> {
  const currentIds = preguntes.map(p => String(p.id));

  // Diagnòstic previ a l'escriptura
  await logSupabaseWriteDiagnostic('preguntes', `GUARDAR_PREGUNTES (${preguntes.length} preguntes)`);

  // 1. Intentar directament a través del client Supabase de l'administrador
  if (isSupabaseConfigured && supabase) {
    try {
      // Pas A: Eliminar preguntes esborrades
      const { data: existingRows, error: selErr } = await supabase.from('preguntes').select('id');
      if (selErr) {
        console.error('[Supabase Write Error] Taula: preguntes, Operació: SELECT existents, Error complet:', selErr);
      } else if (existingRows && existingRows.length > 0) {
        const idsToDelete = existingRows
          .map(r => String(r.id))
          .filter(id => !currentIds.includes(id));

        if (idsToDelete.length > 0) {
          await logSupabaseWriteDiagnostic('preguntes', `DELETE (${idsToDelete.length} preguntes sobrants)`);
          const { error: delErr } = await supabase.from('preguntes').delete().in('id', idsToDelete);
          if (delErr) {
            console.error('[Supabase Write Error] Taula: preguntes, Operació: DELETE (sobrants), Error complet:', delErr);
          } else {
            console.log(`[guardarPreguntes] Preguntes esborrades de Supabase: ${idsToDelete.join(', ')}`);
          }
        }
      }

      // Pas B: Upsert de preguntes actuals amb ordre actualitzat
      if (preguntes.length > 0) {
        const payload = preguntes.map((p, index) => ({
          id: String(p.id),
          titol: String(p.titol || ''),
          tipus: p.tipus || 'text',
          opcions: p.tipus === 'select' && Array.isArray(p.opcions) && p.opcions.length > 0 ? p.opcions : null,
          requerit: !!p.requerit,
          activa: !!p.activa,
          ordre: typeof p.ordre === 'number' ? p.ordre : index,
          updated_at: new Date().toISOString()
        }));

        await logSupabaseWriteDiagnostic('preguntes', `UPSERT (${payload.length} preguntes)`);
        const { error: upErr } = await supabase
          .from('preguntes')
          .upsert(payload, { onConflict: 'id' });

        if (upErr) {
          console.error('[Supabase Write Error] Taula: preguntes, Operació: UPSERT, Error complet:', upErr);
        } else {
          console.log(`[guardarPreguntes] Resultat real de guardar a Supabase: Èxit (${payload.length} preguntes sincronitzades correctament).`);
          return { success: true };
        }
      } else {
        // Totes les preguntes han estat esborrades
        console.log('[guardarPreguntes] Resultat real de guardar a Supabase: Èxit (llista buida, totes esborrades).');
        return { success: true };
      }
    } catch (directErr) {
      console.error('[Supabase Write Error] Excepció en accés directe Supabase:', directErr);
    }
  }

  // 2. Intentar a través del bridge protegit del servidor /api/admin/preguntes amb el token d'administrador
  try {
    let token = '';
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || '';
    }

    const resp = await fetch('/api/admin/preguntes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ preguntes })
    });

    const json = await resp.json();
    if (resp.ok && json.success) {
      console.log(`[guardarPreguntes] Resultat real de guardar a Supabase (via /api/admin/preguntes): Èxit (${preguntes.length} preguntes sincronitzades).`);
      return { success: true };
    } else {
      const errorMsg = json.error || `HTTP ${resp.status}: Fallada al servidor`;
      console.error('[guardarPreguntes] Resultat real de guardar a Supabase: Error:', errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (apiErr: any) {
    const errorMsg = apiErr?.message || String(apiErr);
    console.error('[guardarPreguntes] Resultat real de guardar a Supabase: Error fatal:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Eliminar una pregunta de Supabase per ID.
 * Retorna { success: true } o { success: false, error: ... }.
 */
export async function eliminarPregunta(id: string): Promise<{ success: boolean; error?: string }> {
  // Diagnòstic previ a l'eliminació
  await logSupabaseWriteDiagnostic('preguntes', `DELETE (id: ${id})`);

  // 1. Intentar directament a través de Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('preguntes')
        .delete()
        .eq('id', id);

      if (!error) {
        console.log(`[eliminarPregunta] Resultat real d'eliminar de Supabase: Pregunta "${id}" eliminada amb èxit.`);
        return { success: true };
      }
      console.error(`[Supabase Write Error] Taula: preguntes, Operació: DELETE (id: ${id}), Error complet:`, error);
    } catch (err) {
      console.error(`[Supabase Write Error] Excepció en esborrat directe de "${id}":`, err);
    }
  }

  // 2. Intentar mitjançant bridge del servidor /api/admin/preguntes/:id
  try {
    let token = '';
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || '';
    }

    const resp = await fetch(`/api/admin/preguntes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    const json = await resp.json();
    if (resp.ok && json.success) {
      console.log(`[eliminarPregunta] Resultat real d'eliminar de Supabase (via /api/admin/preguntes): Pregunta "${id}" eliminada amb èxit.`);
      return { success: true };
    } else {
      const errorMsg = json.error || `HTTP ${resp.status}: Error esborrant pregunta`;
      console.error(`[eliminarPregunta] Resultat real d'eliminar de Supabase: Error eliminant "${id}":`, errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (apiErr: any) {
    const errorMsg = apiErr?.message || String(apiErr);
    console.error(`[eliminarPregunta] Resultat real d'eliminar de Supabase: Error:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}
