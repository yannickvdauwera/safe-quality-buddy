
-- toolbox_signatures: restrict SELECT to elevated roles or the signer's linked user
DROP POLICY "signatures read" ON public.toolbox_signatures;
CREATE POLICY "signatures read elevated or own" ON public.toolbox_signatures
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hse_manager'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = toolbox_signatures.employee_id AND e.user_id = auth.uid())
);

-- safety_observations: restrict SELECT to elevated roles or the reporter
DROP POLICY "Authenticated can view all safety observations" ON public.safety_observations;
CREATE POLICY "safety observations read elevated or own" ON public.safety_observations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hse_manager'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR auth.uid() = reporter_id
);

-- toolbox_sessions: restrict SELECT to elevated roles or session participants
DROP POLICY "sessions read" ON public.toolbox_sessions;
CREATE POLICY "sessions read elevated or participant" ON public.toolbox_sessions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hse_manager'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.toolbox_session_participants p
    JOIN public.employees e ON e.id = p.employee_id
    WHERE p.session_id = toolbox_sessions.id AND e.user_id = auth.uid()
  )
);

-- safety-observations storage: restrict SELECT to owner or elevated, add DELETE policy
DROP POLICY "safety-observations read" ON storage.objects;
CREATE POLICY "safety-observations read owner or elevated" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'safety-observations'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "safety-observations delete owner or elevated" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'safety-observations'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
  )
);
