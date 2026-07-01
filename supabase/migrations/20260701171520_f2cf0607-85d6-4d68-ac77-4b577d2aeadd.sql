
DROP POLICY IF EXISTS "safety-observations upload" ON storage.objects;
DROP POLICY IF EXISTS "safety-observations read" ON storage.objects;

CREATE POLICY "safety-observations upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'safety-observations');

CREATE POLICY "safety-observations read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'safety-observations');
