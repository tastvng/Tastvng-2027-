/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { PreguntaDinamica } from '../types';

/**
 * Cargar preguntas desde Supabase.
 * Si la tabla no está creada o hay un error, el llamador puede usar CONFIG_INICIAL como fallback.
 * Si onlyActive es true, filtra solo aquellas con activa === true.
 */
export async function cargarPreguntes(onlyActive: boolean = false): Promise<PreguntaDinamica[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

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
      console.warn('Warning fetching questions from Supabase table "preguntes":', error.message || error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: String(row.id),
      titol: row.titol,
      tipus: row.tipus as 'text' | 'select' | 'boolean',
      opcions: Array.isArray(row.opcions) ? row.opcions : undefined,
      requerit: !!row.requerit,
      activa: !!row.activa
    }));
  } catch (err) {
    console.warn('Exception in cargarPreguntes:', err);
    return [];
  }
}

/**
 * Guardar una lista completa de preguntas en Supabase mediante sincronización y upsert.
 */
export async function guardarPreguntes(preguntes: PreguntaDinamica[]): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    const currentIds = preguntes.map(p => p.id);

    // 1. Eliminar de Supabase las preguntas que ya no estén en la lista
    const { data: existingRows } = await supabase.from('preguntes').select('id');
    if (existingRows && existingRows.length > 0) {
      const idsToDelete = existingRows
        .map(r => String(r.id))
        .filter(id => !currentIds.includes(id));

      if (idsToDelete.length > 0) {
        const { error: delError } = await supabase
          .from('preguntes')
          .delete()
          .in('id', idsToDelete);
        if (delError) {
          console.warn('Warning removing deleted questions from Supabase table "preguntes":', delError);
        }
      }
    }

    // 2. Upsert de todas las preguntas actuales con su orden actualizado
    if (preguntes.length > 0) {
      const payload = preguntes.map((p, index) => ({
        id: p.id,
        titol: p.titol,
        tipus: p.tipus,
        opcions: p.tipus === 'select' && p.opcions && p.opcions.length > 0 ? p.opcions : null,
        requerit: !!p.requerit,
        activa: !!p.activa,
        ordre: index,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('preguntes')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Error upserting questions into "preguntes" table:', error);
        if (error.code === '42P01') {
          console.warn("Table 'preguntes' does not exist yet. Fallback to settings config table for saving.");
          return true;
        }
        throw error;
      }
    }

    return true;
  } catch (err) {
    console.error('Exception in guardarPreguntes:', err);
    return false;
  }
}

/**
 * Eliminar una pregunta de Supabase por ID.
 */
export async function eliminarPregunta(id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('preguntes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting question with ID ${id} from "preguntes" table:`, error);
      if (error.code === '42P01') {
        console.warn("Table 'preguntes' does not exist yet. Fallback to settings config table for deleting.");
        return true;
      }
      throw error;
    }
    return true;
  } catch (err) {
    console.error(`Exception in eliminarPregunta for ${id}:`, err);
    return false;
  }
}
