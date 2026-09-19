import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL!;
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(url, key);

async function inspectAll() {
  const tables = ["settings", "personalizacion", "sistema_config", "preguntes", "inscripciones"];
  for (const t of tables) {
    try {
      const res = await supabase.from(t).select("*").limit(50);
      if (res.error) {
        console.log(`Table ${t} error: ${res.error.message}`);
      } else {
        console.log(`Table ${t} count: ${res.data.length}`);
        const str = JSON.stringify(res.data);
        const matches = str.match(/https?:\/\/[^\s"'\\]+/g);
        if (matches) {
          console.log(`Table ${t} URLs:`, Array.from(new Set(matches)));
        }
      }
    } catch (e: any) {
      console.log(`Table ${t} err: ${e.message}`);
    }
  }
}
inspectAll();
