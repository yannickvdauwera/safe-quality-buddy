
-- 1. Employees: restrict SELECT to elevated roles or linked user
DROP POLICY IF EXISTS "All authenticated can view employees" ON public.employees;
CREATE POLICY "Elevated roles or self can view employees"
  ON public.employees FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR user_id = auth.uid()
  );

-- 2. Profiles: users can only view their own profile
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Storage: reports-attachments — only admin/hse_manager or owner can delete
DROP POLICY IF EXISTS "Authenticated can delete report attachments" ON storage.objects;
CREATE POLICY "Owner or elevated can delete report attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'reports-attachments'
    AND (
      owner = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hse_manager'::app_role)
    )
  );

-- 4. Storage: safety-observations — restrict anon uploads to public/ prefix
DROP POLICY IF EXISTS "safety-observations upload" ON storage.objects;
CREATE POLICY "safety-observations upload authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'safety-observations');
CREATE POLICY "safety-observations upload anon public prefix"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'safety-observations'
    AND name LIKE 'public/%'
  );

-- 5. toolbox_signatures: require signer identity match
DROP POLICY IF EXISTS "signatures insert (participant only)" ON public.toolbox_signatures;
CREATE POLICY "signatures insert (signer identity)"
  ON public.toolbox_signatures FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.toolbox_session_participants p
      WHERE p.session_id = toolbox_signatures.session_id
        AND p.employee_id = toolbox_signatures.employee_id
    )
    AND (
      signed_by_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = toolbox_signatures.employee_id
          AND e.user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hse_manager'::app_role)
    )
  );

-- 6. SECURITY DEFINER functions: revoke public/anon EXECUTE
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
