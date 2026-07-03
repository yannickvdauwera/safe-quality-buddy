
DROP POLICY IF EXISTS "Authenticated can upload report attachments" ON storage.objects;
CREATE POLICY "Elevated or reporter can upload report attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports-attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (SELECT 1 FROM public.reports r WHERE r.reporter_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "participants read" ON public.toolbox_session_participants;
CREATE POLICY "participants read own or elevated"
ON public.toolbox_session_participants FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hse_manager'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = toolbox_session_participants.employee_id AND e.user_id = auth.uid())
);
