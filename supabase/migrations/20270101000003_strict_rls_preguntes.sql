-- ==============================================================================
-- Migration: 20270101000003_strict_rls_preguntes.sql
-- Dedicated "preguntes" table configuration with strict RLS policies:
-- 1. Anonymous users (public form) can ONLY SELECT active questions (activa = true).
-- 2. Authenticated administrators (is_admin() or authenticated) can SELECT, INSERT, UPDATE, DELETE.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.preguntes (
  id          text PRIMARY KEY,
  titol       text NOT NULL,
  tipus       text NOT NULL,
  opcions     jsonb,
  requerit    boolean NOT NULL DEFAULT false,
  activa      boolean NOT NULL DEFAULT true,
  ordre       integer,
  updated_at  timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.preguntes ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "anon_select_preguntes" ON public.preguntes;
DROP POLICY IF EXISTS "anon_select_active_preguntes" ON public.preguntes;
DROP POLICY IF EXISTS "auth_all_preguntes" ON public.preguntes;
DROP POLICY IF EXISTS "admin_all_preguntes" ON public.preguntes;

-- 1. Allow anonymous visitors to ONLY read active questions
CREATE POLICY anon_select_active_preguntes ON public.preguntes
  FOR SELECT TO anon
  USING (activa = true);

-- 2. Allow authenticated staff full administrative privileges
CREATE POLICY auth_all_preguntes ON public.preguntes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
