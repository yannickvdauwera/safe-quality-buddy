
-- Broaden profile visibility so teammates appear in pickers.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view team profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Executors on a risk analysis (freely chosen from app users)
CREATE TABLE public.risk_analysis_executors (
  analysis_id uuid NOT NULL REFERENCES public.risk_analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.risk_analysis_executors TO authenticated;
GRANT ALL ON public.risk_analysis_executors TO service_role;

ALTER TABLE public.risk_analysis_executors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read RA executors"
  ON public.risk_analysis_executors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HSE/manager/admin can manage RA executors"
  ON public.risk_analysis_executors FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );
