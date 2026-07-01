
-- Add fields to support Monday sync
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employer text,
  ADD COLUMN IF NOT EXISTS monday_item_id bigint,
  ADD COLUMN IF NOT EXISTS monday_board_id bigint,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_unique
  ON public.employees (lower(email)) WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_monday_item_unique
  ON public.employees (monday_item_id) WHERE monday_item_id IS NOT NULL;

-- Log every incoming Monday webhook for traceability
CREATE TABLE IF NOT EXISTS public.monday_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  event_type text,
  monday_item_id bigint,
  monday_board_id bigint,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL,
  error text,
  payload jsonb NOT NULL
);

GRANT SELECT ON public.monday_sync_events TO authenticated;
GRANT ALL ON public.monday_sync_events TO service_role;

ALTER TABLE public.monday_sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HSE managers can view sync events"
  ON public.monday_sync_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
