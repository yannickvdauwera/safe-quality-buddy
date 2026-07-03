
CREATE TABLE public.form_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_type text NOT NULL,
  form_key text NOT NULL DEFAULT 'new',
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, form_type, form_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_drafts TO authenticated;
GRANT ALL ON public.form_drafts TO service_role;

ALTER TABLE public.form_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drafts"
  ON public.form_drafts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all drafts"
  ON public.form_drafts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete drafts"
  ON public.form_drafts
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_form_drafts_updated_at
  BEFORE UPDATE ON public.form_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX form_drafts_user_type_idx ON public.form_drafts (user_id, form_type, updated_at DESC);
