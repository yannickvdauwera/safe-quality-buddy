-- Enum types
CREATE TYPE public.report_type AS ENUM ('mos', 'stop', 'ao_ehbo', 'werkplekinspectie', 'kwaliteit', 'klacht', 'andere');
CREATE TYPE public.report_status AS ENUM ('open', 'in_behandeling', 'opgevolgd', 'gesloten');
CREATE TYPE public.report_severity AS ENUM ('laag', 'middel', 'hoog', 'kritiek');

CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.report_type NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  involved_firm text,
  severity public.report_severity NOT NULL DEFAULT 'middel',
  status public.report_status NOT NULL DEFAULT 'open',
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deadline date,
  follow_up_notes text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view reports"
  ON public.reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporter can update own open reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (auth.uid() = reporter_id AND status = 'open')
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Managers and HSE can update all reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hse_manager')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX idx_reports_assigned ON public.reports(assigned_to);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_type ON public.reports(type);
CREATE INDEX idx_reports_observed_at ON public.reports(observed_at DESC);