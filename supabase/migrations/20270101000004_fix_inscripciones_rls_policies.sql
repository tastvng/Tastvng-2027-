-- ==============================================================================
-- Migration: 20270101000004_fix_inscripciones_rls_policies.sql
-- Fix RLS policies for public.inscripciones:
-- 1. Allow INSERT for anon (public unregistered users)
-- 2. Allow INSERT for authenticated (users with active session)
-- 3. Restrict SELECT, UPDATE, DELETE to administrators via public.is_admin()
-- ==============================================================================

-- Ensure RLS is enabled on public.inscripciones
ALTER TABLE IF EXISTS public.inscripciones ENABLE ROW LEVEL SECURITY;

-- 1. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "anon_insert_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "authenticated_insert_inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "admin_all_inscripciones" ON public.inscripciones;

-- 2. Public anonymous users can ONLY insert
CREATE POLICY anon_insert_inscripciones
ON public.inscripciones
FOR INSERT
TO anon
WITH CHECK (true);

-- 3. Authenticated users can ALSO insert (e.g. if submitting with active auth session)
CREATE POLICY authenticated_insert_inscripciones
ON public.inscripciones
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Administrators have full access (SELECT, INSERT, UPDATE, DELETE) via public.is_admin()
CREATE POLICY admin_all_inscripciones
ON public.inscripciones
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
