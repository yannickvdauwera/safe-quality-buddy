DROP POLICY IF EXISTS "Authenticated can insert own RA signature" ON public.risk_analysis_signatures;
CREATE POLICY "HSE/manager/admin can insert RA signatures"
  ON public.risk_analysis_signatures FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hse_manager')
    OR public.has_role(auth.uid(), 'manager')
  );