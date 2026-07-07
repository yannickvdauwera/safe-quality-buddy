
DO $$ BEGIN
  CREATE TYPE public.risk_method AS ENUM ('fine_kinney', 'kans_ernst');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.risk_analyses
  ADD COLUMN IF NOT EXISTS risk_method public.risk_method NOT NULL DEFAULT 'fine_kinney';
