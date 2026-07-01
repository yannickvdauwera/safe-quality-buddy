
CREATE TYPE public.safety_observation_type AS ENUM ('mos', 'stop');

CREATE TABLE public.safety_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.safety_observation_type NOT NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  reporter_function TEXT,
  observed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observed_time TIME,
  plant TEXT,
  area TEXT,
  location TEXT,
  involved_party TEXT,
  hazards TEXT[] NOT NULL DEFAULT '{}',
  risks TEXT[] NOT NULL DEFAULT '{}',
  situation_description TEXT,
  action_taken TEXT,
  improvement_proposal TEXT,
  company_action TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_observations TO authenticated;
GRANT ALL ON public.safety_observations TO service_role;

ALTER TABLE public.safety_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view all safety observations"
  ON public.safety_observations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create safety observations"
  ON public.safety_observations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Owner or manager/hse/admin can update"
  ON public.safety_observations FOR UPDATE TO authenticated
  USING (
    auth.uid() = reporter_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hse_manager')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin can delete"
  ON public.safety_observations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_safety_observations_updated_at
  BEFORE UPDATE ON public.safety_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
