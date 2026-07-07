-- Enum for analysis type
CREATE TYPE public.risk_analysis_type AS ENUM ('werkpost', 'tra', 'lmra', 'rie');
CREATE TYPE public.risk_analysis_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.risk_session_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.risk_sign_method AS ENUM ('kiosk', 'qr', 'login');
CREATE TYPE public.risk_measure_type AS ENUM ('technical', 'organizational', 'human');

-- 1) Risk analyses (library)
CREATE TABLE public.risk_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  analysis_type public.risk_analysis_type NOT NULL DEFAULT 'werkpost',
  workpost TEXT,
  department TEXT,
  status public.risk_analysis_status NOT NULL DEFAULT 'draft',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_analyses TO authenticated;
GRANT ALL ON public.risk_analyses TO service_role;
ALTER TABLE public.risk_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read risk analyses"
  ON public.risk_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "HSE/manager/admin can insert risk analyses"
  ON public.risk_analyses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "HSE/manager/admin can update risk analyses"
  ON public.risk_analyses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin can delete risk analyses"
  ON public.risk_analyses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_risk_analyses_updated_at
  BEFORE UPDATE ON public.risk_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Versions
CREATE TABLE public.risk_analysis_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.risk_analyses(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  change_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE (analysis_id, version_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_analysis_versions TO authenticated;
GRANT ALL ON public.risk_analysis_versions TO service_role;
ALTER TABLE public.risk_analysis_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read RA versions"
  ON public.risk_analysis_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "HSE/manager/admin can insert RA versions"
  ON public.risk_analysis_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "HSE/manager/admin can update RA versions"
  ON public.risk_analysis_versions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));

-- 3) Items (rows)
CREATE TABLE public.risk_analysis_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.risk_analysis_versions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  activity TEXT,
  hazard TEXT NOT NULL,
  risk_description TEXT,
  -- Fine & Kinney gross scores
  score_w NUMERIC(6,2),
  score_b NUMERIC(6,2),
  score_e NUMERIC(6,2),
  score_r NUMERIC(10,2),
  -- Measures
  measures TEXT,
  measure_types public.risk_measure_type[] NOT NULL DEFAULT '{}',
  -- Residual scores
  residual_w NUMERIC(6,2),
  residual_b NUMERIC(6,2),
  residual_e NUMERIC(6,2),
  residual_r NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ra_items_version ON public.risk_analysis_items(version_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_analysis_items TO authenticated;
GRANT ALL ON public.risk_analysis_items TO service_role;
ALTER TABLE public.risk_analysis_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read RA items"
  ON public.risk_analysis_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "HSE/manager/admin can insert RA items"
  ON public.risk_analysis_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "HSE/manager/admin can update RA items"
  ON public.risk_analysis_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "HSE/manager/admin can delete RA items"
  ON public.risk_analysis_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER trg_ra_items_updated_at
  BEFORE UPDATE ON public.risk_analysis_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Sessions
CREATE TABLE public.risk_analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.risk_analyses(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.risk_analysis_versions(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ,
  given_at TIMESTAMPTZ,
  location TEXT,
  given_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  given_by_name TEXT,
  notes TEXT,
  status public.risk_session_status NOT NULL DEFAULT 'planned',
  signing_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_analysis_sessions TO authenticated;
GRANT ALL ON public.risk_analysis_sessions TO service_role;
ALTER TABLE public.risk_analysis_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read RA sessions"
  ON public.risk_analysis_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "HSE/manager/admin can manage RA sessions"
  ON public.risk_analysis_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER trg_ra_sessions_updated_at
  BEFORE UPDATE ON public.risk_analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Session participants (invited employees)
CREATE TABLE public.risk_session_participants (
  session_id UUID NOT NULL REFERENCES public.risk_analysis_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_session_participants TO authenticated;
GRANT ALL ON public.risk_session_participants TO service_role;
ALTER TABLE public.risk_session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read RA participants"
  ON public.risk_session_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "HSE/manager/admin can manage RA participants"
  ON public.risk_session_participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));

-- 6) Signatures
CREATE TABLE public.risk_analysis_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.risk_analysis_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sign_method public.risk_sign_method NOT NULL DEFAULT 'kiosk',
  signed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (session_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_analysis_signatures TO authenticated;
GRANT ALL ON public.risk_analysis_signatures TO service_role;
-- public role needed for the QR sign-in flow via a server function using service_role or publishable key with narrow policy
ALTER TABLE public.risk_analysis_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read RA signatures"
  ON public.risk_analysis_signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own RA signature"
  ON public.risk_analysis_signatures FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "HSE/manager/admin can delete RA signatures"
  ON public.risk_analysis_signatures FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));