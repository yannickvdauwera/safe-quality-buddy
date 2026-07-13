-- Extra velden voor items van een risicoanalyse organisatie
ALTER TABLE public.risk_analysis_items
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS current_state text,
  ADD COLUMN IF NOT EXISTS legislation text,
  ADD COLUMN IF NOT EXISTS measure_status text CHECK (measure_status IN ('open','in_progress','done')),
  ADD COLUMN IF NOT EXISTS smiley text CHECK (smiley IN ('green','yellow','red'));