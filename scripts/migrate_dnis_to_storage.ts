/**
 * Migration Script: Migrate base64 DNI images to Supabase Storage (bucket: 'dnis')
 * 
 * Execution:
 * npx tsx scripts/migrate_dnis_to_storage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no trobats al fitxer .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function migrate() {
  console.log("🔍 Cercant inscripcions amb DNI en format base64...");

  const { data: rows, error } = await supabase
    .from('inscripciones')
    .select('id, codiSeguiment, c1DniUrl, c2DniUrl')
    .or('c1DniUrl.like.data:%,c2DniUrl.like.data:%');

  if (error) {
    console.error("❌ Error consultant la base de dades:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("✅ No s'ha trobat cap DNI en base64 pendent de migrar.");
    return;
  }

  console.log(`📋 S'han trobat ${rows.length} inscripcions amb imatges base64.`);

  // Ensure bucket 'dnis' exists
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = (buckets || []).some(b => b.name === 'dnis');
    if (!exists) {
      console.log("🪣 Creant el bucket privat 'dnis' a Supabase Storage...");
      await supabase.storage.createBucket('dnis', { public: false });
    }
  } catch (bucketErr) {
    console.warn("⚠️ Avís comprovant bucket:", bucketErr);
  }

  for (const row of rows) {
    const updates: Record<string, any> = {};
    const code = (row.codiSeguiment || row.id || 'ins').replace(/[^a-zA-Z0-9_-]/g, '_');

    // Migrate c1DniUrl if base64
    if (typeof row.c1DniUrl === 'string' && row.c1DniUrl.startsWith('data:')) {
      try {
        const matches = row.c1DniUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const ext = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
          const buffer = Buffer.from(matches[2], 'base64');
          const filePath = `${row.id}_c1_${Date.now()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from('dnis')
            .upload(filePath, buffer, {
              contentType: mime,
              upsert: true
            });

          if (!upErr) {
            updates.c1DniUrl = filePath;
            console.log(`✓ [${code}] c1DniUrl migrat a Storage: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
          } else {
            console.error(`❌ Error pujant c1 de ${code}:`, upErr.message);
          }
        }
      } catch (err: any) {
        console.error(`❌ Excepció processant c1 de ${code}:`, err.message);
      }
    }

    // Migrate c2DniUrl if base64
    if (typeof row.c2DniUrl === 'string' && row.c2DniUrl.startsWith('data:')) {
      try {
        const matches = row.c2DniUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const ext = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
          const buffer = Buffer.from(matches[2], 'base64');
          const filePath = `${row.id}_c2_${Date.now()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from('dnis')
            .upload(filePath, buffer, {
              contentType: mime,
              upsert: true
            });

          if (!upErr) {
            updates.c2DniUrl = filePath;
            console.log(`✓ [${code}] c2DniUrl migrat a Storage: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
          } else {
            console.error(`❌ Error pujant c2 de ${code}:`, upErr.message);
          }
        }
      } catch (err: any) {
        console.error(`❌ Excepció processant c2 de ${code}:`, err.message);
      }
    }

    // Update row in table
    if (Object.keys(updates).length > 0) {
      const { error: rowUpErr } = await supabase
        .from('inscripciones')
        .update(updates)
        .eq('id', row.id);

      if (rowUpErr) {
        console.error(`❌ Error actualitzant fila ${row.id}:`, rowUpErr.message);
      } else {
        console.log(`✨ Fila ${row.id} actualitzada amb les noves rutes.`);
      }
    }
  }

  console.log("🎉 Migració de DNI base64 finalitzada amb èxit.");
}

migrate().catch(console.error);
