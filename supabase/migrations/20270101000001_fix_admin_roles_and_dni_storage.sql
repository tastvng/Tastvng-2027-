-- ==============================================================================
-- Security Audit Remediation: Strict Role-Based Access Control (RBAC) & DNI Security
-- Application: Tastvng 2027 — Inscripcions de Comparses
-- Migration: 20270101000001_fix_admin_roles_and_dni_storage.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PUBLIC.PROFILES TABLE (NO HARDCODED ADMINS)
-- ------------------------------------------------------------------------------

-- Create public.profiles table if it does not exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure the role column exists and enforces allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'));
  END IF;
END $$;

-- Enable Row Level Security (RLS) on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy or insecure policies on profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "allow_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "auth_all_profiles" ON public.profiles;

-- ------------------------------------------------------------------------------
-- 2. STRICT public.is_admin() FUNCTION (EXCLUSIVELY ROLE-BASED)
-- ------------------------------------------------------------------------------
-- Validates that the caller is authenticated AND has role = 'admin' in public.profiles.
-- Zero hardcoded emails, zero JWT fallbacks, zero username or domain checks.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Secure function execution
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Policies for public.profiles:
-- Authenticated user can ONLY view their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Real administrator can perform all operations on profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. TRIGGER FOR NEW USERS & SAFE BACKFILL (ALL DEFAULT TO 'user')
-- ------------------------------------------------------------------------------

-- All newly registered users receive role = 'user'. No email exceptions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth.users safely with role = 'user'
INSERT INTO public.profiles (id, role)
SELECT id, 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. HARDEN RLS ON INSCRIPCIONES (AND INSCRIPCIONS IF PRESENT)
-- ------------------------------------------------------------------------------

ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;

-- Drop all legacy or insecure policies
DROP POLICY IF EXISTS "anon_all" ON public.inscripciones;
DROP POLICY IF EXISTS "anon_select" ON public.inscripciones;
DROP POLICY IF EXISTS "anon_select_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "auth_all_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "admin_all_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "allow_all" ON public.inscripciones;

-- Ensure public anonymous registration insert policy exists
DROP POLICY IF EXISTS "anon_insert_inscripciones" ON public.inscripciones;
CREATE POLICY "anon_insert_inscripciones" ON public.inscripciones
  FOR INSERT TO anon
  WITH CHECK (true);

-- Only verified administrators can view, modify, or delete registrations
CREATE POLICY "admin_all_inscripciones" ON public.inscripciones
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Also audit alternative table 'inscripcions' if it exists in Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscripcions') THEN
    EXECUTE 'ALTER TABLE public.inscripcions ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "anon_all" ON public.inscripcions;';
    EXECUTE 'DROP POLICY IF EXISTS "anon_select" ON public.inscripcions;';
    EXECUTE 'DROP POLICY IF EXISTS "anon_insert_inscripcions" ON public.inscripcions;';
    EXECUTE 'DROP POLICY IF EXISTS "auth_all_inscripcions" ON public.inscripcions;';
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_inscripcions" ON public.inscripcions;';
    EXECUTE 'CREATE POLICY anon_insert_inscripcions ON public.inscripcions FOR INSERT TO anon WITH CHECK (true);';
    EXECUTE 'CREATE POLICY admin_all_inscripcions ON public.inscripcions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. HARDEN RLS ON SETTINGS
-- ------------------------------------------------------------------------------

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Drop legacy or insecure policies
DROP POLICY IF EXISTS "auth_all_settings" ON public.settings;
DROP POLICY IF EXISTS "admin_all_settings" ON public.settings;
DROP POLICY IF EXISTS "allow_all_settings" ON public.settings;

-- Public anon can ONLY select non-sensitive configuration keys
DROP POLICY IF EXISTS "anon_select_public_settings" ON public.settings;
DROP POLICY IF EXISTS "anon_select_settings" ON public.settings;
CREATE POLICY "anon_select_public_settings" ON public.settings
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

-- Only verified administrators can manage sensitive settings (SMTP, credentials, staff, etc.)
CREATE POLICY "admin_all_settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. HARDEN RLS ON PREGUNTES
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'preguntes') THEN
    EXECUTE 'ALTER TABLE public.preguntes ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "auth_all_preguntes" ON public.preguntes;';
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_preguntes" ON public.preguntes;';
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_preguntes" ON public.preguntes;';
    EXECUTE 'CREATE POLICY anon_select_preguntes ON public.preguntes FOR SELECT TO anon USING (true);';
    EXECUTE 'CREATE POLICY admin_all_preguntes ON public.preguntes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. STRICT DNI STORAGE SECURITY (REVOKE ANONYMOUS BUCKET UPLOAD)
-- ------------------------------------------------------------------------------

-- Ensure the bucket exists and is PRIVATE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dnis',
  'dnis',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- REVOKE all insecure anonymous and general authenticated policies on storage.objects
DROP POLICY IF EXISTS "anon_upload_dni" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_dni" ON storage.objects;
DROP POLICY IF EXISTS "anon_select_dni" ON storage.objects;
DROP POLICY IF EXISTS "public_upload_dni" ON storage.objects;
DROP POLICY IF EXISTS "public_read_dnis" ON storage.objects;
DROP POLICY IF EXISTS "auth_manage_dnis" ON storage.objects;
DROP POLICY IF EXISTS "dnis_public_read" ON storage.objects;
DROP POLICY IF EXISTS "dnis_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "dnis_authenticated_all" ON storage.objects;
DROP POLICY IF EXISTS "dnis_admin_all" ON storage.objects;

-- ONLY verified administrators can access, read, update, or delete DNI files directly
CREATE POLICY "dnis_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'dnis' AND public.is_admin())
  WITH CHECK (bucket_id = 'dnis' AND public.is_admin());

-- NOTE: Public DNI uploads do NOT have direct access to storage.objects.
-- They must be routed through the secure backend endpoint (/api/upload-dni),
-- which enforces magic-byte file signature validation, rate limits, and opaque naming.
