/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { PreguntaDinamica } from '../types';

/**
 * Cargar preguntas desde Supabase.
 * Si la tabla no está creada o hay un error, el llamador puede usar CONFIG_INICIAL como fallback.
 */
export async function cargarPreguntes(): Promise<PreguntaDinamica[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured');
  }

  const { data, error } = await supabase
    .from('preguntes')
    .select('*')
    .order('ordre', { ascending: true });

  if (error) {
    console.error('Error fetching questions from Supabase table "preguntes":', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: String(row.id),
    titol: row.titol,
    tipus: row.tipus as 'text' | 'select' | 'boolean',
    opcions: Array.isArray(row.opcions) ? row.opcions : undefined,
    requerit: !!row.requerit,
    activa: !!row.activa
  }));
}

/**
 * Guardar una lista completa de preguntas en Supabase mediante upsert.
 */
export async function guardarPreguntes(preguntes: PreguntaDinamica[]): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
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
      throw error;
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
      throw error;
    }
    return true;
  } catch (err) {
    console.error(`Exception in eliminarPregunta for ${id}:`, err);
    return false;
  }
}
