
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read basic profile info" ON public.profiles;
CREATE POLICY "Authenticated can read basic profile info"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);
