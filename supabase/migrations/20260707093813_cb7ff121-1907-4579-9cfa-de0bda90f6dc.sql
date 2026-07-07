
DROP POLICY IF EXISTS "Elevated or reporter can upload report attachments" ON storage.objects;

CREATE POLICY "Elevated or reporter can upload report attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reports-attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.reporter_id = auth.uid()
        AND r.id::text = split_part(storage.objects.name, '/', 1)
    )
  )
);
