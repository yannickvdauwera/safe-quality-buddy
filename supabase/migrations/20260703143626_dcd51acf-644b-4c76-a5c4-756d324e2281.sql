-- Restrict reports SELECT to elevated roles or reporter/assigned user
DROP POLICY IF EXISTS "All authenticated can view reports" ON public.reports;

CREATE POLICY "Reports read elevated or own or assigned"
ON public.reports
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hse_manager'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR auth.uid() = reporter_id
  OR auth.uid() = assigned_to
);

-- Harden anon public-link inserts on safety_observations:
-- ensure that anonymous submissions cannot set privileged fields
-- (status, assignment-adjacent), and normalize to safe defaults.
CREATE OR REPLACE FUNCTION public.sanitize_public_safety_observation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_via = 'public' AND NEW.reporter_id IS NULL THEN
    -- Force safe defaults for public submissions
    NEW.status := 'open'::report_status;
    NEW.reporter_id := NULL;

    -- Length caps to prevent abuse / injection payload bloat
    IF length(coalesce(NEW.reporter_name, '')) > 200 THEN
      NEW.reporter_name := left(NEW.reporter_name, 200);
    END IF;
    IF length(coalesce(NEW.reporter_function, '')) > 200 THEN
      NEW.reporter_function := left(NEW.reporter_function, 200);
    END IF;
    IF length(coalesce(NEW.location, '')) > 500 THEN
      NEW.location := left(NEW.location, 500);
    END IF;
    IF length(coalesce(NEW.plant, '')) > 200 THEN
      NEW.plant := left(NEW.plant, 200);
    END IF;
    IF length(coalesce(NEW.area, '')) > 200 THEN
      NEW.area := left(NEW.area, 200);
    END IF;
    IF length(coalesce(NEW.involved_party, '')) > 500 THEN
      NEW.involved_party := left(NEW.involved_party, 500);
    END IF;
    IF length(coalesce(NEW.situation_description, '')) > 5000 THEN
      NEW.situation_description := left(NEW.situation_description, 5000);
    END IF;
    IF length(coalesce(NEW.action_taken, '')) > 5000 THEN
      NEW.action_taken := left(NEW.action_taken, 5000);
    END IF;
    IF length(coalesce(NEW.improvement_proposal, '')) > 5000 THEN
      NEW.improvement_proposal := left(NEW.improvement_proposal, 5000);
    END IF;
    IF length(coalesce(NEW.company_action, '')) > 5000 THEN
      NEW.company_action := left(NEW.company_action, 5000);
    END IF;

    -- Cap array sizes for hazards/risks
    IF array_length(NEW.hazards, 1) > 50 THEN
      NEW.hazards := NEW.hazards[1:50];
    END IF;
    IF array_length(NEW.risks, 1) > 50 THEN
      NEW.risks := NEW.risks[1:50];
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_public_safety_observation_trg ON public.safety_observations;
CREATE TRIGGER sanitize_public_safety_observation_trg
BEFORE INSERT ON public.safety_observations
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_public_safety_observation();