-- ==============================================================================
-- Security Audit Remediation: Strict Role-Based Access Control (RBAC) & DNI Security
-- Application: Tastvng 2027 — Inscripcions de Comparses
-- Migration: 20270101000001_fix_admin_roles_and_dni_storage.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PUBLIC.PROFILES TABLE (NO HARDCODED ADMINS)
-- ------------------------------------------------------------------------------

-- Create public.profiles table if it does not already exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure the role column exists and enforces allowed values if table already existed
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

-- ------------------------------------------------------------------------------
-- 2. STRICT public.is_admin() FUNCTION (EXCLUSIVELY ROLE-BASED)
-- ------------------------------------------------------------------------------
-- Validates that caller is authenticated AND has role = 'admin' in public.profiles.
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

-- Secure function execution permissions
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Audit and clean up policies on public.profiles via pg_policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles'
      AND policyname NOT IN ('profiles_select_own', 'profiles_admin_all')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', pol.policyname);
  END LOOP;
END $$;

-- Policy: Authenticated users can ONLY view their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Policy: Only verified administrators can perform administrative operations on profiles
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
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

-- Table: public.inscripciones (checked dynamically via information_schema)
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscripciones') THEN
    ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;

    -- Audit and remove any policy not matching the strict approved policy set
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'inscripciones'
        AND policyname NOT IN ('anon_insert_inscripciones', 'admin_all_inscripciones')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.inscripciones;', pol.policyname);
    END LOOP;

    -- Re-create / ensure strictly defined policies
    DROP POLICY IF EXISTS "anon_insert_inscripciones" ON public.inscripciones;
    CREATE POLICY "anon_insert_inscripciones" ON public.inscripciones
      FOR INSERT TO anon
      WITH CHECK (true);

    DROP POLICY IF EXISTS "admin_all_inscripciones" ON public.inscripciones;
    CREATE POLICY "admin_all_inscripciones" ON public.inscripciones
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Alternative Table: public.inscripcions (checked dynamically via information_schema)
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscripcions') THEN
    ALTER TABLE public.inscripcions ENABLE ROW LEVEL SECURITY;

    -- Audit and remove any policy not matching the strict approved policy set
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'inscripcions'
        AND policyname NOT IN ('anon_insert_inscripcions', 'admin_all_inscripcions')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.inscripcions;', pol.policyname);
    END LOOP;

    DROP POLICY IF EXISTS "anon_insert_inscripcions" ON public.inscripcions;
    CREATE POLICY "anon_insert_inscripcions" ON public.inscripcions
      FOR INSERT TO anon
      WITH CHECK (true);

    DROP POLICY IF EXISTS "admin_all_inscripcions" ON public.inscripcions;
    CREATE POLICY "admin_all_inscripcions" ON public.inscripcions
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. HARDEN RLS ON SETTINGS
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

    -- Audit and remove any policy not matching the strict approved policy set
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'settings'
        AND policyname NOT IN ('anon_select_public_settings', 'admin_all_settings')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.settings;', pol.policyname);
    END LOOP;

    -- Anon policy: only non-sensitive configuration keys (never SMTP, secrets, or passwords)
    DROP POLICY IF EXISTS "anon_select_public_settings" ON public.settings;
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

    -- Admin policy: administrators manage all settings via public.is_admin()
    DROP POLICY IF EXISTS "admin_all_settings" ON public.settings;
    CREATE POLICY "admin_all_settings" ON public.settings
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. HARDEN RLS ON PREGUNTES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'preguntes') THEN
    ALTER TABLE public.preguntes ENABLE ROW LEVEL SECURITY;

    -- Audit and remove any policy not matching the strict approved policy set
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'preguntes'
        AND policyname NOT IN ('anon_select_preguntes', 'admin_all_preguntes')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.preguntes;', pol.policyname);
    END LOOP;

    DROP POLICY IF EXISTS "anon_select_preguntes" ON public.preguntes;
    CREATE POLICY "anon_select_preguntes" ON public.preguntes
      FOR SELECT TO anon
      USING (true);

    DROP POLICY IF EXISTS "admin_all_preguntes" ON public.preguntes;
    CREATE POLICY "admin_all_preguntes" ON public.preguntes
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. STRICT DNI STORAGE SECURITY (REVOKE ANONYMOUS BUCKET UPLOAD)
-- ------------------------------------------------------------------------------

-- Ensure the 'dnis' bucket is strictly private and limited to valid document types
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
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
  END IF;
END $$;

-- Audit and remove all insecure anonymous and general authenticated policies on storage.objects for dnis
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    -- Dynamically drop any policies on storage.objects targeting dnis that are not dnis_admin_all
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND (
          policyname ILIKE '%dni%' 
          OR coalesce(qual, '') ILIKE '%dnis%' 
          OR coalesce(with_check, '') ILIKE '%dnis%'
        )
        AND policyname != 'dnis_admin_all'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', pol.policyname);
    END LOOP;

    -- Re-create / ensure strictly defined admin-only policy on storage.objects for bucket 'dnis'
    DROP POLICY IF EXISTS "dnis_admin_all" ON storage.objects;
    CREATE POLICY "dnis_admin_all" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = 'dnis' AND public.is_admin())
      WITH CHECK (bucket_id = 'dnis' AND public.is_admin());
  END IF;
END $$;

-- NOTE: Public DNI uploads do NOT have direct access to storage.objects.
-- They must be routed through the secure backend endpoint (/api/upload-dni),
-- which enforces magic-byte file signature validation, rate limits, and opaque naming.
