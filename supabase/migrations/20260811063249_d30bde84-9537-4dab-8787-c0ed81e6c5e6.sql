-- 1. Lock down authenticated uploads to safety-observations bucket
DROP POLICY IF EXISTS "safety-observations upload authenticated" ON storage.objects;

CREATE POLICY "safety-observations upload own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'safety-observations'
  AND owner = auth.uid()
  AND name ~ ('^u/' || auth.uid()::text || '/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$')
);

-- 2. monday_sync_events: writes are service-role only (webhook). Make it explicit.
REVOKE INSERT, UPDATE, DELETE ON public.monday_sync_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, SELECT ON public.monday_sync_events FROM anon;
GRANT SELECT ON public.monday_sync_events TO authenticated;
GRANT ALL ON public.monday_sync_events TO service_role;

CREATE POLICY "No client writes to sync events"
ON public.monday_sync_events
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);