-- Require workers to declare report format version when claiming jobs.
-- Old workers (version 0) stop receiving jobs after this migration.
-- Run in Supabase Dashboard → SQL Editor.

DROP FUNCTION IF EXISTS public.claim_evaluation();

CREATE OR REPLACE FUNCTION public.claim_evaluation(
  p_worker_format_version INTEGER DEFAULT 0
)
RETURNS SETOF public.evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_id UUID;
  min_version CONSTANT INTEGER := 2;
BEGIN
  IF p_worker_format_version < min_version THEN
    RETURN;
  END IF;

  SELECT id INTO claimed_id
  FROM public.evaluations
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.evaluations
  SET status = 'processing'
  WHERE id = claimed_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation(INTEGER) TO service_role;
