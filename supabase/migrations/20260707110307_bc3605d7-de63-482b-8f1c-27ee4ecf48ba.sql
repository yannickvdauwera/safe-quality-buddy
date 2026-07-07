
DROP POLICY IF EXISTS "Authenticated can view team profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.list_app_users()
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
  ORDER BY p.full_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_app_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_app_users() TO authenticated;
