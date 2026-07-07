
CREATE OR REPLACE FUNCTION public.can_access_risk_analysis(_analysis_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (SELECT 1 FROM public.risk_analyses ra WHERE ra.id = _analysis_id AND ra.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.risk_analysis_executors ex WHERE ex.analysis_id = _analysis_id AND ex.user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.risk_analysis_sessions s
      JOIN public.risk_session_participants p ON p.session_id = s.id
      JOIN public.employees e ON e.id = p.employee_id
      WHERE s.analysis_id = _analysis_id
        AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.risk_analysis_sessions s
      WHERE s.analysis_id = _analysis_id
        AND s.created_by = auth.uid()
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_risk_analysis(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated can read risk analyses" ON public.risk_analyses;
CREATE POLICY "Elevated or involved can read risk analyses"
  ON public.risk_analyses FOR SELECT TO authenticated
  USING (public.can_access_risk_analysis(id));

DROP POLICY IF EXISTS "Authenticated can read RA versions" ON public.risk_analysis_versions;
CREATE POLICY "Elevated or involved can read RA versions"
  ON public.risk_analysis_versions FOR SELECT TO authenticated
  USING (public.can_access_risk_analysis(analysis_id));

DROP POLICY IF EXISTS "Authenticated can read RA items" ON public.risk_analysis_items;
CREATE POLICY "Elevated or involved can read RA items"
  ON public.risk_analysis_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.risk_analysis_versions v
      WHERE v.id = risk_analysis_items.version_id
        AND public.can_access_risk_analysis(v.analysis_id)
    )
  );

DROP POLICY IF EXISTS "Authenticated can read RA sessions" ON public.risk_analysis_sessions;
CREATE POLICY "Elevated or involved can read RA sessions"
  ON public.risk_analysis_sessions FOR SELECT TO authenticated
  USING (public.can_access_risk_analysis(analysis_id));

DROP POLICY IF EXISTS "Authenticated can read RA participants" ON public.risk_session_participants;
CREATE POLICY "Elevated or involved can read RA participants"
  ON public.risk_session_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.risk_analysis_sessions s
      WHERE s.id = risk_session_participants.session_id
        AND public.can_access_risk_analysis(s.analysis_id)
    )
  );

DROP POLICY IF EXISTS "Authenticated can read RA signatures" ON public.risk_analysis_signatures;
CREATE POLICY "Elevated or involved can read RA signatures"
  ON public.risk_analysis_signatures FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR signed_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = risk_analysis_signatures.employee_id
        AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.risk_analysis_sessions s
      WHERE s.id = risk_analysis_signatures.session_id
        AND public.can_access_risk_analysis(s.analysis_id)
    )
  );

DROP POLICY IF EXISTS "Authenticated can read RA executors" ON public.risk_analysis_executors;
CREATE POLICY "Elevated or involved can read RA executors"
  ON public.risk_analysis_executors FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR user_id = auth.uid()
    OR public.can_access_risk_analysis(analysis_id)
  );

DROP POLICY IF EXISTS "toolboxes read" ON public.toolboxes;
CREATE POLICY "toolboxes read elevated or involved"
  ON public.toolboxes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.toolbox_sessions s
      JOIN public.toolbox_session_participants p ON p.session_id = s.id
      JOIN public.employees e ON e.id = p.employee_id
      WHERE s.toolbox_id = toolboxes.id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "toolbox_versions read" ON public.toolbox_versions;
CREATE POLICY "toolbox_versions read elevated or involved"
  ON public.toolbox_versions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.toolboxes t
      WHERE t.id = toolbox_versions.toolbox_id
        AND (
          t.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.toolbox_sessions s
            JOIN public.toolbox_session_participants p ON p.session_id = s.id
            JOIN public.employees e ON e.id = p.employee_id
            WHERE s.toolbox_id = t.id
              AND e.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "safety-observations upload anon public prefix" ON storage.objects;
CREATE POLICY "safety-observations upload anon public prefix"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'safety-observations'
    AND name ~ '^public/(hazard|near-miss|nearmiss|positive|observation|incident|onveilige_situatie|onveilige-situatie)/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$'
  );
