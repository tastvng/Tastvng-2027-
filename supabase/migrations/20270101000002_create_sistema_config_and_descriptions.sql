-- ==============================================================================
-- Migration: 20270101000002_create_sistema_config_and_descriptions.sql
-- Description: Create public.sistema_config table, populate descriptions for
--              Parella Adulta / Juvenil in CA and ES, and configure armilla_opcional.
-- ==============================================================================

-- 1. CREATE SISTEMA_CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.sistema_config (
  clau text PRIMARY KEY,
  valor jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add compatibility columns 'key' and 'value' if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sistema_config' AND column_name = 'key'
  ) THEN
    ALTER TABLE public.sistema_config ADD COLUMN "key" text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sistema_config' AND column_name = 'value'
  ) THEN
    ALTER TABLE public.sistema_config ADD COLUMN "value" jsonb;
  END IF;
END $$;

-- 2. ENABLE ROW LEVEL SECURITY (safe against views)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relname = 'sistema_config' 
      AND c.relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE public.sistema_config ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 3. POLICIES FOR SISTEMA_CONFIG
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relname = 'sistema_config' 
      AND c.relkind IN ('r', 'p')
  ) THEN
    DROP POLICY IF EXISTS anon_select_sistema_config ON public.sistema_config;
    CREATE POLICY anon_select_sistema_config ON public.sistema_config
      FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS auth_manage_sistema_config ON public.sistema_config;
    CREATE POLICY auth_manage_sistema_config ON public.sistema_config
      FOR ALL TO authenticated
      USING (
        CASE 
          WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN public.is_admin()
          ELSE true
        END
      )
      WITH CHECK (
        CASE 
          WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN public.is_admin()
          ELSE true
        END
      );
  END IF;
END $$;

-- 4. INSERT CONFIGURATION RECORDS (JSONB)
INSERT INTO public.sistema_config (clau, valor, "key", "value")
VALUES 
  (
    'descripcio_parella_adulta_ca',
    '{"text": "Especialista para a partir de 16 anys o més. Inclou samarretres exclusives de la collada i purs dolços."}'::jsonb,
    'descripcio_parella_adulta_ca',
    '{"text": "Especialista para a partir de 16 anys o més. Inclou samarretres exclusives de la collada i purs dolços."}'::jsonb
  ),
  (
    'descripcio_parella_adulta_es',
    '{"text": "Especial para a partir de 16 años o más. Incluye camisetas exclusivas de la colla y puros dulces."}'::jsonb,
    'descripcio_parella_adulta_es',
    '{"text": "Especial para a partir de 16 años o más. Incluye camisetas exclusivas de la colla y puros dulces."}'::jsonb
  ),
  (
    'descripcio_parella_juvenil_ca',
    '{"text": "Ideal per a parelles de 5 a 15 anys d''edat. Inclou fulard petit de color fucsia."}'::jsonb,
    'descripcio_parella_juvenil_ca',
    '{"text": "Ideal per a parelles de 5 a 15 anys d''edat. Inclou fulard petit de color fucsia."}'::jsonb
  ),
  (
    'descripcio_parella_juvenil_es',
    '{"text": "Ideal para parejas de 5 a 15 años de edad. Incluye pañuelo pequeño de color fucsia."}'::jsonb,
    'descripcio_parella_juvenil_es',
    '{"text": "Ideal para parejas de 5 a 15 años de edad. Incluye pañuelo pequeño de color fucsia."}'::jsonb
  ),
  (
    'armilla_opcional',
    '{"opcional": true}'::jsonb,
    'armilla_opcional',
    '{"opcional": true}'::jsonb
  )
ON CONFLICT (clau) DO UPDATE 
SET valor = EXCLUDED.valor, 
    "key" = EXCLUDED."key", 
    "value" = EXCLUDED."value",
    updated_at = now();

-- 5. SYNC WITH PUBLIC.SETTINGS TABLE IF PRESENT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relname = 'settings' 
      AND c.relkind IN ('r', 'p')
  ) THEN
    INSERT INTO public.settings (key, value)
    VALUES
      ('descripcio_parella_adulta_ca', '{"text": "Especialista para a partir de 16 anys o més. Inclou samarretres exclusives de la collada i purs dolços."}'),
      ('descripcio_parella_adulta_es', '{"text": "Especial para a partir de 16 años o más. Incluye camisetas exclusivas de la colla y puros dulces."}'),
      ('descripcio_parella_juvenil_ca', '{"text": "Ideal per a parelles de 5 a 15 anys d''edat. Inclou fulard petit de color fucsia."}'),
      ('descripcio_parella_juvenil_es', '{"text": "Ideal para parejas de 5 a 15 años de edad. Incluye pañuelo pequeño de color fucsia."}'),
      ('armilla_opcional', '{"opcional": true}')
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;
  END IF;
END $$;
