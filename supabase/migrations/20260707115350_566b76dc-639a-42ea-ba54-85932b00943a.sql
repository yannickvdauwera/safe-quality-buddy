
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS function_title text;

-- Backfill from employees table where a user is linked
UPDATE public.profiles p
SET function_title = e.function_title
FROM public.employees e
WHERE e.user_id = p.id
  AND e.function_title IS NOT NULL
  AND p.function_title IS NULL;
