-- Worker support: atomic job claim + evaluation creation with usage limits
-- Run in Supabase Dashboard → SQL Editor after schema.sql

-- Claim the oldest pending evaluation (SKIP LOCKED for multi-worker safety)
CREATE OR REPLACE FUNCTION public.claim_evaluation()
RETURNS SETOF public.evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_id UUID;
BEGIN
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

REVOKE ALL ON FUNCTION public.claim_evaluation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation() TO service_role;

-- Create evaluation row and increment monthly upload counter (free tier: 5/month)
CREATE OR REPLACE FUNCTION public.create_evaluation_job(
  p_user_id UUID,
  p_title TEXT,
  p_original_filename TEXT,
  p_content_type TEXT,
  p_file_size_bytes INTEGER
)
RETURNS public.evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_month_key TEXT;
  v_upload_count INTEGER;
  v_evaluation_id UUID := gen_random_uuid();
  v_transcript_path TEXT;
  v_evaluation public.evaluations;
BEGIN
  SELECT plan INTO v_plan
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_month_key := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');

  IF v_plan = 'free' THEN
    SELECT upload_count INTO v_upload_count
    FROM public.usage_counters
    WHERE user_id = p_user_id AND month_key = v_month_key
    FOR UPDATE;

    IF v_upload_count IS NULL THEN
      INSERT INTO public.usage_counters (user_id, month_key, upload_count)
      VALUES (p_user_id, v_month_key, 0);
      v_upload_count := 0;
    END IF;

    IF v_upload_count >= 5 THEN
      RAISE EXCEPTION 'Monthly upload limit reached (5 per month on free plan)';
    END IF;
  END IF;

  v_transcript_path := p_user_id::text || '/' || v_evaluation_id::text || '/' || p_original_filename;

  INSERT INTO public.evaluations (
    id,
    user_id,
    title,
    original_filename,
    content_type,
    transcript_path,
    file_size_bytes,
    status
  )
  VALUES (
    v_evaluation_id,
    p_user_id,
    p_title,
    p_original_filename,
    p_content_type,
    v_transcript_path,
    p_file_size_bytes,
    'pending'
  )
  RETURNING * INTO v_evaluation;

  INSERT INTO public.usage_counters (user_id, month_key, upload_count)
  VALUES (p_user_id, v_month_key, 1)
  ON CONFLICT (user_id, month_key)
  DO UPDATE SET upload_count = public.usage_counters.upload_count + 1;

  RETURN v_evaluation;
END;
$$;

REVOKE ALL ON FUNCTION public.create_evaluation_job(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_evaluation_job(UUID, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- Reset jobs stuck in processing for over 30 minutes
CREATE OR REPLACE FUNCTION public.recover_stale_evaluations(stale_minutes INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recovered INTEGER;
BEGIN
  UPDATE public.evaluations
  SET status = 'pending', error_message = NULL
  WHERE status = 'processing'
    AND created_at < now() - (stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stale_evaluations(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_stale_evaluations(INTEGER) TO service_role;

-- Enable Realtime updates for evaluation status (dashboard live refresh)
ALTER TABLE public.evaluations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'evaluations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluations;
  END IF;
END $$;
