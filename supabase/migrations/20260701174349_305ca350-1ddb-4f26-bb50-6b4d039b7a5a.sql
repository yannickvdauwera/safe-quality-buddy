
CREATE POLICY "Authenticated can upload report attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports-attachments');

CREATE POLICY "Authenticated can read report attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reports-attachments');

CREATE POLICY "Authenticated can delete report attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reports-attachments');
