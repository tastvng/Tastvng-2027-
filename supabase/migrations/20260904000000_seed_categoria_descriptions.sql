-- Seed default category descriptions into settings table if not present
INSERT INTO public.settings (key, value)
VALUES
  ('categoria_adulta_desc_ca', 'Recomanada per a participants de 16 anys o més. Inclou samarretes exclusives de la collada i puros dolços.'),
  ('categoria_adulta_desc_es', 'Recomendada para participantes de 16 años o más. Incluye camisetas exclusivas de la colla y puros dulces.'),
  ('categoria_juvenil_desc_ca', 'Ideal per a parelles joves de fins a 15 anys d''edat. Inclou fulard petit de color fúcsia.'),
  ('categoria_juvenil_desc_es', 'Ideal para parejas jóvenes de hasta 15 años de edad. Incluye pañuelo pequeño de color fucsia.')
ON CONFLICT (key) DO NOTHING;
