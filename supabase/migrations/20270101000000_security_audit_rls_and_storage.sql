-- ==============================================================================
-- Security Audit Remediation: Row Level Security (RLS), Storage & Constraints
-- Application: Tastvng 2027 — Inscripcions de Comparses
-- ==============================================================================

-- 1. INSCRIPCIONES TABLE CONSTRAINTS & RLS
CREATE TABLE IF NOT EXISTS public.inscripciones (
  id text PRIMARY KEY,
  codi_seguiment text,
  categoria text,
  preu_total numeric,
  pagat boolean DEFAULT false,
  recollit boolean DEFAULT false,
  estat_pagament text DEFAULT 'pendent',
  c1_nom text,
  c1_cognoms text,
  c1_email text,
  c1_telefon text,
  c1_dni_url text,
  c1_es_menor boolean DEFAULT false,
  c1_tutor_nom text,
  c1_tutor_cognoms text,
  c1_tutor_dni text,
  c1_tutor_telefon text,
  c1_samarreta text,
  c2_nom text,
  c2_cognoms text,
  c2_email text,
  c2_telefon text,
  c2_dni_url text,
  c2_es_menor boolean DEFAULT false,
  c2_tutor_nom text,
  c2_tutor_cognoms text,
  c2_tutor_dni text,
  c2_tutor_telefon text,
  c2_samarreta text,
  te_domas_balco boolean DEFAULT false,
  te_mocadors_extra integer DEFAULT 0,
  respostes_preguntes jsonb DEFAULT '[]'::jsonb,
  data_hora timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Ensure UNIQUE constraint on codi_seguiment to prevent duplicates and race conditions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_codi_seguiment_inscripciones'
  ) THEN
    ALTER TABLE public.inscripciones ADD CONSTRAINT unique_codi_seguiment_inscripciones UNIQUE (codi_seguiment);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
END $$;

-- Enable Row Level Security (RLS) on inscripciones
ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;

-- Drop legacy/insecure policies if present
DROP POLICY IF EXISTS "anon_all" ON public.inscripciones;
DROP POLICY IF EXISTS "anon_select" ON public.inscripciones;
DROP POLICY IF EXISTS "anon_select_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "anon_insert_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "auth_all_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "allow_all" ON public.inscripciones;

-- Public can ONLY insert new registrations (cannot read other users' sensitive PII/DNI)
CREATE POLICY anon_insert_inscripciones ON public.inscripciones
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated staff (with Supabase Auth) can select, update, and manage all registrations
CREATE POLICY auth_all_inscripciones ON public.inscripciones
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


-- 2. SETTINGS TABLE RLS (Protecting sensitive keys from anonymous users)
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON public.settings;
DROP POLICY IF EXISTS "anon_select_public_settings" ON public.settings;
DROP POLICY IF EXISTS "auth_all_settings" ON public.settings;
DROP POLICY IF EXISTS "allow_all_settings" ON public.settings;

-- Anon can ONLY select public, non-sensitive configuration keys
-- Secret keys (like tast_smtp_%, tast_staff_%, etc.) are NEVER readable by anon
CREATE POLICY anon_select_public_settings ON public.settings
  FOR SELECT TO anon
  USING (
    key LIKE 'tast_portada_config_%' OR
    key LIKE 'tast_config_%' OR
    key LIKE 'categoria_%' OR
    key LIKE 'tast_noticies_%' OR
    key LIKE 'codigo_vestimenta_%' OR
    key LIKE 'tast_secretaria_hours_%' OR
    key LIKE 'tast_nom_esdeveniment%' OR
    key LIKE 'tast_any_edicio%' OR
    key LIKE 'tast_direccio_esdeveniment%' OR
    key LIKE 'tast_email_subject_%' OR
    key LIKE 'tast_email_body_%' OR
    key LIKE 'tast_email_logo%'
  );

-- Authenticated admins can manage all settings
CREATE POLICY auth_all_settings ON public.settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


-- 3. STORAGE SECURITY: PRIVATE BUCKET FOR DNI DOCUMENTS
-- Ensure storage bucket 'dnis' is private (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dnis',
  'dnis',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- RLS policies on storage.objects for 'dnis' bucket
DROP POLICY IF EXISTS "anon_upload_dni" ON storage.objects;
DROP POLICY IF EXISTS "auth_manage_dnis" ON storage.objects;
DROP POLICY IF EXISTS "public_read_dnis" ON storage.objects;

-- Allow anonymous users to upload a DNI scan upon registration
CREATE POLICY anon_upload_dni ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'dnis');

-- Only authenticated users (admins/secretaries) can select, download or delete DNI files
CREATE POLICY auth_manage_dnis ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'dnis')
  WITH CHECK (bucket_id = 'dnis');
