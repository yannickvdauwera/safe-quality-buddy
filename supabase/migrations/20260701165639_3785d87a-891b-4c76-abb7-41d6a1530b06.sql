
-- Enums
CREATE TYPE public.toolbox_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.toolbox_session_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.toolbox_sign_method AS ENUM ('kiosk', 'qr', 'login');

-- 1. Toolboxes (library)
CREATE TABLE public.toolboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status public.toolbox_status NOT NULL DEFAULT 'draft',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolboxes TO authenticated;
GRANT ALL ON public.toolboxes TO service_role;
ALTER TABLE public.toolboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "toolboxes read" ON public.toolboxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "toolboxes insert (hse/manager/admin)" ON public.toolboxes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "toolboxes update (hse/manager/admin)" ON public.toolboxes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "toolboxes delete (admin)" ON public.toolboxes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER toolboxes_updated_at BEFORE UPDATE ON public.toolboxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Toolbox versions
CREATE TABLE public.toolbox_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  toolbox_id UUID NOT NULL REFERENCES public.toolboxes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (toolbox_id, version_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_versions TO authenticated;
GRANT ALL ON public.toolbox_versions TO service_role;
ALTER TABLE public.toolbox_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "toolbox_versions read" ON public.toolbox_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "toolbox_versions write (hse/manager/admin)" ON public.toolbox_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'));

-- 3. Sessions
CREATE TABLE public.toolbox_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  toolbox_id UUID NOT NULL REFERENCES public.toolboxes(id) ON DELETE RESTRICT,
  version_id UUID NOT NULL REFERENCES public.toolbox_versions(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ,
  given_at TIMESTAMPTZ,
  location TEXT,
  given_by_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  notes TEXT,
  status public.toolbox_session_status NOT NULL DEFAULT 'planned',
  signing_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_sessions TO authenticated;
GRANT ALL ON public.toolbox_sessions TO service_role;
ALTER TABLE public.toolbox_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions read" ON public.toolbox_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions write (hse/manager/admin)" ON public.toolbox_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER toolbox_sessions_updated_at BEFORE UPDATE ON public.toolbox_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Session participants (invited list)
CREATE TABLE public.toolbox_session_participants (
  session_id UUID NOT NULL REFERENCES public.toolbox_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_session_participants TO authenticated;
GRANT ALL ON public.toolbox_session_participants TO service_role;
ALTER TABLE public.toolbox_session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read" ON public.toolbox_session_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "participants write (hse/manager/admin)" ON public.toolbox_session_participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager') OR public.has_role(auth.uid(),'manager'));

-- 5. Signatures
CREATE TABLE public.toolbox_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.toolbox_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  signature_data TEXT NOT NULL,
  sign_method public.toolbox_sign_method NOT NULL,
  signed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_signatures TO authenticated;
GRANT ALL ON public.toolbox_signatures TO service_role;
ALTER TABLE public.toolbox_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures read" ON public.toolbox_signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "signatures insert (auth)" ON public.toolbox_signatures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "signatures delete (hse/admin)" ON public.toolbox_signatures FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager'));
