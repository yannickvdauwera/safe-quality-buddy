
-- Restrict SELECT on reports-attachments to owner or elevated roles / related report reporter
DROP POLICY IF EXISTS "Authenticated can read report attachments" ON storage.objects;
CREATE POLICY "Report attachments read owner or elevated"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

-- UPDATE policy for reports-attachments
CREATE POLICY "Report attachments update owner or elevated"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'reports-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'reports-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
);

-- UPDATE policy for safety-observations
CREATE POLICY "safety-observations update owner or elevated"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'safety-observations'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'safety-observations'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
);
