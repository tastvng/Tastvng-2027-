import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = (metaEnv.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Clean logging
if (isSupabaseConfigured) {
  console.log("Supabase client initialized successfully using environment variables.");
} else {
  console.log("Supabase is not yet fully configured in your environment. Falling back gracefully to LocalStorage for interface settings.");
}

/**
 * Interface representing standard landing / portada setting structure
 */
export async function getSupabaseSettings(): Promise<any | null> {
  if (!supabase) {
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*');
      
    if (error) {
      console.warn("Warning reading settings table from Supabase:", error.message || error);
      return null;
    }
    
    if (data && data.length > 0) {
      // Find row matching our configuration key/id
      const row = data.find(r => 
        r.key === 'tast_portada_config_2026' || 
        r.id === 'tast_portada_config_2026' || 
        r.key === 'portada_config' || 
        r.id === 'portada_config'
      ) || data[0];
                  
      if (row) {
        // Resolve value from the found row
        let configPayload = row.value !== undefined ? row.value 
                        : row.config !== undefined ? row.config 
                        : row.settings !== undefined ? row.settings 
                        : row;
        
        if (typeof configPayload === 'string') {
          try {
            configPayload = JSON.parse(configPayload);
          } catch(e) {
            // not double serialized
          }
        }
        return configPayload;
      }
    }
    return null;
  } catch (err) {
    console.warn("Exception fetching settings from Supabase, operating in LocalStorage fallback mode:", err);
    return null;
  }
}

/**
 * Saves or updates settings securely with adaptive columns
 */
export async function saveSupabaseSettings(config: any): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    // Attempt 1: { key: 'tast_portada_config_2026', value: config }
    let response = await supabase
      .from('settings')
      .upsert({ key: 'tast_portada_config_2026', value: config });
      
    if (!response.error) return true;
    let lastError = response.error;
    
    // Attempt 2: { id: 'tast_portada_config_2026', value: config }
    if (lastError.message?.includes('column "key" does not exist') || lastError.message?.includes('key')) {
      response = await supabase
        .from('settings')
        .upsert({ id: 'tast_portada_config_2026', value: config });
      if (!response.error) return true;
      lastError = response.error;
    }
    
    // Attempt 3: { key: 'tast_portada_config_2026', config: config }
    if (lastError.message?.includes('column "value" does not exist') || lastError.message?.includes('value')) {
      response = await supabase
        .from('settings')
        .upsert({ key: 'tast_portada_config_2026', config: config });
      if (!response.error) return true;
      lastError = response.error;
    }

    // Attempt 4: { id: 'tast_portada_config_2026', config: config }
    response = await supabase
      .from('settings')
      .upsert({ id: 'tast_portada_config_2026', config: config });
      
    if (!response.error) return true;
    
    console.error("All adaptive upsert attempts on 'settings' table failed:", response.error);
    return false;
  } catch (err) {
    console.error("Exception saving settings to Supabase:", err);
    return false;
  }
}
