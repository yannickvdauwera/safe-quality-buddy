
ALTER TABLE public.safety_observations
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signature_data_url text,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_function text,
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS submitted_via text NOT NULL DEFAULT 'internal';

CREATE UNIQUE INDEX IF NOT EXISTS safety_observations_public_token_idx
  ON public.safety_observations(public_token);

-- Allow anonymous inserts via public link (submitted_via must be 'public')
DROP POLICY IF EXISTS "Public can insert via public link" ON public.safety_observations;
CREATE POLICY "Public can insert via public link"
  ON public.safety_observations
  FOR INSERT
  TO anon
  WITH CHECK (submitted_via = 'public' AND reporter_id IS NULL);

GRANT INSERT ON public.safety_observations TO anon;
