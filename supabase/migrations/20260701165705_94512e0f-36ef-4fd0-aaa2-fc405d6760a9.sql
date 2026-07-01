
DROP POLICY IF EXISTS "signatures insert (auth)" ON public.toolbox_signatures;
CREATE POLICY "signatures insert (participant only)" ON public.toolbox_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.toolbox_session_participants p
      WHERE p.session_id = toolbox_signatures.session_id
        AND p.employee_id = toolbox_signatures.employee_id
    )
  );
