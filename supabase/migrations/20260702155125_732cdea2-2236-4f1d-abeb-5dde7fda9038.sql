
CREATE TABLE public.employee_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluator_name text NOT NULL,
  employee_name text NOT NULL,
  location text NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  evaluated_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX employee_evaluations_employee_idx ON public.employee_evaluations(employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_evaluations TO authenticated;
GRANT ALL ON public.employee_evaluations TO service_role;

ALTER TABLE public.employee_evaluations ENABLE ROW LEVEL SECURITY;

-- Elevated roles (admin, hse_manager, manager) can view all evaluations
CREATE POLICY "Elevated roles can view evaluations"
  ON public.employee_evaluations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hse_manager')
    OR public.has_role(auth.uid(), 'manager')
    OR evaluator_id = auth.uid()
  );

CREATE POLICY "Elevated roles can insert evaluations"
  ON public.employee_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hse_manager')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Elevated roles can update evaluations"
  ON public.employee_evaluations FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hse_manager')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admins can delete evaluations"
  ON public.employee_evaluations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_employee_evaluations_updated_at
  BEFORE UPDATE ON public.employee_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
