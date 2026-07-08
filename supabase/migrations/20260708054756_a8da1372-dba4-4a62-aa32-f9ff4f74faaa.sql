
DROP POLICY IF EXISTS "Authenticated can read basic profile info" ON public.profiles;

DROP FUNCTION IF EXISTS public.list_app_users();
CREATE FUNCTION public.list_app_users()
RETURNS TABLE(id uuid, full_name text, email text, function_title text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.email, p.function_title
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
  ORDER BY p.full_name NULLS LAST;
$function$;

REVOKE ALL ON FUNCTION public.list_app_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_app_users() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.can_access_risk_analysis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_risk_analysis(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sanitize_public_safety_observation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
