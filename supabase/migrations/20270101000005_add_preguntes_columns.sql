-- Migration: 20270101000005_add_preguntes_columns.sql
-- Add configurable breakfast / dynamic question fields to public.preguntes

ALTER TABLE public.preguntes ADD COLUMN IF NOT EXISTS condicio jsonb;
ALTER TABLE public.preguntes ADD COLUMN IF NOT EXISTS ambit text DEFAULT 'parella';
ALTER TABLE public.preguntes ADD COLUMN IF NOT EXISTS presentacio text DEFAULT 'desplegable';
ALTER TABLE public.preguntes ADD COLUMN IF NOT EXISTS descripcio text;
ALTER TABLE public.preguntes ADD COLUMN IF NOT EXISTS preus jsonb;
ALTER TABLE public.preguntes ADD COLUMN IF NOT EXISTS concepte text;
ALTER TABLE public.preguntes ADD COLUMN IF NOT EXISTS concepte_es text;
