
-- 1) Rename enum value operator -> gebruiker
ALTER TYPE public.app_role RENAME VALUE 'operator' TO 'gebruiker';

-- 2) job_functions reference table (admin-managed dropdown)
CREATE TABLE public.job_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_functions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_functions TO authenticated;
GRANT ALL ON public.job_functions TO service_role;

ALTER TABLE public.job_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view job functions"
  ON public.job_functions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert job functions"
  ON public.job_functions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update job functions"
  ON public.job_functions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete job functions"
  ON public.job_functions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_job_functions_updated_at
  BEFORE UPDATE ON public.job_functions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default function
INSERT INTO public.job_functions (name) VALUES ('Brand- en veiligheidswacht')
ON CONFLICT (name) DO NOTHING;

-- Seed existing free-text function_titles from profiles + employees so admins have a full starting list
INSERT INTO public.job_functions (name)
SELECT DISTINCT btrim(function_title)
FROM (
  SELECT function_title FROM public.profiles WHERE function_title IS NOT NULL AND btrim(function_title) <> ''
  UNION
  SELECT function_title FROM public.employees WHERE function_title IS NOT NULL AND btrim(function_title) <> ''
) s
ON CONFLICT (name) DO NOTHING;

-- 3) profiles.function_titles (array) — multi-select
ALTER TABLE public.profiles
  ADD COLUMN function_titles text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Backfill from existing single value
UPDATE public.profiles
SET function_titles = ARRAY[function_title]
WHERE function_title IS NOT NULL AND btrim(function_title) <> '';

-- 4) Update handle_new_user: default role 'gebruiker' + default function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, function_title, function_titles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'Brand- en veiligheidswacht',
    ARRAY['Brand- en veiligheidswacht']
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'gebruiker');
  RETURN NEW;
END; $function$;
